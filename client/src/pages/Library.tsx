/**
 * Library Page
 *
 * Browse published projects from the community.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { usePageTitle } from '../hooks/usePageTitle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { getLibraryProjects, type LibraryProjectSummary } from '../services/libraryService'
import { BookOpen, Search, FileCode, Calendar, User } from 'lucide-react'

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

export function Library() {
  usePageTitle('Library')
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    getLibraryProjects({ limit: 50, offset: 0 })
      .then((res) => {
        if (!cancelled) setProjects(res.projects)
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filtered = search.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : projects

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Library</h1>
              <p className="text-muted-foreground mt-1">
                Browse published projects and view scanned maps from the community
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <>
              <Card className="border-dashed">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {projects.length === 0 ? 'No published projects yet' : 'No matches'}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-4">
                      {projects.length === 0
                        ? 'When users publish their public projects, they will appear here.'
                        : 'Try a different search term.'}
                    </p>
                    {projects.length === 0 && (
                      <div className="mt-6 p-4 bg-muted/50 rounded-lg max-w-lg mx-auto text-left text-sm">
                        <p className="font-medium mb-2">How to publish a project:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Open your project from <strong>Projects</strong></li>
                          <li>Click <strong>Edit Project</strong></li>
                          <li>Turn off <strong>Private Project</strong> and save</li>
                          <li>Click <strong>Publish to Library</strong> (next to Edit Project)</li>
                        </ol>
                        <p className="mt-2 text-muted-foreground">Then it will show up here and others can view its files and maps.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <Link key={p.project_id} to={`/library/${p.project_id}`}>
                  <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode className="w-5 h-5 text-primary shrink-0" />
                          <CardTitle className="text-base truncate">{p.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {p.file_count} file{p.file_count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {p.description && (
                        <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {p.owner_email?.split('@')[0] || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {p.published_at ? formatRelativeTime(p.published_at) : ''}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" className="mt-3 w-full">
                        View project
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
