/**
 * ProjectDashboard Page
 * 
 * Main project management dashboard.
 * Shows all user projects with advanced search, filtering, sort, and create functionality.
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Folder, AlertCircle, RefreshCw, Search as SearchIcon } from 'lucide-react'
import { Header } from '../components/Header'
import { usePageTitle } from '../hooks/usePageTitle'
import { ProjectCard } from '../components/ProjectCard'
import { CreateProjectModal } from '../components/CreateProjectModal'
import { ProjectFilters } from '../components/ProjectFilters'
import type { ProjectFilters as ProjectFiltersType } from '../types/project'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardContent } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { useProjectStore } from '../store/projectStore'
import { Project, SortOption } from '../types/project'
import { filterAndSortProjects, debounce } from '../lib/projectFilters'


/**
 * Empty state - No projects yet
 */
function EmptyProjectsState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <Card className="p-12 text-center">
      <Folder className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Create your first project to start analyzing firmware files
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Project
      </Button>
    </Card>
  )
}

/**
 * Empty state - No search results
 */
function EmptySearchState({ searchTerm }: { searchTerm: string }) {
  return (
    <Card className="p-12 text-center">
      <SearchIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">No projects found</h3>
      <p className="text-muted-foreground">
        No projects match "{searchTerm}"
      </p>
    </Card>
  )
}

/**
 * Error state
 */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-12 text-center border-destructive">
      <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
      <h3 className="text-xl font-semibold mb-2">Failed to load projects</h3>
      <p className="text-muted-foreground mb-6">{message}</p>
      <Button onClick={onRetry} variant="outline">
        <RefreshCw className="w-4 h-4 mr-2" />
        Try Again
      </Button>
    </Card>
  )
}

/**
 * Skeleton loader for project grid
 */
function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Main ProjectDashboard component
 */
export function ProjectDashboard() {
  usePageTitle('Projects')
  const navigate = useNavigate()
  const { projects, isLoading, error, fetchProjects } = useProjectStore()
  const [sortBy, setSortBy] = useState<SortOption>('lastModified')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [filters, setFilters] = useState<ProjectFiltersType>({
    search: '',
    dateRange: 'all',
    customDateFrom: undefined,
    customDateTo: undefined,
    fileCount: 'all',
    privacy: 'all',
  })

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Debounced filter update for search
  const debouncedSetFilters = useCallback(
    debounce((newFilters: ProjectFiltersType) => {
      setFilters(newFilters)
    }, 300),
    []
  )

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: ProjectFiltersType) => {
    // Use debounced update for search, immediate for other filters
    if (newFilters.search !== filters.search) {
      debouncedSetFilters(newFilters)
    } else {
      setFilters(newFilters)
    }
  }, [filters.search, debouncedSetFilters])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    return filterAndSortProjects(projects, filters, sortBy)
  }, [projects, filters, sortBy])

  // Navigate to project detail (placeholder for now)
  const handleProjectClick = (project: Project) => {
    navigate(`/projects/${project.project_id}`)
  }

  // Create project
  const handleCreateProject = () => {
    setEditingProject(null)
    setShowCreateModal(true)
  }

  // Edit project
  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setShowCreateModal(true)
  }

  // Delete project - this will be handled by the modal's delete functionality
  const handleDeleteProject = (project: Project) => {
    // The delete functionality is built into the CreateProjectModal
    // We just need to open it in edit mode and the user can delete from there
    setEditingProject(project)
    setShowCreateModal(true)
  }

  // Handle modal close
  const handleModalClose = (open: boolean) => {
    if (!open) {
      setShowCreateModal(false)
      setEditingProject(null)
    }
  }

  // Handle modal success
  const handleModalSuccess = () => {
    // Projects will be updated optimistically by the store
    // No need to refetch
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage your firmware analysis projects
            </p>
          </div>
          <Button onClick={handleCreateProject}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Advanced Filters */}
        <div className="mb-6">
          <ProjectFilters
            onFiltersChange={handleFiltersChange}
            resultCount={filteredProjects.length}
            totalCount={projects.length}
          />
        </div>

        {/* Sort Controls */}
        <div className="flex justify-end mb-6">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastModified">Last Modified</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Project Grid / States */}
        {isLoading ? (
          <ProjectGridSkeleton count={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchProjects} />
        ) : filteredProjects.length === 0 ? (
          filters.search ? (
            <EmptySearchState searchTerm={filters.search} />
          ) : (
            <EmptyProjectsState onCreateClick={handleCreateProject} />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.project_id}
                project={project}
                onClick={() => handleProjectClick(project)}
                onEdit={handleEditProject}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Project Modal */}
      <CreateProjectModal
        open={showCreateModal || !!editingProject}
        onOpenChange={handleModalClose}
        project={editingProject || undefined}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}

