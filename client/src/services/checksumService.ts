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

export interface ChecksumRange {
  start: number
  end: number
}

export interface ExcludeRange {
  start: number
  end: number
}

export interface ChecksumConfig {
  algorithm: 'simple_sum' | 'crc16' | 'crc32' | 'xor' | 'twos_complement' | 'modular'
  checksum_range: ChecksumRange
  checksum_location: number
  checksum_size?: number
  endianness?: 'little' | 'big'
  exclude_ranges?: ExcludeRange[]
  modulo?: number
}

export interface ChecksumValidationResponse {
  is_valid: boolean
  stored_checksum: number
  calculated_checksum: number
  stored_checksum_hex: string
  calculated_checksum_hex: string
  checksum_location: number
}

export interface ChecksumUpdateResponse {
  success: boolean
  checksum_value: number
  checksum_value_hex: string
  checksum_location: number
  message: string
}

export async function validateChecksum(
  fileId: string,
  config: ChecksumConfig
): Promise<ChecksumValidationResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.post<ChecksumValidationResponse>(
      `/files/${fileId}/checksum/validate`,
      config
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to validate checksum')
    }
    throw error
  }
}

export async function updateChecksum(
  fileId: string,
  config: ChecksumConfig
): Promise<ChecksumUpdateResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.post<ChecksumUpdateResponse>(
      `/files/${fileId}/checksum/update`,
      config
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to update checksum')
    }
    throw error
  }
}

