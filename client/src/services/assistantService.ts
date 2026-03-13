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
  /** Exact Text Viewer table for the currently selected map (axis labels + data grid). Sent so the AI can give step-by-step instructions (e.g. "change the value at 4.5k RPM to X"). */
  selected_map_text_view?: string | null
  /** Text Viewer tables for all scanned maps (so the AI can say what each result relates to—e.g. torque limiter, fuel map, boost). Capped in size for token limits. */
  all_maps_text_views?: string | null
}

export interface AssistantChatResponsePayload {
  summary: string
  issues: string[]
  suggestions: string[]
  ask_vehicle?: string | null
}

export interface AssistantHistoryMessageDTO {
  message_id: string
  role: 'user' | 'assistant'
  user_text?: string | null
  summary?: string | null
  issues: string[]
  suggestions: string[]
  ask_vehicle?: string | null
  created_at: string
}

export async function assistantChat(
  body: AssistantChatRequestPayload
): Promise<AssistantChatResponsePayload> {
  const api = createAuthAxios()
  const { data } = await api.post<AssistantChatResponsePayload>('/assistant/chat', body)
  return data
}

export async function getAssistantHistory(fileId: string): Promise<AssistantHistoryMessageDTO[]> {
  const api = createAuthAxios()
  const { data } = await api.get<{ messages: AssistantHistoryMessageDTO[] }>(
    '/assistant/history',
    {
      params: { file_id: fileId },
    }
  )
  return data.messages
}

export async function clearAssistantHistory(fileId: string): Promise<void> {
  const api = createAuthAxios()
  await api.delete('/assistant/history', {
    params: { file_id: fileId },
  })
}
