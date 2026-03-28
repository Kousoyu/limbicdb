/**
 * LimbicDB SQLite Implementation
 * 
 * Production-ready embedded cognitive memory database with SQLite storage.
 */

import { SQLiteStore } from './storage/sqlite-store'
import { EmbeddingStore, cosineSimilarity, type EmbeddingRow } from './embedding-store'
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
  Embedder,
  DecayConfig
} from './types'
import { classifyMemory, extractTags } from './classify'
import { computeStrength } from './decay'
import { parseTime } from './time'
import { generateId, generateShortId } from './utils/id'

// Minimal types for SQLite adapter boundary
type SQLiteAdapter = {
  exec(sql: string): void
  run(sql: string, ...params: any[]): { changes?: number; lastInsertRowid?: number }
  get<T = any>(sql: string, ...params: any[]): T | undefined
  all<T = any>(sql: string, ...params: any[]): T[]
}

type RawSqliteDbLike = {
  exec?(sql: string): void
  prepare(sql: string): {
    run(...params: any[]): { changes?: number; lastInsertRowid?: number }
    get<T = any>(...params: any[]): T | undefined
    all<T = any>(...params: any[]): T[]
  }
}

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  enabled: true,
  halfLifeHours: 168,  // 7 days
  recallBoost: 1.4,
  maxStrength: 1.0,
  pruneThreshold: 0.01,
  pruneIntervalMinutes: 60,
}

const DEFAULT_LIMITS = {
  maxMemories: 10000,
  maxStateKeys: 1000,
  maxSnapshots: 100,
  maxDbSize: '500MB',
} as const

export class LimbicDBSQLite implements LimbicDB {
  private config: Required<LimbicDBConfig>
  private store: SQLiteStore
  private _embedder?: Embedder
  private _embeddingStore?: EmbeddingStore
  private _pendingEmbeddings = 0
  private _pruneIntervalId: NodeJS.Timeout | null = null
  private _statsCache: LimbicDBStats = {
    memoryCount: 0,
    stateKeyCount: 0,
    snapshotCount: 0,
    dbSizeBytes: 0
  }

  
  constructor(config: Required<LimbicDBConfig>) {
    this.config = config
    this.store = new SQLiteStore(config.path)
    this._embedder = config.embedder
    
    // Initialize embedding store if embedder is provided
    if (this._embedder) {
      // Get database connection from store
      const rawDb = (this.store as any).getRawDb?.() as RawSqliteDbLike | undefined
      // Debug logging removed for production
      if (rawDb) {
        // Create adapter for better-sqlite3 Database
        // better-sqlite3 Database has .prepare() method, Statement has .run(), .get(), .all()
        // Database also has .exec() for DDL
        const dbAdapter: SQLiteAdapter = {
          exec(sql: string) {
            if (typeof rawDb.exec === 'function') {
              rawDb.exec(sql)
            } else {
              // Fallback: use prepare for single statement
              rawDb.prepare(sql).run()
            }
          },
          run(sql: string, ...params: any[]) {
            return rawDb.prepare(sql).run(...params)
          },
          get(sql: string, ...params: any[]) {
            return rawDb.prepare(sql).get(...params)
          },
          all(sql: string, ...params: any[]) {
            return rawDb.prepare(sql).all(...params)
          }
        }
        this._embeddingStore = new EmbeddingStore({ type: 'sqlite', db: dbAdapter })
        // EmbeddingStore initialized with adapter
      } else {
        // No db connection available for EmbeddingStore
      }
    }
    
    // Start automatic pruning if enabled
    if (this.config.decay!.enabled) {
      this.startAutoPrune()
    }
    
    // Initial stats update
    this.updateStatsCache()
  }
  
