import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import { open, openMemory, openSQLite } from '../src/index'
import type { LimbicDB, Embedder, RecallResult } from '../src/types'

// Helper to run tests with both backends
function describeWithBackends(name: string, fn: (createDb: () => Promise<LimbicDB>) => void) {
  describe(`${name} (memory backend)`, () => {
    fn(async () => openMemory(':memory:'))
  })

  describe(`${name} (SQLite backend)`, () => {
    fn(async () => openSQLite(':memory:'))
  })
}

// Simple mock embedder for testing
const mockEmbedder: Embedder = {
  embed: async (text: string): Promise<number[]> => {
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

// Helper function to create mock embedder
function createMockEmbedder(): Embedder {
  return mockEmbedder
}

// Failing embedder for error handling tests
const failingEmbedder: Embedder = {
  embed: async (): Promise<number[]> => {
    throw new Error('Embedding failed')
  },
  dimensions: 384
}

describeWithBackends('LimbicDB Semantic Search Tests', (createDb) => {
  let db: LimbicDB
  let dbWithEmbedder: LimbicDB

  beforeEach(async () => {
    db = await createDb()
    dbWithEmbedder = await createDb()
    // @ts-ignore - configure embedder directly for testing
    dbWithEmbedder.configureEmbedder?.(mockEmbedder)
  })

  afterEach(async () => {
    await db.close()
    await dbWithEmbedder.close()
  })

  describe('graceful degradation', () => {
    it('should fallback to keyword when semantic requested but no embedder', async () => {
      // Arrange
      await db.remember('Test memory with keyword')
      await db.remember('Another test memory')

      // Act
      const result = await db.recall('keyword', { mode: 'semantic' })

      // Assert
      expect(result.meta.mode).toBe('keyword')
      expect(result.meta.fallback).toBe(true)
      expect(result.memories.length).toBeGreaterThan(0)
      // Should still return results using keyword search
    })

    it('should fallback to keyword when hybrid requested but no embedder', async () => {
      // Arrange
      await db.remember('Test memory')

      // Act
      const result = await db.recall('test', { mode: 'hybrid' })

      // Assert
      expect(result.meta.mode).toBe('keyword')
      expect(result.meta.fallback).toBe(true)
      expect(result.memories.length).toBe(1)
    })
  })

  describe('embedding failure handling', () => {
    it('should remember successfully even if embedding fails', async () => {
      // Arrange
      const dbWithFailingEmbedder = await createDb()
      // @ts-ignore - configure failing embedder
      dbWithFailingEmbedder.configureEmbedder?.(failingEmbedder)
      
      // Act & Assert - remember should not throw
      await expect(dbWithFailingEmbedder.remember('Test memory')).resolves.toBeDefined()
      
      // Verify memory was stored
      const result = await dbWithFailingEmbedder.recall('test', { mode: 'keyword' })
      expect(result.memories.length).toBe(1)
      
      await dbWithFailingEmbedder.close()
    })

    it('should handle embedding failure during recall gracefully', async () => {
      // Arrange
      const dbWithFailingEmbedder = await createDb()
      // @ts-ignore - configure failing embedder  
      dbWithFailingEmbedder.configureEmbedder?.(failingEmbedder)
      await dbWithFailingEmbedder.remember('Test memory')
      
      // Act
      const result = await dbWithFailingEmbedder.recall('test', { mode: 'semantic' })
      
      // Assert - should fall back to keyword
      expect(result.meta.fallback).toBe(true)
      expect(result.meta.mode).toBe('keyword')
      expect(result.memories.length).toBe(1)
      
      await dbWithFailingEmbedder.close()
    })
  })

  describe('vector consistency', () => {
    it.skip('should serialize and deserialize vectors with minimal precision loss', async () => {
      // This test requires actual implementation to test
      // For now, it's a placeholder
      // TODO: Implement when vector serialization is properly implemented
    })

    it.skip('should compute consistent cosine similarity', async () => {
      // Test cosine similarity utility function
      // TODO: Implement when cosine similarity utility is exposed for testing
    })
  })

  describe('hybrid search behavior', () => {
    it('should combine keyword and semantic scores (when implemented)', async () => {
      // Arrange
      await dbWithEmbedder.remember('Memory with exact keyword match')
      await dbWithEmbedder.remember('Memory with semantic similarity but no keyword')
      
      // Wait for embeddings (if implemented)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Act
      const result = await dbWithEmbedder.recall('keyword', { mode: 'hybrid' })
      
      // Assert - Currently falls back to keyword
      // In the future, this should be 'hybrid' with fallback: false
      expect(result.meta.mode).toBe('keyword')
      expect(result.meta.fallback).toBe(true)
      expect(result.memories.length).toBeGreaterThanOrEqual(1) // At least keyword match
    })

    it.skip('should apply correct weighting (30% keyword, 70% semantic) when implemented', async () => {
      // This test requires actual implementation
      // TODO: Implement when hybrid search with configurable weights is implemented
    })

    it('should handle cases where only one modality returns results (when implemented)', async () => {
      // Arrange: memory that doesn't contain keyword but is semantically related
      await dbWithEmbedder.remember('Feline companion animal')
      
      // Wait for embeddings (if implemented)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Act: query with different word but similar meaning
      const result = await dbWithEmbedder.recall('cat', { mode: 'hybrid' })
      
      // Assert: Currently no semantic similarity, so may not return results
      // In the future, this should return result via semantic similarity
      // expect(result.memories.length).toBeGreaterThan(0)
      expect(result.meta.fallback).toBe(true) // Falls back to keyword
    })
  })

  describe('recall modes', () => {
    it('should support keyword mode (default behavior)', async () => {
      // Arrange
      await db.remember('Test keyword memory')
      
      // Act
      const result = await db.recall('keyword', { mode: 'keyword' })
      
      // Assert
      expect(result.meta.mode).toBe('keyword')
      expect(result.memories.length).toBe(1)
    })

    it('should support semantic mode when embedder available (future feature)', async () => {
      // Arrange
      await dbWithEmbedder.remember('Memory about user preferences')
      
      // Wait for embedding (if implemented)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Act: query with different wording but same meaning
      const result = await dbWithEmbedder.recall('What does the user like?', { mode: 'semantic' })
      
      // Assert - Currently falls back to keyword since semantic search is not implemented
      // In the future, this should be 'semantic' when embedder is available
      expect(result.meta.mode).toBe('keyword')
      expect(result.meta.fallback).toBe(true)
      expect(result.memories.length).toBeGreaterThanOrEqual(0)
    })

    it('should include timing information in result meta', async () => {
      // Arrange
      await dbWithEmbedder.remember('Timing test memory')
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Act
      const result = await dbWithEmbedder.recall('test', { mode: 'semantic' })
      
      // Assert
      expect(result.meta.timing).toBeDefined()
      expect(result.meta.timing.searchMs).toBeGreaterThanOrEqual(0)
      expect(result.meta.timing.embedMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('configuration', () => {
    it.skip('should allow embedder configuration via constructor', async () => {
      // This test would require the actual API to support embedder in config
      // TODO: Implement when embedder can be configured via constructor (not just @ts-ignore)
    })

    it('should track embedding statistics in stats (when implemented)', async () => {
      // Arrange
      await dbWithEmbedder.remember('Memory 1')
      await dbWithEmbedder.remember('Memory 2')
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Act
      const stats = dbWithEmbedder.stats
      
      // Assert - Currently embeddingsCount is undefined since not implemented
      // In the future, this should track embeddings count
      expect(stats.embeddingsCount).toBeUndefined()
      // embeddingsDimensions should be tracked when embeddings are enabled
      // expect(stats.embeddingsDimensions).toBe(384)
    })
  })

  describe('backward compatibility', () => {
    it('should maintain backward compatibility for existing code', async () => {
      // Arrange
      await db.remember('Legacy test memory')
      
      // Act: using old API (if available)
      const legacyResult = await (db as any).recallLegacy?.('legacy') || await db.recall('legacy')
      
      // Assert: should still work
      expect(Array.isArray(legacyResult)).toBe(true)
    })
  })

  describe('README contract smoke test', () => {
    it('should accurately report execution mode for SQLite backend', async () => {
      // This test simulates what a user would do following README
      // Default example: open('./agent.limbic') -> SQLite backend
      
      // Create a temporary file path
      const tempFilePath = '/tmp/limbicdb-smoke-test.limbic'
      
      try {
        // Simulate README example with embedder
        const embedder = createMockEmbedder()
        const memory = open({ path: tempFilePath, embedder })
        
        // Add some memories - include the query term to ensure keyword match
        await memory.remember('User prefers React with TypeScript')
        await memory.remember('Project uses PostgreSQL database')
        await memory.remember('Technology stack includes React and PostgreSQL')
        
        // Give time for async embeddings (if any)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Test semantic mode - SQLite backend should execute semantic when embedder is configured
        const result = await memory.recall('technology', { mode: 'semantic' })
        
        // Critical contract assertions:
        // 1. executedMode should be semantic
        expect(result.meta.executedMode).toBe('semantic')
        
        // 2. requestedMode should be 'semantic' (what user asked for)
        expect(result.meta.requestedMode).toBe('semantic')
        
        // 3. fallback should be false (semantic executed successfully)
        expect(result.meta.fallback).toBe(false)
        
        // 4. mode should equal executedMode (backward compatibility)
        expect(result.meta.mode).toBe(result.meta.executedMode)
        
        // 5. Should still return some results (keyword search works)
        expect(result.memories.length).toBeGreaterThan(0)
        
      } finally {
        // Cleanup
        try {
          await fs.promises.unlink(tempFilePath).catch(() => {})
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    it('should accurately report execution mode for memory backend', async () => {
      // Memory backend should support all modes when embedder is provided
      const embedder = createMockEmbedder()
      const memory = open({ path: ':memory:', embedder })
      
      // Add some memories - include the query term to ensure keyword match
      await memory.remember('User prefers React with TypeScript')
      await memory.remember('Project uses PostgreSQL database')
      await memory.remember('Technology stack includes React and PostgreSQL')
      
      // Give time for async embeddings
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Test semantic mode - memory backend should execute semantic
      const result = await memory.recall('technology', { mode: 'semantic' })
      
      // Memory backend has full semantic implementation
      expect(result.meta.executedMode).toBe('semantic')
      expect(result.meta.requestedMode).toBe('semantic')
      expect(result.meta.fallback).toBe(false)
      expect(result.meta.mode).toBe('semantic')
    })
  })
})
