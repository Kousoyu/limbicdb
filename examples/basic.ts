#!/usr/bin/env node
/**
 * Basic LimbicDB Example
 * 
 * Demonstrates core functionality:
 * 1. Creating/opening a database
 * 2. Remembering memories
 * 3. Recalling memories
 * 4. Memory decay simulation
 * 5. State persistence
 */

import { open } from '../src/index.js'

async function main() {
  console.log('🧠 LimbicDB Basic Example\n')
  
  // 1. Open database (in-memory for demo)
  const db = open(':memory:')
  console.log('✅ Database opened (in-memory mode)')
  
  // 2. Remember some facts
  console.log('\n📝 Remembering memories...')
  
  const memories = [
    'User prefers TypeScript over JavaScript',
    'Project uses PostgreSQL version 15',
    'Yesterday we discussed the API design',
    'Deployment process: first build, then deploy to Vercel',
    'Need to finish user authentication by Friday',
  ]
  
  for (const content of memories) {
    const memory = await db.remember(content)
    console.log(`  • "${content.substring(0, 40)}..." → ${memory.kind}`)
  }
  
  // 3. Recall memories
  console.log('\n🔍 Recalling memories...')
  
  const queries = ['TypeScript', 'deployment', 'Friday', 'PostgreSQL']
  for (const query of queries) {
    const results = await db.recall(query)
    console.log(`  • "${query}": ${results.length} result(s)`)
    if (results.length > 0) {
      console.log(`    First: "${results[0].content.substring(0, 50)}..."`)
    }
  }
  
  // 4. State persistence
  console.log('\n💾 Testing state persistence...')
  
  await db.set('project', {
    name: 'LimbicDB Demo',
    version: '0.1.0',
    progress: 0.25,
    todos: ['Write tests', 'Add semantic search', 'Benchmark']
  })
  
  const project = await db.get('project')
  console.log(`  • Project: ${project?.name} v${project?.version}`)
  console.log(`  • Progress: ${(project?.progress * 100).toFixed(1)}%`)
  
  // 5. Timeline
  console.log('\n📜 Timeline (recent events)...')
  const events = await db.history({ limit: 5 })
  console.log(`  • ${events.length} events recorded`)
  for (const event of events) {
    console.log(`    - ${event.type}.${event.action}: ${event.content?.substring(0, 30)}...`)
  }
  
  // 6. Close
  await db.close()
  console.log('\n✅ Example completed')
  console.log('\n💡 Next steps:')
  console.log('  • Try with a file: open("./agent.limbic")')
  console.log('  • Add custom embedder for semantic search')
  console.log('  • Configure decay: { halfLifeHours: 24 }')
  console.log('  • Use memory kinds: { kind: "goal" }')
}

main().catch(console.error)