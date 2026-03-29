# LimbicDB

> Your AI has memory. You just can't see it. **LimbicDB makes memory observable, explainable, and controllable.**

[![npm version](https://img.shields.io/npm/v/limbicdb.svg)](https://www.npmjs.com/package/limbicdb)
[![npm downloads](https://img.shields.io/npm/dm/limbicdb.svg)](https://www.npmjs.com/package/limbicdb)
[![Node.js version](https://img.shields.io/node/v/limbicdb.svg)](https://nodejs.org/)
[![License](https://img.shields.io/npm/l/limbicdb.svg)](LICENSE)

## 🎯 **Debuggable Memory - The Core Innovation**

### ⚠️ **Your AI is Lying to You**

```bash
# Add conflicting memories
limbic remember "User likes anime"
limbic remember "User hates anime"

# Ask your AI  
limbic ask "What does the user like?"
```

**Output (may vary):**
> The user likes anime.

**Run again:**
> The user dislikes anime.

Your AI is inconsistent — not because of the model, but because its **memory is a black box**.

### 🔍 **Now You Can See Why**

```bash
limbic explain "anime"
```

**Output:**
```
Found 2 matching memories:

1. "User likes anime"
   Score: 0.820
   Reasons: exact match: "anime", strength: 0.50

2. "User hates anime"  
   Score: 0.790
   Reasons: exact match: "anime", strength: 0.50

⚠️ Conflict detected between memories

Decision trace:
  • retrieved 2 relevant memories
  • applied keyword matching and scoring  
  • detected conflicting sentiments
```

### 🧠 **Fix It**

```bash
limbic forget "User hates anime"
```

```bash
limbic ask "What does the user like?"
```

> The user likes anime.

## 🚀 **Complete CLI Command Set**

- `limbic remember <content>` - Add memories to database
- `limbic search <query>` - Search memories with relevance scoring
- `limbic timeline <query>` - View memory timeline with timestamps
- `limbic forget <content>` - Remove memories from database
- `limbic explain <query>` - **NEW!** Explain retrieval decisions with conflict detection

All commands support `--json` output for programmatic access and Python SDK integration.

## 🐍 **Python SDK**

Install with pip:
```bash
pip install limbicdb
```

```python
from limbicdb import Memory

# Initialize memory
memory = Memory(limbicdb_path="/path/to/limbicdb")

# Explain memory retrieval decisions
explanation = memory.explain("anime")
print(f"Conflicts detected: {explanation['conflicts']}")

# Full CRUD operations
memory.remember("User loves Python")
results = memory.search("Python") 
timeline = memory.timeline("Python")
memory.forget("Old memory")
```

## 🤖 **LangChain Integration**

LimbicDB provides drop-in replacement for LangChain memory with debuggable capabilities. Use it as your standard memory backend and call `explain()` after agent runs to understand decisions.

## 💡 **Why LimbicDB?**

- **Deterministic recall**: Same input → same output
- **Explainable retrieval**: See *why* something was returned  
- **Debuggable memory**: Inspect, trace, resolve conflicts
- **Local-first**: SQLite storage, no external dependencies
- **Extensible**: Designed for HTTP API and WebAssembly future extensions

## 📦 **Installation**

### Node.js
```bash
npm install limbicdb
```

### Python  
```bash
pip install limbicdb
```

## 🧪 **Quick Start**

```bash
# Remember something
limbic remember "User prefers React with TypeScript"

# Search memories
limbic search "React"

# Explain decisions
limbic explain "React"

# Timeline view
limbic timeline "React"

# Clean up
limbic forget "User prefers React with TypeScript"
```

## 📈 **Philosophy**

Memory should not be a black box. LimbicDB provides the foundation for truly debuggable AI systems where you can understand, inspect, and control how your AI remembers and uses information.

## 📄 **Documentation**

- [API Reference](docs/api.md)
- [CLI Commands](docs/cli.md)  
- [Python SDK Guide](docs/python-sdk.md)
- [LangChain Integration](docs/langchain.md)

## 📜 **License**

MIT

---

**Note**: This is the stable v1.0.1 release with complete Debuggable Memory functionality. For the latest development version, see the [GitHub repository](https://github.com/Kousoyu/limbicdb).