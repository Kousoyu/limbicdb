#!/usr/bin/env tsx
/**
 * LimbicDB Durable Storage with Semantic Search and Snapshots
 * 
 * Demonstrates using LimbicDB with persistent file storage, embeddings,
 * and snapshot/restore functionality.
 * 
 * This is a durable semantic MVP path for alpha evaluation:
 * - Persistent SQLite database (./agent.limbic)
 * - Embeddings for semantic search (experimental-mvp)
 * - Snapshots for backup and restore
 * 
 * Usage:
 *   npx tsx examples/durable-semantic-snapshot.ts
 * 
 * The example creates a file-based database, adds memories with embeddings,
 * performs semantic search, creates a snapshot, modifies data, restores,
 * and verifies everything works correctly.
 */

import { open } from '../src/index'
import { unlink } from 'fs/promises'
import { join } from 'path'

// Simple mock embedder - in real usage, replace with your model
const mockEmbedder = {
  async embed(text: string): Promise<number[]> {
    // Deterministic embedding for consistent demonstration
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const dims = 384
    const vector = Array(dims).fill(0).map((_, i) => 
      Math.sin((hash + i) * 0.1) * 0.1
    )
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    return vector.map(v => v / norm)
  },
  dimensions: 384,
  modelHint: 'mock-model-v1'
}

