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
  vehicle_model?: string | null
  published_at: string | null
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
  vehicle_model?: string | null
}

export interface ProjectsResponse {
  projects: Project[]
  pagination?: {
    next_cursor: string | null
    has_more: boolean
  }
}

export type SortOption = 'lastModified' | 'name' | 'created'

export interface ProjectFilters {
  search: string
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
  customDateFrom?: string
  customDateTo?: string
  fileCount: 'all' | '0' | '1-5' | '6-10' | '10+'
  privacy: 'all' | 'private' | 'public'
}

