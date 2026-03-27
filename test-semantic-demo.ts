import { open } from './dist/index.js';

// Mock embedder for testing
const mockEmbedder = {
  embed: async (text: string): Promise<number[]> => {
    // Simple deterministic mock embedding
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const dims = 384;
    const vector = Array(dims).fill(0).map((_, i) => 
      Math.sin((hash + i) * 0.1) * 0.1
    );
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / norm);
  },
  dimensions: 384,
  modelHint: 'mock-v1'
};

async function test() {
  console.log('=== Testing Semantic Search Integration ===\n');
  
  // Test 1: With embedder
  console.log('1. Testing with embedder...');
  const dbWithEmbedder = open({
    path: ':memory:',
    embedder: mockEmbedder
  });
  
  await dbWithEmbedder.remember('The user loves coffee in the morning');
  await dbWithEmbedder.remember('Project deadline is next Friday');
  await dbWithEmbedder.remember('Team meetings are on Wednesdays');
  
  // Wait for async embeddings
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const semanticResult = await dbWithEmbedder.recall('morning beverage', {
    mode: 'semantic',
    limit: 3
  });
  
  console.log(`Mode: ${semanticResult.meta.mode}, Fallback: ${semanticResult.meta.fallback}`);
  console.log(`Results: ${semanticResult.memories.length}`);
  
  // Test 2: Hybrid mode
  console.log('\n2. Testing hybrid mode...');
  const hybridResult = await dbWithEmbedder.recall('meeting', {
    mode: 'hybrid',
    limit: 2
  });
  
  console.log(`Mode: ${hybridResult.meta.mode}`);
  console.log(`Results: ${hybridResult.memories.length}`);
  
  // Test 3: Without embedder (should fallback)
  console.log('\n3. Testing without embedder (graceful fallback)...');
  const dbNoEmbedder = open(':memory:');
  
  await dbNoEmbedder.remember('Test without embeddings');
  
  const fallbackResult = await dbNoEmbedder.recall('test', {
    mode: 'semantic'
  });
  
  console.log(`Requested: semantic, Actual: ${fallbackResult.meta.mode}, Fallback: ${fallbackResult.meta.fallback}`);
  console.log(`Still works: ${fallbackResult.memories.length > 0}`);
  
  // Test 4: Stats
  console.log('\n4. Checking stats...');
  const stats = dbWithEmbedder.stats;
  console.log(`Memories: ${stats.memoryCount}, Embeddings: ${stats.embeddingsCount || 0}`);
  
  await dbWithEmbedder.close();
  await dbNoEmbedder.close();
  
  console.log('\n✅ All tests completed!');
}

test().catch(console.error);