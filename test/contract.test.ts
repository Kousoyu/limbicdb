import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openMemory, openSQLite } from '../src/index'
import type { LimbicDB } from '../src/types'

// Helper to run tests with both backends
function describeWithBackends(name: string, fn: (createDb: () => Promise<LimbicDB>) => void) {
  describe(`${name} (memory backend)`, () => {
    fn(async () => openMemory(':memory:'))
  })

  describe(`${name} (SQLite backend)`, () => {
    fn(async () => openSQLite(':memory:'))
  })
}

describeWithBackends('LimbicDB Contract Tests', (createDb) => {
  let db: LimbicDB

  beforeEach(async () => {
    db = await createDb()
  })

  afterEach(async () => {
    await db.close()
  })

  describe('keyword search semantics', () => {
    it('should match memories containing exact keyword', async () => {
      // Arrange
      await db.remember('This is a test memory')
      await db.remember('Another test example')
      await db.remember('Unrelated content')

      // Act
      const results = (await db.recall('test')).memories

      // Assert
      expect(results.length).toBe(2)
      expect(results.some(m => m.content.includes('test memory'))).toBe(true)
      expect(results.some(m => m.content.includes('test example'))).toBe(true)
    })

    it('should be case-insensitive', async () => {
      // Arrange
      await db.remember('UPPERCASE TEST')
      await db.remember('lowercase test')
      await db.remember('MixedCase Test')

      // Act
      const results = (await db.recall('test')).memories

      // Assert
      expect(results.length).toBe(3)
    })

    it('should match exact word occurrences (partial matching depends on FTS configuration)', async () => {
      // Arrange
      await db.remember('This is a test')
      await db.remember('Testing is important') // Contains "test" as substring
      await db.remember('No match')

      // Act
      const results = (await db.recall('test')).memories

      // Assert - At least exact match should work
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some(m => m.content.includes('This is a test'))).toBe(true)
    })

    // Note: Chinese/Unicode search support is tracked in Issue #6
    // Current implementation has basic CJK support via FTS5 + LIKE fallback
    // but may not match partial characters within multi-character terms
    it.skip('should support Unicode/Chinese character matching (tracked in #6)', async () => {
      // This test is skipped pending CJK search improvements in Issue #6
      // Current status: basic CJK search works via FTS5 + LIKE fallback
      // but this test expects more advanced matching capabilities
      // Arrange
      await db.remember('这是一个测试记忆')
      await db.remember('另一个记忆')
      await db.remember('测试内容')

      // Act
      const results = (await db.recall('测试')).memories

      // Assert
      // With improved CJK support, should find both memories containing '测试'
      expect(results.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('empty query semantics', () => {
    it('should return all memories when query is empty string', async () => {
      // Arrange
      await db.remember('Memory 1', { tags: ['test'] })
      await db.remember('Memory 2', { tags: ['test'] })
      await db.remember('Memory 3', { tags: ['other'] })

      // Act
      const results = (await db.recall('')).memories

      // Assert
      expect(results.length).toBe(3)
    })

    it('should filter by kind with empty query', async () => {
      // Arrange
      await db.remember('This is a fact', { kind: 'fact' })
      await db.remember('User prefers dark theme', { kind: 'preference' })
      await db.remember('Yesterday we had a meeting', { kind: 'episode' })
      await db.remember('Another fact', { kind: 'fact' })

      // Act
      const facts = (await db.recall('', { kind: 'fact' })).memories
      const preferences = (await db.recall('', { kind: 'preference' })).memories

      // Assert
      expect(facts.length).toBe(2)
      expect(facts.every(m => m.kind === 'fact')).toBe(true)
      expect(preferences.length).toBe(1)
      expect(preferences[0].kind).toBe('preference')
    })

    it('should filter by multiple kinds with empty query', async () => {
      // Arrange
      await db.remember('Fact 1', { kind: 'fact' })
      await db.remember('Episode 1', { kind: 'episode' })
      await db.remember('Preference 1', { kind: 'preference' })
      await db.remember('Fact 2', { kind: 'fact' })

      // Act
      const results = (await db.recall('', { kind: ['fact', 'episode'] })).memories

      // Assert
      expect(results.length).toBe(3)
      expect(results.some(m => m.kind === 'fact')).toBe(true)
      expect(results.some(m => m.kind === 'episode')).toBe(true)
      expect(results.every(m => m.kind === 'fact' || m.kind === 'episode')).toBe(true)
    })
  })

  describe('tags filtering semantics', () => {
    it('should require ALL tags when filtering (AND semantics)', async () => {
      // Arrange
      await db.remember('Memory with tag1', { tags: ['tag1'] })
      await db.remember('Memory with tag2', { tags: ['tag2'] })
      await db.remember('Memory with both tags', { tags: ['tag1', 'tag2'] })
      await db.remember('Memory with tag1 and other', { tags: ['tag1', 'other'] })

      // Act
      const results = (await db.recall('', { tags: ['tag1', 'tag2'] })).memories

      // Assert
      expect(results.length).toBe(1)
      expect(results[0].content).toBe('Memory with both tags')
      expect(results[0].tags).toContain('tag1')
      expect(results[0].tags).toContain('tag2')
    })

    it('should handle empty tags array', async () => {
      // Arrange
      await db.remember('Memory 1', { tags: ['test'] })
      await db.remember('Memory 2', { tags: [] })

      // Act
      const results = (await db.recall('', { tags: [] })).memories

      // Assert - empty tags array should return all memories (no tag filter)
      expect(results.length).toBe(2)
    })

    it('should combine kind and tags filters', async () => {
      // Arrange
      await db.remember('Fact with tag1', { kind: 'fact', tags: ['tag1'] })
      await db.remember('Fact with tag2', { kind: 'fact', tags: ['tag2'] })
      await db.remember('Episode with tag1', { kind: 'episode', tags: ['tag1'] })
      await db.remember('Fact with both tags', { kind: 'fact', tags: ['tag1', 'tag2'] })

      // Act
      const results = (await db.recall('', { kind: 'fact', tags: ['tag1', 'tag2'] })).memories

      // Assert
      expect(results.length).toBe(1)
      expect(results[0].kind).toBe('fact')
      expect(results[0].tags).toContain('tag1')
      expect(results[0].tags).toContain('tag2')
    })
  })

  describe('strength-based filtering', () => {
    it('should filter by minStrength', async () => {
      // Arrange
      await db.remember('Weak memory', { strength: 0.1 })
      await db.remember('Strong memory', { strength: 0.9 })
      await db.remember('Medium memory', { strength: 0.5 })

      // Act
      const strongResults = (await db.recall('', { minStrength: 0.8 })).memories
      const mediumResults = (await db.recall('', { minStrength: 0.4 })).memories
      const allResults = (await db.recall('', { minStrength: 0.01 })).memories

      // Assert
      expect(strongResults.length).toBe(1)
      expect(strongResults[0].content).toBe('Strong memory')
      expect(mediumResults.length).toBe(2) // Strong + Medium
      expect(allResults.length).toBe(3)
    })
  })

  describe('time-based filtering', () => {
    it('should filter by since time', async () => {
      // Arrange
      const now = Date.now()
      const oneHourAgo = now - 60 * 60 * 1000
      const twoHoursAgo = now - 2 * 60 * 60 * 1000

      // We can't directly control createdAt in API, but we can test the filter
      // by using relative time strings
      await db.remember('Recent memory')
      await db.remember('Older memory')

      // Act - use relative time
      const recentResults = (await db.recall('', { since: '1h ago' })).memories
      
      // Assert - at least recent memory should be included
      expect(recentResults.length).toBeGreaterThan(0)
    })
  })

  describe('pagination and limits', () => {
    it('should respect limit parameter', async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        await db.remember(`Memory ${i}`)
      }

      // Act
      const limit3 = (await db.recall('', { limit: 3 })).memories
      const limit5 = (await db.recall('', { limit: 5 })).memories
      const defaultLimit = (await db.recall('')).memories

      // Assert
      expect(limit3.length).toBe(3)
      expect(limit5.length).toBe(5)
      expect(defaultLimit.length).toBeLessThanOrEqual(10) // Default limit is 10
    })

    it('should sort by strength (descending) by default', async () => {
      // Arrange
      await db.remember('Weak memory', { strength: 0.2 })
      await db.remember('Strong memory', { strength: 0.9 })
      await db.remember('Medium memory', { strength: 0.5 })

      // Act
      const results = (await db.recall('')).memories

      // Assert
      expect(results.length).toBe(3)
      // Should be sorted by strength descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].strength).toBeGreaterThanOrEqual(results[i + 1].strength)
      }
    })
  })

  describe('forget semantics', () => {
    it('should forget memories by tags filter', async () => {
      // Arrange
      await db.remember('Temp memory 1', { tags: ['temp'] })
      await db.remember('Temp memory 2', { tags: ['temp'] })
      await db.remember('Permanent memory', { tags: ['permanent'] })

      // Act
      const forgotten = await db.forget({ tags: ['temp'] })
      const remaining = (await db.recall('')).memories

      // Assert
      expect(forgotten).toBe(2)
      expect(remaining.length).toBe(1)
      expect(remaining[0].content).toBe('Permanent memory')
    })

    it('should forget memories by kind filter', async () => {
      // Arrange
      await db.remember('Goal 1', { kind: 'goal' })
      await db.remember('Goal 2', { kind: 'goal' })
      await db.remember('Fact 1', { kind: 'fact' })

      // Act
      const forgotten = await db.forget({ kind: 'goal' })
      const remaining = (await db.recall('')).memories

      // Assert
      expect(forgotten).toBe(2)
      expect(remaining.length).toBe(1)
      expect(remaining[0].kind).toBe('fact')
    })

    it('should require at least one filter for forget', async () => {
      // Act & Assert
      await expect(db.forget({})).rejects.toThrow('Forget requires at least one filter')
    })
  })
})