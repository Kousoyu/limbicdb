/**
 * Memory Explain Module
 * Provides detailed explanation of memory retrieval decisions
 */

import type { Memory } from '../types';
import { SQLiteStore } from '../sqlite-store';

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
  private store: SQLiteStore;
  
  constructor(store: SQLiteStore) {
    this.store = store;
  }
  
  async explain(query: string): Promise<ExplainResult> {
    // Get all memories that match the query
    const allMemories = await this.store.getAllMemories();
    const relevantMemories = allMemories.filter(mem => 
      mem.content.toLowerCase().includes(query.toLowerCase())
    );
    
    // Calculate scores and reasons
    const candidates = relevantMemories.map(mem => {
      const score = this.calculateScore(mem, query);
      const reasons = this.getReasons(mem, query);
      return { memory: mem, score, reasons };
    }).sort((a, b) => b.score - a.score);
    
    // Detect conflicts (simplified: look for opposing sentiment words)
    const hasPositive = candidates.some(c => 
      c.memory.content.toLowerCase().includes('like') || 
      c.memory.content.toLowerCase().includes('prefer')
    );
    const hasNegative = candidates.some(c => 
      c.memory.content.toLowerCase().includes('hate') || 
      c.memory.content.toLowerCase().includes('dislike')
    );
    const conflicts = hasPositive && hasNegative;
    
    // Build decision trace
    const decisionTrace = [
      `retrieved ${allMemories.length} total memories`,
      `filtered to ${relevantMemories.length} relevant memories`,
      'applied keyword matching',
      conflicts ? 'detected conflicting sentiments' : 'no conflicts detected'
    ];
    
    return {
      query,
      selectedMemory: candidates.length > 0 ? candidates[0].memory : undefined,
      candidates,
      conflicts,
      decisionTrace
    };
  }
  
  private calculateScore(memory: Memory, query: string): number {
    const content = memory.content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);
    let matchCount = 0;
    
    for (const word of queryWords) {
      if (content.includes(word)) {
        matchCount++;
      }
    }
    
    // Simple scoring: match count / content length
    return matchCount / Math.max(content.length, 1);
  }
  
  private getReasons(memory: Memory, query: string): string[] {
    const reasons: string[] = [];
    const content = memory.content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (content.includes(queryLower)) {
      reasons.push(`exact match: "${query}"`);
    } else {
      const queryWords = query.toLowerCase().split(/\s+/);
      const matchedWords = queryWords.filter(word => content.includes(word));
      if (matchedWords.length > 0) {
        reasons.push(`keyword matches: ${matchedWords.join(', ')}`);
      }
    }
    
    // Add strength information
    if (memory.strength !== undefined) {
      reasons.push(`strength: ${memory.strength.toFixed(2)}`);
    }
    
    return reasons;
  }
}