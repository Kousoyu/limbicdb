/**
 * Memory Explain Module
 * Provides detailed explanation of memory retrieval decisions
 */

import type { Memory } from '../types';
import { open } from '../index';

export interface ExplainResult {
  query: string;
  selectedMemory?: Memory;
  candidates: Array<{
    memory: Memory;
    score: number;
    reasons: string[];
  }>;
  conflicts: boolean;
  decisionTrace: string[];
}

export class MemoryExplain {
  private dbPath: string;
  
  constructor(dbPath: string = './agent.limbic') {
    this.dbPath = dbPath;
  }
  
  async explain(query: string): Promise<ExplainResult> {
    const memory = open(this.dbPath);
    
    try {
      // Get all memories that match the query using recall
      const recallResult = await memory.recall(query, { limit: 100 });
      const relevantMemories = recallResult.memories;
      
      // Calculate scores and reasons
      const candidates = relevantMemories.map(mem => {
        const score = this.calculateScore(mem, query);
        const reasons = this.getReasons(mem, query);
        return { memory: mem, score, reasons };
      }).sort((a, b) => b.score - a.score);
      
      // Detect conflicts (simplified: look for opposing sentiment words)
      const hasPositive = candidates.some(c => 
        c.memory.content.toLowerCase().includes('like') || 
        c.memory.content.toLowerCase().includes('love') ||
        c.memory.content.toLowerCase().includes('prefer')
      );
      const hasNegative = candidates.some(c => 
        c.memory.content.toLowerCase().includes('hate') || 
        c.memory.content.toLowerCase().includes('dislike') ||
        c.memory.content.toLowerCase().includes('avoid')
      );
      const conflicts = hasPositive && hasNegative;
      
      // Build decision trace
      const decisionTrace = [
        `retrieved ${relevantMemories.length} relevant memories`,
        'applied keyword matching and scoring',
        conflicts ? 'detected conflicting sentiments' : 'no conflicts detected',
        `selected top candidate with score ${candidates[0]?.score?.toFixed(3) || 'N/A'}`
      ];
      
      return {
        query,
        selectedMemory: candidates.length > 0 ? candidates[0].memory : undefined,
        candidates,
        conflicts,
        decisionTrace
      };
    } finally {
      await memory.close();
    }
  }
  
  private calculateScore(memory: Memory, query: string): number {
    const content = memory.content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let matchCount = 0;
    
    // Exact match bonus
    if (content.includes(query.toLowerCase())) {
      matchCount += queryWords.length * 2;
    } else {
      // Word-by-word matching
      for (const word of queryWords) {
        if (content.includes(word)) {
          matchCount++;
        }
      }
    }
    
    // Simple scoring: match count / content length
    return Math.min(1.0, matchCount / Math.max(content.split(/\s+/).length, 1));
  }
  
  private getReasons(memory: Memory, query: string): string[] {
    const reasons: string[] = [];
    const content = memory.content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (content.includes(queryLower)) {
      reasons.push(`exact match: "${query}"`);
    } else {
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matchedWords = queryWords.filter(word => content.includes(word));
      if (matchedWords.length > 0) {
        reasons.push(`keyword matches: ${matchedWords.join(', ')}`);
      }
    }
    
    // Add strength information
    if (memory.strength !== undefined) {
      reasons.push(`strength: ${memory.strength.toFixed(2)}`);
    }
    
    // Add access information
    if (memory.accessCount > 0) {
      reasons.push(`accessed ${memory.accessCount} times`);
    }
    
    return reasons;
  }
}