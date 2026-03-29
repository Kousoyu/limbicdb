#!/usr/bin/env node

import { open } from '../index';

async function main() {
  // Parse arguments
  const args = [];
  let jsonOutput = false;
  
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--json') {
      jsonOutput = true;
    } else {
      args.push(process.argv[i]);
    }
  }
  
  if (args.length === 0) {
    console.log('Usage: limbic timeline <query> [--json]');
    process.exit(1);
  }
  
  const query = args.join(' ');
  const dbPath = './agent.limbic';
  
  try {
    const memory = open(dbPath);
    // Use recall with no limit to get all memories
    const result = await memory.recall(query, { limit: 1000 });
    const allMemories = result.memories.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    await memory.close();
    
    if (jsonOutput) {
      console.log(JSON.stringify({ query, memories: allMemories }));
    } else {
      console.log(`🕒 Timeline for: "${query}"\n`);
      if (allMemories.length === 0) {
        console.log('No memories found.');
      } else {
        allMemories.forEach((mem, index) => {
          const date = new Date(mem.createdAt || Date.now());
          console.log(`[${date.toLocaleTimeString()}] ${mem.content}`);
        });
      }
    }
    
  } catch (error: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ query, memories: [], error: error.message }));
    } else {
      console.error('Error getting timeline:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);