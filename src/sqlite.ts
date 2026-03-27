// @ts-nocheck
/**
 * LimbicDB SQLite Implementation
 * 
 * Production-ready embedded cognitive memory database with SQLite storage.
 */

import { SQLiteStore } from './storage/sqlite-store'
import type {
  LimbicDB,
  LimbicDBConfig,
  Memory,
  RememberOptions,
  RecallOptions,
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
  // @ts-ignore - Will be used for semantic search
  private _embedder?: Embedder
  
  constructor(config: Required<LimbicDBConfig>) {
    this.config = config
    this.store = new SQLiteStore(config.path)
    this._embedder = config.embedder
    
    // Start automatic pruning if enabled
    if (this.config.decay!.enabled) {
      this.startAutoPrune()
    }
  }
  
  private startAutoPrune(): void {
    // @ts-ignore - decay is guaranteed to be DecayConfig
    const intervalMs = this.config.decay.pruneIntervalMinutes * 60 * 1000
    setInterval(() => this.autoPrune(), intervalMs)
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
    
    return memory
  }
  
  async recall(query: string, options?: RecallOptions): Promise<Memory[]> {
    const now = Date.now()
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
      
      await this.store.logEvent({
        id: generateId(),
        type: 'memory',
        action: 'delete',
        refKey: memory.id,
        content: `Forgot: ${memory.content.substring(0, 100)}`,
        timestamp: Date.now()
      })
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
    await this.store.setState(key, serialized, now)
    
    const existed = await this.store.getState(key) !== null
    await this.store.logEvent({
      id: generateId(),
      type: 'state',
      action: existed ? 'update' : 'create',
      refKey: key,
      content: `Set ${key}: ${typeof value}`,
      timestamp: now
    })
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
    await this.store.close()
  }
  
  get stats(): LimbicDBStats {
    // This is async in SQLiteStore, but we need sync getter
    // For now, return placeholder stats - will need to refactor
    return {
      memoryCount: 0,
      stateKeyCount: 0,
      snapshotCount: 0,
      dbSizeBytes: 0
    }
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