/**
 * Dashboard Page
 * 
 * Overview page showing recent activity, statistics, and quick actions
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useProjectStore } from '../store/projectStore'
import { 
  FileCode, 
  Activity, 
  TrendingUp, 
  Clock,
  Plus,
  ArrowRight,
  FolderOpen
} from 'lucide-react'

export function Dashboard() {
  const { projects, fetchProjects, isLoading } = useProjectStore()

  useEffect(() => {
    if (projects.length === 0 && !isLoading) {
      fetchProjects()
    }
  }, [projects.length, isLoading, fetchProjects])

  const totalFiles = projects.reduce((sum, p) => sum + (p.file_count || 0), 0)
  const recentProjects = projects.slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Overview of your ECU map recognition workspace
              </p>
            </div>
            <Button asChild>
              <Link to="/projects">
                <FolderOpen className="w-4 h-4 mr-2" />
                View All Projects
              </Link>
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active projects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                <FileCode className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalFiles}</div>
                <p className="text-xs text-muted-foreground">
                  Firmware files uploaded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {projects.filter(p => {
                    const updated = new Date(p.updated_at)
                    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
                    return updated > dayAgo
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Projects updated today
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Projects */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>
                  Your most recently updated projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No projects yet</p>
                    <Button asChild>
                      <Link to="/projects">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Project
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentProjects.map((project) => (
                      <Link
                        key={project.project_id}
                        to={`/projects/${project.project_id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <FolderOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{project.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {project.file_count || 0} files
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/projects">
                        View All Projects
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/projects">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Project
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/library">
                      <FileCode className="w-4 h-4 mr-2" />
                      Browse Map Library
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/settings">
                      <Activity className="w-4 h-4 mr-2" />
                      Settings & Preferences
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

