#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

console.log('=== LimbicDB Example Verification ===')

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
  
  console.log('\n✅ All examples completed successfully')
} catch (error) {
  console.error('\n❌ Example verification failed:', error.message)
  if (error.stdout) console.error('STDOUT:', error.stdout.toString())
  if (error.stderr) console.error('STDERR:', error.stderr.toString())
  process.exit(1)
}