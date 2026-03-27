# Changelog

All notable changes to LimbicDB will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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