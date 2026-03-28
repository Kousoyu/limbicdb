#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

console.log('=== LimbicDB Example Verification ===')

function runBasicTest() {
  console.log('\n3. Running basic usage test (README example)...')
  
  const testFile = join(repoRoot, 'test-basic-verify.limbic')
  const testScriptPath = join(repoRoot, 'test-basic-verify.mjs')
  
  try {
    // Clean up any existing test file
    try { rmSync(testFile, { force: true }) } catch {}
    
    // Create the basic test script
    const basicTestCode = `import { open } from './dist/index.js'
import { rmSync } from 'fs'

async function test() {
  const memory = open("./test-basic-verify.limbic")
  try {
    await memory.remember("User is allergic to nuts")
    await memory.remember("Project deadline is Friday")
    
    const result = await memory.recall("allergies")
    console.log("Basic test passed:", result.memories.length > 0)
    if (result.memories.length === 0) {
      throw new Error("No memories found")
    }
  } finally {
    await memory.close()
    // Clean up test file
    try { rmSync("./test-basic-verify.limbic", { force: true }) } catch {}
  }
}

test().catch(err => {
  console.error("Basic test failed:", err)
  process.exit(1)
})
`
    
    // Write test to temporary file
    writeFileSync(testScriptPath, basicTestCode, 'utf8')
    
    try {
      execSync(`node ${testScriptPath}`, { 
        cwd: repoRoot, 
        stdio: 'inherit',
        timeout: 15000
      })
    } finally {
      try { rmSync(testScriptPath, { force: true }) } catch {}
      try { rmSync(testFile, { force: true }) } catch {}
    }
    
  } catch (error) {
    // Clean up on error
    try { rmSync(testFile, { force: true }) } catch {}
    try { rmSync(testScriptPath, { force: true }) } catch {}
    throw error
  }
}

try {
  // Build first to ensure dist exists
  console.log('1. Building...')
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' })
  
  console.log('\n2. Running semantic-recall example...')
  execSync('npx tsx examples/semantic-recall.ts', { 
    cwd: repoRoot, 
    stdio: 'inherit',
    timeout: 30000 // 30 seconds
  })
  
  console.log('\n3. Running durable-semantic-snapshot example...')
  execSync('npx tsx examples/durable-semantic-snapshot.ts', { 
    cwd: repoRoot, 
    stdio: 'inherit',
    timeout: 30000
  })
  
  // Run basic test
  runBasicTest()
  
  console.log('\n✅ All examples completed successfully')
} catch (error) {
  console.error('\n❌ Example verification failed:', error.message)
  if (error.stdout) console.error('STDOUT:', error.stdout.toString())
  if (error.stderr) console.error('STDERR:', error.stderr.toString())
  process.exit(1)
}