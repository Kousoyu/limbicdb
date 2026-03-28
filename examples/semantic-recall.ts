/**
 * Semantic recall with LimbicDB
 * 
 * This example shows how to add semantic search to LimbicDB
 * using any embedding model. LimbicDB never ships a model —
 * you bring your own.
 * 
 * Prerequisites:
 * npm install limbicdb @xenova/transformers
 * 
 * @xenova/transformers runs models locally via ONNX Runtime.
 * No API keys, no network calls, no data leaves your machine.
 * 
 * Note: @xenova/transformers is just one option. You can use OpenAI,
 * Cohere, or any embedding provider that returns number[].
 */

import { open } from 'limbicdb';

// Option 1: Use @xenova/transformers (local, no API keys)
// If you want to run this example, uncomment the import and pipeline call:
/*
import { pipeline } from '@xenova/transformers';

// Create your embedding function
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

async function embedWithTransformers(text: string): Promise<number[]> {
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}
*/

// Option 2: Mock embedding for demonstration (no dependencies)
// This is what we'll use for this example
async function embedMock(text: string): Promise<number[]> {
  // Simulate embedding computation
  await new Promise(resolve => setTimeout(resolve, 5));
  
  // Create a deterministic "embedding" for demonstration
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dims = 384;
  const vector = Array(dims).fill(0).map((_, i) => 
    Math.sin((hash + i) * 0.1) * 0.1
  );
  
  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / norm);
}

async function main() {
  console.log('=== LimbicDB Semantic Recall Example ===\n');
  
  // Step 1: Open LimbicDB with embedder
  console.log('1. Opening database with embedder...');
  const memory = open({
    path: ':memory:', // Use in-memory for example
    embedder: {
      embed: embedMock,
      dimensions: 384,
      modelHint: 'mock-model-v1'
    }
  });
  
  // Step 2: Remember some things
  console.log('2. Storing memories...');
  const memories = [
    'User prefers dark mode in all applications',
    'Last meeting was about Q3 budget review on March 15',
    'User is allergic to peanuts',
    'Project deadline is April 30, 2026',
    'Team uses React with TypeScript for frontend',
    'Database is PostgreSQL version 15',
    'Deployment happens every Tuesday at 2 AM',
    'Code review process requires two approvals',
    'User enjoys hiking on weekends',
    'Standup meetings are at 10 AM daily'
  ];
  
  for (const content of memories) {
    await memory.remember(content);
  }
  
  // Wait a moment for async embeddings to complete
  console.log('3. Computing embeddings (async)...');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Step 4: Semantic recall — meaning, not keywords
  console.log('\n4. Semantic recall — meaning, not keywords');
  console.log('Query: "What are the user\'s UI preferences?"');
  console.log('(Note: Query shares no keywords with any memory)');
  
  const semanticResult = await memory.recall('What are the user\'s UI preferences?', {
    mode: 'semantic',
    limit: 3,
  });
  
  console.log(`Mode: ${semanticResult.meta.mode}, Fallback: ${semanticResult.meta.fallback}`);
  console.log(`Embed: ${semanticResult.meta.timing.embedMs || 0}ms, Search: ${semanticResult.meta.timing.searchMs}ms`);
  console.log('Top results:');
  for (const mem of semanticResult.memories) {
    // Note: score field will be added when semantic search is fully implemented
    console.log(`  ${mem.content.substring(0, 60)}...`);
  }
  // Expected: "User prefers dark mode..." should rank highest
  
  // Step 5: Hybrid recall — best of both worlds
  console.log('\n5. Hybrid recall — 30% keyword, 70% semantic');
  console.log('Query: "budget"');
  
  const hybridResult = await memory.recall('budget', {
    mode: 'hybrid',
    limit: 3,
  });
  
  console.log(`Mode: ${hybridResult.meta.mode}`);
  console.log('Top results:');
  for (const mem of hybridResult.memories) {
    console.log(`  ${mem.content.substring(0, 60)}...`);
  }
  // Expected: "Last meeting was about Q3 budget review..." should appear
  
  // Step 6: Keyword recall (current default behavior)
  console.log('\n6. Keyword recall (current default behavior)');
  console.log('Query: "React"');
  
  const keywordResult = await memory.recall('React', {
    mode: 'keyword',
    limit: 2,
  });
  
  console.log(`Mode: ${keywordResult.meta.mode}`);
  console.log('Top results:');
  for (const mem of keywordResult.memories) {
    console.log(`  ${mem.content.substring(0, 60)}...`);
  }
  
  // Step 7: Graceful degradation
  console.log('\n7. Graceful degradation — no embedder, still works');
  const memoryNoEmbedder = open(':memory:'); // No embedder
  
  // Store a memory without embedder
  await memoryNoEmbedder.remember('Test without embedding support');
  
  const fallbackResult = await memoryNoEmbedder.recall('test', {
    mode: 'semantic', // Request semantic but no embedder
  });
  
  console.log(`Requested: semantic, Actual: ${fallbackResult.meta.mode}, Fallback: ${fallbackResult.meta.fallback}`);
  console.log(`Still returned ${fallbackResult.memories.length} result(s) using keyword search`);
  
  // Step 8: Stats show embedding count
  console.log('\n8. Statistics with embedding count');
  const stats = memory.stats;
  console.log(`Memories: ${stats.memoryCount}, Embeddings: ${stats.embeddingsCount || 0}`);
  
  // Step 9: Cleanup
  await memory.close();
  await memoryNoEmbedder.close();
  
  console.log('\n=== Example complete ===');
  console.log('\nKey takeaways:');
  console.log('1. LimbicDB supports keyword, semantic, and hybrid recall modes');
  console.log('2. Semantic recall requires providing your own embedder function');
  console.log('3. Hybrid recall combines keyword and semantic scores (30%/70%)');
  console.log('4. Graceful degradation: semantic falls back to keyword if no embedder');
  console.log('5. Embeddings computed async, don\'t block remember()');
  console.log('6. No built-in models — you control your data and compute');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;