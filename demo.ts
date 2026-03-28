#!/usr/bin/env tsx
/**
 * LimbicDB Demo
 * 
 * Run with: npx tsx demo.ts
 */

import { open } from './src/index.js'

async function main() {
  console.log('🧠 LimbicDB Demo\n')
  
  // Create in-memory database
  const db = open(':memory:')
  
  // Remember some memories
  console.log('1. Remembering memories...')
  await db.remember('User loves TypeScript and React')
  await db.remember('Project deadline is this Friday')
  await db.remember('Deploy process: npm run build then npm run deploy')
  await db.remember('Yesterday we fixed the login bug')
  await db.remember('User prefers dark mode for coding')
  
  // Recall memories
  console.log('\n2. Recalling memories about TypeScript...')
  const results = await db.recall('TypeScript')
  results.memories.forEach((mem, i) => {
    console.log(`  ${i + 1}. [${mem.kind}] ${mem.content} (strength: ${mem.strength.toFixed(2)})`)
  })
  
  // Test state persistence
  console.log('\n3. Testing state persistence...')
  await db.set('session', { userId: 'user123', startedAt: new Date().toISOString() })
  const session = await db.get('session')
  console.log(`  Session:`, session)
  
  // View timeline
  console.log('\n4. Recent timeline events...')
  const events = await db.history({ limit: 5 })
  events.forEach(event => {
    const time = new Date(event.timestamp).toLocaleTimeString()
    console.log(`  ${time} ${event.type}.${event.action}: ${event.content || event.refKey}`)
  })
  
  // Show stats
  console.log('\n5. Database stats:')
  console.log(`  Memories: ${db.stats.memoryCount}`)
  console.log(`  State keys: ${db.stats.stateKeyCount}`)
  
  // Close
  await db.close()
  console.log('\n✅ Demo completed!')
  console.log('\n💡 Try:')
  console.log('  • npm run build && node dist/index.js')
  console.log('  • Create a file-based DB: open("./my-agent.limbic")')
  console.log('  • Add memory decay: { decay: { halfLifeHours: 24 } }')
}

main().catch(console.error)