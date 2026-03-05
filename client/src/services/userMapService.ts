import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import type { MapCandidate } from '../store/analysisStore'

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

export interface UserMapResponse {
  id: string
  file_id: string
  project_id: string
  type: MapCandidate['type']
  offset: number
  size: number
  dataType: string
  dimensions: Record<string, number>
  name?: string | null
  description?: string | null
  unit?: string | null
  config: Record<string, unknown>
}

function responseToCandidate(res: UserMapResponse): MapCandidate {
  const dims = res.dimensions || {}
  const config = res.config || {}
  return {
    id: res.id,
    type: res.type,
    offset: res.offset,
    confidence: 100,
    size: res.size,
    dimensions: {
      x: dims.x ?? (config.dimensions as any)?.x ?? 1,
      y: dims.y ?? (config.dimensions as any)?.y,
      z: dims.z ?? (config.dimensions as any)?.z,
    },
    dataType: res.dataType || (config.dataType as string | undefined),
    name: res.name ?? (config.name as string | undefined),
    description: res.description ?? (config.description as string | undefined),
    unit: res.unit ?? (config.unit as string | undefined),
    mapId: config.mapId as string | undefined,
    skipBytesPerLine: (config.skipBytesPerLine as number | undefined) ?? 0,
    skipBytes: (config.skipBytes as number | undefined) ?? 0,
    numberFormat: (config.numberFormat as any) ?? 'decimal',
    sign: config.sign as boolean | undefined,
    difference: config.difference as boolean | undefined,
    originalValues: config.originalValues as boolean | undefined,
    percent: config.percent as boolean | undefined,
    factor: (config.factor as number | undefined) ?? 1,
    offsetValue: (config.offsetValue as number | undefined) ?? 0,
    reciprocal: config.reciprocal as boolean | undefined,
    precision: (config.precision as number | undefined) ?? 0,
    valueRangeMin: config.valueRangeMin as number | undefined,
    valueRangeMax: config.valueRangeMax as number | undefined,
    mirrorMap: config.mirrorMap as boolean | undefined,
    xAxis: (config.xAxis as any) ?? undefined,
    yAxis: (config.yAxis as any) ?? undefined,
    comment: config.comment as string | undefined,
    dataOverrides: (config.dataOverrides as Record<string, number> | undefined) ?? undefined,
  }
}

export async function fetchUserMapsForFile(fileId: string): Promise<MapCandidate[]> {
  const api = createAuthAxios()
  const { data } = await api.get<UserMapResponse[]>(`/files/${fileId}/user-maps`)
  return data.map(responseToCandidate)
}

export async function saveUserMapForFile(
  fileId: string,
  map: MapCandidate
): Promise<MapCandidate> {
  const api = createAuthAxios()
  const payload = {
    map: {
      id: map.id,
      type: map.type,
      offset: map.offset,
      size: map.size,
      dataType: map.dataType ?? 'u16le',
      dimensions: map.dimensions ?? {},
      name: map.name ?? null,
      description: map.description ?? null,
      unit: map.unit ?? null,
      config: { ...map },
    },
  }
  const { data } = await api.post<UserMapResponse>(`/files/${fileId}/user-maps`, payload)
  return responseToCandidate(data)
}

