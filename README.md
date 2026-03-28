# LimbicDB

English | [简体中文](./README.zh-CN.md)

**A local-first memory engine for embedded agents.**

Store what matters, recall it with context, and inspect why it was used — in a single local file.

> **Current Status (v1.0.0-beta.1)**: 
> - **SQLite backend**: Keyword search (stable), semantic/hybrid search (experimental-mvp)
> - **Memory backend**: Keyword search (stable), semantic/hybrid search (experimental, bring-your-own embedder)
> - **Snapshot parity**: Embeddings included in snapshots (both backends, beta feature)
> - **Release discipline**: CI/CD, version consistency, example validation (beta rigor)

## Backend Capability Matrix

| Feature | SQLite Backend (`open('./agent.limbic')`) | Memory Backend (`open(':memory:')`) |
|---------|-------------------------------------------|-------------------------------------|
| **Keyword search** | stable (FTS5 + LIKE fallback) | stable |
| **Semantic search** | 🧪 Experimental (MVP) | 🧪 Experimental (bring-your-own embedder) |
| **Hybrid search** | 🧪 Experimental (MVP) | 🧪 Experimental (70% semantic, 30% keyword) |
| **Persistent storage** | ✅ Single `.limbic` file | ❌ Volatile (in-memory only) |
| **Snapshot/Restore** | ✅ (with embeddings) | ✅ (with embeddings) |
| **File-based** | ✅ | ❌ |

## Quick Start (Choose Your Path)

### Path 1: Durable Local File (SQLite Backend)
```typescript
import { open } from 'limbicdb'

// Default path uses SQLite backend - durable, file-based
const memory = open('./agent.limbic')

await memory.remember('User prefers concise answers')
await memory.remember('Project uses PostgreSQL')

const results = await memory.recall('user preferences', { mode: 'keyword' })

await memory.close()
```

### Path 2: Experimental Semantic Prototype (Memory Backend)
```typescript
import { open } from 'limbicdb'

// ':memory:' path uses memory backend - supports semantic search
const memory = open(':memory:')

// To use semantic search, provide an embedder
const memoryWithEmbedder = open({
  path: ':memory:',
  embedder: {
    async embed(text) { /* your embedding function */ },
    dimensions: 384
  }
})

const results = await memoryWithEmbedder.recall('query', { mode: 'semantic' })
```

## Development Requirements

- **Node.js**: 20.19.0+, 22.13.0+, or 24.0.0+ (required by ESLint 10 & Vitest 4)
- **npm**: 10+ or equivalent
- **TypeScript**: 5.4+

**Note for contributors**: The development toolchain requires newer Node.js versions. The published npm package may support older Node.js versions for runtime usage.

## Why LimbicDB

Most agent memory tools focus on storage or retrieval alone. LimbicDB is built around the full memory lifecycle:

- **Remember** important information
- **Recall** relevant context when needed
- **Forget** or prune low-value memory over time
- **Inspect** why something was recalled
- **Compact** noisy memory into cleaner long-lived state

LimbicDB is designed for agents that need durable, inspectable memory without requiring a server, a hosted platform, or a heavyweight runtime.

## Core Principles

* **Local-first by default**
 Your memory stays in a local file unless you choose otherwise.

* **Inspectable, not magical**
 Memory should be explainable, reviewable, and auditable.

* **Lightweight, not bloated**
 Designed to be embedded inside agents and tools without dragging in a platform.

* **Model-agnostic**
 Useful without a specific model provider, with optional enhancements when available.

* **Truthful about limitations**
 We document what doesn't work as clearly as what does.

## Known Limitations (Alpha)

LimbicDB v0.4.0-alpha.3 has these current limitations:

* **Chinese / CJK search support is limited**  
  FTS5 default configuration has limitations with CJK characters; search may not match partial words or characters within multi-character terms.

* **Partial word matching not guaranteed**  
  Searching for "test" may not match "testing" or "tested" depending on exact FTS configuration.

* **SQLite semantic/hybrid search experimental**  
  The default `open('./agent.limbic')` path uses SQLite backend where semantic/hybrid search is now available in MVP form but still experimental.

* **Memory format stability**  
  The `.limbic` file format may change between alpha releases.

* **Snapshot parity now complete**  
  SQLite snapshots now include embeddings (MVP).

These limitations are documented for transparency. Future releases will address them based on user feedback.

