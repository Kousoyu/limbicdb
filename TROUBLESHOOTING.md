# Troubleshooting

Common issues and solutions for LimbicDB.

> **Status**: Alpha (v0.4.0-alpha.3) - These are the most common "trust-breaking" issues.

## Quick Diagnosis

If something isn't working as expected:

```bash
# 1. Run verification
npm run verify

# 2. Run examples
npx tsx examples/coding-agent-memory.ts

# 3. Check mode execution
npm run test -- --run test/semantic.test.ts
```

## 1. Semantic/Hybrid Search Falls Back to Keyword

**Symptom**: You request `mode: 'semantic'` or `mode: 'hybrid'` but get keyword results with `fallback: true` in meta.

### Why This Happens

Semantic/hybrid search requires **embeddings**. Fallback occurs when:

| Scenario | SQLite Backend | Memory Backend |
|----------|----------------|----------------|
| **No embedder configured** | ✅ Fallback to keyword | ✅ Fallback to keyword |
| **Embedder configured but no embeddings computed yet** | ✅ Fallback to keyword | ✅ Fallback to keyword |
| **Embeddings exist for some but not all memories** | ⚠️ Partial fallback (only memories with embeddings) | ⚠️ Partial fallback |
| **Embedder throws error** | ✅ Fallback to keyword | ✅ Fallback to keyword |

### Diagnosis Steps

```javascript
const memory = open({
  path: './agent.limbic',
  embedder: { /* your embedder */ }
})

// 1. Check stats for embeddings
console.log(memory.stats.embeddingsCount) // Should be > 0
console.log(memory.stats.embeddingsDimensions) // Should match your embedder

// 2. Check if embeddings are computed
const result = await memory.recall('test', { mode: 'semantic' })
console.log(result.meta)
// Look for: fallback, pendingEmbeddings, executedMode
```

### Solutions

**A. Wait for embeddings to compute**
```javascript
// Embeddings compute asynchronously
await memory.remember('Important fact') // Starts embedding computation
await new Promise(resolve => setTimeout(resolve, 1000)) // Wait a bit
// Now semantic search should work
```

**B. Force embedding computation (memory backend only)**
```javascript
// Memory backend: all embeddings compute immediately
const memoryBackend = open({
  path: ':memory:',
  embedder: { /* your embedder */ }
})
// No delay needed for memory backend
```

**C. Check embedder configuration**
```javascript
// Common mistake: wrong dimensions
const memory = open({
  path: './agent.limbic',
  embedder: {
    async embed(text) {
      // Must return number[]
      return [0.1, 0.2, 0.3] // Example: 3 dimensions
    },
    dimensions: 3 // Must match actual vector length!
  }
})
```

## 2. SQLite vs Memory Backend Differences

**Symptom**: Code works with `:memory:` but not with `./agent.limbic`, or performance differs significantly.

### Key Differences

| Aspect | SQLite Backend (`open('./agent.limbic')`) | Memory Backend (`open(':memory:')`) |
|--------|------------------------------------------|------------------------------------|
| **Storage** | Persistent file | Volatile (RAM only) |
| **Semantic search** | MVP - requires embeddings in file | Full - embeddings in memory |
| **Embedding availability** | Async, eventual consistency | Immediate after computation |
| **Performance (keyword)** | Fast (FTS5) | Fast (in-memory matching) |
| **Performance (semantic)** | Slower (file I/O + vectors) | Faster (vectors in memory) |
| **Snapshot/restore** | With embeddings (MVP) | With embeddings (full) |

### When to Choose Which

**Use SQLite backend when:**
- You need persistence across sessions
- Memory count > 1,000 (better disk management)
- You're OK with eventual consistency for embeddings
- You want inspectable `.limbic` file

**Use Memory backend when:**
- Testing/development
- Need immediate semantic search
- Memory count < 1,000
- Don't need persistence

### Migration Between Backends

```javascript
// From memory to SQLite (with embeddings)
const memoryBackend = open(':memory:', { embedder })
await memoryBackend.remember('Important memory')

// Take snapshot
const snapshotId = await memoryBackend.snapshot()

// Open SQLite backend
const sqliteBackend = open('./agent.limbic', { embedder })

// Restore snapshot (embeddings included)
await sqliteBackend.restore(snapshotId)
```

**Note**: Direct memory transfer isn't supported. Use snapshot/restore.

## 3. When Are Embeddings Available?

**Symptom**: You configured an embedder but semantic search still doesn't work.

### Embedding Lifecycle

```
remember(text) → [Async] → embedding computed → stored → available for search
```

**Timeline**:
1. **Immediate**: Memory stored (without embedding)
2. **Async (varies)**: Embedding computation starts
3. **Eventually**: Embedding stored, available for semantic search

### Checking Embedding Status

```javascript
const memory = open({ path: './agent.limbic', embedder })

// Add memory
await memory.remember('User prefers dark mode')

// Check immediately (likely 0)
console.log(memory.stats.embeddingsCount) // Might be 0

// Check after delay
await new Promise(resolve => setTimeout(resolve, 2000))
console.log(memory.stats.embeddingsCount) // Should be 1

// Check specific memory
const results = await memory.recall('dark mode', { mode: 'semantic' })
console.log(results.meta.pendingEmbeddings) // Number waiting
```

