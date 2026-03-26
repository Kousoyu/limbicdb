/**
 * LimbicDB — Embedded cognitive memory database for AI agents
 * 
 * @example Basic usage
 * ```typescript
 * import { open } from 'limbicdb'
 * 
 * const memory = open('./agent.limbic')
 * 
 * await memory.remember('User prefers React with TypeScript')
 * const results = await memory.recall('tech stack')
 * 
 * await memory.set('currentTask', { name: 'Build login page' })
 * const task = await memory.get('currentTask')
 * 
 * await memory.close()
 * ```
 * 
 * @example In-memory mode
 * ```typescript
 * const memory = open(':memory:')
 * ```
 * 
 * @example With custom embedder
 * ```typescript
 * import { open } from 'limbicdb'
 * import { OpenAIEmbedder } from 'limbicdb-embedder-openai'
 * 
 * const memory = open({
 *   path: './agent.limbic',
 *   embedder: new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY }),
 * })
 * ```
 * 
 * @packageDocumentation
 */

// Re-export all public types
export type {
  LimbicDB,
  LimbicDBConfig,
  Memory,
  MemoryKind,
  TimelineEvent,
  RecallOptions,
  RememberOptions,
  HistoryOptions,
  ForgetFilter,
  DecayConfig,
  Embedder,
  LimbicDBStats,
} from './types'

// Factory function — the main entry point
export { open } from './core'

// Version
export const VERSION = '0.1.0'