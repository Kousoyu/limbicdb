// @ts-nocheck
/**
 * LimbicDB SQLite Implementation
 * 
 * Production-ready embedded cognitive memory database with SQLite storage.
 */

import { SQLiteStore } from './storage/sqlite-store'
import { EmbeddingStore, cosineSimilarity } from './embedding-store'
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
  private _statsUpdatePromise: Promise<void> | null = null
  
  constructor(config: Required<LimbicDBConfig>) {
    this.config = config
    this.store = new SQLiteStore(config.path)
    this._embedder = config.embedder
    
    // Initialize embedding store if embedder is provided
    if (this._embedder) {
      // @ts-ignore - Access private db field
      const db = (this.store as any).db
      if (db) {
        this._embeddingStore = new EmbeddingStore({ type: 'sqlite', db })
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
    // @ts-ignore - decay is guaranteed to be DecayConfig
    const intervalMs = this.config.decay.pruneIntervalMinutes * 60 * 1000
    this._pruneIntervalId = setInterval(() => this.autoPrune(), intervalMs)
  }
  
  private async autoPrune(): Promise<void> {
    // @ts-ignore - decay is guaranteed to be DecayConfig
    if (!this.config.decay.enabled) return
    
    // @ts-ignore - decay is guaranteed to be DecayConfig
    const threshold = this.config.decay.pruneThreshold
    const beforeTime = Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
    const pruned = await this.store.pruneWeakMemories(threshold as number, beforeTime)
    
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
    const now = startTime
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const requestedMode = options?.mode || 'keyword'
    
    // Determine what mode would be executed
    // In SQLite backend, semantic/hybrid are not yet implemented, so always execute keyword
    const executedMode: RecallMode = 'keyword'
    const fallback = (requestedMode === 'semantic' || requestedMode === 'hybrid') && executedMode === 'keyword'
    
    // Log warning if user requested semantic/hybrid but we're falling back
    if (fallback) {
      console.warn('[limbicdb] SQLite backend: semantic/hybrid search not yet implemented, falling back to keyword')
    }
    
    let memories: Memory[] = []
    let embedMs = 0
    
    // Always execute keyword recall for now
    memories = await this.executeKeywordRecall(query, options, startTime)
    
    const searchMs = Date.now() - startTime
    
    return {
      memories,
      meta: {
        requestedMode,
        executedMode,
        mode: executedMode, // Alias for backward compatibility
        fallback,
        pendingEmbeddings: this._pendingEmbeddings,
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
        if (!this._embedder || !this._embeddingStore) {
          return 'keyword' // fallback
        }
        // TODO: Check if embeddings exist for any memories
        return requestedMode
      default:
        return 'keyword'
    }
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
    
    const snapshotData = {
      memories: memories.map(mem => [mem.id, mem] as [string, Memory]),
      state,
      timeline,
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
    return {
      memoryCount: storeStats.memoryCount,
      stateKeyCount: storeStats.stateKeyCount,
      snapshotCount: storeStats.snapshotCount,
      dbSizeBytes: storeStats.dbSizeBytes
    }
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