async function main() {
  console.log('=== LimbicDB Durable Storage Example ===\n')
  console.log('This example shows the alpha evaluation setup for agent memory:')
  console.log('- Persistent SQLite database (./agent.limbic file)')
  console.log('- Embeddings for semantic search (experimental-mvp)')
  console.log('- Snapshot/restore for backups (alpha reliability)\n')
  
  const dbPath = './agent.limbic'
  
  // Clean up any existing demo file
  try {
    await unlink(dbPath)
  } catch {
    // File doesn't exist, that's fine
  }
  
  // Step 1: Open database with embedder
  console.log('1. Opening persistent database with embedder...')
  console.log(`   Path: ${dbPath}`)
  
  const db = open({
    path: dbPath,           // File path, not :memory:
    embedder: mockEmbedder  // Optional: enables semantic search
  })
  
  try {
    // Step 2: Add memories
    console.log('\n2. Adding memories with automatic embedding...')
    
    const memories = [
      'User interface should use dark theme',
      'Weekly team meeting is every Monday at 10 AM',
      'Project uses React with TypeScript and Tailwind CSS',
      'Database connection string: postgresql://localhost:5432/app',
      'Deployment pipeline runs on Git push to main branch',
      'Code review requires at least one approval',
      'User prefers keyboard shortcuts over mouse',
      'API rate limit is 1000 requests per hour',
      'Error logs are stored in /var/log/app.log',
      'Backup runs daily at 2 AM'
    ]
    
    for (const content of memories) {
      await db.remember(content)
    }
    
    console.log(`   Added ${memories.length} memories`)
    console.log('   Embeddings computed asynchronously in background')
    
    // Wait briefly for embeddings (real embedders might take longer)
    console.log('   Waiting for embedding computation...')
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Step 3: Check database stats
    console.log('\n3. Database statistics:')
    const stats = db.stats
    console.log(`   Memories: ${stats.memoryCount}`)
    if (stats.embeddingsCount !== undefined) {
      console.log(`   Embeddings: ${stats.embeddingsCount} computed`)
      console.log(`   Embedding dimensions: ${stats.embeddingsDimensions}`)
    }
    
    // Step 4: Demonstrate different search modes
    console.log('\n4. Search demonstration:')
    
    // 4a: Keyword search (always works)
    console.log('\n   a) Keyword search:')
    const keywordResult = await db.recall('React TypeScript', {
      mode: 'keyword',
      limit: 3
    })
    console.log(`      Query: "React TypeScript"`)
    console.log(`      Found: ${keywordResult.memories.length} matches`)
    console.log(`      Mode: ${keywordResult.meta.executedMode}`)
    
    // 4b: Semantic search (requires embeddings)
    console.log('\n   b) Semantic search:')
    const semanticResult = await db.recall('frontend development tools', {
      mode: 'semantic',
      limit: 3
    })
    console.log(`      Query: "frontend development tools"`)
    console.log(`      Found: ${semanticResult.memories.length} matches`)
    console.log(`      Mode: ${semanticResult.meta.requestedMode} → ${semanticResult.meta.executedMode}`)
    if (semanticResult.meta.fallback) {
      console.log(`      Note: Fell back to keyword (no embeddings)`)
    } else {
      console.log(`      Semantic similarity search worked!`)
    }
    
    // 4c: Hybrid search
    console.log('\n   c) Hybrid search:')
    const hybridResult = await db.recall('user interface preferences', {
      mode: 'hybrid',
      limit: 3
    })
    console.log(`      Query: "user interface preferences"`)
    console.log(`      Found: ${hybridResult.memories.length} matches`)
    console.log(`      Mode: ${hybridResult.meta.requestedMode} → ${hybridResult.meta.executedMode}`)
    
    // Step 5: Create snapshot
    console.log('\n5. Creating snapshot...')
    const snapshotId = await db.snapshot()
    console.log(`   Snapshot ID: ${snapshotId}`)
    console.log(`   Includes: memories, state, timeline, and embeddings`)
    
    // Verify snapshot contains embeddings
    const snapshotStats = db.stats
    console.log(`   Current embeddings in snapshot: ${snapshotStats.embeddingsCount || 0}`)
    
    // Step 6: Modify data after snapshot
    console.log('\n6. Modifying data after snapshot...')
    await db.remember('This memory will be lost after restore')
    await db.remember('Temporary configuration change')
    
    const afterModifyStats = db.stats
    console.log(`   Added 2 more memories`)
    console.log(`   Total memories now: ${afterModifyStats.memoryCount}`)
    
    // Step 7: Restore snapshot
    console.log('\n7. Restoring snapshot...')
    await db.restore(snapshotId)
    console.log(`   Restored from snapshot: ${snapshotId}`)
    
    const afterRestoreStats = db.stats
    console.log(`   Memories after restore: ${afterRestoreStats.memoryCount}`)
    console.log(`   Embeddings after restore: ${afterRestoreStats.embeddingsCount || 0}`)
    
    // Step 8: Verify restore worked
    console.log('\n8. Verifying restore...')
    
    // Check that temporary memories are gone
    const tempSearch = await db.recall('temporary', { mode: 'keyword' })
    if (tempSearch.memories.length === 0) {
      console.log('   ✓ Temporary memories correctly removed')
    } else {
      console.log('   ✗ Temporary memories still exist')
    }
    
    // Verify semantic search still works
    const postRestoreSearch = await db.recall('frontend tools', {
      mode: 'semantic',
      limit: 2
    })
    
    if (postRestoreSearch.meta.fallback) {
      console.log('   ⚠️ Semantic search fell back to keyword after restore')
    } else {
      console.log('   ✓ Semantic search works after restore')
      console.log(`   Mode: ${postRestoreSearch.meta.executedMode}`)
    }
    
    // Step 9: Close and reopen database
    console.log('\n9. Testing persistence across sessions...')
    await db.close()
    console.log('   Database closed')
    
    // Reopen the same file
    const db2 = open({
      path: dbPath,
      embedder: mockEmbedder
    })
    
    try {
      const reopenedStats = db2.stats
      console.log(`   Reopened database`)
      console.log(`   Memories: ${reopenedStats.memoryCount}`)
      console.log(`   Embeddings: ${reopenedStats.embeddingsCount || 0}`)
      
      // Quick search to verify everything loaded
      const testSearch = await db2.recall('dark theme', { mode: 'keyword' })
      console.log(`   Search test: found ${testSearch.memories.length} matches`)
      
    } finally {
      await db2.close()
    }
    
    console.log('\n=== Example Complete ===')
    console.log('\nAlpha key takeaways:')
    console.log('1. Default path (./agent.limbic) provides durable storage (alpha reliability)')
    console.log('2. Embedder config enables semantic/hybrid search (experimental-mvp)')
    console.log('3. Snapshots capture memories, state, timeline, and embeddings')
    console.log('4. Restore brings back everything including embeddings (alpha feature)')
    console.log('5. Database persists across application restarts (core promise)')
    console.log('\nAlpha evaluation guidance:')
    console.log('- Replace mockEmbedder with your actual embedding model (OpenAI, local, etc.)')
    console.log('- Schedule regular snapshots for backup (alpha feature reliability)')
    console.log('- Use hybrid search (experimental) or keyword search (stable fallback)')
    console.log('- Monitor executedMode and fallback flags to understand alpha behavior')
    console.log('- Semantic search may fall back to keyword depending on embedding availability')
    
  } finally {
    // Final cleanup
    try {
      await unlink(dbPath)
      console.log('\nDemo file cleaned up.')
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Example failed:', err)
    process.exit(1)
  })
}

export default main