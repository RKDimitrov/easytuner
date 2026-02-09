import { useState, useEffect } from 'react'
import { Button } from './ui/button'
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
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { formatHexOffset } from '../lib/utils'
import { validateChecksum, type ChecksumValidationResponse } from '../services/checksumService'
import type { ChecksumConfig } from '../services/editService'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export interface DetectionCandidate {
  id: string
  label: string
  config: ChecksumConfig
}

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

const DETECTION_PRESETS: { value: string; label: string; filter: (c: DetectionCandidate) => boolean }[] = [
  { value: 'all', label: 'All configurations', filter: () => true },
  { value: 'quick', label: 'Quick (range start 0x0 only)', filter: (c) => c.config.checksum_range.start === 0 },
  { value: 'edc15_fsf8', label: 'EDC15/FSF8 (range 0x0 and 0x400)', filter: (c) => [0, 0x400].includes(c.config.checksum_range.start) },
]

/** Full one-line description of a checksum config (and optional validation result). */
function formatFullChecksumConfig(
  config: ChecksumConfig,
  result?: ChecksumValidationResponse
): string {
  const parts = [
    `Algorithm: ${config.algorithm}`,
    `Range: ${formatHexOffset(config.checksum_range.start)}–${formatHexOffset(config.checksum_range.end)}`,
    `Location: ${formatHexOffset(config.checksum_location)}`,
    `Size: ${config.checksum_size ?? 2} bytes`,
    `Endianness: ${config.endianness ?? 'little'}`,
  ]
  if (config.modulo != null) parts.push(`Modulo: 0x${config.modulo.toString(16).toUpperCase()}`)
  if (result !== undefined) {
    parts.push(result.is_valid ? '✓ Valid' : `✗ Invalid (stored ${result.stored_checksum_hex}, calculated ${result.calculated_checksum_hex})`)
  }
  return parts.join(' · ')
}

interface ChecksumDetectPopupProps {
  open: boolean
  onClose: () => void
  fileId: string | null | undefined
  fileSize: number
  onApplyConfig: (config: ChecksumConfig) => void
  onOpenFullConfig: () => void
}

export function ChecksumDetectPopup({
  open,
  onClose,
  fileId,
  fileSize,
  onApplyConfig,
  onOpenFullConfig,
}: ChecksumDetectPopupProps) {
  const allCandidates = getDetectionCandidates(fileSize)
  const [detectionPreset, setDetectionPreset] = useState('edc15_fsf8')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionResults, setDetectionResults] = useState<Array<{ candidate: DetectionCandidate; result: ChecksumValidationResponse }> | null>(null)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setDetectionResults(null)
      setSelectedResultId(null)
    }
  }, [open])

  const runDetection = async () => {
    if (!fileId) return
    const preset = DETECTION_PRESETS.find((p) => p.value === detectionPreset)
    const candidates = preset ? allCandidates.filter(preset.filter) : allCandidates
    setIsDetecting(true)
    setDetectionResults(null)
    setSelectedResultId(null)
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
    if (results.length > 0) setSelectedResultId(results[0].candidate.id)
    setIsDetecting(false)
  }

  const selectedResult = detectionResults?.find((r) => r.candidate.id === selectedResultId)
  const canApply = selectedResult?.result.is_valid ?? false

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Checksum Configuration</DialogTitle>
          <DialogDescription>
            Configure checksum calculation and update location. The checksum will be automatically updated when saving edits.
            <span className="mt-1 block text-xs">
              💡 Smart defaults: Checksum at end of file ({formatHexOffset(Math.max(0, fileSize - 2))}), range 0x0–{formatHexOffset(Math.max(0, fileSize - 2))}.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Auto-detect checksum</Label>
            <p className="text-xs text-muted-foreground">
              Run detection to find which configuration this file uses. Results show whether each option is correct or incorrect.
            </p>
            <div className="flex flex-col gap-2">
              <Select value={detectionPreset} onValueChange={setDetectionPreset}>
                <SelectTrigger className="w-full">
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
                disabled={isDetecting || !fileId}
                className="w-full"
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
          </div>

          {/* Dropdown with FULL checksum configuration info (under Run detection) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Checksum configuration</Label>
            <Select
              value={
                detectionResults?.length === 0
                  ? '__none__'
                  : (selectedResultId ?? '')
              }
              onValueChange={(v) => (v && v !== '__none__' && v !== '__placeholder__' ? setSelectedResultId(v) : setSelectedResultId(null))}
              disabled={detectionResults === null || detectionResults.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    detectionResults === null
                      ? 'Run detection to see configurations'
                      : detectionResults.length === 0
                        ? 'No configurations to show'
                        : 'Select a configuration'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {detectionResults === null ? (
                  <SelectItem value="__placeholder__" disabled>
                    Run detection to see configurations
                  </SelectItem>
                ) : detectionResults.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No matching configuration found
                  </SelectItem>
                ) : (
                  detectionResults.map(({ candidate, result }) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      <span className="block text-xs">
                        {result.is_valid ? (
                          <CheckCircle2 className="inline h-3.5 w-3.5 text-green-600 mr-1.5 align-middle shrink-0" />
                        ) : (
                          <XCircle className="inline h-3.5 w-3.5 text-destructive mr-1.5 align-middle shrink-0" />
                        )}
                        {formatFullChecksumConfig(candidate.config, result)}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedResult && (
              <p className="text-xs text-muted-foreground rounded border border-border bg-muted/30 p-2 font-mono break-all">
                {formatFullChecksumConfig(selectedResult.candidate.config, selectedResult.result)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {canApply && selectedResult && (
              <Button
                type="button"
                onClick={() => {
                  onApplyConfig(selectedResult.candidate.config)
                  onClose()
                }}
              >
                Apply this configuration
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => { onClose(); onOpenFullConfig(); }}>
              Open full configuration…
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