## Feedback

LimbicDB is still in alpha.

If you try it, the most helpful feedback is:
- install/setup problems
- recall behavior that feels surprising
- documentation mismatches with actual behavior
- places where the README feels stronger than the real product

Please open an issue using the built-in templates.

## Documentation

For troubleshooting common issues, see:
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Solutions to common "trust-breaking" issues
- [BETA-ENTRANCE-CRITERIA.md](./BETA-ENTRANCE-CRITERIA.md) - Criteria for moving from alpha to beta

Key topics covered:
- Why semantic/hybrid search falls back to keyword
- Differences between SQLite and memory backends
- When embeddings become available for search
- Current CJK search boundaries and limitations
- Performance characteristics and expectations

## Current Implementation Status

### SQLite Backend (`open('./agent.limbic')`)
**Current (alpha)**:
* ✅ **One-file storage** - `.limbic` SQLite file format
* ✅ **Keyword search** - FTS5 + LIKE fallback for English and basic CJK
* ✅ **Memory lifecycle** - remember, recall, forget, inspect, history
* ✅ **Auto-classification** - facts, episodes, preferences, procedures, goals
* ✅ **State storage** - get/set for memory-adjacent state
* ✅ **Timeline auditing** - full operation history

**In progress**:
* 🔄 **Embedding storage** - basic integration complete
* 🧪 **Semantic search** - experimental MVP implementation
* 🧪 **Hybrid search** - experimental MVP implementation
* ✅ **Snapshot parity** - embeddings now included in snapshots

### Memory Backend (`open(':memory:')`)
**Current (alpha)**:
* ✅ **Keyword search** - local text matching
* ✅ **Memory lifecycle** - full lifecycle operations
* ✅ **Auto-classification** - same as SQLite backend
* ✅ **State storage** - in-memory key-value
* ✅ **Timeline auditing** - operation history

**Experimental (v0.4 alpha)**:
* 🧪 **Semantic search** - vector-based similarity (bring-your-own embedder)
* 🧪 **Hybrid search** - 70% semantic + 30% keyword weighting
* 🧪 **Embedding integration** - async computation, final consistency model
* 🧪 **Snapshot with embeddings** - embeddings included in snapshots

### Cross-Backend
* ✅ **Contract testing** - 34 tests ensure memory and SQLite backends behave identically
* ✅ **Unified API** - Same interface for both backends
* ✅ **Error handling** - Graceful fallbacks when features unavailable

## Search Capability Matrix

To set clear expectations about what kind of search works today:

| Capability | Status | Notes |
|------------|--------|-------|
| **English keyword search** | ✅ Stable | Exact and partial word matching with FTS5 |
| **Chinese/CJK exact term** | 🔄 Improving | FTS5 + LIKE fallback works for exact matches (tested) |
| **Chinese/CJK partial match** | 🔄 Improving | LIKE fallback provides substring matching (tested) |
| **Mixed CJK + English** | 🔄 Improving | Hybrid approach handles mixed queries (tested) |
| **Semantic/embedding search** | 🧪 Experimental (bring-your-own embedder) | Memory backend experimental, SQLite backend experimental MVP |

**Status Key:**
* ✅ **Stable** - Reliable, tested, ready for use
* 🔄 **Improving** - Functional but actively being refined
* 🧪 **Experimental** - Available but may have limitations
* 📋 **Planned** - On the roadmap, not yet implemented

## Roadmap Direction

LimbicDB is evolving toward a reliable memory runtime with:

* stronger recall semantics
* inspectable retrieval decisions
* retention and pruning policies
* compaction for long-lived memory stores
* reliable local file formats for embedded use

## How LimbicDB compares

LimbicDB is not a vector database. It's a memory lifecycle engine.
This table helps you decide if it fits your use case.

