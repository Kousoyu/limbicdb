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
    console.log('Usage: limbic remember <content> [--json]');
    process.exit(1);
  }
  
  const content = args.join(' ');
  const dbPath = './agent.limbic';
  
  try {
    const memory = open(dbPath);
    await memory.remember(content);
    await memory.close();
    
    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, content }));
    } else {
      console.log(`✅ Remembered: "${content}"`);
    }
    
  } catch (error: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: error.message }));
    } else {
      console.error('Error remembering:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);