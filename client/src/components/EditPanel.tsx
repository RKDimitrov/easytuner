import { useState, useEffect } from 'react'
import { useEditStore, DataType, readValueFromData } from '../store/editStore'
import { useAnalysisStore } from '../store/analysisStore'
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
import { formatHexOffset } from '../lib/utils'
import { X } from 'lucide-react'

interface EditPanelProps {
  offset: number | null
  onClose: () => void
}

export function EditPanel({ offset, onClose }: EditPanelProps) {
  const fileData = useAnalysisStore((state) => state.fileData)
  const fileId = useAnalysisStore((state) => state.fileId)
  const { addEdit, edits } = useEditStore()
  
  const [dataType, setDataType] = useState<DataType>('u16le')
  const [value, setValue] = useState<number>(0)
  const [originalValue, setOriginalValue] = useState<number>(0)
  const [valueInput, setValueInput] = useState<string>('')
  const [inputMode, setInputMode] = useState<'decimal' | 'hex'>('decimal')
  
  // Load value when offset changes
  useEffect(() => {
    if (offset === null || !fileData) {
      return
    }
    
    // Read current value
    const currentValue = readValueFromData(fileData, offset, dataType)
    if (currentValue !== null) {
      setOriginalValue(currentValue)
      setValue(currentValue)
      setValueInput(currentValue.toString())
    }
  }, [offset, fileData, dataType])
  
  // Check if there's already an edit at this offset
  const existingEdit = offset !== null ? edits.get(offset) : null
  
  // Update value when data type changes
  useEffect(() => {
    if (offset === null || !fileData) return
    
    const newValue = readValueFromData(fileData, offset, dataType)
    if (newValue !== null) {
      setOriginalValue(newValue)
      // If there's an existing edit, use that value, otherwise use original
      if (existingEdit && existingEdit.dataType === dataType) {
        setValue(existingEdit.value)
        setValueInput(existingEdit.value.toString())
      } else {
        setValue(newValue)
        setValueInput(newValue.toString())
      }
    }
  }, [dataType, offset, fileData, existingEdit])
  
  const handleValueChange = (input: string) => {
    setValueInput(input)
    
    // Try to parse the value
    let parsed: number | null = null
    
    if (inputMode === 'hex') {
      // Remove 0x prefix if present
      const cleanInput = input.replace(/^0x/i, '')
      parsed = parseInt(cleanInput, 16)
    } else {
      parsed = parseInt(input, 10)
    }
    
    if (!isNaN(parsed) && parsed >= 0) {
      // Check max value for data type
      const maxValue = {
        'u8': 0xFF,
        'u16le': 0xFFFF,
        'u16be': 0xFFFF,
        'u32le': 0xFFFFFFFF,
        'u32be': 0xFFFFFFFF,
      }[dataType]
      
      if (parsed <= maxValue) {
        setValue(parsed)
      }
    }
  }
  
  const handleApply = () => {
    if (offset === null || !fileId) return
    
    // Add edit
    addEdit(offset, value, dataType, originalValue)
    
    // Close panel
    onClose()
  }
  
  const handleCancel = () => {
    onClose()
  }
  
  if (offset === null || !fileData) {
    return null
  }
  
  // Calculate value ranges
  const maxValue = {
    'u8': 0xFF,
    'u16le': 0xFFFF,
    'u16be': 0xFFFF,
    'u32le': 0xFFFFFFFF,
    'u32be': 0xFFFFFFFF,
  }[dataType]
  
  const valueHex = `0x${value.toString(16).toUpperCase().padStart(dataType === 'u8' ? 2 : dataType.includes('16') ? 4 : 8, '0')}`
  const originalValueHex = `0x${originalValue.toString(16).toUpperCase().padStart(dataType === 'u8' ? 2 : dataType.includes('16') ? 4 : 8, '0')}`
  
  // Check if value has changed
  const hasChanged = value !== originalValue || existingEdit !== null
  
  return (
    <Dialog open={offset !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Value</DialogTitle>
          <DialogDescription>
            Modify the value at offset {formatHexOffset(offset)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Address */}
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={formatHexOffset(offset)}
              disabled
              className="font-mono"
            />
          </div>
          
          {/* Data Type */}
          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select
              value={dataType}
              onValueChange={(value) => setDataType(value as DataType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="u8">8-bit (unsigned)</SelectItem>
                <SelectItem value="u16le">16-bit Little Endian</SelectItem>
                <SelectItem value="u16be">16-bit Big Endian</SelectItem>
                <SelectItem value="u32le">32-bit Little Endian</SelectItem>
                <SelectItem value="u32be">32-bit Big Endian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Original Value */}
          <div className="space-y-2">
            <Label>Original Value</Label>
            <div className="flex gap-2">
              <Input
                value={originalValue}
                disabled
                className="font-mono"
              />
              <Input
                value={originalValueHex}
                disabled
                className="font-mono w-32"
              />
            </div>
          </div>
          
          {/* New Value */}
          <div className="space-y-2">
            <Label>New Value</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex gap-1 mb-1">
                  <Button
                    variant={inputMode === 'decimal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInputMode('decimal')}
                    className="h-7 text-xs"
                  >
                    Decimal
                  </Button>
                  <Button
                    variant={inputMode === 'hex' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInputMode('hex')}
                    className="h-7 text-xs"
                  >
                    Hex
                  </Button>
                </div>
                <Input
                  value={valueInput}
                  onChange={(e) => handleValueChange(e.target.value)}
                  className="font-mono"
                  placeholder={inputMode === 'hex' ? '0x0000' : '0'}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  value={valueHex}
                  disabled
                  className="font-mono w-32"
                />
                <div className="text-xs text-muted-foreground text-center">
                  Hex
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Range: 0 - {maxValue.toString(16).toUpperCase()} (0x{maxValue.toString(16).toUpperCase()})
            </p>
          </div>
          
          {/* Change Indicator */}
          {hasChanged && (
            <div className="p-2 bg-primary/10 border border-primary/20 rounded text-sm">
              <span className="text-primary font-medium">Value changed:</span>{' '}
              {originalValue} → {value} ({originalValueHex} → {valueHex})
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasChanged}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

