/**
 * LimbicDB — Core Types
 * 
 * Based on cognitive science principles:
 * - Ebbinghaus forgetting curve (1885)
 * - Tulving memory classification (1972)  
 * - ACT-R cognitive architecture (1993)
 */

export type MemoryKind = 'fact' | 'episode' | 'preference' | 'procedure' | 'goal'
export type TimelineAction = 'create' | 'update' | 'delete' | 'access'
export type TimelineType = 'memory' | 'state' | 'snapshot'
export type RecallStrategy = 'keyword' | 'semantic' | 'hybrid'

export interface Memory {
  id: string
  content: string
  embedding?: Float32Array
  kind: MemoryKind
  tags: string[]
  meta: Record<string, any>
  strength: number  // 0-1, computed based on decay
  createdAt: number  // Unix timestamp (ms)
  accessedAt: number // Last recall time
  accessCount: number
  baseStrength?: number  // Initial strength (0-1)
}

export interface TimelineEvent {
  id: string
  type: TimelineType
  action: TimelineAction
  refKey?: string  // memory ID or state key
  content?: string // summary
  timestamp: number
}

export interface RecallOptions {
  limit?: number  // default: 10
  minStrength?: number  // default: 0.01
  kind?: MemoryKind | MemoryKind[]
  tags?: string[]
  since?: string | number  // '2h ago' or timestamp
  strategy?: RecallStrategy  // default: 'hybrid'
  semanticThreshold?: number  // 0-1, default: 0.7
}

export interface RememberOptions {
  kind?: MemoryKind  // auto-detected if omitted
  tags?: string[]
  meta?: Record<string, any>
  strength?: number  // 0-1, default: 0.5
  baseStrength?: number  // 0-1, default: same as strength
}

export interface HistoryOptions {
  since?: string | number
  until?: string | number
  type?: TimelineType | TimelineType[]
  limit?: number
}

export interface ForgetFilter {
  ids?: string[]
  kind?: MemoryKind | MemoryKind[]
  tags?: string[]
  before?: string | number
  maxStrength?: number  // forget memories weaker than this
}

export interface DecayConfig {
  enabled: boolean
  halfLifeHours: number  // default: 168 (7 days)
  recallBoost: number    // default: 1.4 (40% boost on recall)
  maxStrength: number    // default: 1.0
  pruneThreshold: number // default: 0.01 (auto-delete below this)
  pruneIntervalMinutes: number  // default: 60 (check every hour)
}

export interface LimbicDBConfig {
  // Storage path, ':memory:' for in-memory mode
  path: string
  
  // Optional embedder for semantic search
  embedder?: Embedder
  
  // Memory decay configuration
  decay?: Partial<DecayConfig>
  
  // Storage limits
  limits?: {
    maxMemories?: number  // default: 10000
    maxStateKeys?: number // default: 1000
    maxSnapshots?: number // default: 100
    maxDbSize?: string    // default: '500MB'
  }
}

export interface Embedder {
  embed(text: string): Promise<Float32Array>
  dimensions: number
}

export interface LimbicDBStats {
  memoryCount: number
  stateKeyCount: number
  snapshotCount: number
  dbSizeBytes: number
  oldestMemoryAge?: number  // ms
  newestMemoryAge?: number  // ms
}

export interface LimbicDB {
  // --- Memory Operations ---
  remember(content: string, options?: RememberOptions): Promise<Memory>
  recall(query: string, options?: RecallOptions): Promise<Memory[]>
  forget(filter: ForgetFilter): Promise<number>  // returns number forgotten
  
  // --- State Operations ---
  get<T = any>(key: string): Promise<T | null>
  set<T = any>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
  
  // --- Timeline & Audit ---
  history(options?: HistoryOptions): Promise<TimelineEvent[]>
  snapshot(): Promise<string>  // returns snapshot ID
  restore(snapshotId: string): Promise<void>
  
  // --- Lifecycle ---
  close(): Promise<void>
  
  // --- Statistics ---
  readonly stats: LimbicDBStats
}

// Factory function type
export type OpenFunction = {
  (path: string): LimbicDB
  (config: LimbicDBConfig): LimbicDB
}