| | LimbicDB | Mem0 | LangChain Memory | ChromaDB | Raw JSON files |
|---|---|---|---|---|---|
| **What it is** | Memory lifecycle engine | Memory-as-a-service | Memory modules for chains | Vector database | DIY |
| **Local, no server** | ✅ Single `.limbic` file | ⚠️ Has local mode, but designed for cloud | ✅ | ✅ | ✅ |
| **No API keys needed** | ✅ | ❌ (cloud) / ✅ (local) | ✅ | ✅ | ✅ |
| **Semantic search** | 🧪 Experimental (both backends, bring-your-own embedder) | ✅ Built-in | ✅ Via vector stores | stable feature | ❌ |
| **Keyword search** | ✅ FTS5 + LIKE fallback | ✅ | ✅ | ⚠️ Limited | ❌ |
| **Memory decay / forgetting** | ✅ Half-life model | ⚠️ Basic | ❌ | ❌ | ❌ |
| **Auto-classification** | ✅ fact/episode/preference/procedure/goal | ❌ | ❌ | ❌ | ❌ |
| **Full operation history** | ✅ Auditable timeline | ❌ | ❌ | ❌ | ❌ |
| **One-file portable** | ✅ Copy/backup one file | ❌ | ❌ | ❌ | ✅ |
| **Language** | TypeScript/JS | Python | Python | Python/JS | Any |
| **Maturity** | Alpha | Production | Production | Production | N/A |

**Choose LimbicDB if:** You need a local, portable, inspectable memory store for a single agent, and you care about memory lifecycle (decay, forgetting, auditing) more than raw vector search performance.

**Don't choose LimbicDB if:** You need production-grade semantic search today, Python-native integration, or cloud-scale multi-tenant memory. Use Mem0, Chroma, or LangChain Memory instead.

> We'd rather you pick the right tool than pick us. If LimbicDB isn't right for your case, these alternatives are genuinely good.

## Relationship to CogniCore

LimbicDB focuses on **memory**.
CogniCore focuses on **runtime orchestration, governance, and recovery**.

If you use both together:

* **CogniCore** decides how the agent runs
* **LimbicDB** decides how memory is stored, recalled, and maintained

**Important:** LimbicDB and CogniCore are **separate, independently versioned projects**. You can use LimbicDB without CogniCore, and vice versa.

---

## API Reference (Quick)

### `open(path)` / `open(config)`
Create or open a LimbicDB instance.

### `remember(content, options?)`
Store a memory with auto-classification.

### `recall(query, options?)`
Retrieve relevant memories (local search and ranking).

### `forget(filter)`
Explicitly forget memories (safety filters required).

### `get(key)` / `set(key, value)`
Persistent key-value state (memory-adjacent state only).

### `history(options?)`
Query the timeline of all operations.

### `snapshot()`
Create a point-in-time snapshot.

### `close()`
Cleanly close the database.

---

## Memory Classification

LimbicDB automatically classifies memories into semantic types:

| Kind | Description | Example |
|------|-------------|---------|
| `fact` | Definite knowledge | "The API runs on port 3000" |
| `episode` | Event / experience | "Yesterday we refactored the auth module" |
| `preference` | User preference | "User prefers functional components" |
| `procedure` | How to do something | "Deploy: first build, then push to main" |
| `goal` | Current objective | "Need to finish the dashboard by Friday" |

```typescript
// Auto-classified
await memory.remember('User prefers dark theme') // → 'preference'
await memory.remember('Yesterday we fixed the login bug') // → 'episode'

// Manual override
await memory.remember('PostgreSQL rocks', { kind: 'preference' })
```

## Memory Strength and Retention

Memories in LimbicDB have a strength score that evolves over time:

- Memories accessed frequently **grow stronger**
- Memories not recalled **gradually fade**
- Low-strength memories may be **automatically pruned**
- Important memories can be **explicitly preserved**

```typescript
const memory = open({
  path: './agent.limbic',
  decay: {
    halfLifeHours: 168, // 7 days: memory halves in strength each week
    pruneThreshold: 0.01, // Remove memories below this strength
  }
})
```

## Architecture

LimbicDB is built around a simple but powerful core:

1. **Storage Abstraction**
   - In-memory store (fast, for development)
   - SQLite store (durable, for persistent scenarios)
   - Unified interface for future backends

2. **Memory Lifecycle**
   - Write-time classification and tagging
   - Recall-time relevance scoring
   - Background decay and pruning
   - Optional compression and consolidation

3. **Local-First Design**
   - Single file format (`.limbic` SQLite database)
   - No external dependencies by default
   - Pluggable search enhancements when needed

## Getting Started

### Installation

```bash
npm install limbicdb
```

### Basic Usage

