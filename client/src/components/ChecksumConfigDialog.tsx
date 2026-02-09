import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Checkbox } from './ui/checkbox'
import { formatHexOffset } from '../lib/utils'
import { validateChecksum, type ChecksumValidationResponse } from '../services/checksumService'
import type { ChecksumConfig } from '../services/editService'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface ChecksumConfigDialogProps {
  open: boolean
  onClose: () => void
  onSave: (config: ChecksumConfig) => void
  fileSize: number
  fileId?: string | null
  defaultConfig?: Partial<ChecksumConfig>
}

export interface DetectionCandidate {
  id: string
  label: string
  config: ChecksumConfig
}

/** Build list of candidate configs to try for auto-detect (range starts × algorithms). */
function getDetectionCandidates(fileSize: number): DetectionCandidate[] {
  const size = 2
  const location = Math.max(0, fileSize - size)
  const rangeEnd = location
  const rangeStarts = [0, 0x200, 0x400, 0x800].filter((s) => s < rangeEnd)
  const algorithms: { alg: ChecksumConfig['algorithm']; mod?: number; label: string }[] = [
    { alg: 'modular_16bit', mod: 0x10000, label: 'Modular 16-bit LE' },
    { alg: 'ones_complement_16bit', label: "Ones' comp 16-bit LE" },
    { alg: 'modular_16bit_be', mod: 0x10000, label: 'Modular 16-bit BE' },
    { alg: 'ones_complement_16bit_be', label: "Ones' comp 16-bit BE" },
    { alg: 'modular', mod: 0xFFFF, label: 'Modular bytes 0xFFFF' },
    { alg: 'modular', mod: 0x10000, label: 'Modular bytes 0x10000' },
    { alg: 'ones_complement', label: "Ones' comp bytes" },
  ]
  const out: DetectionCandidate[] = []
  for (const start of rangeStarts) {
    for (const { alg, mod, label } of algorithms) {
      const config: ChecksumConfig = {
        algorithm: alg,
        checksum_range: { start, end: rangeEnd },
        checksum_location: location,
        checksum_size: size,
        endianness: 'little',
        modulo: mod,
      }
      out.push({
        id: `s${start.toString(16)}-${alg}-${mod ?? 'n'}`,
        label: `Start 0x${start.toString(16)} · ${label}`,
        config,
      })
    }
  }
  return out
}

/** Preset groups for detection: which candidates to run. */
const DETECTION_PRESETS: { value: string; label: string; filter: (c: DetectionCandidate) => boolean }[] = [
  { value: 'all', label: 'All configurations', filter: () => true },
  { value: 'quick', label: 'Quick (range start 0x0 only)', filter: (c) => c.config.checksum_range.start === 0 },
  { value: 'edc15_fsf8', label: 'EDC15/FSF8 (range 0x0 and 0x400)', filter: (c) => [0, 0x400].includes(c.config.checksum_range.start) },
]

// Helper function to calculate smart defaults
function calculateSmartDefaults(fileSize: number, checksumSize: number = 2) {
  // Common pattern: checksum at the very end of the file
  // Range: from start to (end - checksum_size)
  const location = Math.max(0, fileSize - checksumSize)
  const rangeStart = 0
  const rangeEnd = location  // End before checksum location

  return {
    rangeStart,
    rangeEnd,
    location,
  }
}

/** ECU presets for checksum (range, location, algorithm). EDC15C2 uses 512KB flash, last 2 bytes = checksum. */
export const ECU_PRESETS = {
  none: { label: 'Custom', value: 'none' as const },
  EDC15C2: {
    label: 'EDC15C2 (Bosch)',
    value: 'EDC15C2' as const,
    description: 'Last 2 bytes = checksum. If LE variants fail, try 16-bit BIG-endian (Modular 16-bit BE / Ones\' complement 16-bit BE).',
    getConfig: (fileSize: number) => {
      const size = 2
      const location = Math.max(0, fileSize - size)
      return {
        rangeStart: 0,
        rangeEnd: location,
        location,
        checksumSize: size,
        algorithm: 'modular_16bit' as const,
        modulo: 0x10000,
        endianness: 'little' as const,
      }
    },
  },
  /** Peugeot 607 2.2 HDi / FSF8 – EDC15C2 with optional header skip. Try Start 0x0, 0x200, 0x400, 0x800 if one fails. */
  FSF8: {
    label: 'FSF8 (Peugeot 607 HDi)',
    value: 'FSF8' as const,
    description: '512KB, last 2 bytes = checksum. Default range starts at 0x400 (skip first 1KB). If validation fails, try Start Offset 0x0, 0x200, 0x400 or 0x800.',
    getConfig: (fileSize: number) => {
      const size = 2
      const location = Math.max(0, fileSize - size)
      const rangeStart = 0x400  // Many FSF8/Peugeot dumps exclude first 1KB (vector/boot block)
      return {
        rangeStart: Math.min(rangeStart, location),
        rangeEnd: location,
        location,
        checksumSize: size,
        algorithm: 'modular_16bit' as const,
        modulo: 0x10000,
        endianness: 'little' as const,
      }
    },
  },
} as const

