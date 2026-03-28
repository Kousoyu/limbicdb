import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { open } from '../src/index'
import { Embedder } from '../src/types'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Mock embedder for testing
const mockEmbedder: Embedder = {
  async embed(text: string): Promise<number[]> {
    // Deterministic embedding based on text hash
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const dims = 384
    const vector = Array(dims).fill(0).map((_, i) => 
      Math.sin((hash + i) * 0.1) * 0.1
    )
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    return vector.map(v => v / norm)
  },
  dimensions: 384,
  modelHint: 'test-model'
}

describe('Snapshot Embeddings Integration (Issue #5)', () => {
  describe('SQLite backend', () => {
    let tempFilePath: string
    
    beforeEach(() => {
      tempFilePath = `${os.tmpdir()}/limbicdb-snapshot-embeddings-${Date.now()}.limbic`
    })
    
    afterEach(async () => {
      try {
        await fs.unlink(tempFilePath).catch(() => {})
      } catch {
        // Ignore cleanup errors
      }
    })
    
    it.skip('should include embeddings in snapshots and restore them (covered by snapshot-semantic.test.ts)', async () => {
      // Arrange: create database with embedder
      const db = open({
        path: tempFilePath,
        embedder: mockEmbedder
      })
      
      try {
        // Add memories
        await db.remember('Test memory 1 for embeddings')
        await db.remember('Test memory 2 for embeddings')
        
        // Wait for embeddings computation
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check embeddings count before snapshot - use async getStats for fresh data
        const preSnapshotStats = await db.getStats()
        
        // Create snapshot
        const snapshotId = await db.snapshot()
        expect(snapshotId).toBeDefined()
        
        // Add more data after snapshot
        await db.remember('Memory added after snapshot')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Check embeddings count after restore - use async getStats for fresh data
        const postRestoreStats = await db.getStats()
        
        // Memory count should be the same as before snapshot
        expect(postRestoreStats.memoryCount).toBe(preSnapshotStats.memoryCount)
        
        // Embeddings count should be preserved if it was tracked
        if (preSnapshotStats.embeddingsCount !== undefined) {
          expect(postRestoreStats.embeddingsCount).toBe(preSnapshotStats.embeddingsCount)
        }
        
        // If embeddings were tracked, dimensions should be preserved
        if (preSnapshotStats.embeddingsDimensions !== undefined) {
          expect(postRestoreStats.embeddingsDimensions).toBe(preSnapshotStats.embeddingsDimensions)
        }
        
        // Verify that the added memory is not present
        const results = await db.recall('added after', { mode: 'keyword' })
        expect(results.memories.some(m => m.content.includes('added after'))).toBe(false)
        
        // Original memories should be present
        const originalResults = await db.recall('Test memory', { mode: 'keyword' })
        expect(originalResults.memories.length).toBe(2)
        
      } finally {
        await db.close()
      }
    })
    
    it('should handle snapshots without embedder gracefully', async () => {
      // Test backward compatibility
      const db = open({
        path: tempFilePath
        // No embedder
      })
      
      try {
        // Add memories without embeddings
        await db.remember('Legacy memory 1')
        await db.remember('Legacy memory 2')
        
        // Create snapshot (no embeddings)
        const snapshotId = await db.snapshot()
        
        // Add more data
        await db.remember('Memory added after legacy snapshot')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Verify only snapshot memories exist
        const results = await db.recall('memory', { mode: 'keyword' })
        expect(results.memories.length).toBe(2)
        expect(results.memories.some(m => m.content.includes('added after'))).toBe(false)
        
      } finally {
        await db.close()
      }
    })
  })
  
  describe('Memory backend', () => {
    it.skip('should preserve embeddings in memory backend snapshots (covered by snapshot-semantic.test.ts)', async () => {
      const db = open({
        path: ':memory:',
        embedder: mockEmbedder
      })
      
      try {
        // Add memories
        await db.remember('Memory backend test 1')
        await db.remember('Memory backend test 2')
        
        // Wait for embeddings
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Check stats before snapshot - use async getStats for fresh data
        const preSnapshotStats = await db.getStats()
        
        // Create snapshot
        const snapshotId = await db.snapshot()
        
        // Add more data
        await db.remember('Added after snapshot in memory backend')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Check stats after restore - use async getStats for fresh data
        const postRestoreStats = await db.getStats()
        
        // Memory count should be preserved
        expect(postRestoreStats.memoryCount).toBe(preSnapshotStats.memoryCount)
        
        // If embeddings were tracked, they should be preserved
        if (preSnapshotStats.embeddingsCount !== undefined) {
          expect(postRestoreStats.embeddingsCount).toBe(preSnapshotStats.embeddingsCount)
        }
        
        // Added memory should not be present
        const results = await db.recall('added after', { mode: 'keyword' })
        expect(results.memories.some(m => m.content.includes('added after'))).toBe(false)
        
      } finally {
        await db.close()
      }
    })
  })
})