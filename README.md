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

## Roadmap Direction

LimbicDB is evolving toward a reliable memory runtime with:

* stronger recall semantics
* inspectable retrieval decisions
* retention and pruning policies
* compaction for long-lived memory stores
* stable local file formats for embedded use

## Relationship to CogniCore

LimbicDB focuses on **memory**.
CogniCore focuses on **runtime orchestration, governance, and recovery**.

If you use both together:

* **CogniCore** decides how the agent runs
* **LimbicDB** decides how memory is stored, recalled, and maintained

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

## License

MIT

---

*Built for embedded agents that need durable, inspectable memory without server dependencies.*