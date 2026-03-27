import { describe, it, expect, beforeEach } from 'vitest';
import {
  cosineSimilarity,
  serializeVector,
  deserializeVector,
  EmbeddingStore,
} from '../src/embedding-store';

// ---- Vector math tests ----

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 6);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 6);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
  });

  it('returns 0 for zero vector', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('handles high-dimensional vectors (384d)', () => {
    const a = Array.from({ length: 384 }, (_, i) => Math.sin(i));
    const b = Array.from({ length: 384 }, (_, i) => Math.cos(i));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(-1);
    expect(sim).toBeLessThan(1);
  });
});

describe('vector serialization', () => {
  it('roundtrips a simple vector', () => {
    const original = [1.0, -2.5, 3.14159, 0.0, -0.001];
    const blob = serializeVector(original);
    const restored = deserializeVector(blob);

    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      // Float32 has ~7 digits of precision
      expect(restored[i]).toBeCloseTo(original[i], 5);
    }
  });

  it('roundtrips a 384-dimensional vector with negligible error', () => {
    const original = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    const blob = serializeVector(original);
    const restored = deserializeVector(blob);

    // Cosine similarity between original and restored should be > 0.999999
    const sim = cosineSimilarity(original, restored);
    expect(sim).toBeGreaterThan(0.999999);
  });

  it('produces compact BLOB (384d = 1536 bytes)', () => {
    const v = Array.from({ length: 384 }, () => Math.random());
    const blob = serializeVector(v);
    expect(blob.byteLength).toBe(384 * 4); // Float32 = 4 bytes each
  });
});

// ---- EmbeddingStore tests (in-memory backend) ----

describe('EmbeddingStore (memory)', () => {
  let store: EmbeddingStore;

  beforeEach(async () => {
    store = new EmbeddingStore({ type: 'memory' });
    await store.initialize();
  });

  it('stores and retrieves an embedding', async () => {
    const vector = [0.1, 0.2, 0.3];
    await store.store('mem-1', vector, 'test-model');

    const result = await store.get('mem-1');
    expect(result).not.toBeNull();
    expect(result!.memoryId).toBe('mem-1');
    expect(result!.vector).toEqual(vector);
    expect(result!.dimensions).toBe(3);
    expect(result!.modelHint).toBe('test-model');
  });

  it('returns null for missing embedding', async () => {
    const result = await store.get('nonexistent');
    expect(result).toBeNull();
  });

  it('overwrites existing embedding (upsert)', async () => {
    await store.store('mem-1', [1, 2, 3]);
    await store.store('mem-1', [4, 5, 6]);

    const result = await store.get('mem-1');
    expect(result!.vector).toEqual([4, 5, 6]);
  });

  it('deletes an embedding', async () => {
    await store.store('mem-1', [1, 2, 3]);
    await store.delete('mem-1');

    const result = await store.get('mem-1');
    expect(result).toBeNull();
  });

  it('counts embeddings', async () => {
    expect(await store.count()).toBe(0);
    await store.store('mem-1', [1, 2, 3]);
    await store.store('mem-2', [4, 5, 6]);
    expect(await store.count()).toBe(2);
  });

  it('clears all embeddings', async () => {
    await store.store('mem-1', [1, 2, 3]);
    await store.store('mem-2', [4, 5, 6]);
    await store.clear();
    expect(await store.count()).toBe(0);
  });

  it('gets all embeddings for search (excluding forgotten)', async () => {
    await store.store('mem-1', [1, 2, 3]);
    await store.store('mem-2', [4, 5, 6]);
    await store.store('mem-3', [7, 8, 9]);
    
    const all = await store.getAllForSearch(['mem-2']); // exclude mem-2
    expect(all.length).toBe(2);
    expect(all.map(r => r.memoryId)).toEqual(expect.arrayContaining(['mem-1', 'mem-3']));
  });
});

// Note: SQLite backend tests would require a real SQLite database
// For now, we test the in-memory backend which is the foundation.