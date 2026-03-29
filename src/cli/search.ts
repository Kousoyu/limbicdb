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
    console.log('Usage: limbic search <query> [--json]');
    process.exit(1);
  }
  
  const query = args.join(' ');
  const dbPath = './agent.limbic';
  
  try {
    const memory = open(dbPath);
    const result = await memory.recall(query);
    const results = result.memories;
    await memory.close();
    
    if (jsonOutput) {
      console.log(JSON.stringify({ query, results }));
    } else {
      console.log(`🔍 Search results for: "${query}"\n`);
      if (results.length === 0) {
        console.log('No memories found.');
      } else {
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.content}`);
          console.log(`   Score: ${result.strength?.toFixed(3) || 'N/A'}`);
          if (result.baseStrength !== undefined) {
            console.log(`   Base Strength: ${result.baseStrength.toFixed(2)}`);
          }
          console.log('');
        });
      }
    }
    
  } catch (error: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ query, results: [], error: error.message }));
    } else {
      console.error('Error searching:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);