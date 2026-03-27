/**
 * Storage Layer Interface for LimbicDB
 * 
 * Abstract storage interface to support multiple backends:
 * - SQLite (production)
 * - Memory (development/testing)
 * - Future: PostgreSQL, Redis, etc.
 */

import type {
  Memory,
  MemoryKind,
  TimelineEvent,
  TimelineType
} from '../types'

export interface SearchQuery {
  query: string
  limit: number
  minStrength?: number
  kind?: MemoryKind | MemoryKind[]
  tags?: string[]
  since?: number
}

export interface EventQuery {
  since?: number
  until?: number
  type?: TimelineType | TimelineType[]
  limit?: number
}

export interface SnapshotData {
  memories: Array<[string, Memory]>
  state: Array<[string, string]>
  timeline: TimelineEvent[]
  createdAt: number
}

export interface IStorage {
  // --- Memory Operations ---
  saveMemory(memory: Memory): Promise<void>
  getMemory(id: string): Promise<Memory | null>
  updateMemoryAccess(id: string, accessTime: number, newStrength: number): Promise<void>
  deleteMemory(id: string): Promise<void>
  searchMemories(query: SearchQuery): Promise<Memory[]>
  getMemoriesByFilter(filter: {
    ids?: string[]
    kind?: MemoryKind | MemoryKind[]
    tags?: string[]
    before?: number
    maxStrength?: number
  }): Promise<Memory[]>
  
  // --- State Operations ---
  getState(key: string): Promise<string | null>
  setState(key: string, value: string, timestamp: number): Promise<void>
  deleteState(key: string): Promise<void>
  getAllStateKeys(): Promise<string[]>
  
  // --- Timeline Operations ---
  logEvent(event: TimelineEvent): Promise<void>
  getEvents(query: EventQuery): Promise<TimelineEvent[]>
  pruneEvents(keepCount: number): Promise<number> // Keep only latest N events
  
  // --- Snapshot Operations ---
  saveSnapshot(id: string, data: SnapshotData): Promise<void>
  getSnapshot(id: string): Promise<SnapshotData | null>
  deleteSnapshot(id: string): Promise<void>
  listSnapshots(): Promise<Array<{id: string, createdAt: number}>>
  
  // --- Maintenance Operations ---
  pruneWeakMemories(threshold: number, beforeTime: number): Promise<number>
  getStats(): Promise<{
    memoryCount: number
    stateKeyCount: number
    snapshotCount: number
    dbSizeBytes: number
  }>
  
  // --- Lifecycle ---
  close(): Promise<void>
  vacuum(): Promise<void> // Optional: optimize storage
}