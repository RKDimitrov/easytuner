/**
 * File Service
 * 
 * API service for file upload and download operations.
 */

import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'

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
  })
  
  // Add auth header if token exists
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
  
  return instance
}

export interface FileUploadResponse {
  file_id: string
  filename: string
  size_bytes: number
  sha256: string
  uploaded_at: string
  duplicate: boolean
}

export interface FileMetadata {
  file_id: string
  filename: string
  size_bytes: number
  sha256: string
  project_id: string
  uploaded_at: string
  created_at: string
  updated_at: string
}

/**
 * Upload a file to a project
 * POST /api/v1/files/upload
 */
export async function uploadFile(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<FileUploadResponse> {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    
    // Validate project_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectId)) {
      console.error('Invalid project ID format:', projectId)
      throw new Error(`Invalid project ID format. Please select a valid project.`)
    }
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectId)
    
    console.log('Uploading file:', {
      filename: file.name,
      size: file.size,
      projectId: projectId,
      hasToken: !!token
    })
    
    const response = await axios.post<FileUploadResponse>(
      `${API_BASE_URL}${API_PREFIX}/files/upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let axios set it automatically for FormData
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(progress)
          }
        },
      }
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const response = error.response
      let errorDetail = 'Failed to upload file'
      
      if (response?.data) {
        // Handle FastAPI validation errors (422)
        if (response.status === 422 && Array.isArray(response.data.detail)) {
          // Extract validation error messages
          const validationErrors = response.data.detail
            .map((err: any) => {
              const field = err.loc?.join('.') || 'field'
              const msg = err.msg || 'Invalid value'
              return `${field}: ${msg}`
            })
            .join(', ')
          errorDetail = `Validation error: ${validationErrors}`
        } else if (response.data.detail) {
          // Single error message
          errorDetail = typeof response.data.detail === 'string' 
            ? response.data.detail 
            : JSON.stringify(response.data.detail)
        } else if (response.data.message) {
          errorDetail = response.data.message
        }
      }
      
      throw new Error(errorDetail)
    }
    throw error
  }
}

/**
 * Download a file by ID
 * GET /api/v1/files/{file_id}
 */
export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  try {
    const api = createAuthAxios()
    const response = await api.get(`/files/${fileId}`, {
      responseType: 'arraybuffer',
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to download file')
    }
    throw error
  }
}

/**
 * Get file metadata
 * GET /api/v1/files/{file_id}/metadata
 */
export async function getFileMetadata(fileId: string): Promise<FileMetadata> {
  try {
    const api = createAuthAxios()
    const response = await api.get<FileMetadata>(`/files/${fileId}/metadata`)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to get file metadata')
    }
    throw error
  }
}

export interface ProjectFile {
  file_id: string
  filename: string
  size_bytes: number
  sha256: string
  uploaded_at: string
  created_at: string
  updated_at: string
  has_scan: boolean
  latest_scan_id: string | null
  latest_scan_at: string | null
  scan_count: number
}

export interface ProjectFilesResponse {
  files: ProjectFile[]
  count: number
}

/**
 * Get files for a project
 * GET /api/v1/projects/{project_id}/files
 */
export async function getProjectFiles(projectId: string): Promise<ProjectFilesResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.get<ProjectFilesResponse>(`/projects/${projectId}/files`)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to get project files')
    }
    throw error
  }
}

/**
 * Delete a file
 * DELETE /api/v1/files/{file_id}
 */
export async function deleteFile(fileId: string): Promise<void> {
  try {
    const api = createAuthAxios()
    await api.delete(`/files/${fileId}`)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to delete file')
    }
    throw error
  }
}