  private async updateStatsCache(): Promise<void> {
    try {
      const storeStats = await this.store.getStats()
      this._statsCache = {
        memoryCount: storeStats.memoryCount,
        stateKeyCount: storeStats.stateKeyCount,
        snapshotCount: storeStats.snapshotCount,
        dbSizeBytes: storeStats.dbSizeBytes
      }
      
      // Add embedding statistics if available
      if (this._embeddingStore) {
        try {
          this._statsCache.embeddingsCount = await this._embeddingStore.count()
          if (this._embedder) {
            this._statsCache.embeddingsDimensions = this._embedder.dimensions
          }
        } catch (err) {
          // Silently fail - stats will not include embedding info
        }
      }
    } catch (error) {
      // Silently fail - stats will remain at default values
      console.warn('Failed to update stats cache:', error)
    }
  }
  
  private async ensureEmbeddingStoreInitialized(): Promise<void> {
    if (this._embeddingStore) {
      await this._embeddingStore.initialize()
    }
  }
  
  private async computeEmbeddingAsync(memoryId: string, content: string): Promise<void> {
    if (!this._embedder || !this._embeddingStore) return
    
    try {
      await this.ensureEmbeddingStoreInitialized()
      const vector = await this._embedder.embed(content)
      await this._embeddingStore.store(memoryId, vector, this._embedder.modelHint || 'user-provided')
    } catch (err) {
      // Log but don't throw. Memory is saved, embedding is best-effort.
      if (typeof console !== 'undefined') {
        console.warn(`[limbicdb] Embedding failed for memory ${memoryId}:`, 
          err instanceof Error ? err.message : err)
      }
    } finally {
      this._pendingEmbeddings--
    }
  }
  
  private startAutoPrune(): void {
    const decay = this.config.decay as DecayConfig
    const intervalMs = decay.pruneIntervalMinutes * 60 * 1000
    this._pruneIntervalId = setInterval(() => this.autoPrune(), intervalMs)
  }
  
