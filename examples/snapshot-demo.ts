/**
 * LimbicDB Snapshot Demo
 * 
 * Demonstrates the snapshot and restore functionality with embeddings.
 * 
 * Usage:
 *   npx tsx examples/snapshot-demo.ts
 * 
 * This example creates a database, adds memories with embeddings,
 * creates a snapshot, modifies the data, then restores the snapshot.
 */

import { open } from '../src/index'

// Simple mock embedder for demonstration
const mockEmbedder = {
  async embed(text: string): Promise<number[]> {
    // Deterministic embedding for demo purposes
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
  modelHint: 'demo-model'
}

async function main() {
  console.log('=== LimbicDB Snapshot Demo ===\n')
  
  // Create a database with embedder
  const db = open({
    path: './demo-snapshot.limbic',
    embedder: mockEmbedder
  })
  
  try {
    console.log('1. Adding memories...')
    await db.remember('User prefers dark mode interface')
    await db.remember('Application should have minimalist design')
    await db.remember('User likes keyboard shortcuts for efficiency')
    
    console.log('   Memories added. Waiting for embeddings computation...')
    // Give time for async embedding computation
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('\n2. Performing semantic search...')
    const searchResults = await db.recall('user interface preferences', {
      mode: 'semantic',
      limit: 5
    })
    
    console.log(`   Found ${searchResults.memories.length} relevant memories`)
    console.log(`   Search mode: requested=${searchResults.meta.requestedMode}, executed=${searchResults.meta.executedMode}`)
    console.log(`   Fallback: ${searchResults.meta.fallback}`)
    if (searchResults.meta.pendingEmbeddings !== undefined) {
      console.log(`   Pending embeddings: ${searchResults.meta.pendingEmbeddings}`)
    }
    
    if (searchResults.memories.length > 0) {
      console.log('   Top memories:')
      searchResults.memories.forEach((mem, i) => {
        console.log(`     ${i + 1}. ${mem.content}`)
      })
    }
    
    console.log('\n3. Creating snapshot...')
    const snapshotId = await db.snapshot()
    console.log(`   Snapshot created: ${snapshotId}`)
    
    // Show current stats
    const preSnapshotStats = db.stats
    console.log(`   Stats before snapshot: ${preSnapshotStats.memoryCount} memories`)
    if (preSnapshotStats.embeddingsCount !== undefined) {
      console.log(`   Embeddings: ${preSnapshotStats.embeddingsCount}`)
    }
    
    console.log('\n4. Modifying data after snapshot...')
    await db.remember('This memory will be lost after restore')
    console.log('   Added one more memory')
    
    console.log('\n5. Restoring snapshot...')
    await db.restore(snapshotId)
    console.log(`   Restored from snapshot: ${snapshotId}`)
    
    // Show stats after restore
    const postRestoreStats = db.stats
    console.log(`   Stats after restore: ${postRestoreStats.memoryCount} memories`)
    if (postRestoreStats.embeddingsCount !== undefined) {
      console.log(`   Embeddings: ${postRestoreStats.embeddingsCount}`)
    }
    
    console.log('\n6. Verifying data after restore...')
    const verifySearch = await db.recall('memory', { mode: 'keyword' })
    console.log(`   Total memories: ${verifySearch.memories.length}`)
    
    // Check if the added memory is gone
    const lostMemorySearch = await db.recall('lost after restore', { mode: 'keyword' })
    if (lostMemorySearch.memories.length === 0) {
      console.log('   ✓ Memory added after snapshot was correctly removed by restore')
    } else {
      console.log('   ✗ Memory added after snapshot still exists (unexpected)')
    }
    
    console.log('\n7. Testing semantic search after restore...')
    const postRestoreSearch = await db.recall('user interface preferences', {
      mode: 'semantic',
      limit: 5
    })
    
    console.log(`   Found ${postRestoreSearch.memories.length} relevant memories`)
    console.log(`   Search mode: requested=${postRestoreSearch.meta.requestedMode}, executed=${postRestoreSearch.meta.executedMode}`)
    console.log(`   Fallback: ${postRestoreSearch.meta.fallback}`)
    if (postRestoreSearch.meta.pendingEmbeddings !== undefined) {
      console.log(`   Pending embeddings: ${postRestoreSearch.meta.pendingEmbeddings}`)
    }
    
    console.log('\n=== Demo Complete ===')
    console.log('\nNote: This demo shows the snapshot/restore functionality.')
    console.log('If embeddings are included in snapshots, semantic search should')
    console.log('work after restore. If not, it will fall back to keyword search.')
    
  } finally {
    await db.close()
    console.log('\nDatabase closed.')
    
    // Clean up demo file
    try {
      const fs = await import('fs/promises')
      await fs.unlink('./demo-snapshot.limbic').catch(() => {})
      console.log('Demo file cleaned up.')
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Run the demo
if (require.main === module) {
  main().catch(err => {
    console.error('Demo failed:', err)
    process.exit(1)
  })
}

export default main