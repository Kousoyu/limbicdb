#!/usr/bin/env node

/**
 * release-check.js
 * 
 * Unified release gate script for LimbicDB.
 * Runs all public contract verification before publishing.
 * 
 * This script is the single source of truth for release validation.
 * It must pass before any npm publish or GitHub release.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function runCommand(name, command) {
  console.log(`\n🚀 Running: ${name}`)
  console.log(`   ${command}`)
  
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname })
    console.log(`✅ ${name} passed\n`)
    return true
  } catch (error) {
    console.error(`❌ ${name} failed\n`)
    console.error(`   Exit code: ${error.status}`)
    if (error.stdout) console.error(error.stdout.toString())
    if (error.stderr) console.error(error.stderr.toString())
    return false
  }
}

async function main() {
  console.log('========================================')
  console.log('  LimbicDB Release Gate')
  console.log('  Single source of truth for release validation')
  console.log('========================================\n')
  
  let allPassed = true
  
  // 1. Documentation consistency check
  allPassed &= runCommand(
    'Documentation Consistency',
    'npm run check:docs'
  )
  
  // 2. Example verification
  allPassed &= runCommand(
    'Example Verification',
    'npm run verify:examples'
  )
  
  // 3. Public contract verification
  allPassed &= runCommand(
    'Public Contract Verification',
    'npm run verify:public-contracts'
  )
  
  // Summary
  console.log('========================================')
  if (allPassed) {
    console.log('✅ All release checks passed')
    console.log('   LimbicDB is ready for release')
    process.exit(0)
  } else {
    console.log('❌ Release checks failed')
    console.log('   Please fix the issues above before publishing')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Fatal error in release-check:', error)
  process.exit(1)
})