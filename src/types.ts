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
export type RecallStrategy = 'keyword' | 'semantic' | 'hybrid' // Deprecated, use mode
export type RecallMode = 'keyword' | 'semantic' | 'hybrid'

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
  // Optional score for recall results
  score?: number // 0-1 relevance score
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
  
  // Mode of recall: keyword (FTS5), semantic (embeddings), or hybrid (both)
  // Default: 'keyword' if no embedder configured, otherwise 'hybrid'
  mode?: RecallMode
  
  // Deprecated, use mode instead
  strategy?: RecallStrategy  // default: 'keyword' (for backward compatibility)
  
  // For semantic/hybrid mode: minimum similarity threshold (0-1)
  // Default: 0.3
  similarityThreshold?: number
}

export interface RecallResult {
  memories: Memory[]
  meta: {
    requestedMode: RecallMode // What the user requested
    executedMode: RecallMode // What actually ran
    mode: RecallMode // Alias for executedMode (backward compatibility)
    fallback: boolean // true if requested semantic/hybrid but fell back to keyword
    pendingEmbeddings?: number // number of memories still waiting for embedding computation
    timing: {
      embedMs?: number // time spent computing query embedding (semantic/hybrid only)
      searchMs: number // time spent searching
    }
  }
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

// Embedding function type
export type EmbedFn = (text: string) => Promise<number[]> | number[]

export interface Embedder {
  embed: EmbedFn
  dimensions: number
  modelHint?: string // For cache invalidation when switching models
}

export interface LimbicDBStats {
  memoryCount: number
  stateKeyCount: number
  snapshotCount: number
  dbSizeBytes: number
  oldestMemoryAge?: number  // ms
  newestMemoryAge?: number  // ms
  // Embedding statistics (if embeddings are enabled)
  embeddingsCount?: number
  embeddingsDimensions?: number
}

export interface LimbicDB {
  // --- Memory Operations ---
  remember(content: string, options?: RememberOptions): Promise<Memory>
  
  // Enhanced recall with detailed results
  recall(query: string, options?: RecallOptions): Promise<RecallResult>
  
  // Legacy recall for backward compatibility (returns just memories)
  recallLegacy?(query: string, options?: RecallOptions): Promise<Memory[]>
  
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
  
  // --- Embedding Operations ---
  // Check if embeddings are available
  hasEmbeddings?(): boolean
  
  // Manually trigger embedding computation for a memory
  computeEmbedding?(memoryId: string): Promise<void>
  
  // Compute embeddings for all memories without embeddings
  computeAllEmbeddings?(): Promise<number> // returns count of computed embeddings
}

// Factory function type
export type OpenFunction = {
  (path: string): LimbicDB
  (config: LimbicDBConfig): LimbicDB
}