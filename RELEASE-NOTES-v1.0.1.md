# LimbicDB v1.0.1 Release Notes

## 🎯 **Debuggable Memory - Finally Available!**

> "Your AI has memory. You just can't see it."  
> **LimbicDB makes memory observable, explainable, and controllable.**

## 🔥 **Core Innovation: Debuggable Memory**

### The Problem: "Your AI is Lying to You"
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

### The Solution: Explainable Retrieval
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

## 🚀 **Complete CLI Command Set**

- `limbic remember <content>` - Add memories to database
- `limbic search <query>` - Search memories with scoring
- `limbic timeline <query>` - View memory timeline
- `limbic forget <content>` - Remove memories from database  
- `limbic explain <query>` - **NEW!** Explain retrieval decisions with conflict detection

All commands support `--json` output for programmatic access.

## 🐍 **Python SDK Integration**

Install with pip:
```bash
pip install limbicdb
```

Basic usage:
```python
from limbicdb import Memory

# Initialize memory
memory = Memory(limbicdb_path="/path/to/limbicdb")

# Explain memory retrieval
explanation = memory.explain("anime")
print(f"Conflicts detected: {explanation['conflicts']}")

# Full CRUD operations
memory.remember("User loves Python")
results = memory.search("Python")
timeline = memory.timeline("Python")
memory.forget("Old memory")
```

## 🤖 **LangChain Integration Ready**

LimbicDB provides drop-in replacement for LangChain memory with debuggable capabilities:
- Use as standard memory backend
- Call `explain()` after agent runs to understand decisions
- Resolve memory conflicts before they cause inconsistent responses

## 📦 **Technical Details**

- **Storage**: SQLite with FTS5 full-text search
- **Performance**: Sub-millisecond recall latency
- **Memory Model**: Strength-based decay with access tracking
- **Conflict Detection**: Semantic opposition detection (likes/hates, love/hate, etc.)
- **Extensibility**: Designed for HTTP API and WebAssembly future extensions

## 🎯 **Use Cases**

1. **AI Agent Debugging**: Understand why your agent gives inconsistent answers
2. **Memory Quality Control**: Identify and resolve conflicting information
3. **Decision Auditing**: Trace how memories influence AI responses
4. **User Experience**: Provide transparent explanations for AI behavior

## 📈 **What's Next**

- **Phase 4**: HTTP API for remote access
- **WebAssembly**: Browser-based memory engine
- **Advanced Conflict Resolution**: Automated conflict detection and resolution
- **Community Ecosystem**: More integrations and adapters

## 🙏 **Special Thanks**

This release represents a complete shift from "black box AI memory" to "debuggable, explainable memory." Thank you for being part of this journey!

---

**Installation:**
- Node.js: `npm install limbicdb`
- Python: `pip install limbicdb`

**Documentation:** [GitHub Repository](https://github.com/Kousoyu/limbicdb)

**License:** MIT