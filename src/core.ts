import type {
  LimbicDB,
  LimbicDBConfig,
  Memory,
  RememberOptions,
  RecallOptions,
  RecallResult,
  RecallMode,
  ForgetFilter,
  HistoryOptions,
  LimbicDBStats,
  TimelineEvent,
  DecayConfig,
  Embedder
} from './types'
import { classifyMemory, extractTags } from './classify'
import { computeStrength, predictExpiry, suggestReviewTime } from './decay'
import { parseTime } from './time'
import { generateId, generateShortId } from './utils/id'
import { EmbeddingStore, cosineSimilarity, type EmbeddingRow } from './embedding-store'

const DEFAULT_DECAY_CONFIG = {
  enabled: true,
  halfLifeHours: 168,  // 7 days
  recallBoost: 1.4,
  maxStrength: 1.0,
  pruneThreshold: 0.01,
  pruneIntervalMinutes: 60,
} as const

const DEFAULT_LIMITS = {
  maxMemories: 10000,
  maxStateKeys: 1000,
  maxSnapshots: 100,
  maxDbSize: '500MB',
} as const

interface StoredMemory extends Memory {
  baseStrength: number
  expiresAt?: number
  reviewAt?: number
  isDeleted: boolean
}

export class LimbicDBImpl implements LimbicDB {
  private config: Required<LimbicDBConfig>
  
  // In-memory storage (MVP - will be replaced with SQLite)
  private memories = new Map<string, StoredMemory>()
  private state = new Map<string, any>()
  private timeline: TimelineEvent[] = []
  private snapshots = new Map<string, { data: any; createdAt: number }>()
  
  // Embedding support
  private embedder?: Embedder
  private embeddingStore?: EmbeddingStore
  private pendingEmbeddings = 0
  
  private _stats: LimbicDBStats = {
    memoryCount: 0,
    stateKeyCount: 0,
    snapshotCount: 0,
    dbSizeBytes: 0,
  }
  
  constructor(config: Required<LimbicDBConfig>) {
    this.config = config
    
    // Initialize embedder if provided
    this.embedder = config.embedder
    if (this.embedder) {
      this.embeddingStore = new EmbeddingStore({ type: 'memory' })
      // Note: initialize() is async, but constructor can't be async
      // We'll initialize lazily when needed
    }
    
    this.updateStats()
  }
  
  private async ensureEmbeddingStoreInitialized(): Promise<void> {
    if (this.embeddingStore) {
      // EmbeddingStore.initialize() is idempotent
      await this.embeddingStore.initialize()
    }
  }
  
  private async computeEmbeddingAsync(memoryId: string, content: string): Promise<void> {
    if (!this.embedder || !this.embeddingStore) return
    
    try {
      await this.ensureEmbeddingStoreInitialized()
      const vector = await this.embedder.embed(content)
      await this.embeddingStore.store(memoryId, vector, this.embedder.modelHint || 'user-provided')
    } catch (err) {
      // Log but don't throw. Memory is saved, embedding is best-effort.
      if (typeof console !== 'undefined') {
        console.warn(`[limbicdb] Embedding failed for memory ${memoryId}:`, 
          err instanceof Error ? err.message : err)
      }
    } finally {
      this.pendingEmbeddings--
    }
  }
  
  private async updateStats() {
    const stats: LimbicDBStats = {
      memoryCount: this.memories.size,
      stateKeyCount: this.state.size,
      snapshotCount: this.snapshots.size,
      dbSizeBytes: 0, // Not applicable for in-memory
    }
    
    const oldestAge = this.getOldestMemoryAge()
    const newestAge = this.getNewestMemoryAge()
    
    if (oldestAge !== undefined) {
      stats.oldestMemoryAge = oldestAge
    }
    if (newestAge !== undefined) {
      stats.newestMemoryAge = newestAge
    }
    
    // Add embedding statistics if embedder is available
    if (this.embeddingStore) {
      try {
        await this.ensureEmbeddingStoreInitialized()
        stats.embeddingsCount = await this.embeddingStore.count()
        if (this.embedder) {
          stats.embeddingsDimensions = this.embedder.dimensions
        }
      } catch (err) {
        // Silently fail - stats will not include embedding info
      }
    }
    
    this._stats = stats
  }
  
