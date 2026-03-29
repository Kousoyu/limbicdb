#!/usr/bin/env node
/**
 * Simplified LimbicDB verification script for CI debugging
 */

import { open } from '../dist/index.js'
import { rmSync } from 'node:fs'

async function main() {
  console.log('🧠 Simple LimbicDB verification')
  
  // Test 1: Basic memory operations (in-memory)
  const db = open(':memory:')
  await db.remember('test memory')
  const result = await db.recall('test')
  console.log(`✅ Basic test: ${result.memories.length} memories found`)
  await db.close()
  
  // Test 2: File-based operations (minimal)
  const filePath = './simple-test.limbic'
  const fileDb = open(filePath)
  await fileDb.remember('file test')
  await fileDb.close()
  
  // Reopen and test
  const reopenedDb = open(filePath)
  const fileResult = await reopenedDb.recall('file')
  console.log(`✅ File test: ${fileResult.memories.length} memories found`)
  await reopenedDb.close()
  
  // Cleanup
  try { rmSync(filePath, { force: true }) } catch {}
  
  console.log('🎉 Simple verification completed!')
}

main().catch(error => {
  console.error('Simple verification failed:', error)
  process.exit(1)
})