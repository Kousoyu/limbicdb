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
    console.log('Usage: limbic forget <content> [--json]');
    process.exit(1);
  }
  
  const content = args.join(' ');
  const dbPath = './agent.limbic';
  
  try {
    const memory = open(dbPath);
    // Search for the memory first to get its ID
    const searchResult = await memory.recall(content, { limit: 1 });
    if (searchResult.memories.length === 0) {
      if (jsonOutput) {
        console.log(JSON.stringify({ success: false, content, error: "Memory not found" }));
      } else {
        console.log(`Memory not found: "${content}"`);
      }
      await memory.close();
      return;
    }
    
    const memoryId = searchResult.memories[0].id;
    const deletedCount = await memory.forget({ ids: [memoryId] });
    await memory.close();
    
    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, content, deletedCount }));
    } else {
      console.log(`🗑️  Forgot: "${content}" (${deletedCount} memories deleted)`);
    }
    
  } catch (error: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, content, error: error.message }));
    } else {
      console.error('Error forgetting:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);