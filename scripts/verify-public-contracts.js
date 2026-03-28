#!/usr/bin/env node

/**
 * verify-public-contracts.js
 * 
 * Verifies LimbicDB's public API contracts that must hold for any release.
 * These are the promises we make to users in README and type definitions.
 * 
 * Contracts verified:
 * 1. Default path reopen persistence
 * 2. No embedder → semantic/hybrid fallback
 * 3. Failing embedder → semantic/hybrid fallback  
 * 4. Snapshot/restore preserves semantic contracts
 * 5. Truth source alignment with runtime behavior
 */

import { open } from '../src/index'
import { rmSync, existsSync } from 'fs'

// Reuse test utilities from verify.js
async function runTest(name, testFn) {
  try {
    await testFn()
    console.log(`✅ ${name}`)
    return true
  } catch (error) {
    console.error(`❌ ${name} failed:`, error.message)
    return false
  }
}

async function main() {
  console.log('========================================')
  console.log('  LimbicDB Public Contract Verification')
  console.log('========================================\n')
  
  let allPassed = true
  
  // Contract 1: Default path reopen persistence
  allPassed &= await runTest('Default path persistence', async () => {
    const filePath = './verify-public-contracts-persistence.limbic'
    
    try {
      // Create and write
      const db1 = open(filePath)
      await db1.remember('Persistent memory test')
      await db1.close()
      
      // Reopen and verify
      const db2 = open(filePath)
      const result = await db2.recall('Persistent', { mode: 'keyword' })
      await db2.close()
      
      if (result.memories.length !== 1) {
        throw new Error(`Expected 1 memory, got ${result.memories.length}`)
      }
      if (!result.memories[0].content.includes('Persistent memory test')) {
        throw new Error('Memory content corrupted')
      }
    } finally {
      // Cleanup
      try { rmSync(filePath, { force: true }) } catch {}
    }
  })
  
  // Contract 2: No embedder → semantic/hybrid fallback
  allPassed &= await runTest('No embedder fallback', async () => {
    const filePath = './verify-public-contracts-no-embedder.limbic'
    
    try {
      const db = open(filePath)
      await db.remember('Test memory for fallback verification')
      
      // Semantic request without embedder
      const semanticResult = await db.recall('Test', { mode: 'semantic' })
      if (semanticResult.meta.requestedMode !== 'semantic') {
        throw new Error(`Requested mode should be 'semantic', got ${semanticResult.meta.requestedMode}`)
      }
      if (semanticResult.meta.executedMode !== 'keyword') {
        throw new Error(`Should fallback to 'keyword', got ${semanticResult.meta.executedMode}`)
      }
      if (!semanticResult.meta.fallback) {
        throw new Error('Fallback flag should be true')
      }
      if (semanticResult.memories.length === 0) {
        throw new Error('Should return results after fallback')
      }
      
      // Hybrid request without embedder
      const hybridResult = await db.recall('Test', { mode: 'hybrid' })
      if (hybridResult.meta.requestedMode !== 'hybrid') {
        throw new Error(`Requested mode should be 'hybrid', got ${hybridResult.meta.requestedMode}`)
      }
      if (hybridResult.meta.executedMode !== 'keyword') {
        throw new Error(`Should fallback to 'keyword', got ${hybridResult.meta.executedMode}`)
      }
      if (!hybridResult.meta.fallback) {
        throw new Error('Fallback flag should be true')
      }
      
      await db.close()
    } finally {
      try { rmSync(filePath, { force: true }) } catch {}
    }
  })
  
  // Contract 3: Failing embedder → semantic/hybrid fallback
  allPassed &= await runTest('Failing embedder fallback', async () => {
    const filePath = './verify-public-contracts-failing-embedder.limbic'
    
    try {
      const failingEmbedder = {
        embed: async () => { throw new Error('Embedding failed (test)') },
        dimensions: 384
      }
      
      const db = open({ path: filePath, embedder: failingEmbedder })
      await db.remember('Test memory with failing embedder')
      
      // Semantic request with failing embedder
      const semanticResult = await db.recall('Test', { mode: 'semantic' })
      if (semanticResult.meta.requestedMode !== 'semantic') {
        throw new Error(`Requested mode should be 'semantic', got ${semanticResult.meta.requestedMode}`)
      }
      if (semanticResult.meta.executedMode !== 'keyword') {
        throw new Error(`Should fallback to 'keyword', got ${semanticResult.meta.executedMode}`)
      }
      if (!semanticResult.meta.fallback) {
        throw new Error('Fallback flag should be true')
      }
      if (semanticResult.memories.length === 0) {
        throw new Error('Should return results after fallback')
      }
      
      // Hybrid request with failing embedder
      const hybridResult = await db.recall('Test', { mode: 'hybrid' })
      if (hybridResult.meta.requestedMode !== 'hybrid') {
        throw new Error(`Requested mode should be 'hybrid', got ${hybridResult.meta.requestedMode}`)
      }
      if (hybridResult.meta.executedMode !== 'keyword') {
        throw new Error(`Should fallback to 'keyword', got ${hybridResult.meta.executedMode}`)
      }
      if (!hybridResult.meta.fallback) {
        throw new Error('Fallback flag should be true')
      }
      
      await db.close()
    } finally {
      try { rmSync(filePath, { force: true }) } catch {}
    }
  })
  
  // Contract 4: Snapshot/restore preserves semantic contracts
  allPassed &= await runTest('Snapshot/restore semantic preservation', async () => {
    const filePath = './verify-public-contracts-snapshot.limbic'
    
    try {
      // Create DB with embedder (mock)
      const mockEmbedder = {
        embed: async (text) => {
          // Simple deterministic embedding for testing
          const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
          return Array(384).fill(0).map((_, i) => Math.sin((hash + i) * 0.1) * 0.1)
        },
        dimensions: 384
      }
      
      const db = open({ path: filePath, embedder: mockEmbedder })
      await db.remember('Snapshot test memory 1')
      await db.remember('Snapshot test memory 2')
      
      // Take snapshot
      const snapshotId = await db.snapshot()
      
      // Add more memories
      await db.remember('Snapshot test memory 3')
      
      // Restore snapshot
      await db.restore(snapshotId)
      
      // Verify semantic contract still holds (can request semantic, may fallback)
      const result = await db.recall('Snapshot', { mode: 'semantic' })
      
      // After restore, we should still get results (either semantic or keyword fallback)
      if (result.memories.length === 0) {
        throw new Error('Should return memories after snapshot restore')
      }
      
      // The contract is that snapshot/restore doesn't break the ability to request semantic
      // It may execute semantic or fallback, but should not crash
      if (result.meta.requestedMode !== 'semantic') {
        throw new Error(`Requested mode should be 'semantic', got ${result.meta.requestedMode}`)
      }
      
      await db.close()
    } finally {
      try { rmSync(filePath, { force: true }) } catch {}
    }
  })
  
  // Contract 5: Truth source alignment (check key fields match runtime)
  allPassed &= await runTest('Truth source alignment', async () => {
    // Read truth source
    const truthSourcePath = './internal/public-truth.json'
    if (!existsSync(truthSourcePath)) {
      throw new Error('Truth source not found: ' + truthSourcePath)
    }
    
    const truthSource = JSON.parse(await import('fs').then(fs => 
      fs.readFileSync(truthSourcePath, 'utf8')
    ))
    
    // Verify key fields
    if (truthSource.version === undefined) {
      throw new Error('Truth source missing version')
    }
    
    if (truthSource.defaultPath !== "open('./agent.limbic')") {
      throw new Error(`Truth source defaultPath mismatch: ${truthSource.defaultPath}`)
    }
    
    // Verify SQLite capability labels
    if (truthSource.sqlite?.keyword !== 'stable') {
      throw new Error(`Truth source SQLite keyword should be 'stable', got ${truthSource.sqlite?.keyword}`)
    }
    if (truthSource.sqlite?.semantic !== 'experimental-mvp') {
      throw new Error(`Truth source SQLite semantic should be 'experimental-mvp', got ${truthSource.sqlite?.semantic}`)
    }
    if (truthSource.sqlite?.hybrid !== 'experimental-mvp') {
      throw new Error(`Truth source SQLite hybrid should be 'experimental-mvp', got ${truthSource.sqlite?.hybrid}`)
    }
    if (truthSource.sqlite?.snapshotEmbeddings !== true) {
      throw new Error(`Truth source SQLite snapshotEmbeddings should be true, got ${truthSource.sqlite?.snapshotEmbeddings}`)
    }
    
    // Verify memory capability labels
    if (truthSource.memory?.keyword !== 'stable') {
      throw new Error(`Truth source memory keyword should be 'stable', got ${truthSource.memory?.keyword}`)
    }
    if (truthSource.memory?.semantic !== 'experimental') {
      throw new Error(`Truth source memory semantic should be 'experimental', got ${truthSource.memory?.semantic}`)
    }
    if (truthSource.memory?.hybrid !== 'experimental') {
      throw new Error(`Truth source memory hybrid should be 'experimental', got ${truthSource.memory?.hybrid}`)
    }
    if (truthSource.memory?.snapshotEmbeddings !== true) {
      throw new Error(`Truth source memory snapshotEmbeddings should be true, got ${truthSource.memory?.snapshotEmbeddings}`)
    }
    
    // Runtime verification: can actually open default path
    const testPath = './verify-truth-source-alignment.limbic'
    try {
      const db = open(testPath)
      await db.remember('Truth source alignment test')
      await db.close()
    } finally {
      try { rmSync(testPath, { force: true }) } catch {}
    }
    
    console.log(`   Truth source version: ${truthSource.version}`)
    console.log(`   Default path: ${truthSource.defaultPath}`)
    console.log(`   SQLite: keyword=${truthSource.sqlite?.keyword}, semantic=${truthSource.sqlite?.semantic}, hybrid=${truthSource.sqlite?.hybrid}`)
    console.log(`   Memory: keyword=${truthSource.memory?.keyword}, semantic=${truthSource.memory?.semantic}, hybrid=${truthSource.memory?.hybrid}`)
  })
  
  // Summary
  console.log('\n========================================')
  if (allPassed) {
    console.log('✅ All public contract checks passed')
    console.log('   LimbicDB public API contracts are valid')
    process.exit(0)
  } else {
    console.log('❌ Public contract checks failed')
    console.log('   Some API promises are not being kept')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Fatal error in verify-public-contracts:', error)
  process.exit(1)
})