# Changelog

All notable changes to LimbicDB will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0-alpha.3] - 2026-03-28

### 🎯 Truthful Alpha Release (Release Discipline)
This release establishes clear release discipline and completes the Day 3 milestone. The focus shifts from feature expansion to reliability and user experience.

### Added
- **CI/CD pipeline**: GitHub Actions workflow with type checking, testing, and package verification
- **Release gate checks**: Automated validation of version consistency, CHANGELOG updates, and example functionality
- **User-facing examples**: 
  - `examples/coding-agent-memory.ts` (50 lines): Shows how a coding agent uses memory across sessions
  - `examples/personal-assistant-memory.ts` (50 lines): Demonstrates personal assistant memory lifecycle
- **Benchmark infrastructure**:
  - `benchmarks/performance-baseline.ts`: Generates markdown report comparing SQLite vs memory backends
  - `benchmarks/search-benchmark.ts`: Detailed performance measurement across modes and scales
  - `npm run benchmark` and `npm run benchmark:baseline` scripts
- **Package verification**: `npm run smoketest` command validates build, tests, and npm pack readiness
- **CJK search improvements**: Enhanced Chinese/Japanese/Korean search with expanded Unicode range handling
- **Performance baseline documentation**: Clear scaling characteristics for keyword, semantic, and hybrid search

### Changed
- **Version consistency**: Package.json (0.4.0-alpha.3), CHANGELOG, and README all aligned
- **Build process**: Enhanced `prepublishOnly` hook includes full smoketest validation
- **Example structure**: All examples directly runnable without modification
- **Git ignore**: Added `benchmarks/results/` to prevent committing environment-specific data
- **Issue hygiene**: Closed Issue #5 (snapshot embeddings), progressed Issue #6 (CJK improvements)

### Fixed
- **Benchmark execution**: ES module compatibility for direct script execution
- **CJK test coverage**: Expanded from skipped placeholder to 5 comprehensive tests
- **Memory backend performance**: Optimized vector operations for larger memory counts

### Release Discipline (New Standard)
From this release forward:
1. **CI must pass** before merging to main (typecheck + test + build + examples)
2. **Version consistency** validated automatically (package.json ↔ CHANGELOG ↔ README)
3. **Examples must run** directly from README instructions
4. **npm pack validation** ensures clean package distribution
5. **Transparent limitations** documented in capability matrix

### Performance Baseline (Alpha Implementation)
- **Keyword search**: <2ms even at 5,000 memories (both backends)
- **Semantic search**: Linear scaling (O(n) with vector dimension)
  - Memory backend: 7.5ms at 5,000 memories
  - SQLite backend: 259ms at 5,000 memories (includes file I/O)
- **Hybrid search**: Similar cost to semantic search
- **Key insight**: Memory backend avoids disk I/O for faster vector operations

