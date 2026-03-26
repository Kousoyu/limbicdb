-- LimbicDB Schema
-- Embedded cognitive memory database for AI agents

-- ==================== MEMORIES ====================
-- Core memory storage with cognitive metadata

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,                    -- UUID v4
  content TEXT NOT NULL,                  -- Memory content
  embedding BLOB,                         -- Vector data (optional)
  kind TEXT NOT NULL CHECK (kind IN ('fact', 'episode', 'preference', 'procedure', 'goal')),
  tags TEXT DEFAULT '[]',                 -- JSON array of tags
  meta TEXT DEFAULT '{}',                 -- JSON metadata
  base_strength REAL DEFAULT 0.5,         -- Initial strength (0-1)
  strength REAL DEFAULT 0.5,              -- Current computed strength
  created_at INTEGER NOT NULL,            -- Unix timestamp (ms)
  accessed_at INTEGER NOT NULL,           -- Last access time
  access_count INTEGER DEFAULT 0,         -- Number of recalls
  expires_at INTEGER,                     -- Predicted expiry time (ms)
  review_at INTEGER,                      -- Suggested review time (ms)
  is_deleted INTEGER DEFAULT 0            -- Soft delete flag
);

-- Full-text search (SQLite FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts 
USING fts5(
  content, 
  kind,
  tags,
  content='memories',
  content_rowid='rowid'
);

-- ==================== STATE ====================
-- Persistent key-value state

CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                    -- JSON
  updated_at INTEGER NOT NULL,
  meta TEXT DEFAULT '{}'                  -- JSON metadata
);

-- ==================== TIMELINE ====================
-- Append-only event log for audit and recovery

CREATE TABLE IF NOT EXISTS timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('memory', 'state', 'snapshot')),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'access')),
  ref_key TEXT,                           -- memory ID or state key
  content TEXT,                           -- Summary
  timestamp INTEGER NOT NULL,
  meta TEXT DEFAULT '{}'
);

-- ==================== SNAPSHOTS ====================
-- Point-in-time backups

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,                    -- UUID
  data BLOB NOT NULL,                     -- Compressed JSON of full state
  created_at INTEGER NOT NULL,
  description TEXT
);

-- ==================== CONFIG ====================
-- Database configuration

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                    -- JSON
  updated_at INTEGER NOT NULL
);

-- ==================== INDEXES ====================

-- Memory indexes
CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind);
CREATE INDEX IF NOT EXISTS idx_memories_strength ON memories(strength);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(accessed_at);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
CREATE INDEX IF NOT EXISTS idx_memories_review ON memories(review_at);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags);

-- State indexes
CREATE INDEX IF NOT EXISTS idx_state_updated ON state(updated_at);

-- Timeline indexes
CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline(timestamp);
CREATE INDEX IF NOT EXISTS idx_timeline_type ON timeline(type, timestamp);
CREATE INDEX IF NOT EXISTS idx_timeline_ref ON timeline(ref_key, timestamp);

-- Snapshot indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at);

-- ==================== TRIGGERS ====================

-- Keep FTS5 in sync with memories
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories
BEGIN
  INSERT INTO memories_fts(rowid, content, kind, tags)
  VALUES (new.rowid, new.content, new.kind, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories
BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, kind, tags)
  VALUES ('delete', old.rowid, old.content, old.kind, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories
BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, kind, tags)
  VALUES ('delete', old.rowid, old.content, old.kind, old.tags);
  INSERT INTO memories_fts(rowid, content, kind, tags)
  VALUES (new.rowid, new.content, new.kind, new.tags);
END;

-- ==================== VIEWS ====================

-- Current active memories (not deleted, not expired)
CREATE VIEW IF NOT EXISTS active_memories AS
SELECT * FROM memories 
WHERE is_deleted = 0 
  AND (expires_at IS NULL OR expires_at > (unixepoch() * 1000))
ORDER BY strength DESC, accessed_at DESC;

-- Memories needing review
CREATE VIEW IF NOT EXISTS memories_needing_review AS
SELECT * FROM memories
WHERE is_deleted = 0 
  AND review_at IS NOT NULL 
  AND review_at <= (unixepoch() * 1000)
ORDER BY review_at ASC;

-- Recent timeline events
CREATE VIEW IF NOT EXISTS recent_timeline AS
SELECT * FROM timeline
ORDER BY timestamp DESC
LIMIT 1000;