#!/usr/bin/env node

import { MemoryExplain } from '../explain';

async function main() {
  // Parse arguments properly
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
    console.log('Usage: limbic explain <query> [--json]');
    process.exit(1);
  }
  
  const query = args.join(' ');
  const dbPath = './agent.limbic'; // Default path
  
  try {
    const explainer = new MemoryExplain(dbPath);
    const explanation = await explainer.explain(query);
    
    if (!jsonOutput) {
      console.log(`🔍 Explanation for: "${query}"\n`);
      
      if (explanation.candidates.length === 0) {
        console.log('No relevant memories found.');
      } else {
        console.log('Found matching memories:\n');
        
        explanation.candidates.forEach((candidate, index) => {
          console.log(`${index + 1}. "${candidate.memory.content}"`);
          console.log(`   Score: ${candidate.score.toFixed(3)}`);
          console.log(`   Reasons: ${candidate.reasons.join(', ')}`);
          
          const date = new Date(candidate.memory.createdAt || Date.now());
          console.log(`   Created: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`);
          console.log('');
        });
        
        if (explanation.conflicts) {
          console.log('⚠️  Conflict detected between memories\n');
        }
      }
      
      console.log('Decision trace:');
      explanation.decisionTrace.forEach(step => {
        console.log(`  • ${step}`);
      });
    }
    
    // Always output JSON if requested
    if (jsonOutput) {
      console.log(JSON.stringify(explanation, null, 2));
    }
    
  } catch (error: any) {
    console.error('Error explaining memory:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);