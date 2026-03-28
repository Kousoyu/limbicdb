#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

// Load truth source
const truth = JSON.parse(readFileSync(join(repoRoot, 'internal/public-truth.json'), 'utf8'))

console.log('=== LimbicDB Documentation Consistency Check ===')
console.log(`Truth source version: ${truth.version}`)

const docsToCheck = [
  { path: 'README.md', description: 'English README', requireVersion: true },
  { path: 'README.zh-CN.md', description: 'Chinese README', requireVersion: true },
  { path: 'ROADMAP.md', description: 'Roadmap', requireVersion: true },
  { path: 'BETA-ENTRANCE-CRITERIA.md', description: 'Beta Criteria', requireVersion: true },
  { path: 'TROUBLESHOOTING.md', description: 'Troubleshooting', requireVersion: true },
  { path: 'CONTRIBUTING.md', description: 'Contributing', requireVersion: false },
]

let allPassed = true

function checkVersion(content, description, requireVersion) {
  // Skip version check if not required
  if (!requireVersion) {
    console.log(`✅ ${description}: Version check skipped (not required)`)
    return true
  }
  
  // Match version patterns like "0.4.0-alpha.3" or "v0.4.0-alpha.3"
  const versionPattern = /v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)/gi
  const allMatches = [...content.matchAll(versionPattern)].map(m => m[1])
  
  // Filter to likely LimbicDB versions (start with 0. or 1., not 20., 22., etc.)
  const limbicVersions = allMatches.filter(v => v.startsWith('0.') || v.startsWith('1.'))
  
  // Find the most specific version (prefer alpha/beta qualifiers)
  const docVersion = limbicVersions.find(v => v.includes('alpha') || v.includes('beta')) || limbicVersions[0]
  
  if (!docVersion) {
    console.log(`❌ ${description}: No LimbicDB version found (expected ${truth.version})`)
    return false
  } else if (docVersion !== truth.version) {
    console.log(`❌ ${description}: Version mismatch - found ${docVersion}, expected ${truth.version}`)
    return false
  } else {
    console.log(`✅ ${description}: Version ${docVersion} matches truth source`)
    return true
  }
}

function checkAPIPatterns(content, description, path) {
  let passed = true
  
  // Check for incorrect API patterns
  const incorrectPatterns = [
    'open(path, { embedder })',
    "open('./agent.limbic', { embedder })",
    'open(\':memory:\', { embedder })',
  ]
  
  for (const pattern of incorrectPatterns) {
    if (content.includes(pattern)) {
      console.log(`❌ ${description}: Contains incorrect open() API pattern: ${pattern}`)
      passed = false
    }
  }
  
  // Check for correct patterns (should exist in documentation)
  const shouldContainPatterns = [
    'open({ path: \'./agent.limbic\', embedder })',
    'open({ path: \':memory:\', embedder })',
    'open(\'./agent.limbic\')',  // without embedder
  ]
  
  // Only check for correct patterns in README and TROUBLESHOOTING
  if (path.includes('README') || path.includes('TROUBLESHOOTING')) {
    let hasCorrectPattern = false
    for (const pattern of shouldContainPatterns) {
      if (content.includes(pattern)) {
        hasCorrectPattern = true
        break
      }
    }
    
    if (!hasCorrectPattern && content.includes('embedder')) {
      console.log(`⚠️  ${description}: Mentions embedder but no correct open() pattern found`)
    }
  }
  
  return passed
}

function checkNpmScripts(content, description, path) {
  if (!path.includes('CONTRIBUTING') && !path.includes('BETA')) {
    return true
  }
  
  let passed = true
  
  // Check for non-existent npm scripts
  const nonExistentScripts = [
    'test:watch',
    'build:watch',
    'verify-examples',  // now should be verify:examples
  ]
  
  for (const script of nonExistentScripts) {
    const pattern = `npm run ${script}`
    if (content.includes(pattern) && script !== 'verify-examples') {
      console.log(`❌ ${description}: References non-existent npm script: ${pattern}`)
      passed = false
    }
  }
  
  // Check that verify:examples is referenced in BETA criteria
  if (path.includes('BETA') && !content.includes('verify:examples')) {
    console.log(`⚠️  ${description}: BETA criteria should reference verify:examples script`)
  }
  
  return passed
}

