#!/usr/bin/env tsx
/**
 * LimbicDB Performance Baseline (PR C)
 * 
 * Measures keyword, semantic, and hybrid search performance
 * for both SQLite and memory backends.
 * 
 * This produces a baseline markdown table for the current alpha implementation.
 * Results are environment-specific and should be interpreted as relative baselines.
 */

import { open } from '../src/index'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mock embedder for consistent benchmarking
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

interface BenchmarkResult {
  backend: 'memory' | 'sqlite'
  memoryCount: number
  mode: 'keyword' | 'semantic' | 'hybrid'
  avgTimeMs: number
  avgResults: number
  embeddingReady: boolean
  fallbackOccurred?: boolean
}

async function benchmarkBackend(
  backend: 'memory' | 'sqlite',
  memoryCounts: number[]
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const searchQueries = [
    'test query for benchmarking',
    'user interface preferences',
    'technical documentation'
  ]
  
  for (const count of memoryCounts) {
    console.log(`\n--- ${backend.toUpperCase()} backend with ${count} memories ---`)
    
    let dbPath: string
    let cleanupPath: string | null = null
    
    if (backend === 'memory') {
      dbPath = ':memory:'
    } else {
      // Create temporary SQLite file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'limbicdb-benchmark-'))
      dbPath = path.join(tempDir, 'benchmark.limbic')
      cleanupPath = tempDir
    }
    
    const db = open({
      path: dbPath,
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
      
      // Wait for embeddings to compute (longer wait for larger counts)
      const embedWaitTime = Math.min(count * 2, 3000) // Max 3 seconds
      console.log(`  Waiting ${embedWaitTime}ms for embeddings computation...`)
      await new Promise(resolve => setTimeout(resolve, embedWaitTime))
      
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
          results.push({
            backend,
            memoryCount: count,
            mode,
            avgTimeMs: 0,
            avgResults: 0,
            embeddingReady: false
          })
          continue
        }
        
        console.log(`  ${mode}:`)
        
        let totalTime = 0
        let totalResults = 0
        let fallbackOccurred = false
        // Reduce iterations for larger memory counts
        const iterations = count >= 5000 ? 2 : 5
        
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
          
          if (result.meta.fallback) {
            fallbackOccurred = true
          }
          
          // Log first iteration details
          if (iter === 0) {
            console.log(`    Query: "${query}" → ${result.memories.length} results`)
            console.log(`    Executed: ${result.meta.executedMode} ${result.meta.fallback ? '(fallback)' : ''}`)
          }
        }
        
        const avgTime = totalTime / iterations
        const avgResults = totalResults / iterations
        console.log(`    Avg time: ${avgTime.toFixed(1)}ms, Avg results: ${avgResults.toFixed(1)}`)
        
        results.push({
          backend,
          memoryCount: count,
          mode,
          avgTimeMs: avgTime,
          avgResults,
          embeddingReady: true,
          fallbackOccurred
        })
      }
      
    } finally {
      await db.close()
      
      // Clean up temporary SQLite file
      if (cleanupPath) {
        try {
          await fs.rm(cleanupPath, { recursive: true, force: true })
        } catch (err) {
          console.warn(`  Warning: Failed to clean up ${cleanupPath}:`, err)
        }
      }
    }
  }
  
  return results
}

