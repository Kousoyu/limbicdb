import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SQLiteStore } from '../src/storage/sqlite-store'
import type { Memory } from '../src/types'

describe('SQLiteStore', () => {
  let store: SQLiteStore
  
  beforeEach(() => {
    store = new SQLiteStore(':memory:')
  })
  
  afterEach(async () => {
    await store.close()
  })
  
  it('should save and retrieve a memory', async () => {
    const memory: Memory = {
      id: 'test-id-1',
      content: '测试记忆内容',
      kind: 'fact',
      tags: ['test', 'example'],
      meta: { source: 'test' },
      strength: 0.8,
      baseStrength: 0.7,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0
    }
    
    await store.saveMemory(memory)
    
    const retrieved = await store.getMemory('test-id-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(memory.id)
    expect(retrieved?.content).toBe(memory.content)
    expect(retrieved?.kind).toBe(memory.kind)
    expect(retrieved?.tags).toEqual(memory.tags)
    expect(retrieved?.strength).toBe(memory.strength)
  })
  
  it('should update memory access', async () => {
    const memory: Memory = {
      id: 'test-id-2',
      content: '另一个测试',
      kind: 'episode',
      tags: [],
      meta: {},
      strength: 0.5,
      baseStrength: 0.5,
      createdAt: 1000,
      accessedAt: 1000,
      accessCount: 0
    }
    
    await store.saveMemory(memory)
    
    const newAccessTime = 2000
    const newStrength = 0.6
    await store.updateMemoryAccess('test-id-2', newAccessTime, newStrength)
    
    const retrieved = await store.getMemory('test-id-2')
    expect(retrieved?.accessedAt).toBe(newAccessTime)
    expect(retrieved?.strength).toBe(newStrength)
    expect(retrieved?.accessCount).toBe(1) // Should be incremented
  })
  
  it('should search memories by keyword', async () => {
    // Create test memories
    const memories: Memory[] = [
      {
        id: 'search-1',
        content: 'TypeScript 是 JavaScript 的超集',
        kind: 'fact',
        tags: ['typescript', 'programming'],
        meta: {},
        strength: 0.8,
        baseStrength: 0.8,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        accessCount: 0
      },
      {
        id: 'search-2',
        content: 'Python 是一种动态类型语言',
        kind: 'fact',
        tags: ['python', 'programming'],
        meta: {},
        strength: 0.7,
        baseStrength: 0.7,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        accessCount: 0
      },
      {
        id: 'search-3',
        content: 'JavaScript 运行在浏览器中',
        kind: 'fact',
        tags: ['javascript', 'web'],
        meta: {},
        strength: 0.9,
        baseStrength: 0.9,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        accessCount: 0
      }
    ]
    
    for (const memory of memories) {
      await store.saveMemory(memory)
    }
    
    // Search for "TypeScript"
    const results = await store.searchMemories({
      query: 'TypeScript',
      limit: 10
    })
    
    expect(results.length).toBe(1)
    expect(results[0].content).toContain('TypeScript')
  })
  
  it('should handle state operations', async () => {
    const timestamp = Date.now()
    
    await store.setState('test-key', 'test-value', timestamp)
    
    const value = await store.getState('test-key')
    expect(value).toBe('test-value')
    
    await store.deleteState('test-key')
    const deletedValue = await store.getState('test-key')
    expect(deletedValue).toBeNull()
  })
  
  it('should log and retrieve timeline events', async () => {
    const event = {
      id: 'event-1',
      type: 'memory' as const,
      action: 'create' as const,
      refKey: 'mem-1',
      content: '测试事件',
      timestamp: Date.now()
    }
    
    await store.logEvent(event)
    
    const events = await store.getEvents({ limit: 10 })
    expect(events.length).toBe(1)
    expect(events[0].id).toBe(event.id)
    expect(events[0].content).toBe(event.content)
  })
  
  it('should get statistics', async () => {
    // Add some test data
    const memory: Memory = {
      id: 'stats-1',
      content: '统计测试',
      kind: 'fact',
      tags: [],
      meta: {},
      strength: 0.5,
      baseStrength: 0.5,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0
    }
    
    await store.saveMemory(memory)
    await store.setState('key1', 'value1', Date.now())
    
    const stats = await store.getStats()
    expect(stats.memoryCount).toBe(1)
    expect(stats.stateKeyCount).toBe(1)
    expect(stats.snapshotCount).toBe(0)
  })
})