function checkSnapshotClaims(content, description, path) {
  if (!path.includes('README')) {
    return true
  }
  
  let passed = true
  
  // Check snapshot embedding claims
  const snapshotClaims = [
    { text: 'snapshot contains embeddings', shouldBePresent: true },
    { text: 'snapshot does not contain embeddings', shouldBePresent: false },
    { text: '快照包含嵌入向量', shouldBePresent: path.includes('zh-CN') },
    { text: '快照未包含嵌入向量', shouldBePresent: false },
  ]
  
  for (const claim of snapshotClaims) {
    const hasClaim = content.includes(claim.text)
    if (hasClaim && !claim.shouldBePresent) {
      console.log(`❌ ${description}: Incorrect snapshot claim: "${claim.text}"`)
      passed = false
    }
  }
  
  return passed
}

function checkOverPromises(content, description) {
  let passed = true
  
  // Check for over-promising language
  const overPromises = [
    'production-like usage',
    'production ready',
    'recommended for production',
    'stable semantic search',
    'fully featured',
  ]
  
  for (const promise of overPromises) {
    if (content.toLowerCase().includes(promise.toLowerCase())) {
      console.log(`⚠️  ${description}: Contains over-promising language: "${promise}"`)
      // Not a failure, but a warning
    }
  }
  
  return passed
}

function checkTruthSourceFields(content, description, path) {
  let passed = true
  
  // Only check README and TROUBLESHOOTING for truth source fields
  if (!path.includes('README') && !path.includes('TROUBLESHOOTING')) {
    return true
  }
  
  // Check default path references
  const defaultPathPattern = truth.defaultPath
  if (!content.includes(defaultPathPattern) && path.includes('README')) {
    console.log(`⚠️  ${description}: Should mention default path "${defaultPathPattern}"`)
  }
  
  // Check SQLite capability labels
  const sqliteKeywordLabel = truth.sqlite.keyword
  const sqliteSemanticLabel = truth.sqlite.semantic
  const sqliteHybridLabel = truth.sqlite.hybrid
  
  // Look for capability tables or descriptions
  if (content.includes('SQLite') || content.includes('sqlite')) {
    // Check for keyword capability
    if (content.toLowerCase().includes('keyword') && content.includes('SQLite')) {
      // We could add more specific checks here if needed
    }
    
    // Check for semantic capability label consistency
    if (content.includes('semantic') && content.includes('SQLite')) {
      // Look for descriptions that might mention experimental-mvp status
      if (content.includes('experimental') || content.includes('MVP') || content.includes('mvp')) {
        // Good indication that capability label is consistent
      } else if (content.includes('stable semantic') || content.includes('full semantic')) {
        console.log(`⚠️  ${description}: SQLite semantic search described as stable/full but truth source says "${sqliteSemanticLabel}"`)
      }
    }
  }
  
  // Check memory backend capability labels
  const memoryKeywordLabel = truth.memory.keyword
  const memorySemanticLabel = truth.memory.semantic
  const memoryHybridLabel = truth.memory.hybrid
  
  // Check snapshot embeddings truth
  if (truth.sqlite.snapshotEmbeddings && truth.memory.snapshotEmbeddings) {
    // Both backends should have snapshot embeddings
    if (content.includes('snapshot') && content.includes('embedding')) {
      // Check for negative claims
      if (content.includes('snapshot does not contain embeddings') || 
          content.includes('embeddings are lost in snapshot')) {
        console.log(`❌ ${description}: Claims embeddings lost in snapshot but truth source says snapshotEmbeddings: true`)
        passed = false
      }
    }
  }
  
  return passed
}

