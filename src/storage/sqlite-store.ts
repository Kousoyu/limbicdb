/**
 * SQLite Storage Implementation for LimbicDB
 * 
 * Production-ready embedded storage with:
 * - ACID compliance
 * - FTS5 full-text search
 * - Efficient memory decay tracking
 * - Automatic cleanup
 */

import Database from 'better-sqlite3'
import type { IStorage, SearchQuery, EventQuery, SnapshotData } from './interface'
import type {
  Memory,
  MemoryKind,
  TimelineEvent,
  TimelineType,
  TimelineAction
} from '../types'

const SCHEMA_SQL = `
-- Main memories table
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact', 'episode', 'preference', 'procedure', 'goal')),
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  meta TEXT NOT NULL DEFAULT '{}', -- JSON object
  embedding BLOB, -- Optional vector data
  strength REAL NOT NULL DEFAULT 0.5,
  base_strength REAL NOT NULL DEFAULT 0.5,
  created_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER, -- Predicted expiry time
  review_at INTEGER, -- Suggested review time
  is_deleted INTEGER NOT NULL DEFAULT 0
);

-- FTS5 full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  kind,
  tags,
  content='memories',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- State key-value store
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Embeddings storage (for semantic search)
CREATE TABLE IF NOT EXISTS memory_embeddings (
  memory_id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,
  dimensions INTEGER NOT NULL,
  model_hint TEXT DEFAULT 'unknown'
);

-- Timeline audit log (append-only)
CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('memory', 'state', 'snapshot')),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'access')),
  ref_key TEXT,
  content TEXT,
  timestamp INTEGER NOT NULL
);

-- Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  memory_data TEXT NOT NULL, -- JSON
  state_data TEXT NOT NULL,   -- JSON
  timeline_data TEXT NOT NULL, -- JSON
  embeddings_data TEXT         -- JSON (optional)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_strength ON memories(strength) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(accessed_at) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline(timestamp);
CREATE INDEX IF NOT EXISTS idx_timeline_ref ON timeline(ref_key);
`

export class SQLiteStore implements IStorage {
  private db: Database.Database
  private preparedStatements: Map<string, Database.Statement> = new Map()
  
  constructor(path: string) {
    const isMemory = path === ':memory:'
    this.db = new Database(path)
    this.initSchema()
    this.configureDatabase(isMemory)
    this.prepareStatements()
  }
  
