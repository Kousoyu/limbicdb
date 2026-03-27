# Changelog

All notable changes to LimbicDB will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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