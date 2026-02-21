import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format hex offset (min 5 digits, e.g. 0x684FA; larger addresses get 6+ digits)
 */
export function formatHexOffset(offset: number): string {
  return '0x' + offset.toString(16).toUpperCase().padStart(5, '0')
}

/**
 * Convert byte to hex string (2 digits)
 */
export function byteToHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0')
}

/**
 * Convert 16-bit word to hex string (4 digits), little-endian: low byte first in memory
 */
export function wordToHexLE(data: Uint8Array, offset: number): string {
  if (offset + 2 > data.length) return '????'
  const lo = data[offset]
  const hi = data[offset + 1]
  const word = lo | (hi << 8)
  return word.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Check if byte is printable ASCII
 */
export function isPrintableAscii(byte: number): boolean {
  return byte >= 32 && byte <= 126
}

/**
 * Get confidence color
 */
export function getConfidenceColor(confidence: number): 'success' | 'warning' | 'destructive' {
  if (confidence >= 85) return 'success'
  if (confidence >= 70) return 'warning'
  return 'destructive'
}