### Forcing Availability (Workarounds)

**Option A: Wait and retry**
```javascript
async function recallWithRetry(query, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await memory.recall(query, options)
    if (!result.meta.fallback || result.meta.pendingEmbeddings === 0) {
      return result
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
  }
  return await memory.recall(query, { ...options, mode: 'keyword' })
}
```

**Option B: Pre-compute embeddings**
```javascript
// If you control the embedder, compute before remembering
async function rememberWithEmbedding(memory, text) {
  const embedding = await memory.config.embedder.embed(text)
  // Store with pre-computed embedding (not directly supported in alpha)
  // Workaround: Use memory backend, then snapshot to SQLite
}
```

## 4. CJK Search Current Boundaries

**Symptom**: Chinese/Japanese/Korean text search returns unexpected results.

### Current Implementation

LimbicDB uses **hybrid search** for CJK:

1. **FTS5 first**: Standard full-text search (works well for English)
2. **LIKE fallback**: If FTS5 returns insufficient results AND query contains CJK characters

### What Works

| Query Type | Works? | Notes |
|------------|--------|-------|
| **Exact Chinese term** | ✅ Yes | "用户" matches "用户喜欢这个功能" |
| **Partial Chinese characters** | ✅ Yes (via LIKE) | "喜欢" matches "用户喜欢蓝色主题" |
| **Mixed Chinese-English** | ✅ Yes | "user 喜欢" matches mixed content |
| **Japanese text** | ✅ Yes | "これはテストです" matches Japanese content |
| **Korean text** | ✅ Yes | "테스트입니다" matches Korean content |

### What Doesn't Work Well (Alpha Limitations)

| Limitation | Status | Workaround |
|------------|--------|------------|
| **Word segmentation** | ❌ Not supported | Search for full phrases |
| **Synonyms** | ❌ Not supported | Include multiple terms |
| **Traditional/Simplified conversion** | ❌ Not supported | Search both versions |
| **Pinyin matching** | ❌ Not supported | Use Chinese characters |
| **Advanced ranking** | ❌ Basic only | Use `minStrength` filter |

### Testing CJK Search

```javascript
// Test if CJK search works for your use case
const memory = open('./test.limbic')

// Add test memories
await memory.remember('用户喜欢蓝色主题')
await memory.remember('这是测试内容')
await memory.remember('This is English content')

// Test various queries
const queries = [
  '用户',      // Exact match
  '喜欢',      // Partial match
  '蓝色',      // Another partial
  'test',      // English (should work)
  '用户 test', // Mixed
]

for (const query of queries) {
  const results = await memory.recall(query)
  console.log(`"${query}": ${results.memories.length} results`)
}
```

### Improving CJK Results

**Option A: Use tags for better filtering**
```javascript
await memory.remember('用户界面应该简洁', { tags: ['ui', 'chinese'] })
const results = await memory.recall('', { tags: ['chinese'] })
```

**Option B: Combine with other filters**
```javascript
// Get all Chinese content (empty query + kind filter)
const chineseContent = await memory.recall('', {
  kind: 'fact', // or whatever kind you use
  minStrength: 0.3
})
```

## 5. Common Error Messages

### "SQLite backend: semantic search not available, falling back to keyword"

**Cause**: No embeddings available yet.

**Solution**: Wait for embeddings to compute, or use keyword search.

### "Embedding dimensions mismatch"

**Cause**: You changed embedder dimensions between sessions.

**Solution**: Use consistent embedder dimensions, or clear database and start fresh.

### "Database is locked" (SQLite backend)

**Cause**: Multiple processes accessing same `.limbic` file.

**Solution**: Ensure only one LimbicDB instance per file, or use `:memory:` for testing.

### "Expected vector of length X, got Y"

**Cause**: Embedder returns wrong vector size.

**Solution**: Check your embedder implementation returns correct dimensions.

## 6. Performance Issues

### Semantic Search is Slow

**Expected**: Semantic search scales linearly with memory count.

**Baseline performance** (from `npm run benchmark:baseline`):
- 100 memories: ~5ms (SQLite), ~1ms (Memory)
- 1,000 memories: ~50ms (SQLite), ~1ms (Memory)  
- 5,000 memories: ~250ms (SQLite), ~8ms (Memory)

**If slower than baseline**:
1. Check embedder performance
2. Use keyword search for large datasets
3. Consider Memory backend for semantic-heavy use

### Memory Usage High

**SQLite backend**: File grows with memories (~1KB per memory + embeddings).

**Memory backend**: All data in RAM.

**Solution**: Use `forget()` to prune old memories, or increase `pruneThreshold`.

## 7. Getting Help

If you're stuck:

1. **Check the examples** - `examples/` directory
2. **Run verification** - `npm run verify`
3. **Check existing issues** - [GitHub Issues](https://github.com/Kousoyu/limbicdb/issues)
4. **Create minimal reproduction** - Smallest code that shows the problem

**When reporting issues**, include:
- Backend type (SQLite or Memory)
- Embedder configuration (if any)
- Node.js version
- Exact error message
- Reproduction code

---

*Last updated: 2026-03-28 (v0.4.0-alpha.3)*