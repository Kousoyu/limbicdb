# LimbicDB

**Embedded cognitive memory database for AI agents.**

Like SQLite for databases. But for agent memory with cognitive science principles.

```bash
npm install limbicdb
```

```typescript
import { open } from 'limbicdb'

const memory = open('./agent.limbic')

// Remember
await memory.remember('User prefers React with TypeScript')
await memory.remember('Project uses PostgreSQL on port 5432')

// Recall (full-text search + semantic when available)
const context = await memory.recall('tech stack')
// → [{ content: 'User prefers React with TypeScript', strength: 0.62, kind: 'preference', ... },
//    { content: 'Project uses PostgreSQL on port 5432', strength: 0.58, kind: 'fact', ... }]

// Persist state across restarts
await memory.set('task', { name: 'Build login page', progress: 0.7 })
// ... process crashes, restarts ...
const task = await memory.get('task') // { name: 'Build login page', progress: 0.7 }

await memory.close()
```

**One file. No server. No config. No external dependencies.**

---

## Why LimbicDB?

| Problem | Current solutions | LimbicDB |
|---------|-------------------|-----------|
| Agent forgets after restart | Write JSON files manually | `open('./agent.limbic')` — done |
| Context management is painful | Dump entire chat history | Smart recall with relevance scoring |
| Memory grows unbounded | Manual cleanup | **Automatic forgetting** based on cognitive science |
| Need a vector database | Deploy Qdrant/Pinecone | Built-in, or use FTS5 with zero setup |
| Can't audit agent decisions | Console.log everywhere | Full timeline with event history |

## Key Innovation: Memories That Fade

LimbicDB doesn't just store — it **forgets intelligently**.

Based on the [Ebbinghaus forgetting curve](https://en.wikipedia.org/wiki/Forgetting_curve) and [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition):

- Memories **decay over time** (configurable half-life)
- Memories accessed frequently **grow stronger**
- Unimportant memories **disappear automatically**
- Important memories **persist indefinitely**

```typescript
const memory = open({
  path: './agent.limbic',
  decay: {
    halfLifeHours: 168, // 7 days: memory halves in strength each week
  }
})

// This memory will fade if never recalled
await memory.remember('User mentioned they had lunch at noon')

// This memory will strengthen each time it's recalled  
await memory.remember('User is a senior React developer')

// Two weeks later...
await memory.recall('user background')
// → Returns the React developer fact (recalled often, still strong)
// → The lunch fact has already been pruned (never recalled, decayed to zero)
```

**This is how human memory works.** Now your agent has it too.

## Memory Types (Cognitive Primitives)

LimbicDB automatically classifies memories based on cognitive science:

| Kind | Description | Example | Brain Region |
|------|-------------|---------|--------------|
| `fact` | Definite knowledge | "The API runs on port 3000" | Semantic Memory |
| `episode` | Event / experience | "Yesterday we refactored the auth module" | Episodic Memory |
| `preference` | User preference | "User prefers functional components" | Implicit Memory |
| `procedure` | How to do something | "Deploy: first build, then push to main" | Procedural Memory |
| `goal` | Current objective | "Need to finish the dashboard by Friday" | Working Memory |

```typescript
// Auto-classified
await memory.remember('User prefers dark theme') // → 'preference'
await memory.remember('Yesterday we fixed the login bug') // → 'episode'
await memory.remember('Need to deploy by EOD') // → 'goal'

// Manual override
await memory.remember('PostgreSQL rocks', { kind: 'preference' })

// Filter by kind
await memory.recall('', { kind: 'goal' }) // only current goals
```

## API Reference (Quick)

### `open(path)` / `open(config)`
Create or open a LimbicDB instance.

### `remember(content, options?)`
Store a memory with auto-classification.

### `recall(query, options?)`
Retrieve relevant memories (FTS5 + optional semantic).

### `forget(filter)`
Explicitly forget memories (safety filters required).

### `get(key)` / `set(key, value)`
Persistent key-value state.

### `history(options?)`
Query the timeline of all operations.

### `snapshot()`
Create a point-in-time snapshot.

---

## Philosophy

> "The art of being wise is the art of knowing what to overlook."
> — William James

Most memory systems try to remember everything. LimbicDB knows that **forgetting is just as important as remembering**. An agent drowning in irrelevant memories is worse than one with no memory at all.

LimbicDB gives your agent a memory that works like yours: it fades, it strengthens through use, and it keeps what matters.

## Why "Limbic"?

The **limbic system** is the part of the brain responsible for emotion, behavior, motivation, and long-term memory. It's where memories are formed, consolidated, and retrieved. 

LimbicDB brings these cognitive principles to AI agents.

## License

MIT

---

*Inspired by Ebbinghaus (1885), Tulving (1972), and ACT-R (1993).*