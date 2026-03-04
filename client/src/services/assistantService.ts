/**
 * Map Assistant chat API.
 * POST /api/v1/assistant/chat
 */

import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'

function getAuthToken(): string | null {
  return useAuthStore.getState().accessToken
}

function createAuthAxios() {
  const token = getAuthToken()
  const instance = axios.create({
    baseURL: `${API_BASE_URL}${API_PREFIX}`,
    headers: { 'Content-Type': 'application/json' },
  })
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
  return instance
}

export interface ProjectContextPayload {
  summary: string
  vehicle_model?: string | null
  intent?: 'analyze_only' | 'tune' | 'compare' | 'document' | null
}

export interface ScannedFileEntryPayload {
  file_id: string
  filename: string
  size_bytes: number
  project_name: string
  scan_id?: string | null
  candidates_count: number
  summary?: string | null
}

export interface MapEntryPayload {
  map_id: string
  file_id: string
  scan_id: string
  type: '1D' | '2D' | '3D' | 'single'
  offset: number
  offset_hex: string
  size_bytes: number
  data_type: string
  confidence: number
  dimensions: Record<string, number>
  name?: string | null
  description?: string | null
  unit?: string | null
  axis_summary?: string | null
  data_sample?: number[] | null
  annotations_count?: number
}

export interface AssistantChatRequestPayload {
  project_context: ProjectContextPayload
  scanned_files: ScannedFileEntryPayload[]
  maps: MapEntryPayload[]
  user_message: string
}

export interface AssistantChatResponsePayload {
  summary: string
  issues: string[]
  suggestions: string[]
  ask_vehicle?: string | null
}

export async function assistantChat(
  body: AssistantChatRequestPayload
): Promise<AssistantChatResponsePayload> {
  const api = createAuthAxios()
  const { data } = await api.post<AssistantChatResponsePayload>('/assistant/chat', body)
  return data
}
