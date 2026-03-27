# LimbicDB Roadmap

> A transparent view of what's next for LimbicDB

## Current Version: v0.4.0-alpha.1

**Focus**: Establishing trust through **product truthfulness**

### Immediate Focus (Next 14 Days)
**Goal**: Make LimbicDB an alpha that won't mislead first-time users

1. **Contract Truthfulness** - Ensure `recall()` results accurately report what was requested vs. what was executed
2. **README Realignment** - Eliminate conflicting narratives about current capabilities
3. **Test Honesty** - Remove placeholder tests that create false maturity signals
4. **SQLite Semantic Parity** - Bring SQLite backend to feature parity with memory backend
5. **Snapshot/Restore Parity** - Ensure embeddings survive snapshot operations
6. **Repository Hygiene** - Clean up internal working files from public view

## Phase 1: Trust Foundation (v0.4.x)

### v0.4.0-alpha.2 (Target: 7 days)
- [x] Contract truthfulness in `recall()` results
- [ ] README that separates memory vs. SQLite backend capabilities
- [ ] Clear documentation of current semantic search limitations
- [ ] Repository cleanup (internal files moved to `docs/dev/`)
- [ ] First-time user experience that matches documentation

### v0.4.0-beta.1 (Target: 14 days)
- [ ] SQLite semantic search implementation
- [ ] SQLite hybrid search implementation
- [ ] Embeddings included in snapshots
- [ ] Cross-backend behavior consistency
- [ ] Production-ready error handling for embedding operations

## Phase 2: Production Readiness (v0.5.x)

### v0.5.0-alpha.1 (Target: 30 days)
- [ ] Performance benchmarking suite
- [ ] Memory management optimizations
- [ ] Advanced retention policies
- [ ] Migration utilities for `.limbic` file format
- [ ] Enhanced error recovery

### v0.5.0 (Target: 60 days)
- [ ] Stable file format guarantees
- [ ] Production deployment guide
- [ ] Load testing results
- [ ] Security audit documentation
- [ ] First production user case studies

## Phase 3: Ecosystem Integration (v0.6.x+)

### Long-term Goals
- [ ] LangChain/LlamaIndex adapters
- [ ] MCP (Model Context Protocol) support
- [ ] Browser/Edge runtime support
- [ ] Advanced vector search optimizations
- [ ] Multi-agent memory sharing patterns

## Development Principles

1. **Default Path First** - New features must work on the default user path before becoming marketing features
2. **Transparent Limitations** - Known limitations are documented in README, not discovered by users
3. **Backend Parity** - Memory and SQLite backends maintain consistent behavior
4. **Test Honesty** - Tests reflect actual capabilities, not future aspirations
5. **Release Discipline** - No release with conflicting narratives between code, docs, and npm

## How to Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## How We Prioritize

1. **Critical bugs** that break the default user experience
2. **Documentation mismatches** between README and actual behavior
3. **Backend inconsistencies** between memory and SQLite
4. **Performance issues** affecting core operations
5. **New features** that don't create expectation mismatches

---

*This roadmap is a living document. Priorities may shift based on user feedback.*