function generateMarkdownTable(results: BenchmarkResult[]): string {
  // Group by backend and memory count
  const grouped: Record<string, Record<string, BenchmarkResult[]>> = {}
  
  for (const result of results) {
    const key = `${result.backend}-${result.memoryCount}`
    if (!grouped[key]) {
      grouped[key] = {}
    }
    if (!grouped[key][result.mode]) {
      grouped[key][result.mode] = []
    }
    grouped[key][result.mode].push(result)
  }
  
  let markdown = `# LimbicDB Performance Baseline (Alpha)\n\n`
  markdown += `*Generated: ${new Date().toISOString().split('T')[0]}*\n\n`
  markdown += `**Note**: This is a baseline for the current alpha implementation. Results are environment-specific and should be interpreted as relative comparisons only.\n\n`
  
  // Memory Backend Results
  markdown += `## Memory Backend (:memory:)\n\n`
  markdown += `| Memories | Keyword (ms) | Semantic (ms) | Hybrid (ms) | Notes |\n`
  markdown += `|----------|--------------|---------------|-------------|-------|\n`
  
  const memoryResults = results.filter(r => r.backend === 'memory')
  const memoryCounts = [...new Set(memoryResults.map(r => r.memoryCount))].sort((a, b) => a - b)
  
  for (const count of memoryCounts) {
    const keyword = memoryResults.find(r => r.memoryCount === count && r.mode === 'keyword')
    const semantic = memoryResults.find(r => r.memoryCount === count && r.mode === 'semantic')
    const hybrid = memoryResults.find(r => r.memoryCount === count && r.mode === 'hybrid')
    
    const keywordStr = keyword && keyword.avgTimeMs > 0 ? keyword.avgTimeMs.toFixed(1) : 'N/A'
    const semanticStr = semantic && semantic.embeddingReady && semantic.avgTimeMs > 0 ? semantic.avgTimeMs.toFixed(1) : 'N/A'
    const hybridStr = hybrid && hybrid.embeddingReady && hybrid.avgTimeMs > 0 ? hybrid.avgTimeMs.toFixed(1) : 'N/A'
    
    let notes = ''
    if (semantic && !semantic.embeddingReady) notes += 'No embeddings; '
    if (semantic && semantic.fallbackOccurred) notes += 'Semantic fallback; '
    if (hybrid && hybrid.fallbackOccurred) notes += 'Hybrid fallback; '
    notes = notes.trim().replace(/; $/, '') || '-'
    
    markdown += `| ${count} | ${keywordStr} | ${semanticStr} | ${hybridStr} | ${notes} |\n`
  }
  
  // SQLite Backend Results
  markdown += `\n## SQLite Backend (./agent.limbic file)\n\n`
  markdown += `| Memories | Keyword (ms) | Semantic (ms) | Hybrid (ms) | Notes |\n`
  markdown += `|----------|--------------|---------------|-------------|-------|\n`
  
  const sqliteResults = results.filter(r => r.backend === 'sqlite')
  const sqliteCounts = [...new Set(sqliteResults.map(r => r.memoryCount))].sort((a, b) => a - b)
  
  for (const count of sqliteCounts) {
    const keyword = sqliteResults.find(r => r.memoryCount === count && r.mode === 'keyword')
    const semantic = sqliteResults.find(r => r.memoryCount === count && r.mode === 'semantic')
    const hybrid = sqliteResults.find(r => r.memoryCount === count && r.mode === 'hybrid')
    
    const keywordStr = keyword && keyword.avgTimeMs > 0 ? keyword.avgTimeMs.toFixed(1) : 'N/A'
    const semanticStr = semantic && semantic.embeddingReady && semantic.avgTimeMs > 0 ? semantic.avgTimeMs.toFixed(1) : 'N/A'
    const hybridStr = hybrid && hybrid.embeddingReady && hybrid.avgTimeMs > 0 ? hybrid.avgTimeMs.toFixed(1) : 'N/A'
    
    let notes = ''
    if (semantic && !semantic.embeddingReady) notes += 'No embeddings; '
    if (semantic && semantic.fallbackOccurred) notes += 'Semantic fallback; '
    if (hybrid && hybrid.fallbackOccurred) notes += 'Hybrid fallback; '
    notes = notes.trim().replace(/; $/, '') || '-'
    
    markdown += `| ${count} | ${keywordStr} | ${semanticStr} | ${hybridStr} | ${notes} |\n`
  }
  
  // Interpretation notes
  markdown += `\n## Interpretation\n\n`
  markdown += `- **Keyword search**: Uses SQLite FTS5 (file) or local matching (memory). Fast and scales well.\n`
  markdown += `- **Semantic search**: Brute-force cosine similarity, O(n) with vector dimension. Performance degrades linearly with memory count.\n`
  markdown += `- **Hybrid search**: Combined scoring (70% semantic, 30% keyword), similar cost to semantic search.\n`
  markdown += `- **Embedding readiness**: Semantic/hybrid modes require embeddings. If embeddings not ready, falls back to keyword search.\n`
  markdown += `- **Backend differences**: Memory backend avoids disk I/O; SQLite backend includes file operations.\n\n`
  
  markdown += `## Limitations\n\n`
  markdown += `1. Mock embedder (deterministic) doesn't represent real model latency\n`
  markdown += `2. Test data is synthetic and uniform\n`
  markdown += `3. Environment (CPU, memory, disk) affects absolute timings\n`
  markdown += `4. Alpha implementation - optimizations are planned\n`
  
  return markdown
}

async function runPerformanceBaseline() {
  console.log('=== LimbicDB Performance Baseline (PR C) ===\n')
  console.log('Note: This establishes baseline performance for the current alpha implementation.')
  console.log('Results are for internal comparison and development prioritization.\n')
  
  const memoryCounts = [100, 1000, 5000] // As requested
  const allResults: BenchmarkResult[] = []
  
  // Run benchmarks for both backends
  console.log('Running memory backend benchmarks...')
  const memoryResults = await benchmarkBackend('memory', memoryCounts)
  allResults.push(...memoryResults)
  
  console.log('\n' + '='.repeat(50) + '\n')
  
  console.log('Running SQLite backend benchmarks...')
  const sqliteResults = await benchmarkBackend('sqlite', memoryCounts)
  allResults.push(...sqliteResults)
  
  // Generate markdown report
  console.log('\n' + '='.repeat(50))
  console.log('Generating markdown report...\n')
  
  const markdown = generateMarkdownTable(allResults)
  console.log(markdown)
  
  // Also save to file
  const outputPath = path.join(__dirname, 'results', `baseline-${new Date().toISOString().split('T')[0]}.md`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, markdown, 'utf-8')
  
  console.log(`\nReport saved to: ${outputPath}`)
  console.log('\n=== Baseline Complete ===')
}

// Run baseline (ES module style)
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBaseline().catch(err => {
    console.error('Performance baseline failed:', err)
    process.exit(1)
  })
}

export default runPerformanceBaseline