function checkCapabilityLabels(content, description, path) {
  let passed = true
  
  // Only check README files for capability labels
  if (!path.includes('README')) {
    return true
  }
  
  // Helper to check if a capability label is correctly represented
  const checkLabel = (backend, capability, truthLabel) => {
    // For README files, we look for the capability matrix
    // We'll do simple pattern matching for now
    
    // Build search patterns based on backend and capability
    let backendPattern = backend === 'sqlite' ? /SQLite.*backend/i : /memory.*backend/i
    let capabilityPattern
    
    switch (capability) {
      case 'keyword':
        capabilityPattern = /keyword.*search/i
        break
      case 'semantic':
        capabilityPattern = /semantic.*search/i
        break
      case 'hybrid':
        capabilityPattern = /hybrid.*search/i
        break
      default:
        return true
    }
    
    // Check if the section exists
    if (backendPattern.test(content) && capabilityPattern.test(content)) {
      // Look for the truth label in the vicinity
      // Simple check: see if the truth label appears near the capability
      // This is a heuristic but better than nothing
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (backendPattern.test(line) && capabilityPattern.test(line)) {
          // Check this line and the next few lines for the label
          const context = lines.slice(i, Math.min(i + 3, lines.length)).join(' ')
          
          // Truth label should appear in context
          // For 'stable', check for 'stable' (case-insensitive)
          // For 'experimental' or 'experimental-mvp', check for 'experimental'
          const expectedPattern = truthLabel === 'stable' ? /stable/i : /experimental/i
          if (!expectedPattern.test(context)) {
            console.log(`⚠️  ${description}: ${backend} ${capability} should be labeled "${truthLabel}" but not found in context`)
            // Not marking as failure, just warning for now
          }
          
          // Special check for experimental-mvp: should mention MVP
          if (truthLabel === 'experimental-mvp' && !/MVP|mvp/i.test(context)) {
            console.log(`⚠️  ${description}: ${backend} ${capability} is experimental-mvp but MVP not mentioned`)
          }
          
          break
        }
      }
    }
    
    return true
  }
  
  // Check all capability labels
  checkLabel('sqlite', 'keyword', truth.sqlite.keyword)
  checkLabel('sqlite', 'semantic', truth.sqlite.semantic)
  checkLabel('sqlite', 'hybrid', truth.sqlite.hybrid)
  checkLabel('memory', 'keyword', truth.memory.keyword)
  checkLabel('memory', 'semantic', truth.memory.semantic)
  checkLabel('memory', 'hybrid', truth.memory.hybrid)
  
  // Check snapshot embeddings
  if (truth.sqlite.snapshotEmbeddings) {
    // Should not contain negative claims about SQLite snapshot embeddings
    if (content.includes('SQLite') && content.includes('snapshot') && 
        (content.includes('does not contain embeddings') || 
         content.includes('embeddings are lost') ||
         content.includes('尚未包含'))) {
      console.log(`❌ ${description}: SQLite snapshot incorrectly claims embeddings not included`)
      passed = false
    }
  }
  
  if (truth.memory.snapshotEmbeddings) {
    // Should not contain negative claims about memory snapshot embeddings
    if (content.includes('memory') && content.includes('snapshot') && 
        (content.includes('does not contain embeddings') || 
         content.includes('embeddings are lost') ||
         content.includes('尚未包含'))) {
      console.log(`❌ ${description}: Memory snapshot incorrectly claims embeddings not included`)
      passed = false
    }
  }
  
  return passed
}

// Main check loop
for (const { path, description, requireVersion } of docsToCheck) {
  try {
    const content = readFileSync(join(repoRoot, path), 'utf8')
    
    console.log(`\n--- Checking ${description} (${path}) ---`)
    
    // Run all checks
    const checks = [
      checkVersion(content, description, requireVersion),
      checkAPIPatterns(content, description, path),
      checkNpmScripts(content, description, path),
      checkSnapshotClaims(content, description, path),
      checkOverPromises(content, description),
      checkTruthSourceFields(content, description, path),
      checkCapabilityLabels(content, description, path),
    ]
    
    if (checks.includes(false)) {
      allPassed = false
    }
    
  } catch (error) {
    console.log(`❌ ${description}: Failed to read file - ${error.message}`)
    allPassed = false
  }
}

console.log('\n' + '='.repeat(50))
if (allPassed) {
  console.log('✅ All documentation consistency checks passed!')
  process.exit(0)
} else {
  console.log('❌ Documentation consistency checks failed')
  console.log('\nSummary of issues:')
  console.log('1. Check version numbers match truth source')
  console.log('2. Ensure open() API patterns are correct')
  console.log('3. Fix references to non-existent npm scripts')
  console.log('4. Verify snapshot embedding claims are accurate')
  console.log('5. Remove over-promising language')
  console.log('6. Ensure truth source fields (default path, capability labels) are consistent')
  process.exit(1)
}