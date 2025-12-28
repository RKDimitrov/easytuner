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
import type { ChecksumConfig } from '../services/editService'

interface ChecksumConfigDialogProps {
  open: boolean
  onClose: () => void
  onSave: (config: ChecksumConfig) => void
  fileSize: number
  defaultConfig?: Partial<ChecksumConfig>
}

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

export function ChecksumConfigDialog({
  open,
  onClose,
  onSave,
  fileSize,
  defaultConfig,
}: ChecksumConfigDialogProps) {
  // Calculate smart defaults
  const smartDefaults = calculateSmartDefaults(fileSize, defaultConfig?.checksum_size || 2)
  
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
    defaultConfig?.algorithm === 'modular'
  )

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
    const moduloValue = enableModulo && algorithm === 'modular' ? parseHex(modulo) : undefined

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
                <SelectItem value="modular">Modular Sum</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {algorithm === 'simple_sum' && 'Sum of all bytes in range'}
              {algorithm === 'crc16' && 'CRC-16-CCITT polynomial (0x1021)'}
              {algorithm === 'crc32' && 'CRC-32 IEEE 802.3 polynomial'}
              {algorithm === 'xor' && 'XOR of all bytes in range'}
              {algorithm === 'twos_complement' && 'Two\'s complement of sum'}
              {algorithm === 'modular' && 'Sum modulo specified value'}
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

          {/* Modulo (for modular algorithm) */}
          {algorithm === 'modular' && (
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
                  placeholder="0xFFFF"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Modulo value (hex). Common: 0xFFFF (65535) or 0x10000 (65536)
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

