/**
 * LimbicDB — A local-first memory engine for embedded agents
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
 * await memory.close()
 * ```
 * 
 * @example In-memory mode (development/testing)
 * ```typescript
 * const memory = open(':memory:')
 * ```
 * 
 * @example Advanced configuration
 * ```typescript
 * const memory = open({
 *   path: './agent.limbic',
 *   // embedder: new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY }), // Future enhancement
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
 * - `:memory:` → In-memory implementation (fast, volatile, for development/testing)
 * - File path → SQLite implementation (persistent, durable storage)
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
export const VERSION = '0.3.0-alpha.2'