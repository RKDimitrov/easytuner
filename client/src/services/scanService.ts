/**
 * Scan Service
 * 
 * API service for scan operations.
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

export interface ScanCreateRequest {
  file_id: string
  data_types?: string[]
  endianness_hint?: string | null
  window_size?: number
  stride?: number
  min_confidence?: number
}

export interface ScanResponse {
  scan_id: string
  file_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  config: Record<string, any>
  candidates_found: number | null
  processing_time_ms: number | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CandidateResponse {
  candidate_id: string
  scan_id: string
  offset: number
  size: number
  data_type: string
  confidence: number
  pattern_type: string
  features: Record<string, any>
  created_at: string
}

export interface ScanResultsResponse {
  scan: ScanResponse
  candidates: CandidateResponse[]
  total_candidates: number
  page: number
  page_size: number
}

/**
 * Create and start a scan
 * POST /api/v1/scans
 */
export async function createScan(request: ScanCreateRequest): Promise<ScanResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.post<ScanResponse>('/scans', request)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to create scan')
    }
    throw error
  }
}

/**
 * Get scan job status
 * GET /api/v1/scans/{scan_id}
 */
export async function getScan(scanId: string): Promise<ScanResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.get<ScanResponse>(`/scans/${scanId}`)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to get scan')
    }
    throw error
  }
}

/**
 * Get scan results (scan + candidates)
 * GET /api/v1/scans/{scan_id}/results
 */
export async function getScanResults(scanId: string, limit = 100, offset = 0): Promise<ScanResultsResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.get<ScanResultsResponse>(`/scans/${scanId}/results`, {
      params: { limit, offset }
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to get scan results')
    }
    throw error
  }
}

/**
 * Get scan candidates
 * GET /api/v1/scans/{scan_id}/candidates
 */
export async function getScanCandidates(scanId: string, limit = 100, offset = 0): Promise<CandidateResponse[]> {
  try {
    const api = createAuthAxios()
    const response = await api.get<CandidateResponse[]>(`/scans/${scanId}/candidates`, {
      params: { limit, offset }
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to get scan candidates')
    }
    throw error
  }
}

