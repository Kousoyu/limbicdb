# Beta Entrance Criteria

> **Status**: Currently in alpha (v0.4.0-alpha.3). Beta criteria not yet met.

These are the criteria LimbicDB must meet before moving from **alpha** to **beta**. Beta means "ready for early adopters with clear expectations".

## 1. Default SQLite Path Has Zero Documentation Ambiguity

**Current status**: ✅ **Partial** - Need more explicit warnings

**Requirements**:
- [ ] Clear warning in README Quick Start: "SQLite backend (`open('./agent.limbic')`) supports semantic/hybrid search in MVP form with limitations"
- [ ] Every mention of semantic/hybrid search must specify backend compatibility
- [ ] API documentation must note when features are backend-specific
- [ ] Migration guide if beta changes default behavior

**Verification**: No GitHub issues about "feature X doesn't work with my config" for at least 2 weeks.

## 2. All README Examples Run Without Modification

**Current status**: 🔄 **Partial** - Basic examples verified; semantic examples need manual setup

**Requirements**:
- [ ] `npm run verify-examples` command that tests all examples
- [ ] CI runs example tests on all supported Node versions (20, 22, 24)
- [ ] No example requires API keys or external services
- [ ] Examples handle edge cases gracefully (e.g., missing embeddings)

**Verification**: CI passes example tests for 10 consecutive runs.

## 3. CI Continuously Stable

**Current status**: ✅ **Established** - `.github/workflows/ci.yml` in place

**Requirements**:
- [ ] Type checking passes 100% of time
- [ ] Tests pass 100% of time (109/109 currently)
- [ ] Build succeeds 100% of time
- [ ] Smoke test (`npm run smoketest`) passes 100% of time
- [ ] No flaky tests

**Verification**: CI passes 10 consecutive runs on main branch.

## 4. npm Install Smoke Test Stable

**Current status**: ✅ **Good** - `npm run smoketest` established

**Requirements**:
- [ ] `npm install limbicdb@alpha` works for new users
- [ ] `npm run build` works after fresh install
- [ ] Basic usage examples work after fresh install
- [ ] No native compilation failures (SQLite works across platforms)

**Verification**: Smoke test passes in CI on Linux, macOS, and Windows runners.

## 5. No Known "Documentation Says A, Reality Is B" Gaps

**Current status**: 🔄 **Improving** - Transparent limitations documented

**Requirements**:
- [ ] Search capability matrix in README is accurate
- [ ] All "Experimental" labels have clear limitation notes
- [ ] Performance characteristics documented (keyword fast, semantic linear scaling)
- [ ] Migration path clear if alpha → beta has breaking changes

**Verification**: No new GitHub issues about "documentation mismatch" for 2 weeks.

---

## Current Assessment (v0.4.0-alpha.3)

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1. Default path clarity | 🔄 **Partial** | Need explicit warnings about SQLite semantic search limitations |
| 2. Examples run | 🔄 **Partial** | Most examples run; semantic-recall.ts requires manual embedder setup |
| 3. CI stable | ✅ **Good** | CI established, need to prove stability |
| 4. npm install stable | ✅ **Good** | Smoke test established |
| 5. No doc/reality gaps | 🔄 **Improving** | Limitations documented but need more clarity |

**Overall**: Not ready for beta. Need 2+ weeks of stable operation and clearer documentation.

---

## Feedback Priority During Alpha → Beta Transition

During this phase, prioritize feedback in this order:

### 1. Critical (Blocking Beta)
- Installation failures
- Basic examples don't run
- Core API (`remember`, `recall`, `forget`) behaves unpredictably
- Data loss or corruption

### 2. Important (Beta Quality)
- Performance significantly worse than documented
- Memory leaks
- Platform-specific issues (Windows, macOS, Linux differences)
- TypeScript type issues

### 3. Nice-to-Have (Post-Beta)
- Feature requests (new search modes, adapters, integrations)
- Performance optimizations (vector indexing, caching)
- Extended examples (LangChain, MCP, etc.)

### 4. Deferred (Phase 3+)
- Major API changes
- Breaking schema changes
- New storage backends
- Marketing/promotion

---

## Release Discipline Required for Beta

Before tagging any release as `beta`:

1. **All 5 criteria must be met** for at least 2 weeks
2. **No critical issues** open for that release
3. **Migration guide** published if breaking changes
4. **Version policy** established (semantic versioning for beta+)

---

## Why These Criteria Matter

Moving from alpha to beta is about **trust**, not features.

**Alpha**: "Here's what works, here's what doesn't. Try it and tell me what breaks."
**Beta**: "Here's what definitely works. If it breaks, it's a bug."

The goal is to reach a state where early adopters can recommend LimbicDB to others without caveats like "well, it works except when..."

---

*Last updated: 2026-03-28 (v0.4.0-alpha.3)*