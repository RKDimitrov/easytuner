import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Types
export interface MapCandidate {
  id: string
  type: '1D' | '2D' | '3D'
  offset: number
  confidence: number
  size: number
  dimensions?: { x: number; y: number; z?: number }
  data?: number[]
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
        bookmarks: [],
        annotations: [],
        scanId: null,
      }),
      
      setCandidates: (candidates) => set({ candidates }),
      
      setSelectedCandidate: (candidate) => set({ selectedCandidate: candidate }),
      
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

