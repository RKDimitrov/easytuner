/**
 * ProjectSelector Component
 * 
 * Dropdown component for selecting projects during upload.
 * Includes search functionality and inline project creation.
 */

import { useState, useEffect } from 'react'
import { Search, Plus, Folder, FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { CreateProjectModal } from './CreateProjectModal'
import { useProjectStore } from '../store/projectStore'
import { useUploadStore } from '../store/uploadStore'
import { Project } from '../types/project'

interface ProjectSelectorProps {
  onProjectChange?: (project: Project | null) => void
  disabled?: boolean
}

/**
 * Project option component for the dropdown
 */
function ProjectOption({ project, isSelected }: { project: Project; isSelected: boolean }) {
  return (
    <div className="flex items-center gap-3 p-2">
      {isSelected ? (
        <FolderOpen className="h-4 w-4 text-primary" />
      ) : (
        <Folder className="h-4 w-4 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{project.name}</div>
        {project.description && (
          <div className="text-xs text-muted-foreground truncate">
            {project.description}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {project.file_count || 0} files
      </div>
    </div>
  )
}

/**
 * Main ProjectSelector component
 */
export function ProjectSelector({ onProjectChange, disabled = false }: ProjectSelectorProps) {
  const { projects, isLoading, fetchProjects } = useProjectStore()
  const { selectedProject, setSelectedProject, lastUsedProject } = useUploadStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Set default project from last used or URL params
  useEffect(() => {
    if (!selectedProject && lastUsedProject) {
      setSelectedProject(lastUsedProject)
    }
  }, [selectedProject, lastUsedProject, setSelectedProject])

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    if (projectId === 'none') {
      setSelectedProject(null)
      onProjectChange?.(null)
    } else {
      const project = projects.find(p => p.project_id === projectId)
      if (project) {
        setSelectedProject(project)
        onProjectChange?.(project)
      }
    }
    setIsOpen(false)
  }

  // Handle project creation
  const handleCreateProject = () => {
    setShowCreateModal(true)
  }

  // Handle modal success
  const handleModalSuccess = (newProject: Project) => {
    setSelectedProject(newProject)
    onProjectChange?.(newProject)
    setShowCreateModal(false)
  }

  // Handle modal close
  const handleModalClose = (open: boolean) => {
    if (!open) {
      setShowCreateModal(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Project</Label>
        <p className="text-xs text-muted-foreground">
          Choose a project to organize your uploaded files, or upload without a project
        </p>
      </div>

      <div className="space-y-3">
        {/* Project Selection */}
        <Select
          value={selectedProject?.project_id || 'none'}
          onValueChange={handleProjectSelect}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a project...">
              {selectedProject ? (
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span>{selectedProject.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span>No Project (orphan files)</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* No Project Option */}
            <SelectItem value="none">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span>No Project (orphan files)</span>
              </div>
            </SelectItem>
            
            {/* Search Input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            
            {/* Project Options */}
            {isLoading ? (
              <SelectItem value="loading" disabled>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Loading projects...</span>
                </div>
              </SelectItem>
            ) : filteredProjects.length === 0 ? (
              <SelectItem value="no-results" disabled>
                <div className="text-center py-2 text-muted-foreground">
                  {searchTerm ? 'No projects found' : 'No projects available'}
                </div>
              </SelectItem>
            ) : (
              filteredProjects.map(project => (
                <SelectItem key={project.project_id} value={project.project_id}>
                  <ProjectOption 
                    project={project} 
                    isSelected={selectedProject?.project_id === project.project_id}
                  />
                </SelectItem>
              ))
            )}
            
            {/* Create New Project Option */}
            <div className="p-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleCreateProject}
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Project
              </Button>
            </div>
          </SelectContent>
        </Select>

        {/* Selected Project Info */}
        {selectedProject && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{selectedProject.name}</div>
                  {selectedProject.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {selectedProject.description}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedProject.file_count || 0} files
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreateModal}
        onOpenChange={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
