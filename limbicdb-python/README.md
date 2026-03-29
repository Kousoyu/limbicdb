# LimbicDB Python SDK

Debuggable memory layer for AI agents

## Installation

```bash
pip install limbicdb
```

> **Note**: This package requires [LimbicDB](https://github.com/Kousoyu/limbicdb) to be installed locally.
> The Python SDK is a thin wrapper around the LimbicDB CLI.

## Quick Start

```python
from limbicdb import Memory

# Initialize memory with default path
memory = Memory()

# Explain memory retrieval decisions
explanation = memory.explain("anime")
print(explanation)

# Check for conflicts
if explanation["conflicts"]:
    print("⚠️  Conflicting memories detected!")
```

## Features

- **Explainable Memory**: See why your AI retrieved specific memories
- **Conflict Detection**: Identify contradictory information in your memory
- **Decision Tracing**: Understand the full retrieval process
- **LangChain Integration**: Use as a drop-in replacement for LangChain memory

## LangChain Integration

```python
from langchain.memory import ConversationBufferMemory
from limbicdb import Memory

# Create LimbicDB memory
limbic_memory = Memory()

# Use in LangChain agent
agent = Agent(
    memory=limbic_memory,
    # ... other agent configuration
)

# After agent runs, explain decisions
explanation = limbic_memory.explain("user query")
```

## Requirements

- Python 3.8+
- Node.js 18+
- LimbicDB installed locally

## Philosophy

Memory should not be a black box. LimbicDB makes AI memory observable, explainable, and controllable.

## License

MIT