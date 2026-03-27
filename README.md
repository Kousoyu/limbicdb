# LimbicDB

English | [简体中文](./README.zh-CN.md)

**A local-first memory engine for embedded agents.**

Store what matters, recall it with context, and inspect why it was used — in a single local file.

## Why LimbicDB

Most agent memory tools focus on storage or retrieval alone. LimbicDB is built around the full memory lifecycle:

- **Remember** important information
- **Recall** relevant context when needed
- **Forget** or prune low-value memory over time
- **Inspect** why something was recalled
- **Compact** noisy memory into cleaner long-lived state

LimbicDB is designed for agents that need durable, inspectable memory without requiring a server, a hosted platform, or a heavyweight runtime.

## What LimbicDB is

- A **local-first** memory engine
- A **one-file** durable store for agent memory
- A **memory lifecycle** runtime: remember, recall, forget, inspect
- A **pluggable** foundation for local and embedded agents

## What LimbicDB is not

- Not an agent runtime
- Not a workflow orchestrator
- Not a cloud memory platform
- Not a graph database
- Not a “human-brain simulator”

## Quick Start

```ts
import { open } from 'limbicdb'

const memory = open('./agent.limbic')

await memory.remember('User prefers concise answers')
await memory.remember('Project uses PostgreSQL')

const results = await memory.recall('user preferences')

await memory.close()
```

## Core Principles

* **Local-first by default**
 Your memory stays in a local file unless you choose otherwise.

* **Inspectable, not magical**
 Memory should be explainable, reviewable, and auditable.

* **Lightweight, not bloated**
 Designed to be embedded inside agents and tools without dragging in a platform.

* **Model-agnostic**
 Useful without a specific model provider, with optional enhancements when available.

## Known Limitations (Alpha)

LimbicDB 0.3.0-alpha is focused on establishing reliable foundations. Current limitations include:

* **Chinese / CJK search support is limited**  
  FTS5 default configuration has limitations with CJK characters; search may not match partial words or characters within multi-character terms.

* **Partial word matching not guaranteed**  
  Searching for "test" may not match "testing" or "tested" depending on exact FTS configuration.

* **Current search is keyword-based, not semantic**  
  `recall()` uses local text matching and ranking, not embedding-based semantic search.

* **Memory format stability**  
  The `.limbic` file format may change between alpha releases.

These limitations are documented for transparency. Future releases will address them based on user feedback.

## Feedback

LimbicDB is still in alpha.

If you try it, the most helpful feedback is:
- install/setup problems
- recall behavior that feels surprising
- backend differences between memory and SQLite
- CJK / Chinese search issues
- places where the README feels stronger than the real product

Please open an issue using the built-in templates.

## Current Status

To avoid confusion between what's implemented today and what's planned for the future, here's a clear breakdown:

### Current (implemented and stable)
* **One-file SQLite storage** - `.limbic` file format
* **Dual backends** - Memory (fast, volatile) + SQLite (persistent)
* **Contract-tested semantics** - 34 tests ensure memory and SQLite backends behave identically
* **Keyword-based recall** - Local text matching and ranking
* **Memory lifecycle** - remember, recall, forget, inspect, history
* **Auto-classification** - facts, episodes, preferences, procedures, goals

### Experimental (improving, may change)
* **CJK search enhancement** - Hybrid FTS5 + LIKE fallback for Chinese/Japanese/Korean text
* **Inspectability depth** - Understanding why memories were recalled
* **Compaction behavior** - Noise reduction and long-term memory consolidation

### Experimental (improving, may change)
* **Embedding / semantic recall** - Vector-based similarity search (bring-your-own embedder, v0.4 alpha)
* **CJK search enhancement** - Hybrid FTS5 + LIKE fallback for Chinese/Japanese/Korean text
* **Inspectability depth** - Understanding why memories were recalled
* **Compaction behavior** - Noise reduction and long-term memory consolidation

### Planned (not yet implemented)
* **Richer explanation APIs** - Deeper insights into memory decisions
* **Stronger file format guarantees** - Stable `.limbic` format across versions
* **Advanced retention policies** - Sophisticated decay and pruning strategies

## Search Capability Matrix

To set clear expectations about what kind of search works today:

| Capability | Status | Notes |
|------------|--------|-------|
| **English keyword search** | ✅ Stable | Exact and partial word matching with FTS5 |
| **Chinese/CJK exact term** | 🔄 Improving | Hybrid FTS5 + LIKE fallback in alpha.2 |
| **Chinese/CJK partial match** | 🧪 Experimental | Limited support via LIKE fallback |
| **Mixed CJK + English** | 🧪 Experimental | Works but ranking may be suboptimal |
| **Semantic/embedding search** | 🧪 Experimental (bring-your-own embedder) | Memory backend fully implemented, SQLite backend stores embeddings (search in progress) |

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
* stable local file formats for embedded use

## How LimbicDB compares

LimbicDB is not a vector database. It's a memory lifecycle engine. 
This table helps you decide if it fits your use case.

| | LimbicDB | Mem0 | LangChain Memory | ChromaDB | Raw JSON files |
|---|---|---|---|---|---|
| **What it is** | Memory lifecycle engine | Memory-as-a-service | Memory modules for chains | Vector database | DIY |
| **Local, no server** | ✅ Single `.limbic` file | ⚠️ Has local mode, but designed for cloud | ✅ | ✅ | ✅ |
| **No API keys needed** | ✅ | ❌ (cloud) / ✅ (local) | ✅ | ✅ | ✅ |
| **Semantic search** | 🧪 Experimental (bring-your-own embedder) | ✅ Built-in | ✅ Via vector stores | ✅ Core feature | ❌ |
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
   - SQLite store (durable, for production)
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
const context = await memory.recall('allergies')
// → [{ content: 'User is allergic to nuts', strength: 0.85, kind: 'fact', ... }]

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

LimbicDB v0.4 adds semantic search support with bring-your-own embedder:

```typescript
import { open } from 'limbicdb'

// Open with your embedding function
const memory = open({
  path: './agent.limbic',
  embedder: {
    async embed(text) {
      // Use @xenova/transformers, OpenAI, Cohere, or any provider
      // Return number[] vector
      return computeEmbedding(text)
    },
    dimensions: 384
  }
})

// Semantic recall finds meaning, not just keywords
const results = await memory.recall('user interface preferences', {
  mode: 'semantic', // or 'hybrid' or 'keyword'
  limit: 5
})

console.log(`Mode: ${results.meta.mode}`)
console.log(`Fallback: ${results.meta.fallback}`) // true if no embedder
```

See the full example: [`examples/semantic-recall.ts`](examples/semantic-recall.ts)

## License

MIT

---

*Built for embedded agents that need durable, inspectable memory without server dependencies.*