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
  /** Text Viewer table for the currently selected map (so the AI can reference exact values and give step-by-step edit instructions). */
  selectedMapTextView?: string | null
  /** Text Viewer tables for multiple scanned maps (so the AI can identify what each map relates to). Built from getMapTableAsText for each candidate; capped by caller. */
  allMapsTextViews?: string | null
  /** When set, sent so the AI can suggest MAP_FIX (correct type, dimensions, offset or skip_bytes). */
  selectedMapForCorrection?: MapCandidate | null
}

/**
 * Convert a MapCandidate to the API MapEntry shape.
 */
function mapCandidateToEntry(
  c: MapCandidate,
  fileId: string,
  scanId: string
): MapEntryPayload {
  const dims: { x?: number; y?: number; z?: number } = c.dimensions || {}
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
    selectedMapTextView,
    allMapsTextViews,
    selectedMapForCorrection,
  } = input

  // Only include files in scanned_files when a scan has actually been run (scanId present).
  // Otherwise the AI would say "the file has been scanned" when the user hasn't run a scan.
  const scannedFiles: ScannedFileEntryPayload[] = []
  if (fileId && fileName && scanId) {
    scannedFiles.push({
      file_id: fileId,
      filename: fileName,
      size_bytes: fileSize,
      project_name: project?.name ?? 'Unknown',
      scan_id: scanId,
      candidates_count: candidates.length,
      summary: null,
    })
  }

  const currentFileNote =
    fileId && fileName
      ? scanId
        ? `Current file: ${fileName} (scan completed, ${candidates.length} map(s) found).`
        : `Current file: ${fileName} (not yet scanned — run a scan to detect calibration maps).`
      : null

  const projectContext: ProjectContextPayload = {
    summary: project
      ? currentFileNote
        ? `${project.name}. ${currentFileNote}`
        : `${project.name}: ${fileName || 'firmware analysis'}`
      : currentFileNote ?? (fileName ? `Firmware analysis: ${fileName}` : 'Firmware analysis'),
    vehicle_model: project?.vehicle_model ?? null,
    intent: null,
  }

  const capped = candidates.slice(0, MAX_MAPS_IN_PAYLOAD)
  const maps: MapEntryPayload[] = capped.map((c) =>
    mapCandidateToEntry(c, fileId ?? '', scanId ?? '')
  )

  const payload: AssistantChatRequestPayload = {
    project_context: projectContext,
    scanned_files: scannedFiles,
    maps,
    user_message: userMessage,
  }
  if (selectedMapTextView != null && selectedMapTextView !== '') {
    payload.selected_map_text_view = selectedMapTextView
  }
  if (allMapsTextViews != null && allMapsTextViews !== '') {
    payload.all_maps_text_views = allMapsTextViews
  }
  if (selectedMapForCorrection != null && fileSize > 0) {
    const dims = selectedMapForCorrection.dimensions || {}
    payload.selected_map_for_correction = {
      map_id: selectedMapForCorrection.id,
      offset_hex: formatHexOffset(selectedMapForCorrection.offset),
      type: selectedMapForCorrection.type,
      dimensions: { x: dims.x ?? 1, y: dims.y ?? 1, ...(dims.z != null && { z: dims.z }) },
      size_bytes: selectedMapForCorrection.size,
      data_type: selectedMapForCorrection.dataType || 'u16le',
      file_size: fileSize,
    }
  }
  return payload
}
