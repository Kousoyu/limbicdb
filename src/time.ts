// @ts-nocheck
/**
 * Time String Parsing
 * 
 * Supports formats like:
 * - '2h ago'
 * - '3 days ago' 
 * - '1 week ago'
 * - '2024-01-01T00:00:00Z'
 * - Unix timestamp (ms)
 * 
 * @module
 */

const UNIT_MULTIPLIERS: Record<string, number> = {
  // English
  'second': 1000,
  'seconds': 1000,
  'sec': 1000,
  'secs': 1000,
  's': 1000,
  
  'minute': 60 * 1000,
  'minutes': 60 * 1000,
  'min': 60 * 1000,
  'mins': 60 * 1000,
  'm': 60 * 1000,
  
  'hour': 60 * 60 * 1000,
  'hours': 60 * 60 * 1000,
  'hr': 60 * 60 * 1000,
  'hrs': 60 * 60 * 1000,
  'h': 60 * 60 * 1000,
  
  'day': 24 * 60 * 60 * 1000,
  'days': 24 * 60 * 60 * 1000,
  'd': 24 * 60 * 60 * 1000,
  
  'week': 7 * 24 * 60 * 60 * 1000,
  'weeks': 7 * 24 * 60 * 60 * 1000,
  'w': 7 * 24 * 60 * 60 * 1000,
  
  'month': 30 * 24 * 60 * 60 * 1000, // Approximation
  'months': 30 * 24 * 60 * 60 * 1000,
  'mon': 30 * 24 * 60 * 1000,
  
  'year': 365 * 24 * 60 * 60 * 1000, // Approximation
  'years': 365 * 24 * 60 * 60 * 1000,
  'y': 365 * 24 * 60 * 60 * 1000,
  
  // Chinese
  '秒': 1000,
  '秒钟': 1000,
  '分': 60 * 1000,
  '分钟': 60 * 1000,
  '小时': 60 * 60 * 1000,
  '时': 60 * 60 * 1000,
  '天': 24 * 60 * 60 * 1000,
  '日': 24 * 60 * 60 * 1000,
  '周': 7 * 24 * 60 * 60 * 1000,
  '星期': 7 * 24 * 60 * 60 * 1000,
  '月': 30 * 24 * 60 * 60 * 1000,
  '年': 365 * 24 * 60 * 60 * 1000,
}

/**
 * Parse a time string or value to Unix timestamp (ms)
 * 
 * @param input - Time string, timestamp, or Date
 * @param reference - Reference time (default: now)
 * @returns Unix timestamp in milliseconds
 */
export function parseTime(
  input: string | number | Date,
  reference: number = Date.now(),
): number {
  if (typeof input === 'number') {
    // Assume milliseconds if > 1e12 (year 2001+), seconds if < 1e12
    return input > 1e12 ? input : input * 1000
  }
  
  if (input instanceof Date) {
    return input.getTime()
  }
  
  const str = input.trim().toLowerCase()
  
  // Try ISO format
  if (str.includes('t') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str)
    if (!isNaN(date.getTime())) {
      return date.getTime()
    }
  }
  
  // Try relative time: "2h ago", "3 days ago"
  const relativeMatch = str.match(/^(\d+(?:\.\d+)?)\s*([a-z\u4e00-\u9fff]+)(?:\s+ago)?$/i)
  if (relativeMatch) {
    const [, amountStr, unit] = relativeMatch
    const amount = parseFloat(amountStr)
    const multiplier = UNIT_MULTIPLIERS[unit as string]
    
    if (multiplier) {
      return reference - (amount * multiplier)
    }
  }
  
  // Try "ago" format: "2 hours ago"
  const agoMatch = str.match(/^(\d+(?:\.\d+)?)\s+([a-z\u4e00-\u9fff]+)\s+ago$/i)
  if (agoMatch) {
    const [, amountStr, unit] = agoMatch
    const amount = parseFloat(amountStr)
    const multiplier = UNIT_MULTIPLIERS[unit as string]
    
    if (multiplier) {
      return reference - (amount * multiplier)
    }
  }
  
  // Try "in" format: "in 2 hours" (future)
  const futureMatch = str.match(/^in\s+(\d+(?:\.\d+)?)\s+([a-z\u4e00-\u9fff]+)$/i)
  if (futureMatch) {
    const [, amountStr, unit] = futureMatch
    const amount = parseFloat(amountStr)
    const multiplier = UNIT_MULTIPLIERS[unit as string]
    
    if (multiplier) {
      return reference + (amount * multiplier)
    }
  }
  
  // Fallback: try parsing as Date
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date.getTime()
  }
  
  throw new Error(`Unable to parse time: ${input}`)
}

/**
 * Format timestamp as relative time string
 * 
 * @param timestamp - Unix timestamp (ms)
 * @param reference - Reference time (default: now)
 * @returns Relative time string like "2 hours ago"
 */
export function formatRelativeTime(
  timestamp: number,
  reference: number = Date.now(),
): string {
  const diff = reference - timestamp
  const absDiff = Math.abs(diff)
  
  if (absDiff < 1000) return 'just now'
  
  const units = [
    { label: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
    { label: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'day', ms: 24 * 60 * 60 * 1000 },
    { label: 'hour', ms: 60 * 60 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
    { label: 'second', ms: 1000 },
  ]
  
  for (const unit of units) {
    if (absDiff >= unit.ms) {
      const amount = Math.round(absDiff / unit.ms)
      const label = amount === 1 ? unit.label : unit.label + 's'
      return diff > 0 ? `${amount} ${label} ago` : `in ${amount} ${label}`
    }
  }
  
  return 'just now'
}