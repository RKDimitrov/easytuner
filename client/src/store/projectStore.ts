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
} from '../services/projectService'

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
        set({ isLoading: true, error: null })
        try {
          const updatedProject = await updateProjectApi(projectId, updates)
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
          const message = error instanceof Error ? error.message : 'Failed to update project'
          set({ 
            error: message, 
            isLoading: false 
          })
          throw error
        }
      },
      
      // Delete project (soft delete)
      deleteProject: async (projectId: string) => {
        set({ isLoading: true, error: null })
        try {
          await deleteProjectApi(projectId)
          set(state => ({
            projects: state.projects.filter(p => p.project_id !== projectId),
            currentProject: state.currentProject?.project_id === projectId 
              ? null 
              : state.currentProject,
            isLoading: false
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete project'
          set({ 
            error: message, 
            isLoading: false 
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