```typescript
import { open } from 'limbicdb'

// Open a memory store (automatically chooses backend)
const memory = open('./agent.limbic')

// Remember something important
await memory.remember('User is allergic to nuts')
await memory.remember('Project deadline is Friday')

// Recall relevant context
const result = await memory.recall('allergies')
// → { memories: [...], meta: { requestedMode: "keyword", executedMode: "keyword", fallback: false } }

// Store memory-adjacent state (not runtime state)
await memory.set('session_summary', {
  lastTopic: 'allergies',
  timestamp: Date.now()
})

// Close cleanly
await memory.close()
```

### Advanced: Explicit Backend Selection

```typescript
import { openMemory, openSQLite } from 'limbicdb'

// Force in-memory backend (development/testing)
const devDb = openMemory(':memory:')

// Force SQLite backend (production)
const prodDb = openSQLite('./agent.limbic')
```

### Semantic Search Example

> **⚠️ Important**: The example below shows the semantic search API. **In v0.4.0-alpha.3, semantic search works with both backends** and is verified in MVP form.
>
> The memory backend (`open(':memory:')`) has a more mature implementation. The SQLite backend (`open('./agent.limbic')`) now supports semantic and hybrid search in MVP form, but may fall back to keyword search if no embeddings are stored yet.

LimbicDB v0.4 alpha adds semantic search support with bring-your-own embedder:

```typescript
import { open } from 'limbicdb'

// Option 1: Memory backend (full semantic search in v0.4 alpha)
const memoryBackend = open({
  path: ':memory:',  // Memory backend supports full semantic search
  embedder: {
    async embed(text) {
      // Use @xenova/transformers, OpenAI, Cohere, or any provider
      // Return number[] vector
      return computeEmbedding(text)
    },
    dimensions: 384
  }
})

// Semantic recall with memory backend
const memoryResults = await memoryBackend.recall('user interface preferences', {
  mode: 'semantic', // Works fully with memory backend
  limit: 5
})

console.log(`Memory backend mode: ${memoryResults.meta.mode}`) // Should be 'semantic'
console.log(`Fallback: ${memoryResults.meta.fallback}`) // Should be false

// Option 2: SQLite backend (verified semantic search MVP)
const sqliteBackend = open({
  path: './agent.limbic',  // SQLite backend - semantic search verified MVP
  embedder: {
    async embed(text) { return computeEmbedding(text) },
    dimensions: 384
  }
})

const sqliteResults = await sqliteBackend.recall('user interface preferences', {
  mode: 'semantic',
  limit: 5
})

console.log(`SQLite backend mode: ${sqliteResults.meta.mode}`) // Could be 'semantic' or 'keyword' if fallback
console.log(`Fallback: ${sqliteResults.meta.fallback}`) // false if embeddings exist, true otherwise
console.log(`Requested: ${sqliteResults.meta.requestedMode}`) // 'semantic'
console.log(`Executed: ${sqliteResults.meta.executedMode}`) // 'semantic' if successful, 'keyword' if fallback
```

See the full example: [`examples/semantic-recall.ts`](examples/semantic-recall.ts)

For a complete example with durable file storage and snapshots, see:
[`examples/durable-semantic-snapshot.ts`](examples/durable-semantic-snapshot.ts)

## Performance Baseline

Two performance benchmarking tools are available:

### 1. Detailed Benchmark (`search-benchmark.ts`)
Measures search performance across different modes and memory scales:

```bash
npx tsx benchmarks/search-benchmark.ts
```

Measures:
- **Keyword search**: SQLite FTS5 performance
- **Semantic search**: Brute-force cosine similarity scaling  
- **Hybrid search**: Combined scoring performance
- **Embedding computation**: Async embedding throughput

### 2. Backend Comparison Baseline (`performance-baseline.ts`)
Generates a markdown table comparing SQLite and memory backends:

```bash
npx tsx benchmarks/performance-baseline.ts
```

Outputs a markdown report with:
- **Both backends**: SQLite (file) vs memory (:memory:)
- **Three memory scales**: 100, 1,000, 5,000 memories
- **Three search modes**: keyword, semantic, hybrid
- **Interpretation notes**: Scaling characteristics and limitations

**Note**: These are internal benchmarking tools for development and comparison. Results are baselines only, not production metrics. The alpha implementation uses brute-force vector search which scales linearly with memory count.

## License

MIT

---

*Built for embedded agents that need durable, inspectable memory without server dependencies.*

<!-- Public sync check: 2026-03-28 03:38 GMT+8 -->