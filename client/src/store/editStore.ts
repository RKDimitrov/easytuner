import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type DataType = 'u8' | 'u16le' | 'u16be' | 'u32le' | 'u32be'

export interface Edit {
  offset: number
  value: number
  dataType: DataType
  originalValue: number
  timestamp: number
}

interface EditState {
  // Pending edits (not yet saved)
  edits: Map<number, Edit>
  
  // Edit count (for reactivity - Zustand doesn't always detect Map changes)
  editCount: number
  
  // Original file data
  originalFileData: Uint8Array | null
  
  // Modified file data (with edits applied locally)
  modifiedFileData: Uint8Array | null
  
  // File ID
  fileId: string | null
  
  // State flags
  isDirty: boolean
  isSaving: boolean
  
  // Actions
  setFile: (fileId: string, fileData: Uint8Array) => void
  addEdit: (offset: number, value: number, dataType: DataType, originalValue: number) => void
  removeEdit: (offset: number) => void
  clearEdits: () => void
  applyEditsLocally: () => void
  reset: () => void
  setIsSaving: (isSaving: boolean) => void
}

// Helper function to apply a single edit to file data
function applyEditToData(
  data: Uint8Array,
  offset: number,
  value: number,
  dataType: DataType
): Uint8Array {
  // Create a new Uint8Array with a new buffer to avoid type issues
  const buffer = new ArrayBuffer(data.length)
  const result = new Uint8Array(buffer)
  result.set(data)
  
  switch (dataType) {
    case 'u8':
      if (offset < result.length) {
        result[offset] = value & 0xFF
      }
      break
      
    case 'u16le':
      if (offset + 1 < result.length) {
        result[offset] = value & 0xFF
        result[offset + 1] = (value >> 8) & 0xFF
      }
      break
      
    case 'u16be':
      if (offset + 1 < result.length) {
        result[offset] = (value >> 8) & 0xFF
        result[offset + 1] = value & 0xFF
      }
      break
      
    case 'u32le':
      if (offset + 3 < result.length) {
        result[offset] = value & 0xFF
        result[offset + 1] = (value >> 8) & 0xFF
        result[offset + 2] = (value >> 16) & 0xFF
        result[offset + 3] = (value >> 24) & 0xFF
      }
      break
      
    case 'u32be':
      if (offset + 3 < result.length) {
        result[offset] = (value >> 24) & 0xFF
        result[offset + 1] = (value >> 16) & 0xFF
        result[offset + 2] = (value >> 8) & 0xFF
        result[offset + 3] = value & 0xFF
      }
      break
  }
  
  return result
}

// Helper function to read a value from file data
export function readValueFromData(
  data: Uint8Array,
  offset: number,
  dataType: DataType
): number | null {
  if (offset >= data.length) return null
  
  switch (dataType) {
    case 'u8':
      return data[offset]
      
    case 'u16le':
      if (offset + 1 >= data.length) return null
      return data[offset] | (data[offset + 1] << 8)
      
    case 'u16be':
      if (offset + 1 >= data.length) return null
      return (data[offset] << 8) | data[offset + 1]
      
    case 'u32le':
      if (offset + 3 >= data.length) return null
      return (
        data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24)
      ) >>> 0  // Convert to unsigned 32-bit
      
    case 'u32be':
      if (offset + 3 >= data.length) return null
      return (
        (data[offset] << 24) |
        (data[offset + 1] << 16) |
        (data[offset + 2] << 8) |
        data[offset + 3]
      ) >>> 0  // Convert to unsigned 32-bit
      
    default:
      return null
  }
}

export const useEditStore = create<EditState>()(
  devtools(
    (set, get) => ({
      edits: new Map(),
      editCount: 0,
      originalFileData: null,
      modifiedFileData: null,
      fileId: null,
      isDirty: false,
      isSaving: false,
      
      setFile: (fileId, fileData) => {
        const state = get()
        // Preserve edits if it's the same file
        const preserveEdits = state.fileId === fileId && state.edits.size > 0
        
        set({
          fileId,
          originalFileData: fileData,
          // If preserving edits, apply them to the new file data
          modifiedFileData: preserveEdits ? (() => {
            let data = new Uint8Array(fileData.buffer.slice(0))
            const sortedEdits = Array.from(state.edits.values()).sort(
              (a, b) => a.offset - b.offset
            )
            sortedEdits.forEach(edit => {
              data = applyEditToData(data, edit.offset, edit.value, edit.dataType)
            })
            return data
          })() : fileData,
          // Only clear edits if it's a different file
          edits: preserveEdits ? state.edits : new Map(),
          editCount: preserveEdits ? state.editCount : 0,
          isDirty: preserveEdits ? state.isDirty : false,
        })
      },
      
      addEdit: (offset, value, dataType, originalValue) => {
        const state = get()
        const newEdits = new Map(state.edits)
        
        // Determine which offsets are affected by this edit
        const affectedOffsets: number[] = [offset]
        const size = dataType === 'u8' ? 1 : dataType.includes('16') ? 2 : 4
        for (let i = 1; i < size; i++) {
          affectedOffsets.push(offset + i)
        }
        
        // Remove any existing edits that overlap with this one
        affectedOffsets.forEach(off => {
          newEdits.delete(off)
        })
        
        // Add new edit
        newEdits.set(offset, {
          offset,
          value,
          dataType,
          originalValue,
          timestamp: Date.now(),
        })
        
        set({
          edits: newEdits,
          editCount: newEdits.size,
          isDirty: true,
        })
        
        // Apply edits locally to update preview
        get().applyEditsLocally()
      },
      
      removeEdit: (offset) => {
        const state = get()
        const newEdits = new Map(state.edits)
        newEdits.delete(offset)
        
        set({
          edits: newEdits,
          editCount: newEdits.size,
          isDirty: newEdits.size > 0,
        })
        
        // Reapply remaining edits
        get().applyEditsLocally()
      },
      
      clearEdits: () => {
        set({
          edits: new Map(),
          editCount: 0,
          modifiedFileData: get().originalFileData,
          isDirty: false,
        })
      },
      
      applyEditsLocally: () => {
        const state = get()
        if (!state.originalFileData) return
        
        // Create a copy of the original data
        const buffer = new ArrayBuffer(state.originalFileData.length)
        const data = new Uint8Array(buffer)
        data.set(state.originalFileData)
        
        // Apply all edits in order
        const sortedEdits = Array.from(state.edits.values()).sort(
          (a, b) => a.offset - b.offset
        )
        
        let modifiedData: Uint8Array = data
        sortedEdits.forEach(edit => {
          const result = applyEditToData(modifiedData, edit.offset, edit.value, edit.dataType)
          // Ensure we have a proper ArrayBuffer-backed Uint8Array
          const buffer = new ArrayBuffer(result.length)
          modifiedData = new Uint8Array(buffer)
          modifiedData.set(result)
        })
        
        set({
          modifiedFileData: modifiedData,
        })
      },
      
      reset: () => {
        set({
          edits: new Map(),
          editCount: 0,
          originalFileData: null,
          modifiedFileData: null,
          fileId: null,
          isDirty: false,
          isSaving: false,
        })
      },
      
      setIsSaving: (isSaving) => {
        set({ isSaving })
      },
    }),
    { name: 'edit-store' }
  )
)

