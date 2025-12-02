/**
 * Project Store
 * 
 * Manages project state using Zustand.
 * Handles project CRUD operations and state management.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { 
  Project, 
  CreateProjectData, 
  UpdateProjectData 
} from '../types/project'
import {
  getProjects,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  deleteProject as deleteProjectApi,
} from '../services/mockProjectService'

interface ProjectState {
  // State
  projects: Project[]
  currentProject: Project | null
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchProjects: () => Promise<void>
  createProject: (data: CreateProjectData) => Promise<Project>
  updateProject: (projectId: string, updates: UpdateProjectData) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  setCurrentProject: (project: Project | null) => void
  clearError: () => void
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set) => ({
      // Initial state
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,
      
      // Fetch all projects
      fetchProjects: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await getProjects()
          set({ 
            projects: response.projects, 
            isLoading: false 
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch projects'
          set({ 
            error: message, 
            isLoading: false 
          })
        }
      },
      
      // Create new project
      createProject: async (data: CreateProjectData) => {
        set({ isLoading: true, error: null })
        try {
          const newProject = await createProjectApi(data)
          // Optimistic update - add to beginning of list
          set(state => ({ 
            projects: [newProject, ...state.projects],
            isLoading: false 
          }))
          return newProject
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create project'
          set({ 
            error: message, 
            isLoading: false 
          })
          throw error
        }
      },
      
      // Update existing project
      updateProject: async (projectId: string, updates: UpdateProjectData) => {
        // Store original state for rollback
        const originalProjects = useProjectStore.getState().projects
        const originalCurrentProject = useProjectStore.getState().currentProject
        
        // Optimistic update
        set(state => ({
          projects: state.projects.map(p => 
            p.project_id === projectId ? { ...p, ...updates } : p
          ),
          currentProject: state.currentProject?.project_id === projectId 
            ? { ...state.currentProject, ...updates }
            : state.currentProject,
          isLoading: true,
          error: null
        }))
        
        try {
          const updatedProject = await updateProjectApi(projectId, updates)
          // Update with actual server response
          set(state => ({
            projects: state.projects.map(p => 
              p.project_id === projectId ? updatedProject : p
            ),
            currentProject: state.currentProject?.project_id === projectId 
              ? updatedProject 
              : state.currentProject,
            isLoading: false
          }))
        } catch (error) {
          // Rollback on error
          set({
            projects: originalProjects,
            currentProject: originalCurrentProject,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to update project'
          })
          throw error
        }
      },
      
      // Delete project (soft delete)
      deleteProject: async (projectId: string) => {
        // Store original state for rollback
        const originalProjects = useProjectStore.getState().projects
        const originalCurrentProject = useProjectStore.getState().currentProject
        
        // Optimistic removal
        set(state => ({
          projects: state.projects.filter(p => p.project_id !== projectId),
          currentProject: state.currentProject?.project_id === projectId 
            ? null 
            : state.currentProject,
          isLoading: true,
          error: null
        }))
        
        try {
          await deleteProjectApi(projectId)
          set({ isLoading: false })
        } catch (error) {
          // Rollback on error
          set({
            projects: originalProjects,
            currentProject: originalCurrentProject,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to delete project'
          })
          throw error
        }
      },
      
      // Set current project
      setCurrentProject: (project: Project | null) => {
        set({ currentProject: project })
      },
      
      // Clear error
      clearError: () => {
        set({ error: null })
      },
    }),
    { name: 'ProjectStore' }
  )
)

