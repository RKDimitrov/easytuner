import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Data organization options (WinOLS-style)
export const DATA_ORGANIZATION_OPTIONS = [
  { value: 'u8', label: '8 Bit', elementSize: 1 },
  { value: 'u16le', label: '16 Bit (LoHi)', elementSize: 2 },
  { value: 'u16be', label: '16 Bit (HiLo)', elementSize: 2 },
  { value: 'u32le', label: '32 Bit (LoHi)', elementSize: 4 },
  { value: 'u32be', label: '32 Bit (HiLo)', elementSize: 4 },
  { value: 'float32le', label: '32 Bit Float (LoHi)', elementSize: 4 },
  { value: 'float32be', label: '32 Bit Float (HiLo)', elementSize: 4 },
  { value: 'float64le', label: '64 Bit Float (LoHi)', elementSize: 8 },
  { value: 'float64be', label: '64 Bit Float (HiLo)', elementSize: 8 },
] as const

// Types
export interface MapCandidate {
  id: string
  type: 'single' | '1D' | '2D' | '3D'
  offset: number
  confidence: number
  size: number
  dimensions?: { x: number; y: number; z?: number }
  data?: number[]
  dataType?: string  // e.g., 'u16le', 'u32be', 'float32le'
  elementSize?: number  // bytes per element
  // Optional display/config (WinOLS-style)
  name?: string
  description?: string
  unit?: string
  mapId?: string
  skipBytesPerLine?: number
  skipBytes?: number
  numberFormat?: 'decimal' | 'hex' | 'system'
  sign?: boolean
  difference?: boolean
  originalValues?: boolean
  percent?: boolean
  factor?: number
  offsetValue?: number
  reciprocal?: boolean
  precision?: number
  valueRangeMin?: number
  valueRangeMax?: number
  mirrorMap?: boolean
  xAxis?: AxisConfig
  yAxis?: AxisConfig
  /** When true, the first row of the grid is used as x-axis labels (RPM/breakpoints); data grid shows only rows 1..y-1. Axes remain editable. */
  firstRowIsXAxis?: boolean
  comment?: string
  /** Cell overrides: key "row,col" => value (for display/edit without writing binary yet) */
  dataOverrides?: Record<string, number>
}

/** Data source for axis: Eprom (read from file) or editable (user-defined values) */
export type AxisDataSource = 'eprom' | 'editable_numbers' | 'editable_texts'

export interface AxisConfig {
  description?: string
  unit?: string
  axisId?: string
  dataSource?: AxisDataSource
  address?: number
  count?: number
  dataType?: string
  factor?: number
  offsetValue?: number
  reciprocal?: boolean
  precision?: number
  /** User-editable axis breakpoint values (e.g. RPM); used when dataSource is editable_numbers */
  axisValues?: number[]
}

export interface Bookmark {
  id: string
  offset: number
  label: string
  color: 'destructive' | 'warning' | 'success'
}

export interface Annotation {
  id: string
  offset: number
  length: number
  label: string
  verified: boolean
}

// State interface
interface AnalysisState {
  // File data
  fileData: Uint8Array | null
  fileName: string
  fileSize: number
  fileId: string | null  // Backend file ID
  
  // Analysis results
  candidates: MapCandidate[]
  selectedCandidate: MapCandidate | null
  
  // User-created maps (custom maps, shown in "My Maps" section)
  userMaps: MapCandidate[]
  
  /** Replace user maps (e.g. when loading from persistence for current file) */
  setUserMaps: (maps: MapCandidate[]) => void
  
  // User annotations
  bookmarks: Bookmark[]
  annotations: Annotation[]
  
  // UI state
  isScanning: boolean
  scanProgress: number
  tosAccepted: boolean
  legalAttestation: boolean
  scanId: string | null
  
  // Actions
  setFileData: (data: Uint8Array, name: string, fileId?: string | null) => void
  clearFileData: () => void
  