  private getOldestMemoryAge(): number | undefined {
    let oldest: number | undefined
    for (const mem of this.memories.values()) {
      if (!oldest || mem.createdAt < oldest) {
        oldest = mem.createdAt
      }
    }
    return oldest ? Date.now() - oldest : undefined
  }
  
  private getNewestMemoryAge(): number | undefined {
    let newest: number | undefined
    for (const mem of this.memories.values()) {
      if (!newest || mem.createdAt > newest) {
        newest = mem.createdAt
      }
    }
    return newest ? Date.now() - newest : undefined
  }
  
  private recordTimelineEvent(
    type: TimelineEvent['type'],
    action: TimelineEvent['action'],
    refKey?: string,
    content?: string,
    timestamp?: number
  ) {
    const event: Omit<TimelineEvent, 'timestamp'> & { timestamp: number } = {
      id: generateId(),
      type,
      action,
      timestamp: timestamp ?? Date.now(),
    }
    
    if (refKey !== undefined) {
      (event as TimelineEvent).refKey = refKey
    }
    if (content !== undefined) {
      (event as TimelineEvent).content = content.substring(0, 200) // Truncate for timeline
    }
    this.timeline.push(event)
    
    // Keep timeline bounded
    if (this.timeline.length > 10000) {
      this.timeline = this.timeline.slice(-5000)
    }
  }
  
  async remember(content: string, options?: RememberOptions): Promise<Memory> {
    const now = Date.now()
    const id = generateId()
    const kind = options?.kind || classifyMemory(content)
    const tags = options?.tags || extractTags(content)
    const baseStrength = options?.strength ?? options?.baseStrength ?? 0.5
    
    // Compute initial strength
    const initialStrength = computeStrength(
      baseStrength,
      now,
      now,
      0,
      this.config.decay as DecayConfig,
      now
    )
    
    const memory: StoredMemory = {
      id,
      content,
      kind,
      tags,
      meta: options?.meta || {},
      strength: initialStrength,
      baseStrength,
      createdAt: now,
      accessedAt: now,
      accessCount: 0,
      expiresAt: predictExpiry(baseStrength, now, now, 0, this.config.decay as DecayConfig),
      reviewAt: suggestReviewTime(baseStrength, now, now, 0, this.config.decay as DecayConfig),
      isDeleted: false,
    }
    
    this.memories.set(id, memory)
    this.updateStats()
    this.recordTimelineEvent('memory', 'create', id, content)
    
    // Async embedding (fire-and-forget)
    if (this.embedder && this.embeddingStore) {
      this.pendingEmbeddings++
      this.computeEmbeddingAsync(id, content).catch(() => {
        // Error already logged in computeEmbeddingAsync
      })
    }
    
    return this.toPublicMemory(memory)
  }
  
  async recall(query: string, options?: RecallOptions): Promise<RecallResult> {
    const startTime = Date.now()
    const requestedMode = options?.mode || 'keyword'
    
    // Determine actual mode based on embedder availability
    const executedMode: RecallMode = this.determineActualMode(requestedMode)
    const fallback = (requestedMode === 'semantic' || requestedMode === 'hybrid') && executedMode === 'keyword'
    
    let memories: Memory[] = []
    let embedMs = 0
    
    if (executedMode === 'keyword') {
      memories = await this.executeKeywordRecall(query, options)
    } else if (executedMode === 'semantic') {
      const result = await this.executeSemanticRecall(query, options)
      memories = result.memories
      embedMs = result.embedMs
    } else if (executedMode === 'hybrid') {
      const result = await this.executeHybridRecall(query, options)
      memories = result.memories
      embedMs = result.embedMs
    }
    
    const searchMs = Date.now() - startTime
    
    // Record access event
    this.recordTimelineEvent('memory', 'access', undefined, `Recalled: "${query.substring(0, 50)}" (${executedMode})`)
    
    return {
      memories,
      meta: {
        requestedMode,
        executedMode,
        mode: executedMode, // Alias for backward compatibility
        fallback,
        pendingEmbeddings: this.pendingEmbeddings,
        timing: {
          searchMs,
          embedMs
        }
      }
    }
  }
  
