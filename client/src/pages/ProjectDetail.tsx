/**
 * ProjectDetail Page
 * 
 * Individual project detail page showing project metadata,
 * files, scans, and management options.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileCode, Calendar, Lock, Globe, Upload, Settings, Activity } from 'lucide-react'
import { Header } from '../components/Header'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { useProjectStore } from '../store/projectStore'
import { Project } from '../types/project'

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
}

/**
 * Project Header Component
 */
function ProjectHeader({ project }: { project: Project }) {
  const navigate = useNavigate()

  const handleEditProject = () => {
    // TODO: Open edit modal (Epic 08 Story 02)
    console.log('Edit project:', project.project_id)
  }

  const handleUploadFile = () => {
    // TODO: Navigate to upload with project context (Epic 08 Story 05)
    navigate(`/?project=${project.project_id}`)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <span>/</span>
        <span className="text-foreground">{project.name}</span>
      </nav>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                {project.is_private ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Private
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Public
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleEditProject}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Project
              </Button>
              <Button onClick={handleUploadFile}>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span>{project.file_count || 0} files</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Created {formatRelativeTime(project.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Updated {formatRelativeTime(project.updated_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Files Tab Content
 */
function FilesTab({ project }: { project: Project }) {
  const fileCount = project.file_count || 0

  if (fileCount === 0) {
    return (
      <Card className="p-12 text-center">
        <FileCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No files yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Upload your first firmware file to get started with analysis
        </p>
        <Button onClick={() => window.location.href = `/?project=${project.project_id}`}>
          <Upload className="w-4 h-4 mr-2" />
          Upload First File
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Files ({fileCount})</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          File management will be implemented in a future story.
          Currently showing {fileCount} files in this project.
        </p>
        {/* TODO: Implement file list table in future story */}
      </CardContent>
    </Card>
  )
}

/**
 * Scans Tab Content
 */
function ScansTab({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scans</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Scan history and results will be displayed here in a future story.
        </p>
        {/* TODO: Implement scans table in future story */}
      </CardContent>
    </Card>
  )
}

/**
 * Settings Tab Content
 */
function SettingsTab({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Project settings and configuration options will be available here.
        </p>
        {/* TODO: Implement settings form in future story */}
      </CardContent>
    </Card>
  )
}

/**
 * Activity Tab Content
 */
function ActivityTab({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Project activity and audit log will be shown here.
        </p>
        {/* TODO: Implement activity feed in future story */}
      </CardContent>
    </Card>
  )
}

/**
 * Loading Skeleton
 */
function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-2" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Project header skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

/**
 * Main ProjectDetail component
 */
export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { projects, isLoading, fetchProjects } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)

  // Fetch projects if not loaded
  useEffect(() => {
    if (projects.length === 0 && !isLoading) {
      fetchProjects()
    }
  }, [projects.length, isLoading, fetchProjects])

  // Find the specific project
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const foundProject = projects.find(p => p.project_id === projectId)
      if (foundProject) {
        setProject(foundProject)
      } else {
        // Project not found - could be 404 or access denied
        console.error('Project not found:', projectId)
      }
      setProjectLoading(false)
    }
  }, [projectId, projects])

  // Show loading state
  if (projectLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <ProjectDetailSkeleton />
        </div>
      </div>
    )
  }

  // Show 404 if project not found
  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Project Not Found</h1>
            <p className="text-muted-foreground">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <ProjectHeader project={project} />

        {/* Tabs */}
        <Tabs defaultValue="files" className="space-y-6">
          <TabsList>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="scans" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Scans
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <FilesTab project={project} />
          </TabsContent>

          <TabsContent value="scans">
            <ScansTab project={project} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab project={project} />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTab project={project} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
