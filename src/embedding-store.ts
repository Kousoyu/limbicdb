/**
 * Embedding storage layer for LimbicDB.
 * 
 * Design: separate table, BLOB storage, no vector index.
 * At <10K memories, brute-force cosine similarity is fast enough.
 */

// ---- Vector math utilities ----

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!; // non-null assertion is safe here
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function serializeVector(v: number[]): Buffer {
  const f32 = new Float32Array(v);
  return Buffer.from(f32.buffer);
}

export function deserializeVector(blob: Buffer): number[] {
  const f32 = new Float32Array(
    blob.buffer,
    blob.byteOffset,
    blob.byteLength / 4
  );
  return Array.from(f32);
}

// ---- Embedding store ----

export interface EmbeddingRow {
  memoryId: string;
  vector: number[];
  dimensions: number;
  modelHint: string;
}

/**
 * Manages the memory_embeddings table.
 * Accepts a generic db interface so it works with both
 * SQLite backend and in-memory backend.
 */
export class EmbeddingStore {
  // For in-memory backend: Map<memoryId, EmbeddingRow>
  private memoryStore?: Map<string, EmbeddingRow>;

  // For SQLite backend: reference to db connection
  private db?: any;
  private mode: 'memory' | 'sqlite';

  constructor(backend: { type: 'memory' } | { type: 'sqlite'; db: any }) {
    if (backend.type === 'memory') {
      this.mode = 'memory';
      this.memoryStore = new Map();
    } else {
      this.mode = 'sqlite';
      this.db = backend.db;
    }
  }

  async initialize(): Promise<void> {
    if (this.mode === 'sqlite') {
      if (!this.db) throw new Error('SQLite database not initialized');
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS memory_embeddings (
          memory_id TEXT PRIMARY KEY,
          vector BLOB NOT NULL,
          dimensions INTEGER NOT NULL,
          model_hint TEXT DEFAULT 'unknown'
        )
      `);
    }
    // Memory backend needs no initialization
  }

  async store(
    memoryId: string,
    vector: number[],
    modelHint: string = 'user-provided'
  ): Promise<void> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      this.memoryStore.set(memoryId, {
        memoryId,
        vector,
        dimensions: vector.length,
        modelHint,
      });
      return;
    }

    const blob = serializeVector(vector);
    await this.db.run(
      `INSERT OR REPLACE INTO memory_embeddings 
       (memory_id, vector, dimensions, model_hint) 
       VALUES (?, ?, ?, ?)`,
      [memoryId, blob, vector.length, modelHint]
    );
  }

  async get(memoryId: string): Promise<EmbeddingRow | null> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      return this.memoryStore.get(memoryId) ?? null;
    }

    if (!this.db) throw new Error('SQLite database not initialized');
    const row = await this.db.get(
      'SELECT * FROM memory_embeddings WHERE memory_id = ?',
      [memoryId]
    );
    if (!row) return null;

    return {
      memoryId: row.memory_id,
      vector: deserializeVector(row.vector),
      dimensions: row.dimensions,
      modelHint: row.model_hint,
    };
  }

  async getAllForSearch(
    excludeForgotten: string[] // list of forgotten memory IDs to exclude
  ): Promise<EmbeddingRow[]> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      const results: EmbeddingRow[] = [];
      const excludeSet = new Set(excludeForgotten);
      this.memoryStore.forEach((row, id) => {
        if (!excludeSet.has(id)) {
          results.push(row);
        }
      });
      return results;
    }

    // For SQLite, join with memories table to exclude forgotten ones
    if (!this.db) throw new Error('SQLite database not initialized');
    const rows = await this.db.all(`
      SELECT e.memory_id, e.vector, e.dimensions, e.model_hint
      FROM memory_embeddings e
      JOIN memories m ON e.memory_id = m.id
      WHERE m.forgotten = 0
    `);

    return rows.map((row: any) => ({
      memoryId: row.memory_id,
      vector: deserializeVector(row.vector),
      dimensions: row.dimensions,
      modelHint: row.model_hint,
    }));
  }

  async delete(memoryId: string): Promise<void> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      this.memoryStore.delete(memoryId);
      return;
    }

    if (!this.db) throw new Error('SQLite database not initialized');
    await this.db.run(
      'DELETE FROM memory_embeddings WHERE memory_id = ?',
      [memoryId]
    );
  }

  async count(): Promise<number> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      return this.memoryStore.size;
    }

    if (!this.db) throw new Error('SQLite database not initialized');
    const row = await this.db.get(
      'SELECT COUNT(*) as cnt FROM memory_embeddings'
    );
    return row.cnt;
  }

  async clear(): Promise<void> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      this.memoryStore.clear();
      return;
    }

    if (!this.db) throw new Error('SQLite database not initialized');
    await this.db.run('DELETE FROM memory_embeddings');
  }

  async getAll(): Promise<EmbeddingRow[]> {
    if (this.mode === 'memory') {
      if (!this.memoryStore) throw new Error('Memory store not initialized');
      return Array.from(this.memoryStore.values());
    }

    if (!this.db) throw new Error('SQLite database not initialized');
    const rows = await this.db.all(
      'SELECT * FROM memory_embeddings'
    );

    return rows.map((row: any) => ({
      memoryId: row.memory_id,
      vector: deserializeVector(row.vector),
      dimensions: row.dimensions,
      modelHint: row.model_hint,
    }));
  }
}