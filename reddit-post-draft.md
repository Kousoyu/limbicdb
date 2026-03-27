# LimbicDB v0.4.0-alpha.1: Local-First Semantic Memory for Embedded Agents (Bring-Your-Own Embedder)

Hi r/LocalLLaMA,

I've just released LimbicDB v0.4.0-alpha.1, a local-first memory engine that now supports semantic search with a bring-your-own embedder approach. Since this community cares about local/offline AI, I thought you might find it interesting.

## What is LimbicDB?
- **Local-first memory engine** for embedded agents (single `.limbic` SQLite file)
- **No API keys, no servers** - everything runs locally
- **Memory lifecycle management** with decay/forgetting curves
- **Fully inspectable** - complete audit trail of all operations

## What's New in v0.4.0-alpha.1: Semantic Search Prototype

### The Problem I'm Trying to Solve
Most memory systems for agents are either:
1. **Pure keyword search** (limited recall)
2. **Cloud-based vector DBs** (API keys, latency, data privacy)
3. **Complex to set up** (sqlite-vss compilation, native dependencies)

LimbicDB takes a different approach: **bring-your-own embedder** with **brute-force cosine similarity**.

### Key Features
- **Three search modes**: `keyword` (traditional), `semantic` (vector), `hybrid` (30% keyword + 70% semantic)
- **Bring-your-own embedder**: Use @xenova/transformers, OpenAI, Cohere, or any provider
- **Zero native dependencies**: No sqlite-vss compilation needed (pure JavaScript cosine similarity)
- **Cross-platform**: Works anywhere Node.js works
- **Memory decay**: Based on Ebbinghaus forgetting curve
- **Auto-classification**: facts, episodes, preferences, procedures, goals

### Example: Semantic Search with @xenova/transformers
```typescript
import { open } from 'limbicdb';
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
async function embed(text: string) {
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

const memory = open({
  path: './agent.limbic',
  embedder: { embed, dimensions: 384, modelHint: 'all-MiniLM-L6-v2' }
});

await memory.remember('User prefers dark mode in all applications');
const result = await memory.recall('UI preferences', { mode: 'semantic' });
// Finds "dark mode" memory even though query has no keyword overlap
```

### Design Decisions (Why Brute-Force?)
1. **No compilation** - avoids sqlite-vss cross-platform issues
2. **<10K memories is fast enough** for most embedded agent use cases
3. **Simple is better than perfect** for a prototype
4. **User controls the embedder** - use local models (all-MiniLM-L6-v2) or cloud APIs

### Current Limitations (Alpha Phase)
- **Brute-force search** - may slow down with >10K memories
- **SQLite backend** semantic search is TODO (currently falls back to keyword)
- **No vector indexing** - simple linear search
- **Snapshot/restore** doesn't include embeddings yet

## Why This Might Be Interesting for Local LLM Enthusiasts
1. **Complete local stack**: Local LLM + local embeddings + local memory store
2. **Privacy**: Your agent's memories stay on your machine
3. **Inspectability**: See exactly why memories were recalled (unlike black-box vector DBs)
4. **Memory lifecycle**: Not just storage, but forgetting/decay based on cognitive science

## Try It Out
```bash
npm install limbicdb@alpha
```

Full example: [semantic-recall.ts](https://github.com/Kousoyu/limbicdb/blob/main/examples/semantic-recall.ts)
GitHub: https://github.com/Kousoyu/limbicdb
npm: https://www.npmjs.com/package/limbicdb

## Looking for Feedback
I'm particularly interested in:
1. **Interface design**: Is the `mode` parameter approach intuitive?
2. **Performance**: Is brute-force search acceptable for your use case?
3. **Embedder integration**: Does bring-your-own work for your setup?
4. **Missing features**: What would make this actually useful for your local AI projects?

This is very much an alpha/prototype - the goal is to validate whether this architecture makes sense before investing more time. Your feedback will shape what gets prioritized next (SQLite semantic search, performance optimizations, more features).

Thanks for reading!