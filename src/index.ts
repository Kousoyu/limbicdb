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

// Import types for internal use
import type {
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
}

// Memory implementation (for ':memory:' paths)
import { open as openMemory } from './core'
// SQLite implementation (for file paths)
import { openSQLite } from './sqlite'

/**
 * Open a LimbicDB database.
 * 
 * Automatically chooses the appropriate storage backend:
 * - `:memory:` → In-memory implementation (fast, volatile)
 * - File path → SQLite implementation (persistent, production-ready)
 * 
 * @param pathOrConfig - Database path or configuration object
 * @returns A LimbicDB instance
 */
export function open(pathOrConfig: string | LimbicDBConfig): LimbicDB {
  // Determine if we should use memory mode
  const path = typeof pathOrConfig === 'string' ? pathOrConfig : pathOrConfig.path
  
  // Use memory mode for ':memory:' path
  if (path === ':memory:') {
    return openMemory(pathOrConfig)
  }
  
  // Otherwise use SQLite
  return openSQLite(pathOrConfig)
}

// Also export specialized open functions for explicit control
export { open as openMemory } from './core'
export { openSQLite } from './sqlite'

// Version
export const VERSION = '0.2.0'