  private initSchema(): void {
    // Enable foreign keys and other settings first
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA_SQL)
  }
  
  private configureDatabase(isMemory: boolean): void {
    // Performance optimizations
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('cache_size = -64000') // 64MB cache
    this.db.pragma('mmap_size = 268435456') // 256MB memory map
    
    if (!isMemory) {
      this.db.pragma('temp_store = MEMORY')
      this.db.pragma('page_size = 4096')
    }
  }
  
  private prepareStatements(): void {
    // Memory operations
    this.prepare('saveMemory', `
      INSERT OR REPLACE INTO memories 
      (id, content, kind, tags, meta, strength, base_strength, created_at, accessed_at, access_count, expires_at, review_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `)
    
    this.prepare('saveMemoryFTS', `
      INSERT OR REPLACE INTO memories_fts (rowid, content, kind, tags)
      VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?)
    `)
    
    this.prepare('getMemory', `
      SELECT * FROM memories WHERE id = ? AND is_deleted = 0
    `)
    
    this.prepare('updateMemoryAccess', `
      UPDATE memories 
      SET accessed_at = ?, strength = ?, access_count = access_count + 1
      WHERE id = ? AND is_deleted = 0
    `)
    
    this.prepare('softDeleteMemory', `
      UPDATE memories SET is_deleted = 1 WHERE id = ?
    `)
    
    this.prepare('searchMemoriesKeyword', `
      SELECT m.*, bm25(memories_fts) as score
      FROM memories_fts
      JOIN memories m ON m.rowid = memories_fts.rowid
      WHERE memories_fts MATCH ? AND m.is_deleted = 0
      ORDER BY score
      LIMIT ?
    `)
    
    this.prepare('searchMemoriesLike', `
      SELECT m.*, 0.0 as score
      FROM memories m
      WHERE m.content LIKE ? AND m.is_deleted = 0
      ORDER BY m.strength DESC, m.accessed_at DESC
      LIMIT ?
    `)
    
    // State operations
    this.prepare('getState', `
      SELECT value FROM state WHERE key = ?
    `)
    
    this.prepare('setState', `
      INSERT OR REPLACE INTO state (key, value, updated_at) VALUES (?, ?, ?)
    `)
    
    this.prepare('deleteState', `
      DELETE FROM state WHERE key = ?
    `)
    
    this.prepare('getAllStateKeys', `
      SELECT key FROM state ORDER BY key
    `)
    
    // Timeline operations
    this.prepare('logEvent', `
      INSERT INTO timeline (id, type, action, ref_key, content, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    this.prepare('getEvents', `
      SELECT * FROM timeline 
      WHERE (? IS NULL OR timestamp >= ?)
        AND (? IS NULL OR timestamp <= ?)
        AND (? IS NULL OR type IN (SELECT json_each.value FROM json_each(?)))
      ORDER BY timestamp DESC
      LIMIT ?
    `)
    
    // Snapshot operations
    this.prepare('saveSnapshot', `
      INSERT OR REPLACE INTO snapshots (id, created_at, memory_data, state_data, timeline_data, embeddings_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    this.prepare('getSnapshot', `
      SELECT * FROM snapshots WHERE id = ?
    `)
    
    this.prepare('deleteSnapshot', `
      DELETE FROM snapshots WHERE id = ?
    `)
    
    this.prepare('listSnapshots', `
      SELECT id, created_at FROM snapshots ORDER BY created_at DESC
    `)
    
    // Maintenance
    this.prepare('pruneWeakMemories', `
      UPDATE memories 
      SET is_deleted = 1 
      WHERE strength < ? AND accessed_at < ? AND is_deleted = 0
    `)
    
    this.prepare('getStats', `
      SELECT 
        (SELECT COUNT(*) FROM memories WHERE is_deleted = 0) as memory_count,
        (SELECT COUNT(*) FROM state) as state_key_count,
        (SELECT COUNT(*) FROM snapshots) as snapshot_count,
        (SELECT page_count * page_size FROM pragma_page_count, pragma_page_size) as db_size_bytes
    `)
  }
  
  private prepare(name: string, sql: string): void {
    try {
      const stmt = this.db.prepare(sql)
      this.preparedStatements.set(name, stmt)
    } catch (error) {
      console.error(`Failed to prepare statement ${name}:`, error)
      throw error
    }
  }
  
  private getStatement(name: string): Database.Statement {
    const stmt = this.preparedStatements.get(name)
    if (!stmt) {
      throw new Error(`Statement not prepared: ${name}`)
    }
    return stmt
  }
  
  // --- Memory Operations ---
  async saveMemory(memory: Memory): Promise<void> {
    const tagsJson = JSON.stringify(memory.tags)
    const metaJson = JSON.stringify(memory.meta)
    
    const memStmt = this.getStatement('saveMemory')
    memStmt.run(
      memory.id,
      memory.content,
      memory.kind,
      tagsJson,
      metaJson,
      memory.strength,
      memory.baseStrength || memory.strength,
      memory.createdAt,
      memory.accessedAt,
      memory.accessCount || 0,
      (memory as any).expiresAt || null,
      (memory as any).reviewAt || null
    )
    
    // Update FTS index
    const ftsStmt = this.getStatement('saveMemoryFTS')
    ftsStmt.run(memory.id, memory.content, memory.kind, tagsJson)
  }
  
  async getMemory(id: string): Promise<Memory | null> {
    const stmt = this.getStatement('getMemory')
    const row = stmt.get(id) as any
    
    if (!row) return null
    
    return {
      id: row.id,
      content: row.content,
      kind: row.kind as MemoryKind,
      tags: JSON.parse(row.tags),
      meta: JSON.parse(row.meta),
      strength: row.strength,
      baseStrength: row.base_strength,
      createdAt: row.created_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count
    }
  }
  
  async updateMemoryAccess(id: string, accessTime: number, newStrength: number): Promise<void> {
    const stmt = this.getStatement('updateMemoryAccess')
    stmt.run(accessTime, newStrength, id)
  }
  
  async deleteMemory(id: string): Promise<void> {
    const stmt = this.getStatement('softDeleteMemory')
    stmt.run(id)
  }
  
  async searchMemories(query: SearchQuery): Promise<Memory[]> {
    // Handle empty query - use filter-based search instead of FTS
    if (!query.query.trim()) {
      // For empty query, get all memories matching filters
      const filterMemories = await this.getMemoriesByFilter({
        kind: query.kind,
        tags: query.tags,
        // No before filter for empty query - we want all memories
        maxStrength: 1.0 // Get all memories regardless of strength
      })
      
      // Apply minStrength and since filters
      const filtered = filterMemories.filter(memory => {
        if (query.minStrength !== undefined && memory.strength < query.minStrength) return false
        if (query.since !== undefined && memory.createdAt < query.since) return false
        return true
      })
      
      // Sort by strength (descending) then by recency
      filtered.sort((a, b) => {
        if (Math.abs(b.strength - a.strength) > 0.05) {
          return b.strength - a.strength
        }
        return b.accessedAt - a.accessedAt
      })
      
      return filtered.slice(0, query.limit)
    }
    
    // Hybrid search: try FTS5 first, fall back to LIKE for CJK queries if needed
    const safeQuery = this.sanitizeFTSQuery(query.query)
    const containsCJK = this.containsCJK(query.query)
    
    // Step 1: Try FTS5 search
    const ftsStmt = this.getStatement('searchMemoriesKeyword')
    const ftsRows = ftsStmt.all(safeQuery, query.limit * 2) as any[]
    
    // Convert FTS rows to Memory objects and apply filters
    const memories: Memory[] = []
    const seenIds = new Set<string>()
    
    for (const row of ftsRows) {
      // Apply additional filters
      if (query.minStrength !== undefined && row.strength < query.minStrength) continue
      if (query.since !== undefined && row.created_at < query.since) continue
      
      // Apply kind filter if specified
      if (query.kind) {
        const kinds = Array.isArray(query.kind) ? query.kind : [query.kind]
        if (!kinds.includes(row.kind as MemoryKind)) continue
      }
      
      // Apply tags filter if specified
      if (query.tags && query.tags.length > 0) {
        const rowTags = JSON.parse(row.tags) as string[]
        const hasAllTags = query.tags.every(tag => rowTags.includes(tag))
        if (!hasAllTags) continue
      }
      
      memories.push({
        id: row.id,
        content: row.content,
        kind: row.kind as MemoryKind,
        tags: JSON.parse(row.tags),
        meta: JSON.parse(row.meta),
        strength: row.strength,
        baseStrength: row.base_strength,
        createdAt: row.created_at,
        accessedAt: row.accessed_at,
        accessCount: row.access_count
      })
      seenIds.add(row.id)
      
      if (memories.length >= query.limit) break
    }
    
    // Step 2: If we don't have enough results AND query contains CJK characters,
    // fall back to LIKE search for better partial matching
    if (memories.length < query.limit && containsCJK) {
      const likeStmt = this.getStatement('searchMemoriesLike')
      const likePattern = `%${this.escapeLikeQuery(query.query)}%`
      const likeRows = likeStmt.all(likePattern, query.limit * 2) as any[]
      
      for (const row of likeRows) {
        // Skip duplicates
        if (seenIds.has(row.id)) continue
        
        // Apply filters (same as above)
        if (query.minStrength !== undefined && row.strength < query.minStrength) continue
        if (query.since !== undefined && row.created_at < query.since) continue
        
        if (query.kind) {
          const kinds = Array.isArray(query.kind) ? query.kind : [query.kind]
          if (!kinds.includes(row.kind as MemoryKind)) continue
        }
        
        if (query.tags && query.tags.length > 0) {
          const rowTags = JSON.parse(row.tags) as string[]
          const hasAllTags = query.tags.every(tag => rowTags.includes(tag))
          if (!hasAllTags) continue
        }
        
        memories.push({
          id: row.id,
          content: row.content,
          kind: row.kind as MemoryKind,
          tags: JSON.parse(row.tags),
          meta: JSON.parse(row.meta),
          strength: row.strength,
          baseStrength: row.base_strength,
          createdAt: row.created_at,
          accessedAt: row.accessed_at,
          accessCount: row.access_count
        })
        seenIds.add(row.id)
        
        if (memories.length >= query.limit) break
      }
    }
    
    return memories
  }
  
  async getMemoriesByFilter(filter: {
    ids?: string[]
    kind?: MemoryKind | MemoryKind[]
    tags?: string[]
    before?: number
    maxStrength?: number
  }): Promise<Memory[]> {
    // Build dynamic query
    const conditions: string[] = ['is_deleted = 0']
    const params: any[] = []
    
    if (filter.ids?.length) {
      conditions.push(`id IN (${filter.ids.map(() => '?').join(',')})`)
      params.push(...filter.ids)
    }
    
    if (filter.kind) {
      const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind]
      conditions.push(`kind IN (${kinds.map(() => '?').join(',')})`)
      params.push(...kinds)
    }
    
    if (filter.before) {
      conditions.push('created_at < ?')
      params.push(filter.before)
    }
    
    if (filter.maxStrength !== undefined) {
      conditions.push('strength <= ?')
      params.push(filter.maxStrength)
    }
    
    // Implement tags filter using SQLite JSON functions
    if (filter.tags && filter.tags.length > 0) {
      // For each tag, add a condition that checks if the tag exists in the JSON array
      // Using LIKE as a simple solution for now (tags are stored as JSON array)
      for (const tag of filter.tags) {
        // Search for the tag in the JSON array: ["tag1", "tag2"] contains "tag1"
        conditions.push(`tags LIKE ?`)
        params.push(`%"${tag}"%`)
      }
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM memories ${whereClause} ORDER BY strength DESC`
    
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(row => ({
      id: row.id,
      content: row.content,
      kind: row.kind as MemoryKind,
      tags: JSON.parse(row.tags),
      meta: JSON.parse(row.meta),
      strength: row.strength,
      baseStrength: row.base_strength,
      createdAt: row.created_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count
    }))
  }
  
  // --- State Operations ---
  async getState(key: string): Promise<string | null> {
    const stmt = this.getStatement('getState')
    const row = stmt.get(key) as any
    return row?.value || null
  }
  
  async setState(key: string, value: string, timestamp: number): Promise<void> {
    const stmt = this.getStatement('setState')
    stmt.run(key, value, timestamp)
  }
  
  async deleteState(key: string): Promise<void> {
    const stmt = this.getStatement('deleteState')
    stmt.run(key)
  }
  
  async getAllStateKeys(): Promise<string[]> {
    const stmt = this.getStatement('getAllStateKeys')
    const rows = stmt.all() as Array<{key: string}>
    return rows.map(row => row.key)
  }
  
  // --- Timeline Operations ---
  async logEvent(event: TimelineEvent): Promise<void> {
    const stmt = this.getStatement('logEvent')
    stmt.run(
      event.id,
      event.type,
      event.action,
      event.refKey || null,
      event.content || null,
      event.timestamp
    )
  }
  
  async getEvents(query: EventQuery): Promise<TimelineEvent[]> {
    const stmt = this.getStatement('getEvents')
    
    const typeFilter = query.type 
      ? JSON.stringify(Array.isArray(query.type) ? query.type : [query.type])
      : null
    
    const rows = stmt.all(
      query.since ?? null, query.since ?? null,
      query.until ?? null, query.until ?? null,
      typeFilter, typeFilter,
      query.limit ?? 1000
    ) as any[]
    
    return rows.map(row => ({
      id: row.id,
      type: row.type as TimelineType,
      action: row.action as TimelineAction,
      refKey: row.ref_key || undefined,
      content: row.content || undefined,
      timestamp: row.timestamp
    }))
  }
  
  async pruneEvents(keepCount: number): Promise<number> {
    // Keep only the latest N events
    const deleteStmt = this.db.prepare(`
      DELETE FROM timeline 
      WHERE id NOT IN (
        SELECT id FROM timeline 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `)
    
    const result = deleteStmt.run(keepCount)
    return result.changes
  }
  
  // --- Snapshot Operations ---
  async saveSnapshot(id: string, data: SnapshotData): Promise<void> {
    const stmt = this.getStatement('saveSnapshot')
    stmt.run(
      id,
      data.createdAt,
      JSON.stringify(data.memories),
      JSON.stringify(data.state),
      JSON.stringify(data.timeline),
      data.embeddings ? JSON.stringify(data.embeddings) : null
    )
  }
  
  async getSnapshot(id: string): Promise<SnapshotData | null> {
    const stmt = this.getStatement('getSnapshot')
    const row = stmt.get(id) as any
    
    if (!row) return null
    
    const snapshotData: SnapshotData = {
      memories: JSON.parse(row.memory_data),
      state: JSON.parse(row.state_data),
      timeline: JSON.parse(row.timeline_data),
      createdAt: row.created_at
    }
    
    // Add embeddings if they exist
    if (row.embeddings_data) {
      snapshotData.embeddings = JSON.parse(row.embeddings_data)
    }
    
    return snapshotData
  }
  
  async deleteSnapshot(id: string): Promise<void> {
    const stmt = this.getStatement('deleteSnapshot')
    stmt.run(id)
  }
  
  async listSnapshots(): Promise<Array<{id: string, createdAt: number}>> {
    const stmt = this.getStatement('listSnapshots')
    const rows = stmt.all() as Array<{id: string, created_at: number}>
    return rows.map(row => ({ id: row.id, createdAt: row.created_at }))
  }
  
  // --- Maintenance Operations ---
  async pruneWeakMemories(threshold: number, beforeTime: number): Promise<number> {
    const stmt = this.getStatement('pruneWeakMemories')
    const result = stmt.run(threshold, beforeTime)
    return result.changes
  }
  
  async getStats(): Promise<{
    memoryCount: number
    stateKeyCount: number
    snapshotCount: number
    dbSizeBytes: number
  }> {
    const stmt = this.getStatement('getStats')
    const row = stmt.get() as any
    return {
      memoryCount: row.memory_count || 0,
      stateKeyCount: row.state_key_count || 0,
      snapshotCount: row.snapshot_count || 0,
      dbSizeBytes: row.db_size_bytes || 0
    }
  }
  
  // --- Lifecycle ---
  async close(): Promise<void> {
    this.db.close()
  }
  
  // --- Snapshot Restoration ---
  async restoreFromSnapshot(snapshotData: SnapshotData): Promise<void> {
    return this.transaction(() => {
      // Clear existing data (except snapshots table)
      this.db.exec('DELETE FROM memories')
      this.db.exec('DELETE FROM memories_fts')
      this.db.exec('DELETE FROM state')
      this.db.exec('DELETE FROM timeline')
      
      // Restore memories
      for (const [_id, memory] of snapshotData.memories) {
        const mem = memory as Memory
        const tagsJson = JSON.stringify(mem.tags)
        const metaJson = JSON.stringify(mem.meta)
        
        // Insert into memories table
        const memStmt = this.db.prepare(`
          INSERT INTO memories 
          (id, content, kind, tags, meta, strength, base_strength, created_at, accessed_at, access_count, is_deleted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `)
        memStmt.run(
          mem.id,
          mem.content,
          mem.kind,
          tagsJson,
          metaJson,
          mem.strength,
          mem.baseStrength || mem.strength,
          mem.createdAt,
          mem.accessedAt,
          mem.accessCount || 0
        )
        
        // Insert into FTS index
        const ftsStmt = this.db.prepare(`
          INSERT INTO memories_fts (rowid, content, kind, tags)
          VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?)
        `)
        ftsStmt.run(mem.id, mem.content, mem.kind, tagsJson)
      }
      
      // Restore state
      for (const [key, value] of snapshotData.state) {
        const stateStmt = this.db.prepare(`
          INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)
        `)
        stateStmt.run(key, value, Date.now())
      }
      
      // Restore timeline events
      for (const event of snapshotData.timeline) {
        const timelineStmt = this.db.prepare(`
          INSERT INTO timeline (id, type, action, ref_key, content, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        timelineStmt.run(
          event.id,
          event.type,
          event.action,
          event.refKey || null,
          event.content || null,
          event.timestamp
        )
      }
    })
  }
  
  async vacuum(): Promise<void> {
    this.db.exec('VACUUM')
  }
  
  // --- Helper Methods ---
  private containsCJK(text: string): boolean {
    // CJK Unicode ranges (Chinese, Japanese, Korean)
    const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/
    return cjkRegex.test(text)
  }

  // @ts-ignore - TypeScript incorrectly flags this as unused (it's used in searchMemories)
  private escapeLikeQuery(query: string): string {
    // Escape SQLite LIKE wildcards: % → \%, _ → \_, \ → \\
    return query.replace(/[%_\\]/g, '\\$&')
  }

  private sanitizeFTSQuery(query: string): string {
    // Basic sanitization for FTS5 query
    // Remove characters that could break FTS5 syntax
    return query.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ').trim()
  }
  
  // --- Transaction Support ---
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }
}