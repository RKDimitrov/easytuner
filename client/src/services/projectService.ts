/**
 * Project Service
 * 
 * API service for project CRUD operations.
 * Integrates with backend /api/v1/projects endpoints.
 */

import axios from 'axios'
import { 
  Project, 
  CreateProjectData, 
  UpdateProjectData,
  ProjectsResponse 
} from '../types/project'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'

import { useAuthStore } from '../store/authStore'

/**
 * Get authentication token from auth store
 */
function getAuthToken(): string | null {
  const { accessToken } = useAuthStore.getState()
  return accessToken
}

/**
 * Create axios instance with auth headers
 */
function createAuthAxios() {
  const token = getAuthToken()
  const instance = axios.create({
    baseURL: `${API_BASE_URL}${API_PREFIX}`,
    headers: {
      'Content-Type': 'application/json',
    }
  })
  
  // Add auth header if token exists
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  
  return instance
}

/**
 * List all projects for the authenticated user
 * GET /api/v1/projects
 */
export async function getProjects(
  limit?: number,
  cursor?: string
): Promise<ProjectsResponse> {
  try {
    const api = createAuthAxios()
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit.toString())
    if (cursor) params.append('cursor', cursor)
    
    const response = await api.get<ProjectsResponse>(
      `/projects${params.toString() ? `?${params.toString()}` : ''}`
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Failed to fetch projects')
    }
    throw error
  }
}

/**
 * Get a single project by ID
 * GET /api/v1/projects/{project_id}
 */
export async function getProject(projectId: string): Promise<Project> {
  try {
    const api = createAuthAxios()
    const response = await api.get<Project>(`/projects/${projectId}`)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Failed to fetch project')
    }
    throw error
  }
}

/**
 * Create a new project
 * POST /api/v1/projects
 */
export async function createProject(data: CreateProjectData): Promise<Project> {
  try {
    const api = createAuthAxios()
    const response = await api.post<Project>('/projects', data)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorDetail = error.response?.data?.detail || error.response?.data?.message || 'Failed to create project'
      throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail))
    }
    throw error
  }
}

/**
 * Update an existing project
 * PATCH /api/v1/projects/{project_id}
 */
export async function updateProject(
  projectId: string, 
  updates: UpdateProjectData
): Promise<Project> {
  try {
    const api = createAuthAxios()
    const response = await api.patch<Project>(`/projects/${projectId}`, updates)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorDetail = error.response?.data?.detail || error.response?.data?.message || 'Failed to update project'
      throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail))
    }
    throw error
  }
}

/**
 * Delete a project (soft delete)
 * DELETE /api/v1/projects/{project_id}
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    const api = createAuthAxios()
    await api.delete(`/projects/${projectId}`)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Failed to delete project')
    }
    throw error
  }
}

