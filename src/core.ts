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
  DecayConfig
} from './types'
import { classifyMemory, extractTags } from './classify'
import { computeStrength, predictExpiry, suggestReviewTime } from './decay'
import { parseTime } from './time'
import { generateId, generateShortId } from './utils/id'

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
  
  private _stats: LimbicDBStats = {
    memoryCount: 0,
    stateKeyCount: 0,
    snapshotCount: 0,
    dbSizeBytes: 0,
  }
  
  constructor(config: Required<LimbicDBConfig>) {
    this.config = config
    this.updateStats()
  }
  
  private updateStats() {
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
    
    return this.toPublicMemory(memory)
  }
  
  async recall(query: string, options?: RecallOptions): Promise<Memory[]> {
    const now = Date.now()
    const limit = options?.limit || 10
    const minStrength = options?.minStrength || 0.01
    const kindFilter = options?.kind
    const tagsFilter = options?.tags
    const sinceFilter = options?.since ? parseTime(options.since) : undefined
    
    // Simple keyword search (MVP - will be FTS5)
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
      
      // Check tags filter
      if (tagsFilter && tagsFilter.length > 0) {
        const hasTag = tagsFilter.some(tag => memory.tags.includes(tag))
        if (!hasTag) continue
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
    
    // Record access event
    this.recordTimelineEvent('memory', 'access', undefined, `Recalled: "${query.substring(0, 50)}"`)
    
    // Return limited results
    return results.slice(0, limit).map(mem => this.toPublicMemory(mem))
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
        const hasTag = filter.tags.some(tag => memory.tags.includes(tag))
        if (!hasTag) continue
      }
      if (beforeTime && memory.createdAt >= beforeTime) continue
      if (filter.maxStrength !== undefined && memory.strength > filter.maxStrength) continue
      
      // Soft delete
      memory.isDeleted = true
      count++
      
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
    
    const snapshotData = {
      memories: Array.from(this.memories.entries()),
      state: Array.from(this.state.entries()),
      timeline: this.timeline,
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
    
    // Restore from snapshot
    const { memories, state, timeline } = snapshot.data
    for (const [id, memory] of memories) {
      this.memories.set(id, memory as StoredMemory)
    }
    for (const [key, value] of state) {
      this.state.set(key, value)
    }
    this.timeline = timeline
    
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