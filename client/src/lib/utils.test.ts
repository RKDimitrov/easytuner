/**
 * Unit tests for utility functions
 */

import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  formatHexOffset,
  byteToHex,
  wordToHexLE,
  isPrintableAscii,
  getConfidenceColor,
} from './utils'

// ─── formatBytes ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(512)).toBe('512 Bytes')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('respects custom decimal places', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB')
    expect(formatBytes(1536, 1)).toBe('1.5 KB')
  })

  it('handles negative decimal parameter by using 0 decimals', () => {
    expect(formatBytes(1536, -1)).toBe('2 KB')
  })

  it('formats partial KB with 2 decimal places by default', () => {
    expect(formatBytes(1500)).toBe('1.46 KB')
  })
})

// ─── formatHexOffset ─────────────────────────────────────────────────────────

describe('formatHexOffset', () => {
  it('formats zero offset', () => {
    expect(formatHexOffset(0)).toBe('0x00000')
  })

  it('pads to minimum 5 hex digits', () => {
    expect(formatHexOffset(1)).toBe('0x00001')
    expect(formatHexOffset(0xff)).toBe('0x000FF')
  })

  it('formats a typical ECU offset', () => {
    expect(formatHexOffset(0x684fa)).toBe('0x684FA')
  })

  it('uses uppercase hex digits', () => {
    expect(formatHexOffset(0xabcde)).toBe('0xABCDE')
  })

  it('handles large offsets beyond 5 digits', () => {
    const result = formatHexOffset(0x1fffff)
    expect(result).toBe('0x1FFFFF')
    expect(result.length).toBeGreaterThan(7) // '0x' + more than 5 chars
  })
})

// ─── byteToHex ────────────────────────────────────────────────────────────────

describe('byteToHex', () => {
  it('formats 0 as "00"', () => {
    expect(byteToHex(0)).toBe('00')
  })

  it('formats single-digit hex with leading zero', () => {
    expect(byteToHex(0x0f)).toBe('0F')
  })

  it('formats 255 as "FF"', () => {
    expect(byteToHex(255)).toBe('FF')
  })

  it('uses uppercase letters', () => {
    expect(byteToHex(0xab)).toBe('AB')
  })

  it('always returns exactly 2 characters', () => {
    for (const val of [0, 1, 15, 16, 127, 255]) {
      expect(byteToHex(val)).toHaveLength(2)
    }
  })
})

// ─── wordToHexLE ──────────────────────────────────────────────────────────────

describe('wordToHexLE', () => {
  it('reads a little-endian 16-bit word correctly', () => {
    const data = new Uint8Array([0x34, 0x12]) // LE: 0x1234
    expect(wordToHexLE(data, 0)).toBe('1234')
  })

  it('reads from a non-zero offset', () => {
    const data = new Uint8Array([0x00, 0x78, 0x56]) // offset 1 → 0x5678
    expect(wordToHexLE(data, 1)).toBe('5678')
  })

  it('returns "????" when offset is out of bounds', () => {
    const data = new Uint8Array([0x01])
    expect(wordToHexLE(data, 0)).toBe('????')
  })

  it('returns "????" when buffer is empty', () => {
    const data = new Uint8Array([])
    expect(wordToHexLE(data, 0)).toBe('????')
  })

  it('pads result to 4 characters', () => {
    const data = new Uint8Array([0x01, 0x00]) // 0x0001
    expect(wordToHexLE(data, 0)).toBe('0001')
  })
})

// ─── isPrintableAscii ─────────────────────────────────────────────────────────

describe('isPrintableAscii', () => {
  it('returns true for space (32)', () => {
    expect(isPrintableAscii(32)).toBe(true)
  })

  it('returns true for tilde (126)', () => {
    expect(isPrintableAscii(126)).toBe(true)
  })

  it('returns true for common printable characters', () => {
    expect(isPrintableAscii('A'.charCodeAt(0))).toBe(true)
    expect(isPrintableAscii('z'.charCodeAt(0))).toBe(true)
    expect(isPrintableAscii('0'.charCodeAt(0))).toBe(true)
  })

  it('returns false for null byte (0)', () => {
    expect(isPrintableAscii(0)).toBe(false)
  })

  it('returns false for DEL (127)', () => {
    expect(isPrintableAscii(127)).toBe(false)
  })

  it('returns false for control characters below 32', () => {
    expect(isPrintableAscii(31)).toBe(false)
    expect(isPrintableAscii(9)).toBe(false) // tab
    expect(isPrintableAscii(10)).toBe(false) // newline
  })
})

// ─── getConfidenceColor ───────────────────────────────────────────────────────

describe('getConfidenceColor', () => {
  it('returns "success" for confidence >= 85', () => {
    expect(getConfidenceColor(85)).toBe('success')
    expect(getConfidenceColor(100)).toBe('success')
    expect(getConfidenceColor(90)).toBe('success')
  })

  it('returns "warning" for confidence between 70 and 84', () => {
    expect(getConfidenceColor(70)).toBe('warning')
    expect(getConfidenceColor(84)).toBe('warning')
    expect(getConfidenceColor(75)).toBe('warning')
  })

  it('returns "destructive" for confidence below 70', () => {
    expect(getConfidenceColor(69)).toBe('destructive')
    expect(getConfidenceColor(0)).toBe('destructive')
    expect(getConfidenceColor(50)).toBe('destructive')
  })
})
