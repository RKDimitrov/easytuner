/**
 * Global TypeScript type definitions
 * 
 * Note: Most types are now defined in the Zustand store (analysisStore.ts)
 * This file can be used for additional shared types.
 */

// Re-export types from store for convenience
export type { MapCandidate, Bookmark, Annotation } from '../store/analysisStore'

// Additional types can be added here as needed
export interface User {
  id: string
  email: string
  name?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}
