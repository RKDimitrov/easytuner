/**
 * Upload Store
 * 
 * Manages upload state including project selection,
 * file upload progress, and session persistence.
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Project } from '../types/project'
import { addFileToProject } from '../services/mockProjectService'

interface UploadState {
  // Project selection
  selectedProject: Project | null
  lastUsedProject: Project | null
  
  // Upload state
  isUploading: boolean
  uploadProgress: number
  uploadError: string | null
  
  // Actions
  setSelectedProject: (project: Project | null) => void
  setLastUsedProject: (project: Project | null) => void
  setIsUploading: (isUploading: boolean) => void
  setUploadProgress: (progress: number) => void
  setUploadError: (error: string | null) => void
  clearUploadState: () => void
  associateFileWithProject: (fileName: string) => Promise<void>
  reset: () => void
}

const initialState = {
  selectedProject: null,
  lastUsedProject: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
}

export const useUploadStore = create<UploadState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        
        setSelectedProject: (project) => set((state) => ({
          selectedProject: project,
          // Update last used project when a project is selected
          lastUsedProject: project || state.lastUsedProject,
        })),
        
        setLastUsedProject: (project) => set({ lastUsedProject: project }),
        
        setIsUploading: (isUploading) => set({ isUploading }),
        
        setUploadProgress: (progress) => set({ uploadProgress: progress }),
        
        setUploadError: (error) => set({ uploadError: error }),
        
        clearUploadState: () => set({
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
        }),
        
        associateFileWithProject: async (fileName: string) => {
          const state = useUploadStore.getState()
          if (state.selectedProject) {
            try {
              await addFileToProject(state.selectedProject.project_id, fileName)
            } catch (error) {
              console.error('Failed to associate file with project:', error)
            }
          }
        },
        
        reset: () => set(initialState),
      }),
      {
        name: 'upload-store',
        // Only persist project selection, not upload state
        partialize: (state) => ({
          lastUsedProject: state.lastUsedProject,
        }),
      }
    ),
    { name: 'UploadStore' }
  )
)