  setCandidates: (candidates: MapCandidate[]) => void
  setSelectedCandidate: (candidate: MapCandidate | null) => void
  updateCandidate: (id: string, updates: Partial<MapCandidate>) => void
  
  addUserMap: (map: Omit<MapCandidate, 'id'>) => void
  updateUserMap: (id: string, updates: Partial<MapCandidate>) => void
  removeUserMap: (id: string) => void
  
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => void
  removeBookmark: (id: string) => void
  
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void
  removeAnnotation: (id: string) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  
  setIsScanning: (isScanning: boolean) => void
  setScanProgress: (progress: number) => void
  setScanId: (id: string | null) => void
  
  setTosAccepted: (accepted: boolean) => void
  setLegalAttestation: (attested: boolean) => void
  
  reset: () => void
}

const initialState = {
  fileData: null,
  fileName: '',
  fileSize: 0,
  fileId: null,
  candidates: [],
  selectedCandidate: null,
  userMaps: [],
  bookmarks: [],
  annotations: [],
  isScanning: false,
  scanProgress: 0,
  tosAccepted: false,
  legalAttestation: false,
  scanId: null,
}

export const useAnalysisStore = create<AnalysisState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setFileData: (data, name, fileId = null) => set({
        fileData: data,
        fileName: name,
        fileSize: data.byteLength,
        fileId: fileId,
      }),
      
      clearFileData: () => set({
        fileData: null,
        fileName: '',
        fileSize: 0,
        fileId: null,
        candidates: [],
        selectedCandidate: null,
        userMaps: [],
        bookmarks: [],
        annotations: [],
        scanId: null,
      }),
      
      setCandidates: (candidates) => set({ candidates }),
      
      setSelectedCandidate: (candidate) => set({ selectedCandidate: candidate }),
      
      updateCandidate: (id, updates) => set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        selectedCandidate:
          state.selectedCandidate?.id === id
            ? { ...state.selectedCandidate, ...updates }
            : state.selectedCandidate,
      })),
      
      addUserMap: (map) => set((state) => ({
        userMaps: [
          ...state.userMaps,
          { ...map, id: (map as MapCandidate).id || crypto.randomUUID(), confidence: 100 } as MapCandidate,
        ],
      })),
      
      updateUserMap: (id, updates) => set((state) => ({
        userMaps: state.userMaps.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
        selectedCandidate:
          state.selectedCandidate?.id === id
            ? { ...state.selectedCandidate, ...updates }
            : state.selectedCandidate,
      })),
      
      removeUserMap: (id) => set((state) => ({
        userMaps: state.userMaps.filter((m) => m.id !== id),
        selectedCandidate:
          state.selectedCandidate?.id === id ? null : state.selectedCandidate,
      })),
      
      setUserMaps: (maps) => set({ userMaps: maps }),
      
      addBookmark: (bookmark) => set((state) => ({
        bookmarks: [
          ...state.bookmarks,
          { ...bookmark, id: crypto.randomUUID() }
        ],
      })),
      
      removeBookmark: (id) => set((state) => ({
        bookmarks: state.bookmarks.filter(b => b.id !== id),
      })),
      
      addAnnotation: (annotation) => set((state) => ({
        annotations: [
          ...state.annotations,
          { ...annotation, id: crypto.randomUUID() }
        ],
      })),
      
      removeAnnotation: (id) => set((state) => ({
        annotations: state.annotations.filter(a => a.id !== id),
      })),
      
      updateAnnotation: (id, updates) => set((state) => ({
        annotations: state.annotations.map(a => 
          a.id === id ? { ...a, ...updates } : a
        ),
      })),
      
      setIsScanning: (isScanning) => set({ isScanning }),
      
      setScanProgress: (progress) => set({ scanProgress: progress }),
      
      setScanId: (id) => set({ scanId: id }),
      
      setTosAccepted: (accepted) => set({ tosAccepted: accepted }),
      
      setLegalAttestation: (attested) => set({ legalAttestation: attested }),
      
      reset: () => set(initialState),
    }),
    { name: 'analysis-store' }
  )
)

