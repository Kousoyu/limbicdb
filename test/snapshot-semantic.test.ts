import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { open } from '../src/index'
import { Embedder } from '../src/types'
import fs from 'fs/promises'
import path from 'path'

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

describe('Snapshot and Semantic Search Integration', () => {
  describe('SQLite backend with embeddings', () => {
    let tempFilePath: string
    
    beforeEach(() => {
      tempFilePath = `/tmp/limbicdb-snapshot-test-${Date.now()}.limbic`
    })
    
    afterEach(async () => {
      try {
        await fs.unlink(tempFilePath).catch(() => {})
      } catch {
        // Ignore cleanup errors
      }
    })
    
    it('should preserve semantic search after snapshot/restore', async () => {
      // Arrange: create database with embedder
      const db = open({
        path: tempFilePath,
        embedder: mockEmbedder
      })
      
      try {
        // Add memories with semantic relationships
        await db.remember('User prefers dark mode in applications')
        await db.remember('Interface should use dark theme')
        await db.remember('User likes minimalist design')
        await db.remember('Application should have clean interface')
        
        // Wait for embeddings computation
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Act: perform semantic search and snapshot results
        const preSnapshotResults = await db.recall('user interface preferences', {
          mode: 'semantic',
          limit: 5
        })
        
        expect(preSnapshotResults.memories.length).toBeGreaterThan(0)
        
        // Create snapshot
        const snapshotId = await db.snapshot()
        expect(snapshotId).toBeDefined()
        
        // Modify data after snapshot
        await db.remember('This memory should not appear after restore')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Perform semantic search again
        const postRestoreResults = await db.recall('user interface preferences', {
          mode: 'semantic',
          limit: 5
        })
        
        // Assert: results should be the same (except for timing metadata)
        expect(postRestoreResults.memories.length).toBe(preSnapshotResults.memories.length)
        
        // Check that the same memories are returned (same IDs)
        const preSnapshotIds = preSnapshotResults.memories.map(m => m.id).sort()
        const postRestoreIds = postRestoreResults.memories.map(m => m.id).sort()
        expect(postRestoreIds).toEqual(preSnapshotIds)
        
        // Check that semantic search mode is preserved
        if (preSnapshotResults.meta.executedMode === 'semantic') {
          expect(postRestoreResults.meta.executedMode).toBe('semantic')
          expect(postRestoreResults.meta.fallback).toBe(false)
        } else if (preSnapshotResults.meta.executedMode === 'keyword') {
          // If pre-snapshot fell back to keyword, post-restore should also fall back
          expect(postRestoreResults.meta.executedMode).toBe('keyword')
          expect(postRestoreResults.meta.fallback).toBe(true)
        }
        
      } finally {
        await db.close()
      }
    })
    
    it('should preserve hybrid search after snapshot/restore', async () => {
      // Arrange: create database with embedder
      const db = open({
        path: tempFilePath,
        embedder: mockEmbedder
      })
      
      try {
        // Add memories with varied content for hybrid search
        await db.remember('Exact keyword match for hybrid test')
        await db.remember('Semantic similarity test without exact keywords')
        await db.remember('Another test memory for scoring')
        
        // Wait for embeddings computation
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Act: perform hybrid search and snapshot results
        const preSnapshotResults = await db.recall('hybrid test', {
          mode: 'hybrid',
          limit: 5
        })
        
        expect(preSnapshotResults.memories.length).toBeGreaterThan(0)
        
        // Create snapshot
        const snapshotId = await db.snapshot()
        expect(snapshotId).toBeDefined()
        
        // Modify data after snapshot
        await db.remember('Memory added after snapshot for hybrid')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Perform hybrid search again
        const postRestoreResults = await db.recall('hybrid test', {
          mode: 'hybrid',
          limit: 5
        })
        
        // Assert: results should be the same
        expect(postRestoreResults.memories.length).toBe(preSnapshotResults.memories.length)
        
        // Check search mode preservation
        expect(postRestoreResults.meta.requestedMode).toBe('hybrid')
        // Could be 'hybrid', 'semantic', or 'keyword' with fallback
        // The important thing is consistency
        if (preSnapshotResults.meta.executedMode === 'hybrid' || 
            preSnapshotResults.meta.executedMode === 'semantic') {
          // If pre-snapshot executed semantic/hybrid, post-restore should not fall back to keyword
          // (unless embeddings somehow lost, which we're testing doesn't happen)
          expect(postRestoreResults.meta.executedMode).not.toBe('keyword')
          expect(postRestoreResults.meta.fallback).toBe(false)
        }
        
      } finally {
        await db.close()
      }
    })
    
    it('should handle snapshot without embeddings gracefully', async () => {
      // Test backward compatibility: snapshot created before embeddings were introduced
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
        expect(snapshotId).toBeDefined()
        
        // Add more data
        await db.remember('Memory added after legacy snapshot')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Verify only snapshot memories exist
        const results = await db.recall('legacy', { mode: 'keyword' })
        expect(results.memories.length).toBe(2)
        expect(results.memories.some(m => m.content.includes('added after'))).toBe(false)
        
        // Try semantic search - should fall back to keyword
        const semanticResults = await db.recall('legacy', { mode: 'semantic' })
        expect(semanticResults.meta.fallback).toBe(true)
        expect(semanticResults.meta.executedMode).toBe('keyword')
        
      } finally {
        await db.close()
      }
    })
    
    it.skip('should maintain embedding statistics across snapshot/restore', async () => {
      const db = open({
        path: tempFilePath,
        embedder: mockEmbedder
      })
      
      try {
        // Add memories
        await db.remember('Memory for stats test 1')
        await db.remember('Memory for stats test 2')
        
        // Wait for embeddings
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Get pre-snapshot stats (fresh, not cached)
        const preSnapshotStats = await db.getStats()
        
        // Create snapshot
        const snapshotId = await db.snapshot()
        
        // Add more data
        await db.remember('Memory added after snapshot for stats')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Get post-restore stats (fresh, not cached)
        const postRestoreStats = await db.getStats()
        
        // Memory count should be the same
        expect(postRestoreStats.memoryCount).toBe(preSnapshotStats.memoryCount)
        
        // Embeddings count should be preserved if it was tracked
        if (preSnapshotStats.embeddingsCount !== undefined) {
          expect(postRestoreStats.embeddingsCount).toBe(preSnapshotStats.embeddingsCount)
        }
        
        // If embeddings were tracked, dimensions should be preserved
        if (preSnapshotStats.embeddingsDimensions !== undefined) {
          expect(postRestoreStats.embeddingsDimensions).toBe(preSnapshotStats.embeddingsDimensions)
        }
        
      } finally {
        await db.close()
      }
    })
  })
  
  describe('Memory backend snapshot parity', () => {
    it('should preserve semantic search in memory backend snapshot/restore', async () => {
      const db = open({
        path: ':memory:',
        embedder: mockEmbedder
      })
      
      try {
        // Add memories
        await db.remember('Memory backend test 1')
        await db.remember('Memory backend test 2')
        
        // Wait for embeddings
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Semantic search before snapshot
        const preResults = await db.recall('test', { mode: 'semantic' })
        
        // Create snapshot
        const snapshotId = await db.snapshot()
        
        // Add more data
        await db.remember('Added after snapshot in memory backend')
        
        // Restore snapshot
        await db.restore(snapshotId)
        
        // Semantic search after restore
        const postResults = await db.recall('test', { mode: 'semantic' })
        
        // Results should be consistent
        expect(postResults.memories.length).toBe(preResults.memories.length)
        
        // Search mode should be preserved
        if (preResults.meta.executedMode === 'semantic') {
          expect(postResults.meta.executedMode).toBe('semantic')
          expect(postResults.meta.fallback).toBe(false)
        }
        
      } finally {
        await db.close()
      }
    })
  })
})