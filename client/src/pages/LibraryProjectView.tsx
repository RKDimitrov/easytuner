/**
 * Library Project View – read-only view of a published project.
 * Shows description, files, and scan results (detected maps).
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { usePageTitle } from '../hooks/usePageTitle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton } from '../components/ui/skeleton'
import { getLibraryProject, type LibraryProjectDetail } from '../services/libraryService'
import { getAvatarUrl } from '../services/authService'
import { formatBytes } from '../lib/utils'
import { ArrowLeft, FileCode, FileText, Globe, Calendar, Map, User } from 'lucide-react'

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 1) return 'Today'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

export function LibraryProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<LibraryProjectDetail | null>(null)
  usePageTitle(project ? `Library - ${project.name}` : 'Library')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    getLibraryProject(projectId)
      .then((data) => {
        if (!cancelled) setProject(data)
      })
      .catch(() => {
        if (!cancelled) setProject(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId])

  if (loading || !projectId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Project not found</h1>
          <p className="text-muted-foreground mb-4">This project may be unpublished or does not exist.</p>
          <Button asChild variant="outline">
            <Link to="/library">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
          <Link to="/library" className="hover:text-foreground">
            Library
          </Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </nav>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{project.name}</CardTitle>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Published
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-muted-foreground">{project.description}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {project.owner_avatar_url ? (
                  <img
                    src={getAvatarUrl(project.owner_avatar_url) ?? ''}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                    width={32}
                    height={32}
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Author</p>
                  <p className="truncate font-medium">{project.owner_display_name || project.owner_email?.split('@')[0] || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <span>{project.file_count} files</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Published {project.published_at ? formatRelativeTime(project.published_at) : ''}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="files" className="space-y-6">
          <TabsList>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="description" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Description
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>Files ({project.files.length})</CardTitle>
                <CardDescription>Click View maps to see detected calibration maps for a file</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Scan</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.files.map((file) => (
                      <TableRow key={file.file_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-muted-foreground" />
                            {file.filename}
                          </div>
                        </TableCell>
                        <TableCell>{formatBytes(file.size_bytes)}</TableCell>
                        <TableCell>{formatRelativeTime(file.uploaded_at)}</TableCell>
                        <TableCell>
                          {file.has_scan ? (
                            <Badge variant="default">
                              {file.candidates_count} map{file.candidates_count !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not scanned</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {file.has_scan && (
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/library/${projectId}/file/${file.file_id}`}>
                                <Map className="w-4 h-4 mr-2" />
                                View hex & maps
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="description">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                {project.description ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
                ) : (
                  <p className="text-muted-foreground italic">No description.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button variant="outline" asChild>
            <Link to="/library">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
