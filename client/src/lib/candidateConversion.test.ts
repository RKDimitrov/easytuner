/**
 * Unit tests for convertCandidateResponse
 */

import { describe, it, expect } from 'vitest'
import { convertCandidateResponse } from './candidateConversion'
import type { CandidateResponse } from '../services/scanService'

function makeCandidate(overrides: Partial<CandidateResponse> = {}): CandidateResponse {
  return {
    candidate_id: 'cand-1',
    scan_id: 'scan-1',
    offset: 1000,
    size: 512,
    data_type: 'u16le',
    confidence: 0.85,
    pattern_type: '2D',
    features: {},
    dimensions: {},
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─── Basic field mapping ──────────────────────────────────────────────────────

describe('convertCandidateResponse – basic fields', () => {
  it('maps candidate_id to id as string', () => {
    const result = convertCandidateResponse(makeCandidate({ candidate_id: '42' }))
    expect(result.id).toBe('42')
  })

  it('maps offset correctly', () => {
    const result = convertCandidateResponse(makeCandidate({ offset: 0x1234 }))
    expect(result.offset).toBe(0x1234)
  })

  it('maps size correctly', () => {
    const result = convertCandidateResponse(makeCandidate({ size: 256 }))
    expect(result.size).toBe(256)
  })

  it('converts confidence from 0-1 to 0-100 (rounded)', () => {
    const result = convertCandidateResponse(makeCandidate({ confidence: 0.856 }))
    expect(result.confidence).toBe(86)
  })

  it('maps data_type to dataType', () => {
    const result = convertCandidateResponse(makeCandidate({ data_type: 'u32le' }))
    expect(result.dataType).toBe('u32le')
  })

  it('defaults dataType to "u16le" when data_type is missing', () => {
    const c = makeCandidate()
    ;(c as any).data_type = undefined
    const result = convertCandidateResponse(c)
    expect(result.dataType).toBe('u16le')
  })
})

// ─── Pattern type → type ──────────────────────────────────────────────────────

describe('convertCandidateResponse – pattern_type mapping', () => {
  it('maps "2D" pattern to type "2D"', () => {
    const result = convertCandidateResponse(makeCandidate({ pattern_type: '2D' }))
    expect(result.type).toBe('2D')
  })

  it('maps "1D" pattern to type "1D"', () => {
    const result = convertCandidateResponse(makeCandidate({ pattern_type: '1D' }))
    expect(result.type).toBe('1D')
  })

  it('maps "3D" pattern to type "3D"', () => {
    const result = convertCandidateResponse(makeCandidate({ pattern_type: '3D' }))
    expect(result.type).toBe('3D')
  })

  it('handles lowercase pattern type', () => {
    const result = convertCandidateResponse(makeCandidate({ pattern_type: '1d' }))
    expect(result.type).toBe('1D')
  })

  it('handles pattern type containing "1D" substring', () => {
    const result = convertCandidateResponse(makeCandidate({ pattern_type: 'MAP_1D' }))
    expect(result.type).toBe('1D')
  })

  it('defaults to "2D" when pattern_type is absent', () => {
    const c = makeCandidate()
    ;(c as any).pattern_type = undefined
    const result = convertCandidateResponse(c)
    expect(result.type).toBe('2D')
  })
})

// ─── Dimensions – explicit x/y ───────────────────────────────────────────────

describe('convertCandidateResponse – dimensions from explicit x/y', () => {
  it('maps x/y dimensions for 2D candidate', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '2D', dimensions: { x: 16, y: 8 } })
    )
    expect(result.dimensions).toEqual({ x: 16, y: 8 })
  })

  it('maps rows/cols as x/y for 2D candidate', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '2D', dimensions: { rows: 10, cols: 20 } })
    )
    expect(result.dimensions).toEqual({ x: 10, y: 20 })
  })

  it('maps width/height as x/y for 2D candidate', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '2D', dimensions: { width: 12, height: 6 } })
    )
    expect(result.dimensions).toEqual({ x: 12, y: 6 })
  })

  it('maps x/y/z dimensions for 3D candidate', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '3D', dimensions: { x: 4, y: 4, z: 4 } })
    )
    expect(result.dimensions).toEqual({ x: 4, y: 4, z: 4 })
  })

  it('maps 1D candidate with only x dimension', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '1D', dimensions: { x: 32, y: 1 } })
    )
    expect(result.dimensions?.x).toBe(32)
    expect(result.dimensions?.y).toBe(1)
  })
})

// ─── Dimensions – estimated_elements ─────────────────────────────────────────

describe('convertCandidateResponse – dimensions from estimated_elements', () => {
  it('creates square 2D dimensions from perfect square estimated_elements', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '2D', dimensions: { estimated_elements: 16 } })
    )
    expect(result.dimensions).toEqual({ x: 4, y: 4 })
  })

  it('falls back to linear for non-perfect-square estimated_elements in 2D', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '2D', dimensions: { estimated_elements: 10 } })
    )
    expect(result.dimensions).toEqual({ x: 10, y: 1 })
  })

  it('creates 1D dimensions from estimated_elements', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '1D', dimensions: { estimated_elements: 32 } })
    )
    expect(result.dimensions).toEqual({ x: 32, y: 1 })
  })

  it('creates cube 3D dimensions from perfect cube estimated_elements', () => {
    const result = convertCandidateResponse(
      makeCandidate({ pattern_type: '3D', dimensions: { estimated_elements: 27 } })
    )
    expect(result.dimensions).toEqual({ x: 3, y: 3, z: 3 })
  })
})

// ─── Dimensions – from features ──────────────────────────────────────────────

describe('convertCandidateResponse – dimensions from features', () => {
  it('reads x_size/y_size from features when dimensions are absent', () => {
    const result = convertCandidateResponse(
      makeCandidate({
        pattern_type: '2D',
        dimensions: {},
        features: { x_size: 8, y_size: 4 },
      })
    )
    expect(result.dimensions).toEqual({ x: 8, y: 4 })
  })
})

// ─── elementSize ─────────────────────────────────────────────────────────────

describe('convertCandidateResponse – elementSize', () => {
  it('reads element_size from dimensions', () => {
    const result = convertCandidateResponse(
      makeCandidate({ dimensions: { x: 4, y: 4, element_size: 4 } })
    )
    expect(result.elementSize).toBe(4)
  })

  it('defaults elementSize to 2 when not provided', () => {
    const result = convertCandidateResponse(makeCandidate({ dimensions: { x: 4, y: 4 } }))
    expect(result.elementSize).toBe(2)
  })
})
