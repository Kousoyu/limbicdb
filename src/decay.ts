/**
 * Memory Decay Algorithm
 * 
 * Based on three cognitive science theories:
 * 
 * 1. Ebbinghaus forgetting curve (1885)
 *    R = e^(-t/S)
 *    R: retention, t: time, S: stability
 * 
 * 2. Pimsleur spaced repetition (1967)
 *    Each successful recall increases memory stability
 *    Optimal review intervals grow exponentially
 * 
 * 3. ACT-R base-level activation (Anderson & Lebiere, 1998)
 *    B_i = ln(Σ t_j^(-d))
 *    d: decay rate, t_j: time since jth practice
 * 
 * LimbicDB's simplified model:
 * strength = baseStrength × decay × repetitionBonus + recencyBoost
 * 
 * Where:
 *   decay = 0.5^(age / halfLife) [Ebbinghaus]
 *   repetitionBonus = 1 + log2(1 + accessCount) × 0.3 [Pimsleur/ACT-R]
 *   recencyBoost = 0.2 × 0.5^(recency / halfLife×2) [Recency effect]
 * 
 * @module
 */

import type { DecayConfig } from './types'

const HOUR_MS = 3_600_000

/**
 * Compute current memory strength
 * 
 * @param baseStrength - Initial strength (0-1), set at remember time
 * @param createdAt - Creation time (Unix ms)
 * @param accessedAt - Last access time (Unix ms)  
 * @param accessCount - Number of successful recalls
 * @param config - Decay configuration
 * @param now - Current time (injectable for testing)
 * @returns Current strength (0 ~ maxStrength)
 */
export function computeStrength(
  baseStrength: number,
  createdAt: number,
  accessedAt: number,
  accessCount: number,
  config: DecayConfig,
  now: number = Date.now(),
): number {
  // If decay disabled, return base strength
  if (!config.enabled) return Math.min(baseStrength, config.maxStrength)

  const halfLifeMs = config.halfLifeHours * HOUR_MS

  // --- 1. Base decay (Ebbinghaus) ---
  const age = Math.max(0, now - createdAt)
  const decay = Math.pow(0.5, age / halfLifeMs)

  // --- 2. Spaced repetition effect (Pimsleur/ACT-R simplified) ---
  // Each successful recall strengthens memory
  // log2 gives diminishing returns (100th recall less effective than 1st)
  const repetitionFactor = 1 + Math.log2(1 + accessCount) * 0.3

  // --- 3. Recency effect ---
  // Recently accessed memories get a temporary boost
  // Uses longer half-life (halfLife×2) for more persistent effect
  const recency = Math.max(0, now - accessedAt)
  const recencyBoost = 0.2 * Math.pow(0.5, recency / (halfLifeMs * 2))

  // --- Combined ---
  const raw = baseStrength * decay * repetitionFactor + recencyBoost

  // Clamp to [0, maxStrength]
  return Math.min(Math.max(raw, 0), config.maxStrength)
}

/**
 * Predict when memory will decay below prune threshold
 * 
 * Useful for debugging and visualization
 * 
 * @returns Predicted expiry time (Unix ms), Infinity if memory won't decay
 */
export function predictExpiry(
  baseStrength: number,
  createdAt: number,
  accessedAt: number,
  accessCount: number,
  config: DecayConfig,
): number {
  if (!config.enabled) return Infinity

  // Binary search for when strength drops below pruneThreshold
  let lo = Date.now()
  let hi = lo + config.halfLifeHours * HOUR_MS * 20 // Predict up to 20 half-lives

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    const s = computeStrength(baseStrength, createdAt, accessedAt, accessCount, config, mid)
    if (s <= config.pruneThreshold) {
      hi = mid
    } else {
      lo = mid
    }
  }

  return Math.round(hi)
}

/**
 * Compute optimal review time
 * 
 * Based on SM-2 algorithm simplification: best to review when strength ~0.4
 * 
 * @returns Suggested next review time (Unix ms)
 */
export function suggestReviewTime(
  baseStrength: number,
  createdAt: number,
  accessedAt: number,
  accessCount: number,
  config: DecayConfig,
): number {
  if (!config.enabled) return Infinity

  const targetStrength = 0.4 // "About to forget" is best time to review
  let lo = Date.now()
  let hi = lo + config.halfLifeHours * HOUR_MS * 10

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    const s = computeStrength(baseStrength, createdAt, accessedAt, accessCount, config, mid)
    if (s <= targetStrength) {
      hi = mid
    } else {
      lo = mid
    }
  }

  return Math.round(hi)
}

/**
 * Determine if memory should be pruned
 */
export function shouldPrune(
  baseStrength: number,
  createdAt: number,
  accessedAt: number,
  accessCount: number,
  config: DecayConfig,
  now: number = Date.now(),
): boolean {
  if (!config.enabled) return false
  
  const strength = computeStrength(baseStrength, createdAt, accessedAt, accessCount, config, now)
  return strength <= config.pruneThreshold
}