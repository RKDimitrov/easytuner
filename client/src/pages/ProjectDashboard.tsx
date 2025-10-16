/**
 * ProjectDashboard Page
 * 
 * Main project management dashboard.
 * Shows all user projects with search, sort, and create functionality.
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Folder, AlertCircle, RefreshCw } from 'lucide-react'
import { Header } from '../components/Header'
import { ProjectCard } from '../components/ProjectCard'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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

/**
 * Filter and sort projects
 */
function filterAndSort(
  projects: Project[],
  searchTerm: string,
  sortBy: SortOption
): Project[] {
  // Filter by search term
  let filtered = projects
  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = projects.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term)
    )
  }
  
  // Sort
  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'lastModified':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      default:
        return 0
    }
  })
}

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
      <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
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
  const navigate = useNavigate()
  const { projects, isLoading, error, fetchProjects } = useProjectStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('lastModified')

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    return filterAndSort(projects, searchTerm, sortBy)
  }, [projects, searchTerm, sortBy])

  // Navigate to project detail (placeholder for now)
  const handleProjectClick = (project: Project) => {
    navigate(`/projects/${project.project_id}`)
  }

  // Create project (placeholder for now - will be modal in Story 02)
  const handleCreateProject = () => {
    // TODO: Open create project modal (Epic 08 Story 02)
    alert('Create project modal will be implemented in Story 02')
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

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Sort Dropdown */}
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
          searchTerm ? (
            <EmptySearchState searchTerm={searchTerm} />
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

