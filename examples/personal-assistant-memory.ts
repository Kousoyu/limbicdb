#!/usr/bin/env tsx
/**
 * LimbicDB for a Personal Assistant
 * 
 * This example shows how a personal assistant could use LimbicDB to remember
 * user preferences, daily events, and important facts.
 * 
 * Key concepts demonstrated:
 * - Memory lifecycle (creation, recall, forgetting)
 * - Tag-based organization
 * - Time-based filtering
 * - Mixed content (facts, preferences, episodes)
 */

import { open } from '../src/index'

async function main() {
  console.log('=== Personal Assistant Memory Example ===\n')
  
  // Open memory for the user
  const memory = open('./personal-assistant.limbic')
  
  try {
    // 1. Learn about the user
    console.log('1. Learning about the user...')
    await memory.remember('User is allergic to peanuts and shellfish', {
      kind: 'fact',
      strength: 0.95, // Important health information
      tags: ['health', 'allergies']
    })
    
    await memory.remember('User prefers morning meetings before 11 AM', {
      kind: 'preference',
      tags: ['schedule', 'preferences']
    })
    
    await memory.remember('User drinks coffee black, no sugar', {
      kind: 'preference',
      tags: ['food', 'preferences']
    })
    
    // 2. Record daily events
    console.log('2. Recording daily events...')
    await memory.remember('Yesterday we had lunch at the new Italian restaurant', {
      kind: 'episode',
      tags: ['food', 'restaurant', 'social']
    })
    
    await memory.remember('Weekly team meeting every Monday 10 AM', {
      kind: 'fact',
      tags: ['work', 'schedule', 'recurring']
    })
    
    await memory.remember('Need to buy groceries after work', {
      kind: 'goal',
      strength: 0.7,
      tags: ['shopping', 'personal']
    })
    
    // 3. Store some procedures
    console.log('3. Storing procedures...')
    await memory.remember('Morning routine: coffee, check emails, 30min exercise', {
      kind: 'procedure',
      tags: ['routine', 'morning']
    })
    
    await memory.remember('Travel checklist: passport, tickets, medication, charger', {
      kind: 'procedure',
      tags: ['travel', 'checklist']
    })
    
    // 4. Query memories in different ways
    console.log('\n4. Smart recall examples:')
    
    // What does the user prefer?
    console.log('   User preferences:')
    const preferences = await memory.recall('', { 
      kind: 'preference',
      limit: 5
    })
    preferences.memories.forEach(pref => {
      console.log(`   - ${pref.content}`)
    })
    
    // What's happening today/soon?
    console.log('\n   Upcoming/recurring items:')
    const upcoming = await memory.recall('meeting schedule', {
      limit: 3
    })
    upcoming.memories.forEach(item => {
      console.log(`   - ${item.content}`)
    })
    
    // Health/safety critical info
    console.log('\n   Critical health info:')
    const health = await memory.recall('allergy', {
      tags: ['health']
    })
    health.memories.forEach(item => {
      console.log(`   - ${item.content} (strength: ${item.strength.toFixed(2)})`)
    })
    
    // 5. Demonstrate forgetting/decay
    console.log('\n5. Memory management:')
    const stats = memory.stats
    console.log(`   Total memories: ${stats.memoryCount}`)
    console.log(`   Oldest memory age: ${stats.oldestMemoryAge ? Math.round(stats.oldestMemoryAge / (1000 * 60 * 60 * 24)) + ' days' : 'N/A'}`)
    
    // Simulate forgetting completed goals
    console.log('\n   Forgetting completed shopping goal...')
    const forgotten = await memory.forget({
      kind: 'goal',
      tags: ['shopping']
    })
    console.log(`   Forgot ${forgotten} completed goal(s)`)
    
    // 6. Mixed query (combining multiple aspects)
    console.log('\n6. Complex query: "What should I know about user for planning?"')
    const planningContext = await memory.recall('user routine preference schedule', {
      limit: 8,
      mode: 'keyword'
    })
    
    console.log(`   Found ${planningContext.memories.length} relevant items:`)
    planningContext.memories.forEach((mem, i) => {
      const type = mem.kind.toUpperCase()
      const preview = mem.content.length > 50 ? mem.content.substring(0, 47) + '...' : mem.content
      console.log(`   ${i + 1}. [${type}] ${preview}`)
    })
    
    // 7. Show memory strength evolution
    console.log('\n7. Memory strength demonstration:')
    console.log('   Health allergies have high strength (0.95): critical')
    console.log('   Daily preferences have medium strength (0.5-0.7): important')
    console.log('   Completed goals can be forgotten: transient')
    
    // 8. Export/backup demonstration
    console.log('\n8. Backup capability:')
    console.log('   The entire memory is stored in ./personal-assistant.limbic')
    console.log('   This single file can be:')
    console.log('   - Copied to another device')
    console.log('   - Version controlled')
    console.log('   - Backed up to cloud storage')
    console.log('   - Inspected with SQLite tools')
    
    // 9. What makes this different from key-value stores
    console.log('\n9. How this differs from simple key-value storage:')
    console.log('   ✓ Memories have semantic types (fact/episode/preference/etc)')
    console.log('   ✓ Memories have strength that evolves over time')
    console.log('   ✓ Tag-based organization and filtering')
    console.log('   ✓ Timeline of all operations (audit trail)')
    console.log('   ✓ Smart recall with relevance ranking')
    console.log('   ✓ Built-in forgetting/decay mechanisms')
    
    console.log('\n=== Example Complete ===')
    console.log('\nKey takeaway:')
    console.log('LimbicDB provides a memory lifecycle engine, not just storage.')
    console.log('It understands that some memories are critical (allergies),')
    console.log('some are preferences (coffee style), and some are transient (shopping lists).')
    
  } finally {
    await memory.close()
    console.log('\nMemory closed. File saved to ./personal-assistant.limbic')
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