  private determineActualMode(requestedMode: RecallMode): RecallMode {
    switch (requestedMode) {
      case 'keyword':
        return 'keyword'
      case 'semantic':
      case 'hybrid':
        // Check if embedder is available
        if (!this.embedder || !this.embeddingStore) {
          return 'keyword' // fallback
        }
        return requestedMode
      default:
        return 'keyword'
    }
  }
  
  private async executeKeywordRecall(
    query: string,
    options?: RecallOptions
  ): Promise<Memory[]> {
    const now = Date.now()
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const kindFilter = options?.kind
    const tagsFilter = options?.tags
    const sinceFilter = options?.since ? parseTime(options.since) : undefined
    
    const results: StoredMemory[] = []
    
    for (const memory of this.memories.values()) {
      if (memory.isDeleted) continue
      
      // Check strength
      if (memory.strength < minStrength) continue
      
      // Check kind filter
      if (kindFilter) {
        const kinds = Array.isArray(kindFilter) ? kindFilter : [kindFilter]
        if (!kinds.includes(memory.kind)) continue
      }
      
      // Check tags filter - must contain ALL specified tags
      if (tagsFilter && tagsFilter.length > 0) {
        const hasAllTags = tagsFilter.every(tag => memory.tags.includes(tag))
        if (!hasAllTags) continue
      }
      
      // Check time filter
      if (sinceFilter && memory.createdAt < sinceFilter) continue
      
      // Simple content matching (case-insensitive)
      if (memory.content.toLowerCase().includes(query.toLowerCase())) {
        // Update access stats
        memory.accessCount++
        memory.accessedAt = now
        memory.strength = computeStrength(
          memory.baseStrength,
          memory.createdAt,
          now,
          memory.accessCount,
          this.config.decay as DecayConfig,
          now
        )
        
        results.push(memory)
        
        if (results.length >= limit * 2) break // Get extra for sorting
      }
    }
    
    // Sort by strength (descending) and recency
    results.sort((a, b) => {
      if (Math.abs(b.strength - a.strength) > 0.05) {
        return b.strength - a.strength
      }
      return b.accessedAt - a.accessedAt
    })
    
    // Apply limit and convert to public format
    return results.slice(0, limit).map(mem => this.toPublicMemory(mem))
  }
  
  private async executeSemanticRecall(
    query: string,
    options?: RecallOptions
  ): Promise<{ memories: Memory[]; embedMs: number }> {
    const embedStartTime = Date.now()
    
    // Compute query embedding
    const queryVector = await this.embedder!.embed(query)
    const embedMs = Date.now() - embedStartTime
    
    const now = Date.now()
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const kindFilter = options?.kind
    const tagsFilter = options?.tags
    const sinceFilter = options?.since ? parseTime(options.since) : undefined
    
    // Get all available embeddings
    await this.ensureEmbeddingStoreInitialized()
    const embeddingRows = await this.embeddingStore!.getAllForSearch([])
    
    // Filter by memory-level criteria first
    const candidateMemoryIds = new Set<string>()
    for (const memory of this.memories.values()) {
      if (memory.isDeleted) continue
      if (memory.strength < minStrength) continue
      
      if (kindFilter) {
        const kinds = Array.isArray(kindFilter) ? kindFilter : [kindFilter]
        if (!kinds.includes(memory.kind)) continue
      }
      
      if (tagsFilter && tagsFilter.length > 0) {
        const hasAllTags = tagsFilter.every(tag => memory.tags.includes(tag))
        if (!hasAllTags) continue
      }
      
      if (sinceFilter && memory.createdAt < sinceFilter) continue
      
      candidateMemoryIds.add(memory.id)
    }
    
    // Filter embeddings to only include candidates
    const candidateEmbeddings = embeddingRows.filter(row => candidateMemoryIds.has(row.memoryId))
    
    // Compute similarities
    const similarities: Array<{ memoryId: string; similarity: number }> = []
    for (const row of candidateEmbeddings) {
      // Check vector dimension compatibility
      if (row.vector.length !== queryVector.length) {
        // This shouldn't happen if using same embedder, but just in case
        continue
      }
      
      const similarity = cosineSimilarity(row.vector, queryVector)
      if (similarity > 0) { // Only include positive similarities
        similarities.push({
          memoryId: row.memoryId,
          similarity
        })
      }
    }
    
    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity)
    