  private async autoPrune(): Promise<void> {
    const decay = this.config.decay as DecayConfig
    if (!decay.enabled) return
    
    const threshold = decay.pruneThreshold
    const beforeTime = Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
    const pruned = await this.store.pruneWeakMemories(threshold, beforeTime)
    
    if (pruned > 0) {
      await this.store.logEvent({
        id: generateId(),
        type: 'memory',
        action: 'delete',
        content: `Auto-pruned ${pruned} weak memories`,
        timestamp: Date.now()
      })
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
    
    const memory: Memory = {
      id,
      content,
      kind,
      tags,
      meta: options?.meta || {},
      strength: initialStrength,
      baseStrength,
      createdAt: now,
      accessedAt: now,
      accessCount: 0
    }
    
    // Save to SQLite
    await this.store.saveMemory(memory)
    
    // Log timeline event
    await this.store.logEvent({
      id: generateId(),
      type: 'memory',
      action: 'create',
      refKey: id,
      content: `Remembered [${kind}]: ${content.substring(0, 80)}`,
      timestamp: now
    })
    
    // Update stats cache in background
    this.updateStatsCache().catch(() => { /* ignore */ })
    
    // Async embedding (fire-and-forget)
    if (this._embedder && this._embeddingStore) {
      this._pendingEmbeddings++
      this.computeEmbeddingAsync(id, content).catch(() => {
        // Error already logged in computeEmbeddingAsync
      })
    }
    
    return memory
  }
  
  async recall(query: string, options?: RecallOptions): Promise<RecallResult> {
    const startTime = Date.now()
    const requestedMode = options?.mode || 'keyword'
    
    // Determine what mode can actually be executed
    const executedMode: RecallMode = this.determineActualMode(requestedMode)
    
    // Check if we need to fallback due to missing embeddings
    let finalExecutedMode = executedMode
    let fallback = false
    
    if (executedMode === 'semantic' || executedMode === 'hybrid') {
      // Verify we actually have embeddings
      const hasEmbeds = await this.hasEmbeddings()
      if (!hasEmbeds) {
        finalExecutedMode = 'keyword'
        fallback = true
        console.warn('[limbicdb] SQLite backend: No embeddings found, falling back to keyword search')
      }
    } else if (requestedMode === 'semantic' || requestedMode === 'hybrid') {
      // Requested semantic/hybrid but determined mode is keyword
      fallback = true
    }
    
    // Log warning if user requested semantic/hybrid but we're falling back
    if (fallback) {
      console.warn(`[limbicdb] SQLite backend: ${requestedMode} search not available, falling back to keyword`)
    }
    
    let memories: Memory[] = []
    let embedMs = 0
    
    // Execute appropriate recall based on mode
    if (finalExecutedMode === 'keyword') {
      memories = await this.executeKeywordRecall(query, options, startTime)
    } else if (finalExecutedMode === 'semantic') {
      const result = await this.executeSemanticRecall(query, options, startTime)
      memories = result.memories
      embedMs = result.embedMs
    } else if (finalExecutedMode === 'hybrid') {
      const result = await this.executeHybridRecall(query, options, startTime)
      memories = result.memories
      embedMs = result.embedMs
    }
    
    const searchMs = Date.now() - startTime
    
    return {
      memories,
      meta: {
        requestedMode,
        executedMode: finalExecutedMode,
        mode: finalExecutedMode, // Alias for backward compatibility
        fallback,
        pendingEmbeddings: this._pendingEmbeddings,
        timing: {
          searchMs,
          embedMs
        }
      }
    }
  }
  
  private async hasEmbeddings(): Promise<boolean> {
    if (!this._embeddingStore) return false
    try {
      const count = await this._embeddingStore.count()
      return count > 0
    } catch (err) {
      // If we can't check, assume no embeddings
      return false
    }
  }

  private determineActualMode(requestedMode: RecallMode): RecallMode {
    // Handle keyword mode directly
    if (requestedMode === 'keyword') {
      return 'keyword'
    }
    
    // Check if semantic/hybrid search is available
    if (requestedMode === 'semantic' || requestedMode === 'hybrid') {
      // Need embedder and embedding store
      if (!this._embedder || !this._embeddingStore) {
        return 'keyword' // fallback
      }
      
      // Note: We can't check embeddings count synchronously here
      // The actual check happens in the recall method
      return requestedMode
    }
    
    // Default fallback
    return 'keyword'
  }
  
  private async executeKeywordRecall(
    query: string,
    options: RecallOptions | undefined,
    startTime: number
  ): Promise<Memory[]> {
    const now = startTime
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    
    // Search memories using SQLite FTS5
    const searchResults = await this.store.searchMemories({
      query,
      limit: limit * 2, // Get extra for filtering
      minStrength,
      kind: options?.kind,
      tags: options?.tags,
      since: options?.since ? parseTime(options.since) : undefined
    })
    
    // Update access stats for retrieved memories
    for (const memory of searchResults) {
      const newStrength = computeStrength(
        memory.baseStrength || memory.strength,
        memory.createdAt,
        now,
        memory.accessCount + 1,
        this.config.decay as DecayConfig,
        now
      )
      
      await this.store.updateMemoryAccess(
        memory.id,
        now,
        newStrength
      )
    }
    
    // Sort by strength (descending) and limit results
    const sorted = searchResults.sort((a, b) => b.strength - a.strength)
    const limited = sorted.slice(0, limit)
    
    // Log recall event
    await this.store.logEvent({
      id: generateId(),
      type: 'memory',
      action: 'access',
      content: `Recalled: "${query.substring(0, 50)}" (found ${limited.length} memories)`,
      timestamp: now
    })
    
    return limited.map(mem => ({
      ...mem,
      strength: computeStrength(
        mem.baseStrength || mem.strength,
        mem.createdAt,
        now,
        mem.accessCount + 1,
        this.config.decay as DecayConfig,
        now
      ),
      accessedAt: now,
      accessCount: mem.accessCount + 1
    }))
  }

  private async executeSemanticRecall(
    query: string,
    options: RecallOptions | undefined,
    startTime: number
  ): Promise<{ memories: Memory[]; embedMs: number }> {
    const embedStartTime = Date.now()
    
    // Compute query embedding
    const queryVector = await this._embedder!.embed(query)
    const embedMs = Date.now() - embedStartTime
    
    const now = startTime
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const kindFilter = options?.kind
    const tagsFilter = options?.tags
    const sinceFilter = options?.since ? parseTime(options.since) : undefined
    
    // First, get memories that match the filters
    const filteredMemories = await this.store.searchMemories({
      query: '', // Empty query to get all memories (filtered)
      limit: 10000, // Large limit to get all
      minStrength,
      kind: kindFilter,
      tags: tagsFilter,
      since: sinceFilter
    })
    
    // Create set of candidate memory IDs
    const candidateMemoryIds = new Set<string>()
    for (const memory of filteredMemories) {
      candidateMemoryIds.add(memory.id)
    }
    
    // Get all embeddings for candidates
    await this.ensureEmbeddingStoreInitialized()
    const embeddingRows = await this._embeddingStore!.getAllForSearch([])
    
    // Filter to only include candidates
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
    
    // Get memories for top results
    const topMemoryIds = similarities.slice(0, limit).map(item => item.memoryId)
    const memories: Memory[] = []
    
    for (const memoryId of topMemoryIds) {
      // Get memory details
      const memoryResults = await this.store.getMemoriesByFilter({
        ids: [memoryId]
      })
      
      if (memoryResults.length === 0) continue
      
      const memory = memoryResults[0]!
      
      // Update access stats
      const newStrength = computeStrength(
        memory.baseStrength || memory.strength,
        memory.createdAt,
        now,
        memory.accessCount + 1,
        this.config.decay as DecayConfig,
        now
      )
      
      await this.store.updateMemoryAccess(
        memory.id,
        now,
        newStrength
      )
      
      memories.push({
        ...memory,
        strength: newStrength,
        accessedAt: now,
        accessCount: memory.accessCount + 1
      })
    }
    
    // Log recall event
    await this.store.logEvent({
      id: generateId(),
      type: 'memory',
      action: 'access',
      content: `Semantic recall: "${query.substring(0, 50)}" (found ${memories.length} memories)`,
      timestamp: now
    })
    
    return { memories, embedMs }
  }

  private async executeHybridRecall(
    query: string,
    options: RecallOptions | undefined,
    startTime: number
  ): Promise<{ memories: Memory[]; embedMs: number }> {
    const embedStartTime = Date.now()
    
    // Compute query embedding
    const queryVector = await this._embedder!.embed(query)
    const embedMs = Date.now() - embedStartTime
    
    const now = startTime
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const kindFilter = options?.kind
    const tagsFilter = options?.tags
    const sinceFilter = options?.since ? parseTime(options.since) : undefined
    
    // Get keyword search results
    const keywordResults = await this.store.searchMemories({
      query,
      limit: limit * 2, // Get extra for filtering
      minStrength,
      kind: kindFilter,
      tags: tagsFilter,
      since: sinceFilter
    })
    
    // Get all memories matching filters (for semantic search)
    const filteredMemories = await this.store.searchMemories({
      query: '', // Empty query to get all memories (filtered)
      limit: 10000,
      minStrength,
      kind: kindFilter,
      tags: tagsFilter,
      since: sinceFilter
    })
    
    // Create set of candidate memory IDs
    const candidateMemoryIds = new Set<string>()
    for (const memory of filteredMemories) {
      candidateMemoryIds.add(memory.id)
    }
    
    // Get all embeddings for candidates
    await this.ensureEmbeddingStoreInitialized()
    const embeddingRows = await this._embeddingStore!.getAllForSearch([])
    
    // Filter to only include candidates
    const candidateEmbeddings = embeddingRows.filter(row => candidateMemoryIds.has(row.memoryId))
    
    // Compute semantic similarities
    const semanticScores = new Map<string, number>()
    for (const row of candidateEmbeddings) {
      if (row.vector.length !== queryVector.length) continue
      
      const similarity = cosineSimilarity(row.vector, queryVector)
      // Normalize to 0-1 range (cosine similarity is -1 to 1)
      const normalized = (similarity + 1) / 2
      semanticScores.set(row.memoryId, normalized)
    }
    
    // Compute keyword scores (simple presence)
    const keywordScores = new Map<string, number>()
    const queryLower = query.toLowerCase()
    
    for (const memory of keywordResults) {
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
    
    // Combine scores for candidate memories (70% semantic, 30% keyword)
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
    const topMemoryIds = sortedMemoryIds.slice(0, limit)
    const memories: Memory[] = []
    
    for (const memoryId of topMemoryIds) {
      // Get memory details
      const memoryResults = await this.store.getMemoriesByFilter({
        ids: [memoryId]
      })
      
      if (memoryResults.length === 0) continue
      
      const memory = memoryResults[0]!
      
      // Update access stats
      const newStrength = computeStrength(
        memory.baseStrength || memory.strength,
        memory.createdAt,
        now,
        memory.accessCount + 1,
        this.config.decay as DecayConfig,
        now
      )
      
      await this.store.updateMemoryAccess(
        memory.id,
        now,
        newStrength
      )
      
      memories.push({
        ...memory,
        strength: newStrength,
        accessedAt: now,
        accessCount: memory.accessCount + 1
      })
    }
    
    // Log recall event
    await this.store.logEvent({
      id: generateId(),
      type: 'memory',
      action: 'access',
      content: `Hybrid recall: "${query.substring(0, 50)}" (found ${memories.length} memories)`,
      timestamp: now
    })
    
    return { memories, embedMs }
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
    
    // Get memories matching filter
    const memories = await this.store.getMemoriesByFilter({
      ids: filter.ids,
      kind: filter.kind,
      tags: filter.tags,
      before: beforeTime,
      maxStrength: filter.maxStrength
    })
    
    // Soft delete each memory
    for (const memory of memories) {
      await this.store.deleteMemory(memory.id)
      
      // Also delete embedding if exists
      if (this._embeddingStore) {
        try {
          await this._embeddingStore.delete(memory.id)
        } catch (err) {
          // Log but continue
          if (typeof console !== 'undefined') {
            console.warn(`[limbicdb] Failed to delete embedding for ${memory.id}:`, 
              err instanceof Error ? err.message : err)
          }
        }
      }
      
      await this.store.logEvent({
        id: generateId(),
        type: 'memory',
        action: 'delete',
        refKey: memory.id,
        content: `Forgot: ${memory.content.substring(0, 100)}`,
        timestamp: Date.now()
      })
    }
    
    // Update stats cache if any memories were deleted
    if (memories.length > 0) {
      this.updateStatsCache().catch(() => { /* ignore */ })
    }
    
    return memories.length
  }
  
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.store.getState(key)
    return value ? JSON.parse(value) : null
  }
  
  async set<T = any>(key: string, value: T): Promise<void> {
    const now = Date.now()
    const serialized = JSON.stringify(value)
    const existed = await this.store.getState(key) !== null
    await this.store.setState(key, serialized, now)
    
    await this.store.logEvent({
      id: generateId(),
      type: 'state',
      action: existed ? 'update' : 'create',
      refKey: key,
      content: `Set ${key}: ${typeof value}`,
      timestamp: now
    })
    
    // Update stats cache
    this.updateStatsCache().catch(() => { /* ignore */ })
  }
  
  async delete(key: string): Promise<boolean> {
    const existed = await this.store.getState(key) !== null
    if (existed) {
      await this.store.deleteState(key)
      await this.store.logEvent({
        id: generateId(),
        type: 'state',
        action: 'delete',
        refKey: key,
        content: `Deleted ${key}`,
        timestamp: Date.now()
      })
      
      // Update stats cache
      this.updateStatsCache().catch(() => { /* ignore */ })
    }
    return existed
  }
  
  async history(options?: HistoryOptions): Promise<TimelineEvent[]> {
    return await this.store.getEvents({
      since: options?.since ? parseTime(options.since) : undefined,
      until: options?.until ? parseTime(options.until) : undefined,
      type: options?.type,
      limit: options?.limit
    })
  }
  
  async snapshot(): Promise<string> {
    const id = generateShortId()
    const now = Date.now()
    
    // Get all current data
    const memories = await this.store.getMemoriesByFilter({})
    const stateKeys = await this.store.getAllStateKeys()
    
    const state: Array<[string, string]> = []
    for (const key of stateKeys) {
      const value = await this.store.getState(key)
      if (value) {
        state.push([key, value])
      }
    }
    
    const timeline = await this.store.getEvents({ limit: 10000 })
    
    // Get embeddings if available
    let embeddings: Array<[string, EmbeddingRow]> | undefined
    if (this._embeddingStore) {
      await this.ensureEmbeddingStoreInitialized()
      const embeddingRows = await this._embeddingStore.getAll()
      embeddings = embeddingRows.map(row => [row.memoryId, row] as [string, EmbeddingRow])
    }
    
    const snapshotData = {
      memories: memories.map(mem => [mem.id, mem] as [string, Memory]),
      state,
      timeline,
      embeddings,
      createdAt: now
    }
    
    await this.store.saveSnapshot(id, snapshotData)
    
    await this.store.logEvent({
      id: generateId(),
      type: 'snapshot',
      action: 'create',
      refKey: id,
      content: `Snapshot ${id}`,
      timestamp: now
    })
    
    return id
  }
  
  async restore(snapshotId: string): Promise<void> {
    const snapshot = await this.store.getSnapshot(snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }
    
    // Restore from snapshot using transaction
    await (this.store as any).restoreFromSnapshot(snapshot)
    
    // Add restore event
    await this.store.logEvent({
      id: generateId(),
      type: 'snapshot',
      action: 'access',
      refKey: snapshotId,
      content: `Restored snapshot ${snapshotId}`,
      timestamp: Date.now()
    })
  }
  
  async close(): Promise<void> {
    if (this._pruneIntervalId) {
      clearInterval(this._pruneIntervalId)
      this._pruneIntervalId = null
    }
    await this.store.close()
  }
  
  get stats(): LimbicDBStats {
    return { ...this._statsCache }
  }
  
  // Helper method to get actual stats (async)
  async getStats(): Promise<LimbicDBStats> {
    const storeStats = await this.store.getStats()
    const stats: LimbicDBStats = {
      memoryCount: storeStats.memoryCount,
      stateKeyCount: storeStats.stateKeyCount,
      snapshotCount: storeStats.snapshotCount,
      dbSizeBytes: storeStats.dbSizeBytes
    }
    
    // Include embedding statistics if available
    if (storeStats.embeddingsCount !== undefined) {
      stats.embeddingsCount = storeStats.embeddingsCount
    }
    if (storeStats.embeddingsDimensions !== undefined) {
      stats.embeddingsDimensions = storeStats.embeddingsDimensions
    }
    
    return stats
  }
}

// Factory function for SQLite-based LimbicDB
export function openSQLite(pathOrConfig: string | LimbicDBConfig): LimbicDB {
  const baseConfig = typeof pathOrConfig === 'string'
    ? { path: pathOrConfig }
    : pathOrConfig
  
  const config = {
    path: baseConfig.path,
    embedder: baseConfig.embedder,
    decay: { ...DEFAULT_DECAY_CONFIG, ...baseConfig.decay } as DecayConfig,
    limits: { ...DEFAULT_LIMITS, ...baseConfig.limits },
  } as Required<LimbicDBConfig>
  
  return new LimbicDBSQLite(config)
}