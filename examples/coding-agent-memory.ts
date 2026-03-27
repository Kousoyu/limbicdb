#!/usr/bin/env tsx
/**
 * LimbicDB for a Coding Agent
 * 
 * This example shows how a coding agent could use LimbicDB to maintain
 * context about a project across multiple sessions.
 * 
 * Key concepts demonstrated:
 * - Auto-classification of memories (facts, preferences, procedures)
 * - Strength-based recall (stronger memories rise to the top)
 * - Snapshot/restore for session persistence
 * - State storage for runtime context
 */

import { open } from '../src/index'

async function main() {
  console.log('=== Coding Agent Memory Example ===\n')
  
  // Open a memory store for the coding project
  const memory = open('./coding-agent.limbic')
  
  try {
    // 1. The agent learns about the project
    console.log('1. Learning about the project...')
    await memory.remember('Project uses TypeScript with React 18')
    await memory.remember('Codebase follows functional programming patterns')
    await memory.remember('User prefers dark theme in the editor', { strength: 0.9 })
    await memory.remember('Authentication uses JWT tokens stored in HTTP-only cookies')
    
    // 2. The agent records its work
    console.log('2. Recording work sessions...')
    await memory.remember('Yesterday I refactored the auth module to use context API', { 
      kind: 'episode',
      tags: ['refactoring', 'auth']
    })
    
    await memory.remember('Need to fix the login page responsive layout', {
      kind: 'goal',
      strength: 0.8,
      tags: ['frontend', 'bug']
    })
    
    await memory.remember('Deployment process: build, run tests, push to main branch', {
      kind: 'procedure',
      tags: ['deployment', 'ci']
    })
    
    // 3. Store runtime state (not memory, but memory-adjacent)
    console.log('3. Storing runtime state...')
    await memory.set('current_session', {
      startedAt: new Date().toISOString(),
      activeFile: 'src/components/Login.tsx',
      focusedTask: 'responsive layout'
    })
    
    // 4. Take a snapshot before making changes
    console.log('4. Creating snapshot...')
    const snapshotId = await memory.snapshot()
    console.log(`   Snapshot created: ${snapshotId}`)
    
    // 5. Recall relevant context for a task
    console.log('\n5. Recalling context for "fix login page":')
    const context = await memory.recall('login page fix', { 
      limit: 5,
      mode: 'keyword'
    })
    
    console.log(`   Found ${context.memories.length} relevant memories:`)
    context.memories.forEach((mem, i) => {
      console.log(`   ${i + 1}. [${mem.kind}] ${mem.content.substring(0, 60)}... (strength: ${mem.strength.toFixed(2)})`)
    })
    
    // 6. Simulate memory decay and recall
    console.log('\n6. Simulating over time (memory decay)...')
    const stats = memory.stats
    console.log(`   Memory count: ${stats.memoryCount}`)
    console.log(`   DB size: ${(stats.dbSizeBytes / 1024).toFixed(1)} KB`)
    
    // 7. Recall preferences specifically
    console.log('\n7. Recalling user preferences:')
    const preferences = await memory.recall('', { 
      kind: 'preference',
      limit: 3
    })
    
    preferences.memories.forEach(pref => {
      console.log(`   - ${pref.content}`)
    })
    
    // 8. Restore snapshot (simulating new session)
    console.log('\n8. Restoring snapshot for new session...')
    await memory.restore(snapshotId)
    console.log('   Restored to snapshot state')
    
    // Verify we're back to snapshot state
    const restoredStats = memory.stats
    console.log(`   Memory count after restore: ${restoredStats.memoryCount}`)
    
    // 9. Show timeline of operations
    console.log('\n9. Recent timeline:')
    const timeline = await memory.history({ limit: 3 })
    timeline.forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString()
      console.log(`   [${time}] ${event.type}.${event.action}: ${event.content || event.refKey || ''}`)
    })
    
    console.log('\n=== Example Complete ===')
    console.log('\nWhat this demonstrates:')
    console.log('- Memory auto-classification (fact/episode/preference/procedure/goal)')
    console.log('- Strength-based recall (more relevant memories surface first)')
    console.log('- Timeline auditing (full history of operations)')
    console.log('- Snapshot/restore (persist and recover session state)')
    console.log('- Not just KV storage (tagging, filtering, semantic organization)')
    
  } finally {
    await memory.close()
    console.log('\nMemory closed. File saved to ./coding-agent.limbic')
    console.log('(Delete this file if you don\'t need it)')
  }
}

// Run example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Example failed:', err)
    process.exit(1)
  })
}