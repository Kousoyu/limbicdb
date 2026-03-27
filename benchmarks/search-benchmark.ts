#!/usr/bin/env tsx
/**
 * LimbicDB Search Performance Baseline
 * 
 * Measures keyword, semantic, and hybrid search performance
 * with varying numbers of memories.
 * 
 * This is an internal benchmarking tool, not for production use.
 * Results should be interpreted as relative baselines, not absolute metrics.
 */

import { open } from '../src/index'

// Mock embedder for benchmarking
const benchmarkEmbedder = {
  async embed(text: string): Promise<number[]> {
    // Simple deterministic embedding for consistent benchmarking
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
  modelHint: 'benchmark'
}

async function runBenchmark() {
  console.log('=== LimbicDB Search Performance Baseline ===\n')
  console.log('Note: This measures MVP implementation with brute-force vector search.')
  console.log('Performance will degrade with >10K memories.\n')
  
  const memoryCounts = [10, 100, 500, 1000]
  const searchQueries = [
    'test query for benchmarking',
    'user interface preferences',
    'technical documentation'
  ]
  
  for (const count of memoryCounts) {
    console.log(`\n--- Benchmark with ${count} memories ---`)
    
    // Create fresh in-memory database
    const db = open({
      path: ':memory:',
      embedder: benchmarkEmbedder
    })
    
    try {
      // Add memories
      console.log(`  Adding ${count} memories...`)
      const startAdd = Date.now()
      
      for (let i = 0; i < count; i++) {
        await db.remember(`Memory ${i}: Sample content for benchmarking search performance. This is memory number ${i} in the database.`)
      }
      
      const addTime = Date.now() - startAdd
      console.log(`  Added ${count} memories in ${addTime}ms (avg ${(addTime/count).toFixed(1)}ms/memory)`)
      
      // Wait for embeddings to compute
      console.log(`  Waiting for embeddings computation...`)
      await new Promise(resolve => setTimeout(resolve, Math.min(count * 10, 2000)))
      
      // Verify embeddings count
      const stats = db.stats
      const hasEmbeddings = stats.embeddingsCount && stats.embeddingsCount > 0
      console.log(`  Embeddings: ${hasEmbeddings ? stats.embeddingsCount + ' computed' : 'none'}`)
      
      // Run benchmark for each search mode
      const modes = ['keyword', 'semantic', 'hybrid'] as const
      
      for (const mode of modes) {
        // Skip semantic/hybrid if no embeddings
        if ((mode === 'semantic' || mode === 'hybrid') && !hasEmbeddings) {
          console.log(`  ${mode}: skipped (no embeddings)`)
          continue
        }
        
        console.log(`  ${mode}:`)
        
        let totalTime = 0
        let totalResults = 0
        const iterations = 5
        
        for (let iter = 0; iter < iterations; iter++) {
          const query = searchQueries[iter % searchQueries.length]
          const startSearch = Date.now()
          
          const result = await db.recall(query, {
            mode,
            limit: 10
          })
          
          const searchTime = Date.now() - startSearch
          totalTime += searchTime
          totalResults += result.memories.length
          
          // Log first iteration details
          if (iter === 0) {
            console.log(`    Query: "${query}" → ${result.memories.length} results`)
            console.log(`    Mode: ${result.meta.requestedMode} → ${result.meta.executedMode} ${result.meta.fallback ? '(fallback)' : ''}`)
          }
        }
        
        const avgTime = totalTime / iterations
        const avgResults = totalResults / iterations
        console.log(`    Avg time: ${avgTime.toFixed(1)}ms, Avg results: ${avgResults.toFixed(1)}`)
        
        // Log embedding computation time if available
        if (mode === 'semantic' || mode === 'hybrid') {
          // Run one more to get timing details
          const detailResult = await db.recall(searchQueries[0], { mode, limit: 10 })
          if (detailResult.meta.timing) {
            console.log(`    Timing: search=${detailResult.meta.timing.searchMs}ms, embed=${detailResult.meta.timing.embedMs}ms`)
          }
        }
      }
      
    } finally {
      await db.close()
    }
  }
  
  console.log('\n=== Benchmark Complete ===')
  console.log('\nInterpretation:')
  console.log('- Keyword search: Uses SQLite FTS5, fast even at scale')
  console.log('- Semantic search: Brute-force cosine similarity, O(n) with vector dimension')
  console.log('- Hybrid search: Combined scoring, similar cost to semantic')
  console.log('\nLimitations:')
  console.log('- Mock embedder is not representative of real model latency')
  console.log('- In-memory database avoids disk I/O')
  console.log('- Results are for baseline comparison only')
}

// Run benchmark
if (require.main === module) {
  runBenchmark().catch(err => {
    console.error('Benchmark failed:', err)
    process.exit(1)
  })
}

export default runBenchmark