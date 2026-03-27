# Contributing to LimbicDB

Thank you for your interest in contributing to LimbicDB! This document provides guidelines for contributions.

## Development Philosophy

LimbicDB follows a **product truthfulness first** philosophy:

> "Every contribution should make LimbicDB harder to misunderstand, not easier."

### Core Principles

1. **Default Path First** - Features should work on `open('./agent.limbic')` before being promoted
2. **Transparent Limitations** - Document what doesn't work as clearly as what does
3. **Backend Parity** - Memory and SQLite backends should behave consistently
4. **Test Honesty** - Tests should reflect actual capabilities, not aspirations

## Before You Start

### Check Existing Issues
- Search [GitHub Issues](https://github.com/Kousoyu/limbicdb/issues) for similar proposals
- Check the [ROADMAP.md](ROADMAP.md) for current priorities

### Small Changes vs. Big Features
- **Small changes** (bug fixes, docs): Feel free to open a PR directly
- **Big features**: Open an issue first to discuss approach and alignment with project goals

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm 9+
- Git

### Local Setup
```bash
# Clone the repository
git clone https://github.com/Kousoyu/limbicdb.git
cd limbicdb

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

### Development Scripts
```bash
# Run tests in watch mode
npm run test:watch

# Build and watch for changes
npm run build:watch

# Type checking
npm run typecheck

# Run demo
npm run demo

# Run verification script
npm run verify
```

## Code Style

### TypeScript Conventions
- Use explicit return types for public methods
- Prefer interfaces over type aliases for public APIs
- Document public APIs with JSDoc comments
- Use `snake_case` for database fields, `camelCase` for JavaScript

### Testing
- Write tests for new functionality
- Update existing tests when changing behavior
- Avoid `expect(true).toBe(true)` placeholder tests
- Tests should be deterministic and fast

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add semantic search to SQLite backend
fix: correct memory strength calculation
docs: update README with backend capabilities
test: add contract tests for recall behavior
chore: update dependencies
```

## Pull Request Process

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Write or update tests
- Update documentation if needed
- Ensure all tests pass

### 3. Create a Pull Request
- Fill out the PR template
- Link related issues
- Describe the change and why it's needed

### 4. PR Review Checklist
Before requesting review, ensure:

- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions
- [ ] Changes don't break existing functionality

## Focus Areas for Contributions

### High Priority
1. **Bug fixes** - Especially for default user path issues
2. **Documentation improvements** - Clarifying limitations and capabilities
3. **Test coverage** - Adding missing tests for edge cases
4. **Performance optimizations** - For core operations

### Medium Priority
1. **SQLite backend parity** - Features missing from SQLite but present in memory backend
2. **Error handling improvements** - Better recovery from edge cases
3. **Developer experience** - Better error messages, debugging tools

### Low Priority (Discuss First)
1. **New features** - Especially if they create new expectation mismatches
2. **API changes** - Breaking changes require careful consideration
3. **Integration adapters** - LangChain, LlamaIndex, etc.

## Questions?

- Open a [GitHub Issue](https://github.com/Kousoyu/limbicdb/issues)
- Check existing issues and discussions

---

Thank you for helping make LimbicDB more reliable and trustworthy!