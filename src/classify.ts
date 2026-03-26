/**
 * Memory Kind Classification
 * 
 * Automatically classify memories into cognitive primitives:
 * - Fact: Definite knowledge ("The sky is blue")
 * - Episode: Event/experience ("Yesterday we had a meeting")
 * - Preference: User preference ("I like dark mode")  
 * - Procedure: How-to instructions ("First install npm, then run build")
 * - Goal: Current objective ("Need to finish by Friday")
 * 
 * Based on Tulving's memory classification (1972) and ACT-R.
 * 
 * @module
 */

import type { MemoryKind } from './types'

// Keywords for each memory kind (English + Chinese)
const KEYWORDS: Record<MemoryKind, { en: RegExp[], zh: RegExp[] }> = {
  fact: {
    en: [
      /\b(is|are|was|were|has|have|had)\b/i,
      /\b(the|a|an)\s+\w+\s+(is|are|was|were)/i,
      /\b(runs?|uses?|requires?|needs?)\b/i,
      /\b(\d+)\b/, // Numbers often indicate facts
    ],
    zh: [
      /是|为|有|需要|要求/i,
      /运行在|使用|需要/i,
      /\d+/, // Numbers
    ],
  },
  episode: {
    en: [
      /\b(yesterday|today|tomorrow|last\s+\w+|this\s+\w+)\b/i,
      /\b(meeting|discussed|talked|conversation)\b/i,
      /\b(happened|occurred|took place)\b/i,
      /^we\s+/i,
    ],
    zh: [
      /昨天|今天|明天|上周|本月|今年/i,
      /会议|讨论|聊天|对话/i,
      /发生了|进行了/i,
      /我们|一起/i,
    ],
  },
  preference: {
    en: [
      /\b(like|love|prefer|favorite|enjoy)\b/i,
      /\b(dislike|hate|avoid)\b/i,
      /\b(better|worse|best|worst)\b/i,
      /\b(would\s+like|would\s+prefer)\b/i,
      /^i\s+(like|love|prefer)/i,
    ],
    zh: [
      /喜欢|爱|偏好|最爱|享受/i,
      /不喜欢|讨厌|避免/i,
      /更好|更差|最好|最差/i,
      /我(喜欢|爱|偏好)/i,
    ],
  },
  procedure: {
    en: [
      /\b(first|then|next|finally|step\s+\d+)\b/i,
      /\b(how\s+to|instructions?|steps?)\b/i,
      /\b(run|install|build|deploy|execute)\b/i,
      /\b(command|code|script)\b/i,
    ],
    zh: [
      /首先|然后|接着|最后|步骤\d*/i,
      /如何|步骤|操作/i,
      /运行|安装|构建|部署|执行/i,
      /命令|代码|脚本/i,
    ],
  },
  goal: {
    en: [
      /\b(need to|must|should|have to)\b/i,
      /\b(goal|objective|target|aim)\b/i,
      /\b(finish|complete|achieve|accomplish)\b/i,
      /\b(by|before|until)\s+\w+/i,
      /^need\s+/i,
    ],
    zh: [
      /需要|必须|应该|不得不/i,
      /目标|目的|任务/i,
      /完成|实现|达成/i,
      /在.*之前|到.*为止/i,
    ],
  },
}

/**
 * Auto-classify a memory based on content
 * 
 * Uses simple keyword matching for MVP.
 * Future: Could use a small classifier model.
 * 
 * @param content - Memory content
 * @returns Predicted memory kind
 */
export function classifyMemory(content: string): MemoryKind {
  // Clean and normalize
  const text = content.trim().toLowerCase()
  
  // Score each kind
  const scores: Record<MemoryKind, number> = {
    fact: 0,
    episode: 0,
    preference: 0,
    procedure: 0,
    goal: 0,
  }
  
  // Check English keywords
  for (const [kind, { en, zh }] of Object.entries(KEYWORDS)) {
    for (const regex of en) {
      if (regex.test(text)) {
        scores[kind as MemoryKind] += 1
      }
    }
    // Also check Chinese keywords
    for (const regex of zh) {
      if (regex.test(text)) {
        scores[kind as MemoryKind] += 1
      }
    }
  }
  
  // Find highest score
  let maxScore = -1
  let bestKind: MemoryKind = 'fact' // Default fallback
  
  for (const [kind, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      bestKind = kind as MemoryKind
    }
  }
  
  // If no strong signal, use heuristics
  if (maxScore === 0) {
    // Check for question marks (often goals)
    if (text.includes('?')) return 'goal'
    
    // Check for imperative verbs (often procedures)
    if (text.match(/^(run|install|build|deploy|create|make)/)) return 'procedure'
    
    // Default to fact (most common)
    return 'fact'
  }
  
  return bestKind
}

/**
 * Extract tags from memory content
 * 
 * Simple implementation: extract hashtags and key terms
 */
export function extractTags(content: string): string[] {
  const tags = new Set<string>()
  
  // Extract hashtags
  const hashtagMatches = content.match(/#(\w+)/g)
  if (hashtagMatches) {
    hashtagMatches.forEach(tag => tags.add(tag.slice(1).toLowerCase()))
  }
  
  // Extract potential key terms (simple heuristic)
  const words = content.toLowerCase().split(/\s+/)
  const keyTerms = words.filter(word => 
    word.length > 3 && 
    !STOP_WORDS.has(word) &&
    !word.match(/^\d+$/)
  )
  
  // Add top 3 key terms as tags
  keyTerms.slice(0, 3).forEach(term => tags.add(term))
  
  return Array.from(tags)
}

// Common stop words to avoid tagging
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'can', 'may', 'might', 'must', 'from', 'as', 'so', 'that',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一个',
])