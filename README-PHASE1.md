# LimbicDB - Phase 1: Debuggable Memory

> Your AI has memory. You just can't see it. LimbicDB makes memory observable, explainable, and controllable.

## ⚠️ Your AI is Lying to You

```bash
# Add conflicting memories
limbic remember "User likes anime"
limbic remember "User hates anime"

# Ask your AI
limbic ask "What does the user like?"
```

Output (may vary):

> The user likes anime.

Run again:

> The user dislikes anime.

Your AI is inconsistent — not because of the model, but because its **memory is a black box**.

## 🔍 Now you can see why

```bash
limbic explain "anime"
```

Output:

```
Found 2 matching memories:

1. "User likes anime"
   Score: 0.820
   Reasons: exact match: "anime", strength: 0.50
   Created: 3/29/2026, 8:38:45 PM

2. "User hates anime"  
   Score: 0.790
   Reasons: exact match: "anime", strength: 0.50
   Created: 3/29/2026, 8:38:45 PM

⚠️ Conflict detected between memories

Decision trace:
  • retrieved 2 total memories
  • filtered to 2 relevant memories
  • applied keyword matching
  • detected conflicting sentiments
```

## 🧠 Fix it

```bash
limbic forget "User hates anime"
```

```bash
limbic ask "What does the user like?"
```

> The user likes anime.

## 🕒 Trace memory over time

```bash
limbic timeline "anime"
```

```
[8:38:45 PM] User hates anime
[8:38:45 PM] User likes anime
```

## Why LimbicDB?

* **Deterministic recall**: Same input → same output
* **Explainable retrieval**: See *why* something was returned  
* **Debuggable memory**: Inspect, trace, resolve conflicts

## Status

* **Core**: Keyword-based deterministic recall (stable)
* **Phase 1 Focus**: Memory explainability and debugging
* **Experimental**: Semantic/hybrid search (disabled by default)

## Philosophy

Memory should not be a black box.