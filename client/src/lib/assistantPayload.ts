/**
 * Build Map Assistant chat request payload from current project, file, and candidates.
 * Caps maps count for token limits.
 */

import type { MapCandidate } from '../store/analysisStore'
import type { Project } from '../types/project'
import type {
  AssistantChatRequestPayload,
  MapEntryPayload,
  ProjectContextPayload,
  ScannedFileEntryPayload,
} from '../services/assistantService'
import { formatHexOffset } from './utils'

const MAX_MAPS_IN_PAYLOAD = 50

export interface BuildPayloadInput {
  /** Current project (for summary, vehicle_model) */
  project: Project | null
  /** Current file */
  fileId: string | null
  fileName: string
  fileSize: number
  /** Latest scan id for this file (optional) */
  scanId: string | null
  /** Map candidates (e.g. from analysis store); will be capped */
  candidates: MapCandidate[]
  userMessage: string
}

/**
 * Convert a MapCandidate to the API MapEntry shape.
 */
function mapCandidateToEntry(
  c: MapCandidate,
  fileId: string,
  scanId: string
): MapEntryPayload {
  const dims = c.dimensions || {}
  const dimensions: Record<string, number> = {}
  if (dims.x !== undefined) dimensions.x = dims.x
  if (dims.y !== undefined) dimensions.y = dims.y
  if (dims.z !== undefined) dimensions.z = dims.z
  if (Object.keys(dimensions).length === 0) dimensions.x = 1

  return {
    map_id: c.id,
    file_id: fileId,
    scan_id: scanId,
    type: c.type,
    offset: c.offset,
    offset_hex: formatHexOffset(c.offset),
    size_bytes: c.size,
    data_type: c.dataType || 'u16le',
    confidence: typeof c.confidence === 'number' ? c.confidence / 100 : 0,
    dimensions,
    name: c.name ?? null,
    description: c.description ?? null,
    unit: c.unit ?? null,
    axis_summary: undefined,
    data_sample: undefined,
    annotations_count: 0,
  }
}

/**
 * Build the full assistant chat request payload.
 */
export function buildAssistantPayload(input: BuildPayloadInput): AssistantChatRequestPayload {
  const {
    project,
    fileId,
    fileName,
    fileSize,
    scanId,
    candidates,
    userMessage,
  } = input

  const projectContext: ProjectContextPayload = {
    summary: project
      ? `${project.name}: ${fileName || 'firmware analysis'}`
      : fileName
        ? `Firmware analysis: ${fileName}`
        : 'Firmware analysis',
    vehicle_model: project?.vehicle_model ?? null,
    intent: null,
  }

  const scannedFiles: ScannedFileEntryPayload[] = []
  if (fileId && fileName) {
    scannedFiles.push({
      file_id: fileId,
      filename: fileName,
      size_bytes: fileSize,
      project_name: project?.name ?? 'Unknown',
      scan_id: scanId ?? null,
      candidates_count: candidates.length,
      summary: null,
    })
  }

  const capped = candidates.slice(0, MAX_MAPS_IN_PAYLOAD)
  const maps: MapEntryPayload[] = capped.map((c) =>
    mapCandidateToEntry(c, fileId ?? '', scanId ?? '')
  )

  return {
    project_context: projectContext,
    scanned_files: scannedFiles,
    maps,
    user_message: userMessage,
  }
}
