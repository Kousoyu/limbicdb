/**
 * ID Generation Utilities
 */

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Generate a short ID (8 chars)
 * Good for snapshot IDs, etc.
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10)
}