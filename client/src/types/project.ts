/**
 * Project-related type definitions
 * Matches backend API schema
 */

export interface Project {
  project_id: string
  owner_user_id: string
  name: string
  description: string | null
  is_private: boolean
  created_at: string
  updated_at: string
  file_count?: number
}

export interface CreateProjectData {
  name: string
  description?: string
  is_private?: boolean
}

export interface UpdateProjectData {
  name?: string
  description?: string
  is_private?: boolean
}

export interface ProjectsResponse {
  projects: Project[]
  pagination?: {
    next_cursor: string | null
    has_more: boolean
  }
}

export type SortOption = 'lastModified' | 'name' | 'created'

