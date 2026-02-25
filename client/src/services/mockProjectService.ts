/**
 * Mock Project Service
 * 
 * Frontend-only project service using localStorage for persistence.
 * This will be replaced when backend project endpoints are implemented.
 */

import { 
  Project, 
  CreateProjectData, 
  UpdateProjectData,
  ProjectsResponse 
} from '../types/project'

const STORAGE_KEY = 'easytuner_projects'
const MOCK_USER_ID = 'mock-user-123'

/**
 * Get projects from localStorage
 */
function getStoredProjects(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load projects from localStorage:', error)
    return []
  }
}

/**
 * Save projects to localStorage
 */
function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch (error) {
    console.error('Failed to save projects to localStorage:', error)
  }
}

/**
 * Generate a mock project ID
 */
function generateProjectId(): string {
  return `mock-project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * List all projects for the authenticated user
 * GET /api/v1/projects
 */
export async function getProjects(
  limit?: number
): Promise<ProjectsResponse> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const projects = getStoredProjects()
    
    // Apply pagination if needed
    let result = projects
    if (limit) {
      result = projects.slice(0, limit)
    }
    
    return {
      projects: result,
      pagination: {
        next_cursor: null,
        has_more: false
      }
    }
  } catch (error) {
    throw new Error('Failed to fetch projects')
  }
}

/**
 * Get a single project by ID
 * GET /api/v1/projects/{project_id}
 */
export async function getProject(projectId: string): Promise<Project> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const projects = getStoredProjects()
    const project = projects.find(p => p.project_id === projectId)
    
    if (!project) {
      throw new Error('Project not found')
    }
    
    return project
  } catch (error) {
    throw new Error('Failed to fetch project')
  }
}

/**
 * Create a new project
 * POST /api/v1/projects
 */
export async function createProject(data: CreateProjectData): Promise<Project> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const projects = getStoredProjects()
    
    const newProject: Project = {
      project_id: generateProjectId(),
      owner_user_id: MOCK_USER_ID,
      name: data.name,
      description: data.description || null,
      is_private: data.is_private || false,
      published_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      file_count: 0
    }
    
    // Add to projects list
    projects.unshift(newProject) // Add to beginning
    saveProjects(projects)
    
    return newProject
  } catch (error) {
    throw new Error('Failed to create project')
  }
}

/**
 * Update an existing project
 * PATCH /api/v1/projects/{project_id}
 */
export async function updateProject(
  projectId: string, 
  updates: UpdateProjectData
): Promise<Project> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400))
    
    const projects = getStoredProjects()
    const projectIndex = projects.findIndex(p => p.project_id === projectId)
    
    if (projectIndex === -1) {
      throw new Error('Project not found')
    }
    
    // Update project
    const updatedProject: Project = {
      ...projects[projectIndex],
      ...updates,
      updated_at: new Date().toISOString()
    }
    
    projects[projectIndex] = updatedProject
    saveProjects(projects)
    
    return updatedProject
  } catch (error) {
    throw new Error('Failed to update project')
  }
}

/**
 * Delete a project (soft delete)
 * DELETE /api/v1/projects/{project_id}
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const projects = getStoredProjects()
    const filteredProjects = projects.filter(p => p.project_id !== projectId)
    
    if (filteredProjects.length === projects.length) {
      throw new Error('Project not found')
    }
    
    saveProjects(filteredProjects)
  } catch (error) {
    throw new Error('Failed to delete project')
  }
}

/**
 * Add a file to a project (for upload integration)
 */
export async function addFileToProject(projectId: string): Promise<void> {
  try {
    const projects = getStoredProjects()
    const projectIndex = projects.findIndex(p => p.project_id === projectId)
    
    if (projectIndex === -1) {
      throw new Error('Project not found')
    }
    
    // Increment file count
    projects[projectIndex] = {
      ...projects[projectIndex],
      file_count: (projects[projectIndex].file_count || 0) + 1,
      updated_at: new Date().toISOString()
    }
    
    saveProjects(projects)
  } catch (error) {
    console.error('Failed to add file to project:', error)
  }
}

/**
 * Initialize with some sample projects for demo purposes
 */
export function initializeSampleProjects(): void {
  const existingProjects = getStoredProjects()
  
  if (existingProjects.length === 0) {
    const sampleProjects: Project[] = [
      {
        project_id: 'sample-1',
        owner_user_id: MOCK_USER_ID,
        name: 'ECU Firmware Analysis',
        description: 'Analysis of automotive ECU firmware for security vulnerabilities',
        is_private: false,
        published_at: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T15:30:00Z',
        file_count: 3
      },
      {
        project_id: 'sample-2',
        owner_user_id: MOCK_USER_ID,
        name: 'Private Research',
        description: 'Confidential research project',
        is_private: true,
        published_at: null,
        created_at: '2024-01-10T09:00:00Z',
        updated_at: '2024-01-18T12:00:00Z',
        file_count: 7
      },
      {
        project_id: 'sample-3',
        owner_user_id: MOCK_USER_ID,
        name: 'Test Project',
        description: 'Empty test project for demonstration',
        is_private: false,
        published_at: null,
        created_at: '2024-01-25T14:00:00Z',
        updated_at: '2024-01-25T14:00:00Z',
        file_count: 0
      }
    ]
    
    saveProjects(sampleProjects)
    console.log('Initialized sample projects for demo')
  }
}
