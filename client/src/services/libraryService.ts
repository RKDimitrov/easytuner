/**
 * Library Service
 *
 * API for browsing published projects (no auth required for reads).
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'

export interface LibraryProjectSummary {
  project_id: string
  owner_user_id: string
  owner_email: string
  owner_avatar_url: string | null
  owner_display_name: string | null
  name: string
  description: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  file_count: number
}

export interface LibraryProjectFile {
  file_id: string
  filename: string
  size_bytes: number
  uploaded_at: string
  has_scan: boolean
  latest_scan_id: string | null
  latest_scan_at: string | null
  candidates_count: number
}

export interface LibraryProjectDetail extends LibraryProjectSummary {
  files: LibraryProjectFile[]
}

/**
 * List published projects (public)
 * GET /api/v1/library
 */
export async function getLibraryProjects(params?: {
  limit?: number
  offset?: number
}): Promise<{ projects: LibraryProjectSummary[]; count: number }> {
  const response = await axios.get<{ projects: LibraryProjectSummary[]; count: number }>(
    `${API_BASE_URL}${API_PREFIX}/library`,
    { params: params ?? {} }
  )
  return response.data
}

/**
 * Get a single published project with files (public)
 * GET /api/v1/library/{project_id}
 */
export async function getLibraryProject(projectId: string): Promise<LibraryProjectDetail> {
  const response = await axios.get<LibraryProjectDetail>(
    `${API_BASE_URL}${API_PREFIX}/library/${projectId}`
  )
  return response.data
}

/**
 * Get scan results for a file in a published project (public)
 * GET /api/v1/library/{project_id}/files/{file_id}/scan-results
 */
export async function getLibraryFileScanResults(
  projectId: string,
  fileId: string,
  params?: { limit?: number; offset?: number }
): Promise<import('./scanService').ScanResultsResponse> {
  const response = await axios.get(
    `${API_BASE_URL}${API_PREFIX}/library/${projectId}/files/${fileId}/scan-results`,
    { params: params ?? {} }
  )
  return response.data
}

/**
 * Download file bytes for a file in a published project (public).
 * Used to show hex viewer and map values in the library.
 * GET /api/v1/library/{project_id}/files/{file_id}/download
 */
export async function downloadLibraryFile(
  projectId: string,
  fileId: string
): Promise<ArrayBuffer> {
  const response = await axios.get(
    `${API_BASE_URL}${API_PREFIX}/library/${projectId}/files/${fileId}/download`,
    { responseType: 'arraybuffer' }
  )
  return response.data
}

export interface LibraryScanEntry {
  file_id: string
  filename: string
  size_bytes: number
  sha256: string
  project_id: string
  project_name: string
  owner_email: string
  owner_avatar_url: string | null
  owner_display_name: string | null
  scan_id: string
  scanned_at: string | null
  processing_time_ms: number | null
  candidates_count: number
}

/**
 * List all scanned files from published projects (public).
 * GET /api/v1/library/scans
 */
export async function getLibraryScans(params?: {
  limit?: number
  offset?: number
}): Promise<{ scans: LibraryScanEntry[]; count: number }> {
  const response = await axios.get<{ scans: LibraryScanEntry[]; count: number }>(
    `${API_BASE_URL}${API_PREFIX}/library/scans`,
    { params: params ?? {} }
  )
  return response.data
}

export interface LibraryHashCheckResult {
  found: false
}
export interface LibraryHashCheckFound {
  found: true
  file_id: string
  filename: string
  size_bytes: number
  project_id: string
  project_name: string
  owner_email: string
  scan_id: string
  scanned_at: string | null
  candidates_count: number
}

/**
 * Check if a file hash has an existing scan in any published project (public).
 * GET /api/v1/library/check-hash?sha256=...
 */
export async function checkLibraryHash(
  sha256: string
): Promise<LibraryHashCheckResult | LibraryHashCheckFound> {
  const response = await axios.get<LibraryHashCheckResult | LibraryHashCheckFound>(
    `${API_BASE_URL}${API_PREFIX}/library/check-hash`,
    { params: { sha256 } }
  )
  return response.data
}
