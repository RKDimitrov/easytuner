/**
 * Convert API CandidateResponse to MapCandidate for hex/map viewers.
 */
import type { MapCandidate } from '../store/analysisStore'
import type { CandidateResponse } from '../services/scanService'

export function convertCandidateResponse(c: CandidateResponse): MapCandidate {
  const dims = (c.dimensions || {}) as Record<string, number>
  const features = (c.features || {}) as Record<string, number>
  let type: '1D' | '2D' | '3D' = '2D'
  if (c.pattern_type) {
    const patternUpper = c.pattern_type.toUpperCase()
    if (patternUpper === '1D' || patternUpper.includes('1D')) type = '1D'
    else if (patternUpper === '3D' || patternUpper.includes('3D')) type = '3D'
    else if (patternUpper === '2D' || patternUpper.includes('2D')) type = '2D'
  }
  let dimensions: { x: number; y: number; z?: number } | undefined
  if (dims.x !== undefined || dims.width !== undefined || dims.rows !== undefined || dims.estimated_elements !== undefined) {
    if (dims.estimated_elements !== undefined && dims.x === undefined && dims.width === undefined) {
      if (type === '1D') dimensions = { x: dims.estimated_elements, y: 1 }
      else if (type === '2D') {
        const sqrt = Math.sqrt(dims.estimated_elements)
        dimensions = Number.isInteger(sqrt) ? { x: sqrt, y: sqrt } : { x: dims.estimated_elements, y: 1 }
      } else if (type === '3D') {
        const cubeRoot = Math.cbrt(dims.estimated_elements)
        dimensions = Number.isInteger(cubeRoot) ? { x: cubeRoot, y: cubeRoot, z: cubeRoot } : { x: dims.estimated_elements, y: 1, z: 1 }
      }
    } else {
      const x = dims.x ?? dims.width ?? dims.rows ?? 0
      const y = dims.y ?? dims.height ?? dims.cols ?? 0
      const z = dims.z ?? dims.depth ?? 1
      if (type === '1D') dimensions = x > 0 ? { x, y: 1 } : undefined
      else if (type === '2D' && x > 0 && y > 0) dimensions = { x, y }
      else if (type === '3D' && x > 0 && y > 0 && z > 0) dimensions = { x, y, z }
    }
  } else if (features.x_size !== undefined || features.width !== undefined) {
    const x = features.x_size || features.width || 0
    const y = features.y_size || features.height || 0
    const z = features.z_size || features.depth || 1
    if (type === '1D' && x > 0) dimensions = { x, y: 1 }
    else if (type === '2D' && x > 0 && y > 0) dimensions = { x, y }
    else if (x > 0 && y > 0 && z > 0) dimensions = { x, y, z }
  }
  if (!dimensions && (dims.width !== undefined || dims.height !== undefined)) {
    const x = dims.width || dims.x || 1
    const y = dims.height || dims.y || 1
    if (x > 0 && y > 0) dimensions = { x, y }
  }
  const elementSize = dims.element_size || 2
  const dataType = c.data_type || 'u16le'
  return {
    id: String(c.candidate_id),
    type,
    offset: c.offset,
    confidence: Math.round(c.confidence * 100),
    size: c.size,
    dimensions,
    dataType,
    elementSize,
  }
}
