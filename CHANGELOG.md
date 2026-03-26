# Changelog

All notable changes to LimbicDB will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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