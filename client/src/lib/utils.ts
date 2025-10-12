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
 * Format hex offset
 */
export function formatHexOffset(offset: number): string {
  return '0x' + offset.toString(16).toUpperCase().padStart(8, '0')
}

/**
 * Convert byte to hex string
 */
export function byteToHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0')
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