### Next Phase Focus
With release discipline established, the project can now focus on:
1. **Vector search optimization** (ANN/indexing for >10K memories)
2. **CJK tokenizer integration** (Issue #6 follow-up)
3. **Adapter ecosystem** (LangChain, MCP, etc.)
4. **Production hardening** (error handling, monitoring, migration)

---

## [0.4.0-alpha.1] - 2026-03-27

### 🧠 Semantic Search MVP (Both Backends)
This alpha release introduces semantic search capabilities to LimbicDB, proving the architecture is feasible and extensible. The key insight: **semantic search is the watershed moment from "keyword memory" to "cognitive memory"**.

### Added
- **Semantic search interface**: New `mode` parameter for `recall()`: `keyword` | `semantic` | `hybrid`
- **Embedder configuration**: User provides embedding function (e.g., @xenova/transformers, OpenAI, Cohere)
- **Vector storage layer** (`src/embedding-store.ts`):
  - Vector math utilities: `cosineSimilarity`, `serializeVector`, `deserializeVector`
  - `EmbeddingStore` class with dual backend support (memory + SQLite)
  - BLOB storage for vectors (384-dim = 1536 bytes vs ~3KB JSON)
  - No vector index – brute-force cosine similarity (<10K memories is fast enough)
- **Memory backend (complete implementation)**:
  - Full semantic search via cosine similarity
  - Hybrid search with hardcoded weights: 30% keyword + 70% semantic
  - Graceful degradation: semantic/hybrid → keyword fallback when no embedder
  - Async embedding computation (fire-and-forget, eventual consistency)
- **SQLite backend (MVP implementation)**:
  - Embedding storage support via `memory_embeddings` table
  - Async embedding computation
  - Embedding statistics in `stats` (`embeddingsCount`, `embeddingsDimensions`)
  - **Semantic search MVP**: Cosine similarity-based semantic recall
  - **Hybrid search MVP**: 30% keyword + 70% semantic weighted combination
  - **Snapshot parity**: Embeddings now included in SQLite snapshots and restores
- **Updated statistics**: `stats.embeddingsCount` and `stats.embeddingsDimensions` when embedder available
- **Comprehensive tests**:
  - Vector math tests (16 tests in `test/embedding-store.test.ts`)
  - Semantic search test suite (30 tests in `test/semantic.test.ts`)
  - All 92 tests pass (90 passed, 2 skipped)
- **Enhanced example**: `examples/semantic-recall.ts` shows real usage with @xenova/transformers or mock embedder

### Changed
- **Backward compatible**: Existing code works unchanged (`recall()` returns `RecallResult`, `recallLegacy()` available)
- **Type definitions extended**: `EmbedFn`, `Embedder`, `RecallResult`, `RecallMode` added to `src/types.ts`
- **`RecallResult` structure**: Now includes `meta` field with mode, fallback flag, timing, pending embeddings
- **`remember()` behavior**: Asynchronous embedding computation (doesn't block, eventual consistency)
- **`forget()` behavior**: Also deletes associated embeddings (when embedding store exists)

### Design Decisions
- **Extreme interface simplification**: Removed `similarityThreshold` and `useHybrid` – first version proves architecture
- **Hardcoded hybrid weights**: 30% keyword + 70% semantic (simple, works, can be configurable later)
- **Brute-force vector search**: No sqlite-vss dependency, avoids compilation/cross-platform issues
- **User provides embedder**: No built-in models – you control your data and compute
- **Async embedding**: `remember()` doesn't block, embeddings may not be immediately available for search
- **Graceful degradation**: Semantic/hybrid requests without embedder → keyword search + `fallback: true`
- **Error handling**: Embedding failures logged but don't break memory storage

### Known Limitations (Alpha Phase)
- **Performance**: Brute-force cosine similarity may slow down with >10K memories
- **No vector indexing**: Simple linear search, no approximate nearest neighbor
- **Embedding dimension consistency**: User must ensure same embedder dimensions across sessions

### Upgrading from 0.3.x
1. No breaking changes – existing code continues to work
2. To use semantic search: provide an `embedder` in config
3. Results from `recall()` now have `meta` field – use `.memories` to get array
4. For backward compatibility, use `recallLegacy()` to get plain `Memory[]`

### Example Usage
```typescript
import { open } from 'limbicdb';
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
async function embed(text: string) {
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

const memory = open({
  path: ':memory:',
  embedder: { embed, dimensions: 384, modelHint: 'all-MiniLM-L6-v2' }
});

await memory.remember('User prefers dark mode in all applications');
const result = await memory.recall('UI preferences', { mode: 'semantic' });
// Finds "dark mode" memory even though query has no keyword overlap
```

---

## [0.3.0-alpha.2] - 2026-03-27

### 🔧 Chinese Search Enhancement Patch
This alpha.2 release focuses on improving Chinese/CJK character search support with a hybrid FTS5 + LIKE fallback strategy.

### Added
- **Hybrid Chinese search**: FTS5 for English/keywords, LIKE fallback for CJK characters
- **CJK detection**: Automatic detection of Chinese/Japanese/Korean characters in queries
- **Backward compatible**: No API changes, existing queries continue to work
- **Performance optimized**: LIKE fallback only activates when needed (CJK chars + insufficient results)

### Changed
- **Search algorithm enhancement**: `SQLiteStore.searchMemories()` now implements hybrid search
- **Improved partial matching**: Chinese characters can now match partially within content
- **Enhanced test coverage**: All existing tests continue to pass

### Fixed
- **Chinese search limitations**: Addressed FTS5 tokenization constraints for CJK characters
- **Partial word matching**: LIKE fallback enables substring matching for Chinese text

### Technical Details
The hybrid search works as follows:
1. **FTS5 first**: Attempt standard full-text search (optimal for English/keywords)
2. **CJK detection**: Check if query contains Chinese/Japanese/Korean characters
3. **LIKE fallback**: If FTS5 results are insufficient AND query contains CJK, fall back to SQL LIKE operator
4. **Result merging**: Combine and deduplicate results from both strategies

This approach maintains FTS5 performance for most queries while providing better support for Chinese users.

---

## [0.3.0-alpha.1] - 2026-03-27

### ⚠️ Alpha Release Notice
This is the first alpha release of LimbicDB, focusing on establishing **reliable foundations** and **semantic consistency**.
The goal is to collect real-world feedback while maintaining clear boundaries about current capabilities.

### Breaking Changes
- **Public positioning shifted** from "cognitive science narrative" to "local-first memory engine"
- **README completely rewritten** to emphasize practical engineering over marketing promises
- **Relationship to CogniCore clarified**: LimbicDB is the memory engine, CogniCore is the runtime orchestration layer

### Added
- **Comprehensive contract tests** (`test/contract.test.ts`): 34 tests defining semantic behavior for:
  - Empty query semantics (`recall('')`, `recall('', {kind})`, etc.)
  - Tags filtering with AND logic (both memory and SQLite backends)
  - Keyword search behavior and limitations
  - Strength-based and time-based filtering
  - Forget semantics and safety constraints
- **Dual backend consistency**: Memory and SQLite backends now pass identical contract tests
- **Explicit limitations documentation** in README (Chinese/CJK search, partial word matching, etc.)
- **Alpha release readiness**: Proper package.json exports, build verification, and documentation

### Fixed
- **P0 Trust Surface Issues** (identified by user feedback):
  - `stats` getter now returns real database statistics (not placeholder zeros)
  - SQLite `setInterval` resource leak fixed via `_pruneIntervalId` cleanup
  - `verify.js` import path corrected (`../src/index.js` → `../dist/index.js`)
  - Package.json `exports` field pointing to correct build artifacts
- **Semantic inconsistencies**:
  - Tags filtering unified to AND logic (must contain ALL specified tags)
  - Empty query handling improved in SQLite backend (proper sorting, no before filter)
  - Integration tests updated to avoid Chinese search limitations (use empty query + tags)
- **Testing completeness**:
  - `forget` test enabled and passing (was previously skipped)
  - `snapshot` test enabled and passing (was previously skipped)
  - All 38 tests now pass (including 34 contract tests)

### Changed
- **README narrative downgraded**: Removed "cognitive science" marketing, emphasized "local-first memory engine"
- **Project description**: "Local-first memory engine for embedded agents. Durable, inspectable, and one-file by default."
- **Bilingual README structure**: Separate `README.md` (English) and `README.zh-CN.md` (Chinese)
- **Package.json exports**: Unified ESM entry points (`module` and `exports.import` both point to `./dist/index.js`)

### Known Limitations (Alpha Phase)
- **Chinese/CJK search support limited**: FTS5 default configuration has restrictions
- **Partial word matching not guaranteed**: "test" may not match "testing"
- **Current search is keyword-based**, not semantic
- **Memory format may change** between alpha releases

These limitations are documented for transparency and will be addressed in future releases based on user feedback.

---

## [0.2.0] - 2026-03-27

### Added
- **Dual-mode storage architecture**: Automatic backend selection based on path
  - `:memory:` → In-memory storage (fast, volatile)
  - File path → SQLite storage (persistent, production-ready)
- **SQLite production backend**:
  - ACID compliance with WAL mode
  - FTS5 full-text search (中文/English mixed search)
  - Automatic memory decay and pruning
  - Efficient indexing (strength, access time, kind)
  - 64MB cache, 256MB memory mapping optimization
- **Storage abstraction layer**: `IStorage` interface for multiple backends
- **Smart routing API**: `open()` automatically chooses optimal backend
- **Explicit control**: `openMemory()` and `openSQLite()` for manual selection
- **Enhanced build system**: TypeScript, tsup (CJS+ESM+DTS), vitest

### Changed
- **Backward compatible**: All existing APIs remain unchanged
- **Memory decay algorithm**: Improved recency effect calculation
- **Build process**: Fixed TypeScript type assertions for DecayConfig
- **Package structure**: Cleaner exports and type definitions

### Fixed
- TypeScript compilation errors in core module
- Time parsing edge cases for Chinese/English unit formats
- SQLite prepared statement parameter binding

### Known Issues (tracked for v0.2.1)
- Tag-based filtering in SQLite backend (temporarily skipped in tests)
- Snapshot restoration transaction synchronization (temporarily skipped in tests)

## [0.1.0] - 2026-03-27

### Added
- Initial release of LimbicDB
- Core API: `open`, `remember`, `recall`, `forget`, `get`, `set`, `history`, `snapshot`, `restore`, `close`
- Cognitive memory primitives: `fact`, `episode`, `preference`, `procedure`, `goal`
- Memory decay based on Ebbinghaus forgetting curve
- Automatic memory classification
- In-memory storage (MVP - SQLite coming soon)
- Full timeline/audit log
- TypeScript support with full type definitions
- Comprehensive README with examples
- MIT License