    // Get memories and update access stats
    const results: Memory[] = []
    for (const item of similarities.slice(0, limit)) {
      const memory = this.memories.get(item.memoryId)
      if (!memory) continue
      
      // Update access stats
      memory.accessCount++
      memory.accessedAt = now
      memory.strength = computeStrength(
        memory.baseStrength,
        memory.createdAt,
        now,
        memory.accessCount,
        this.config.decay as DecayConfig,
        now
      )
      
      results.push(this.toPublicMemory(memory))
    }
    
    return { memories: results, embedMs }
  }
  
  private async executeHybridRecall(
    query: string,
    options?: RecallOptions
  ): Promise<{ memories: Memory[]; embedMs: number }> {
    const embedStartTime = Date.now()
    
    // Compute query embedding
    const queryVector = await this.embedder!.embed(query)
    const embedMs = Date.now() - embedStartTime
    
    const now = Date.now()
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const kindFilter = options?.kind
    const tagsFilter = options?.tags
    const sinceFilter = options?.since ? parseTime(options.since) : undefined
    
    // Get all available embeddings
    await this.ensureEmbeddingStoreInitialized()
    const embeddingRows = await this.embeddingStore!.getAllForSearch([])
    
    // Filter by memory-level criteria
    const candidateMemoryIds = new Set<string>()
    const candidateMemories: StoredMemory[] = []
    
    for (const memory of this.memories.values()) {
      if (memory.isDeleted) continue
      if (memory.strength < minStrength) continue
      
      if (kindFilter) {
        const kinds = Array.isArray(kindFilter) ? kindFilter : [kindFilter]
        if (!kinds.includes(memory.kind)) continue
      }
      
      if (tagsFilter && tagsFilter.length > 0) {
        const hasAllTags = tagsFilter.every(tag => memory.tags.includes(tag))
        if (!hasAllTags) continue
      }
      
      if (sinceFilter && memory.createdAt < sinceFilter) continue
      
      candidateMemoryIds.add(memory.id)
      candidateMemories.push(memory)
    }
    
    // Compute keyword scores (simple presence)
    const keywordScores = new Map<string, number>()
    const queryLower = query.toLowerCase()
    
    for (const memory of candidateMemories) {
      let score = 0
      if (memory.content.toLowerCase().includes(queryLower)) {
        score = 1.0 // Exact match
      } else {
        // Partial matching (simplified)
        const words = queryLower.split(/\s+/).filter(w => w.length > 2)
        const contentLower = memory.content.toLowerCase()
        const matchedWords = words.filter(w => contentLower.includes(w)).length
        score = matchedWords / Math.max(1, words.length)
      }
      keywordScores.set(memory.id, score)
    }
    
    // Compute semantic similarities
    const semanticScores = new Map<string, number>()
    const candidateEmbeddings = embeddingRows.filter(row => candidateMemoryIds.has(row.memoryId))
    
    for (const row of candidateEmbeddings) {
      if (row.vector.length !== queryVector.length) continue
      
      const similarity = cosineSimilarity(row.vector, queryVector)
      // Normalize to 0-1 range (cosine similarity is -1 to 1)
      const normalized = (similarity + 1) / 2
      semanticScores.set(row.memoryId, normalized)
    }
    
    // Combine scores (70% semantic, 30% keyword)
    const combinedScores = new Map<string, number>()
    
    for (const memoryId of candidateMemoryIds) {
      const keywordScore = keywordScores.get(memoryId) || 0
      const semanticScore = semanticScores.get(memoryId) || 0
      
      // Hardcoded weights as per design
      const combined = (semanticScore * 0.7) + (keywordScore * 0.3)
      combinedScores.set(memoryId, combined)
    }
    
    // Sort by combined score
    const sortedMemoryIds = Array.from(candidateMemoryIds).sort((a, b) => {
      return (combinedScores.get(b) || 0) - (combinedScores.get(a) || 0)
    })
    
    // Get top results and update access stats
    const results: Memory[] = []
    for (const memoryId of sortedMemoryIds.slice(0, limit)) {
      const memory = this.memories.get(memoryId)
      if (!memory) continue
      
      // Update access stats
      memory.accessCount++
      memory.accessedAt = now
      memory.strength = computeStrength(
        memory.baseStrength,
        memory.createdAt,
        now,
        memory.accessCount,
        this.config.decay as DecayConfig,
        now
      )
      
      results.push(this.toPublicMemory(memory))
    }
    
    return { memories: results, embedMs }
  }
  
  // Legacy method for backward compatibility
  async recallLegacy(query: string, options?: RecallOptions): Promise<Memory[]> {
    const result = await this.recall(query, options)
    return result.memories
  }
  
  async forget(filter: ForgetFilter): Promise<number> {
    // Safety: require at least one filter
    if (!filter.ids && !filter.kind && !filter.tags && !filter.before && filter.maxStrength === undefined) {
      throw new Error('Forget requires at least one filter (safety guard)')
    }
    
    const beforeTime = filter.before ? parseTime(filter.before) : undefined
    let count = 0
    
    for (const [id, memory] of this.memories.entries()) {
      if (memory.isDeleted) continue
      
      // Check filters
      if (filter.ids && !filter.ids.includes(id)) continue
      if (filter.kind) {
        const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind]
        if (!kinds.includes(memory.kind)) continue
      }
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => memory.tags.includes(tag))
        if (!hasAllTags) continue
      }
      if (beforeTime && memory.createdAt >= beforeTime) continue
      if (filter.maxStrength !== undefined && memory.strength > filter.maxStrength) continue
      
      // Soft delete
      memory.isDeleted = true
      count++
      
      // Also delete embedding if exists
      if (this.embeddingStore) {
        try {
          await this.embeddingStore.delete(id)
        } catch (err) {
          // Log but continue
          if (typeof console !== 'undefined') {
            console.warn(`[limbicdb] Failed to delete embedding for ${id}:`, 
              err instanceof Error ? err.message : err)
          }
        }
      }
      
      this.recordTimelineEvent('memory', 'delete', id, memory.content.substring(0, 100))
    }
    
    this.updateStats()
    return count
  }
  
  async get<T = any>(key: string): Promise<T | null> {
    const value = this.state.get(key)
    return value ? JSON.parse(value) : null
  }
  
  async set<T = any>(key: string, value: T): Promise<void> {
    const now = Date.now()
    const serialized = JSON.stringify(value)
    const existed = this.state.has(key)
    
    this.state.set(key, serialized)
    this.updateStats()
    
    this.recordTimelineEvent(
      'state',
      existed ? 'update' : 'create',
      key,
      `Set ${key}: ${typeof value}`,
      now
    )
  }
  
  async delete(key: string): Promise<boolean> {
    const existed = this.state.delete(key)
    if (existed) {
      this.updateStats()
      this.recordTimelineEvent('state', 'delete', key, `Deleted ${key}`)
    }
    return existed
  }
  
  async history(options?: HistoryOptions): Promise<TimelineEvent[]> {
    let events = this.timeline
    
    // Apply filters
    if (options?.since) {
      const since = parseTime(options.since)
      events = events.filter(e => e.timestamp >= since)
    }
    
    if (options?.until) {
      const until = parseTime(options.until)
      events = events.filter(e => e.timestamp <= until)
    }
    
    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type]
      events = events.filter(e => types.includes(e.type))
    }
    
    // Sort by timestamp (descending)
    events.sort((a, b) => b.timestamp - a.timestamp)
    
    // Apply limit
    if (options?.limit) {
      events = events.slice(0, options.limit)
    }
    
    return events
  }
  
  async snapshot(): Promise<string> {
    const id = generateShortId()
    const now = Date.now()
    
    // Collect embeddings if available
    let embeddings: EmbeddingRow[] = []
    if (this.embeddingStore) {
      try {
        await this.ensureEmbeddingStoreInitialized()
        embeddings = await this.embeddingStore.getAll()
      } catch (err) {
        // Silently fail - snapshot will still work without embeddings
      }
    }
    
    const snapshotData = {
      memories: Array.from(this.memories.entries()),
      state: Array.from(this.state.entries()),
      timeline: this.timeline,
      embeddings,
      createdAt: now,
    }
    
    this.snapshots.set(id, {
      data: snapshotData,
      createdAt: now,
    })
    
    this.updateStats()
    this.recordTimelineEvent('snapshot', 'create', id, `Snapshot ${id}`)
    
    return id
  }
  
  async restore(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }
    
    // Clear current state
    this.memories.clear()
    this.state.clear()
    this.timeline = []
    if (this.embeddingStore) {
      await this.embeddingStore.clear()
    }
    
    // Restore from snapshot
    const { memories, state, timeline, embeddings } = snapshot.data
    for (const [id, memory] of memories) {
      this.memories.set(id, memory as StoredMemory)
    }
    for (const [key, value] of state) {
      this.state.set(key, value)
    }
    this.timeline = timeline
    
    // Restore embeddings if available
    if (embeddings && this.embeddingStore) {
      try {
        await this.ensureEmbeddingStoreInitialized()
        for (const embedding of embeddings) {
          await this.embeddingStore.store(
            embedding.memoryId,
            embedding.vector,
            embedding.modelHint
          )
        }
      } catch (err) {
        // Log but continue
        if (typeof console !== 'undefined') {
          console.warn('[limbicdb] Failed to restore embeddings from snapshot:', 
            err instanceof Error ? err.message : err)
        }
      }
    }
    
    this.updateStats()
    this.recordTimelineEvent('snapshot', 'access', snapshotId, `Restored snapshot ${snapshotId}`)
  }
  
  async close(): Promise<void> {
    // Nothing to close in memory mode
    console.log('LimbicDB (memory mode) closed')
  }
  
  get stats(): LimbicDBStats {
    return { ...this._stats }
  }
  
  private toPublicMemory(memory: StoredMemory): Memory {
    // Return public-facing memory object (without internal fields)
    const { expiresAt, reviewAt, isDeleted, baseStrength, ...publicMemory } = memory
    return publicMemory
  }
  
  // Helper method for testing/development
  // private pruneExpiredMemories(): number {
  //   if (!this.config.decay.enabled) return 0
  //   
  //   const now = Date.now()
  //   let pruned = 0
  //   
  //   for (const [id, memory] of this.memories.entries()) {
  //     if (memory.isDeleted) continue
  //     
  //     const shouldPruneMem = shouldPrune(
  //       memory.baseStrength,
  //       memory.createdAt,
  //       memory.accessedAt,
  //       memory.accessCount,
  //       this.config.decay as any,
  //       now
  //     )
  //     
  //     if (shouldPruneMem) {
  //       memory.isDeleted = true
  //       pruned++
  //       this.recordTimelineEvent('memory', 'delete', id, 'Auto-pruned (decayed)')
  //     }
  //   }
  //   
  //   if (pruned > 0) {
  //     this.updateStats()
  //   }
  //   
  //   return pruned
  // }
}

// Factory function
export function open(pathOrConfig: string | LimbicDBConfig): LimbicDB {
  const baseConfig = typeof pathOrConfig === 'string'
    ? { path: pathOrConfig }
    : pathOrConfig
  
  const config = {
    path: baseConfig.path,
    embedder: baseConfig.embedder,
    decay: { ...DEFAULT_DECAY_CONFIG, ...baseConfig.decay } as DecayConfig,
    limits: { ...DEFAULT_LIMITS, ...baseConfig.limits },
  } as Required<LimbicDBConfig>
  
  return new LimbicDBImpl(config)
}