export function ChecksumConfigDialog({
  open,
  onClose,
  onSave,
  fileSize,
  fileId,
  defaultConfig,
}: ChecksumConfigDialogProps) {
  // Calculate smart defaults
  const smartDefaults = calculateSmartDefaults(fileSize, defaultConfig?.checksum_size || 2)
  const allCandidates = getDetectionCandidates(fileSize)

  const [ecuPreset, setEcuPreset] = useState<'none' | 'EDC15C2' | 'FSF8'>('none')
  const [detectionPreset, setDetectionPreset] = useState('edc15_fsf8')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionResults, setDetectionResults] = useState<Array<{ candidate: DetectionCandidate; result: ChecksumValidationResponse }> | null>(null)
  const [algorithm, setAlgorithm] = useState<ChecksumConfig['algorithm']>(
    defaultConfig?.algorithm || 'simple_sum'
  )
  const [rangeStart, setRangeStart] = useState<string>(
    defaultConfig?.checksum_range?.start?.toString(16) || smartDefaults.rangeStart.toString(16)
  )
  const [rangeEnd, setRangeEnd] = useState<string>(
    defaultConfig?.checksum_range?.end?.toString(16) || smartDefaults.rangeEnd.toString(16)
  )
  const [checksumLocation, setChecksumLocation] = useState<string>(
    defaultConfig?.checksum_location?.toString(16) || smartDefaults.location.toString(16)
  )
  const [checksumSize, setChecksumSize] = useState<number>(
    defaultConfig?.checksum_size || 2
  )
  const [endianness, setEndianness] = useState<'little' | 'big'>(
    defaultConfig?.endianness || 'little'
  )
  const [modulo, setModulo] = useState<string>(
    defaultConfig?.modulo?.toString(16) || 'FFFF'
  )
  const [enableModulo, setEnableModulo] = useState<boolean>(
    defaultConfig?.algorithm === 'modular' || defaultConfig?.algorithm === 'modular_16bit' || defaultConfig?.algorithm === 'modular_16bit_be'
  )

  const runDetection = async () => {
    if (!fileId) return
    const preset = DETECTION_PRESETS.find((p) => p.value === detectionPreset)
    const candidates = preset ? allCandidates.filter(preset.filter) : allCandidates
    setIsDetecting(true)
    setDetectionResults(null)
    const results: Array<{ candidate: DetectionCandidate; result: ChecksumValidationResponse }> = []
    for (const candidate of candidates) {
      try {
        const result = await validateChecksum(fileId, candidate.config)
        results.push({ candidate, result })
      } catch {
        results.push({
          candidate,
          result: {
            is_valid: false,
            stored_checksum: 0,
            calculated_checksum: 0,
            stored_checksum_hex: '0x0',
            calculated_checksum_hex: '0x0',
            checksum_location: candidate.config.checksum_location,
          },
        })
      }
    }
    setDetectionResults(results)
    setIsDetecting(false)
  }

  const applyDetectedConfig = (config: ChecksumConfig) => {
    setAlgorithm(config.algorithm)
    setRangeStart(config.checksum_range.start.toString(16))
    setRangeEnd(config.checksum_range.end.toString(16))
    setChecksumLocation(config.checksum_location.toString(16))
    setChecksumSize(config.checksum_size ?? 2)
    setEndianness(config.endianness ?? 'little')
    if (config.modulo != null) {
      setModulo(config.modulo.toString(16))
      setEnableModulo(true)
    }
    setEcuPreset('none')
    setDetectionResults(null)
  }

  // Reset detection results when dialog closes
  useEffect(() => {
    if (!open) setDetectionResults(null)
  }, [open])

  // Update location when checksum size changes to keep it at the end
  useEffect(() => {
    if (!defaultConfig) {
      const newDefaults = calculateSmartDefaults(fileSize, checksumSize)
      setChecksumLocation(newDefaults.location.toString(16))
      setRangeEnd(newDefaults.rangeEnd.toString(16))
    }
  }, [checksumSize, fileSize, defaultConfig])

  useEffect(() => {
    if (defaultConfig) {
      setAlgorithm(defaultConfig.algorithm || 'simple_sum')
      if (defaultConfig.checksum_range) {
        setRangeStart(defaultConfig.checksum_range.start.toString(16))
        setRangeEnd(defaultConfig.checksum_range.end.toString(16))
      }
      if (defaultConfig.checksum_location !== undefined) {
        setChecksumLocation(defaultConfig.checksum_location.toString(16))
      }
      setChecksumSize(defaultConfig.checksum_size || 2)
      setEndianness(defaultConfig.endianness || 'little')
      if (defaultConfig.modulo) {
        setModulo(defaultConfig.modulo.toString(16))
        setEnableModulo(true)
      }
    } else {
      // Apply smart defaults when dialog opens without existing config
      const newDefaults = calculateSmartDefaults(fileSize, checksumSize)
      setRangeStart(newDefaults.rangeStart.toString(16))
      setRangeEnd(newDefaults.rangeEnd.toString(16))
      setChecksumLocation(newDefaults.location.toString(16))
    }
  }, [defaultConfig, fileSize, checksumSize])

  const parseHex = (value: string): number => {
    const clean = value.replace(/^0x/i, '').trim()
    return parseInt(clean, 16) || 0
  }

  const handleSave = () => {
    const start = parseHex(rangeStart)
    const end = parseHex(rangeEnd)
    const location = parseHex(checksumLocation)
    const moduloValue = enableModulo && (algorithm === 'modular' || algorithm === 'modular_16bit' || algorithm === 'modular_16bit_be') ? parseHex(modulo) : undefined

    // Validation
    if (start < 0 || start >= fileSize) {
      alert('Range start must be between 0 and file size')
      return
    }
    if (end <= start || end > fileSize) {
      alert('Range end must be greater than start and within file size')
      return
    }
    if (location < 0 || location + checksumSize > fileSize) {
      alert('Checksum location must be within file bounds')
      return
    }
    // Check if checksum location overlaps with range
    if (location >= start && location < end) {
      alert('Checksum location must be outside the range being checksummed. The checksum cannot be included in its own calculation.')
      return
    }
    // Check if checksum location is within the range (even partially)
    if (location + checksumSize > start && location < end) {
      alert('Checksum location overlaps with the checksum range. Please place the checksum outside the range.')
      return
    }

    const config: ChecksumConfig = {
      algorithm,
      checksum_range: {
        start,
        end,
      },
      checksum_location: location,
      checksum_size: checksumSize,
      endianness,
      modulo: moduloValue,
    }

    onSave(config)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checksum Configuration</DialogTitle>
          <DialogDescription>
            Configure checksum calculation and update location. The checksum will be automatically updated when saving edits.
            <br />
            <span className="text-xs text-muted-foreground mt-1 block">
              💡 Smart defaults: Checksum at end of file ({formatHexOffset(smartDefaults.location)}), 
              range from start to before checksum (0x0 - {formatHexOffset(smartDefaults.rangeEnd)})
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Auto-detect checksum */}
          {fileId && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <Label className="text-base">Auto-detect checksum</Label>
              <p className="text-sm text-muted-foreground">
                Run detection to find which configuration this file uses. Results will show whether each option is correct or incorrect.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={detectionPreset} onValueChange={setDetectionPreset}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Configurations to try" />
                  </SelectTrigger>
                  <SelectContent>
                    {DETECTION_PRESETS.map((p) => {
                      const count = allCandidates.filter(p.filter).length
                      return (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label} ({count})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={runDetection}
                  disabled={isDetecting}
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running…
                    </>
                  ) : (
                    'Run detection'
                  )}
                </Button>
              </div>
              {detectionResults !== null && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground">Results</p>
                  {detectionResults.map(({ candidate, result }) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {result.is_valid ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <span className="truncate">{candidate.label}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {result.is_valid ? 'Valid' : `Stored ${result.stored_checksum_hex} ≠ ${result.calculated_checksum_hex}`}
                        </span>
                      </div>
                      {result.is_valid && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyDetectedConfig(candidate.config)}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  ))}
                  {detectionResults.every((r) => !r.result.is_valid) && detectionResults.length > 0 && (
                    <p className="text-xs text-muted-foreground">No matching configuration found. Try editing range start manually or use a different preset.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ECU Preset */}
          <div className="space-y-2">
            <Label>ECU preset</Label>
            <Select
              value={ecuPreset}
              onValueChange={(value: 'none' | 'EDC15C2' | 'FSF8') => {
                setEcuPreset(value)
                if (value === 'EDC15C2') {
                  const c = ECU_PRESETS.EDC15C2.getConfig(fileSize)
                  setRangeStart(c.rangeStart.toString(16))
                  setRangeEnd(c.rangeEnd.toString(16))
                  setChecksumLocation(c.location.toString(16))
                  setChecksumSize(c.checksumSize)
                  setAlgorithm(c.algorithm)
                  setModulo(c.modulo === 0x10000 ? '10000' : 'FFFF')
                  setEnableModulo(true)
                  setEndianness(c.endianness)
                } else if (value === 'FSF8') {
                  const c = ECU_PRESETS.FSF8.getConfig(fileSize)
                  setRangeStart(c.rangeStart.toString(16))
                  setRangeEnd(c.rangeEnd.toString(16))
                  setChecksumLocation(c.location.toString(16))
                  setChecksumSize(c.checksumSize)
                  setAlgorithm(c.algorithm)
                  setModulo(c.modulo === 0x10000 ? '10000' : 'FFFF')
                  setEnableModulo(true)
                  setEndianness(c.endianness)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{ECU_PRESETS.none.label}</SelectItem>
                <SelectItem value="EDC15C2">{ECU_PRESETS.EDC15C2.label}</SelectItem>
                <SelectItem value="FSF8">{ECU_PRESETS.FSF8.label}</SelectItem>
              </SelectContent>
            </Select>
            {ecuPreset === 'EDC15C2' && (
              <p className="text-xs text-muted-foreground">
                {ECU_PRESETS.EDC15C2.description}
              </p>
            )}
            {ecuPreset === 'FSF8' && (
              <p className="text-xs text-muted-foreground">
                {ECU_PRESETS.FSF8.description}
              </p>
            )}
          </div>

          {/* Algorithm */}
          <div className="space-y-2">
            <Label>Checksum Algorithm</Label>
            <Select value={algorithm} onValueChange={(value) => {
              setAlgorithm(value as ChecksumConfig['algorithm'])
              if (value === 'modular') {
                setEnableModulo(true)
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple_sum">Simple Sum</SelectItem>
                <SelectItem value="crc16">CRC-16 (CCITT)</SelectItem>
                <SelectItem value="crc32">CRC-32 (IEEE 802.3)</SelectItem>
                <SelectItem value="xor">XOR</SelectItem>
                <SelectItem value="twos_complement">Two's Complement</SelectItem>
                <SelectItem value="modular">Modular Sum (bytes)</SelectItem>
                <SelectItem value="ones_complement">Ones' Complement (bytes)</SelectItem>
                <SelectItem value="modular_16bit">Modular Sum 16-bit words LE (EDC15/EDC16)</SelectItem>
                <SelectItem value="ones_complement_16bit">Ones' Complement 16-bit words LE</SelectItem>
                <SelectItem value="modular_16bit_be">Modular Sum 16-bit words BIG-endian</SelectItem>
                <SelectItem value="ones_complement_16bit_be">Ones' Complement 16-bit words BIG-endian</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {algorithm === 'simple_sum' && 'Sum of all bytes in range'}
              {algorithm === 'crc16' && 'CRC-16-CCITT polynomial (0x1021)'}
              {algorithm === 'crc32' && 'CRC-32 IEEE 802.3 polynomial'}
              {algorithm === 'xor' && 'XOR of all bytes in range'}
              {algorithm === 'twos_complement' && 'Two\'s complement of sum'}
              {algorithm === 'modular' && 'Sum of bytes modulo value (e.g. 0xFFFF or 0x10000)'}
              {algorithm === 'ones_complement' && '0xFFFF − (byte sum & 0xFFFF)'}
              {algorithm === 'modular_16bit' && 'Sum 16-bit words (little-endian), then modulo 0x10000'}
              {algorithm === 'ones_complement_16bit' && '0xFFFF − (16-bit LE word sum & 0xFFFF)'}
              {algorithm === 'modular_16bit_be' && 'Sum 16-bit words (big-endian), then modulo 0x10000'}
              {algorithm === 'ones_complement_16bit_be' && '0xFFFF − (16-bit BE word sum & 0xFFFF)'}
            </p>
          </div>

          {/* Checksum Range */}
          <div className="space-y-2">
            <Label>Checksum Range (hex)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start Offset</Label>
                <Input
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="font-mono"
                  placeholder="0x0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Offset</Label>
                <Input
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="font-mono"
                  placeholder={`0x${fileSize.toString(16)}`}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Range: {formatHexOffset(parseHex(rangeStart))} - {formatHexOffset(parseHex(rangeEnd))} 
              ({parseHex(rangeEnd) - parseHex(rangeStart)} bytes)
            </p>
            {(ecuPreset === 'FSF8' || ecuPreset === 'EDC15C2') && (
              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                <span>Try range start:</span>
                {[0, 0x200, 0x400, 0x800].map((start) => (
                  <Button
                    key={start}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs font-mono"
                    onClick={() => setRangeStart(start.toString(16))}
                  >
                    0x{start.toString(16)}
                  </Button>
                ))}
              </p>
            )}
          </div>

          {/* Checksum Location */}
          <div className="space-y-2">
            <Label>Checksum Storage Location (hex)</Label>
            <div className="flex gap-2">
              <Input
                value={checksumLocation}
                onChange={(e) => setChecksumLocation(e.target.value)}
                className="font-mono"
                placeholder={`0x${(fileSize - checksumSize).toString(16)}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // Set to end of file
                  const newDefaults = calculateSmartDefaults(fileSize, checksumSize)
                  setChecksumLocation(newDefaults.location.toString(16))
                  setRangeEnd(newDefaults.rangeEnd.toString(16))
                }}
                className="whitespace-nowrap"
              >
                Use End
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Location: {formatHexOffset(parseHex(checksumLocation))} 
              {' '}(must be outside checksum range: {formatHexOffset(parseHex(rangeStart))} - {formatHexOffset(parseHex(rangeEnd))})
            </p>
          </div>

          {/* Checksum Size and Endianness */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Checksum Size (bytes)</Label>
              <Select
                value={checksumSize.toString()}
                onValueChange={(value) => {
                  const newSize = parseInt(value)
                  setChecksumSize(newSize)
                  // Auto-adjust location to end of file
                  const newDefaults = calculateSmartDefaults(fileSize, newSize)
                  setChecksumLocation(newDefaults.location.toString(16))
                  setRangeEnd(newDefaults.rangeEnd.toString(16))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 byte</SelectItem>
                  <SelectItem value="2">2 bytes (common)</SelectItem>
                  <SelectItem value="4">4 bytes (common)</SelectItem>
                  <SelectItem value="8">8 bytes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Most ECU files use 2 or 4 bytes
              </p>
            </div>
            <div className="space-y-2">
              <Label>Endianness</Label>
              <Select
                value={endianness}
                onValueChange={(value) => setEndianness(value as 'little' | 'big')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="little">Little Endian</SelectItem>
                  <SelectItem value="big">Big Endian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Modulo (for modular algorithms) */}
          {(algorithm === 'modular' || algorithm === 'modular_16bit' || algorithm === 'modular_16bit_be') && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-modulo"
                  checked={enableModulo}
                  onCheckedChange={(checked) => setEnableModulo(checked === true)}
                />
                <Label htmlFor="enable-modulo" className="cursor-pointer">
                  Use Modulo
                </Label>
              </div>
              {enableModulo && (
                <Input
                  value={modulo}
                  onChange={(e) => setModulo(e.target.value)}
                  className="font-mono"
                  placeholder={algorithm === 'modular_16bit' ? '10000' : 'FFFF'}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Modulo (hex). Byte sum: 0xFFFF or 0x10000. 16-bit word sum: use 0x10000 for EDC15C2.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

