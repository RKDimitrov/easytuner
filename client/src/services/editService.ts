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

export interface EditOperation {
  offset: number
  value: number
  data_type: 'u8' | 'u16le' | 'u16be' | 'u32le' | 'u32be'
  original_value?: number
}

export interface ChecksumConfig {
  algorithm: 'simple_sum' | 'crc16' | 'crc32' | 'xor' | 'twos_complement' | 'modular' | 'ones_complement' | 'modular_16bit' | 'ones_complement_16bit' | 'modular_16bit_be' | 'ones_complement_16bit_be'
  checksum_range: {
    start: number
    end: number
  }
  checksum_location: number
  checksum_size?: number
  endianness?: 'little' | 'big'
  exclude_ranges?: Array<{
    start: number
    end: number
  }>
  modulo?: number
}

export interface EditBatchRequest {
  edits: EditOperation[]
  create_new_version?: boolean
  checksum_config?: ChecksumConfig
}

export interface EditResponse {
  success: boolean
  file_id: string
  original_file_id?: string | null
  edits_applied: number
  file_size: number
}

export interface ReadValueResponse {
  offset: number
  value: number
  value_hex: string
  data_type: string
}

/**
 * Apply edits to a firmware file
 */
export async function applyEdits(
  fileId: string,
  edits: EditOperation[],
  createNewVersion: boolean = true,
  checksumConfig?: ChecksumConfig
): Promise<EditResponse> {
  try {
    const api = createAuthAxios()
    const requestBody: any = {
      edits,
      create_new_version: createNewVersion,
    }
    
    // Only include checksum_config if it's provided
    if (checksumConfig) {
      requestBody.checksum_config = checksumConfig
    }
    
    const response = await api.post<EditResponse>(
      `/files/${fileId}/edits`,
      requestBody
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to apply edits')
    }
    throw error
  }
}

/**
 * Read a value from a file at a specific offset
 */
export async function readValue(
  fileId: string,
  offset: number,
  dataType: string = 'u8'
): Promise<ReadValueResponse> {
  try {
    const api = createAuthAxios()
    const response = await api.get<ReadValueResponse>(
      `/files/${fileId}/read-value`,
      {
        params: {
          offset,
          data_type: dataType,
        },
      }
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Failed to read value')
    }
    throw error
  }
}

