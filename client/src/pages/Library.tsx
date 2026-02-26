/**
 * Library Page
 *
 * Browse published projects and scanned files from the community.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  getLibraryProjects,
  getLibraryScans,
  type LibraryProjectSummary,
  type LibraryScanEntry,
} from '../services/libraryService'
import { formatBytes } from '../lib/utils'
import { BookOpen, Search, FileCode, Calendar, User, Map, Download } from 'lucide-react'

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

function formatMs(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function Library() {
  usePageTitle('Library')

  // Projects tab
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [search, setSearch] = useState('')

  // Scans tab
  const [scans, setScans] = useState<LibraryScanEntry[]>([])
  const [loadingScans, setLoadingScans] = useState(true)
  const [scanSearch, setScanSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    getLibraryProjects({ limit: 50, offset: 0 })
      .then((res) => { if (!cancelled) setProjects(res.projects) })
      .catch(() => { if (!cancelled) setProjects([]) })
      .finally(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    getLibraryScans({ limit: 100, offset: 0 })
      .then((res) => { if (!cancelled) setScans(res.scans) })
      .catch(() => { if (!cancelled) setScans([]) })
      .finally(() => { if (!cancelled) setLoadingScans(false) })
    return () => { cancelled = true }
  }, [])

  const filteredProjects = search.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : projects

  const filteredScans = scanSearch.trim()
    ? scans.filter(
        (s) =>
          s.filename.toLowerCase().includes(scanSearch.toLowerCase()) ||
          s.project_name.toLowerCase().includes(scanSearch.toLowerCase()) ||
          s.owner_email.toLowerCase().includes(scanSearch.toLowerCase())
      )
    : scans

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Library</h1>
            <p className="text-muted-foreground mt-1">
              Browse published projects and scanned firmware files from the community
            </p>
          </div>

          <Tabs defaultValue="projects" className="space-y-6">
            <TabsList>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Projects
                {!loadingProjects && projects.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{projects.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scans" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Scanned Files
                {!loadingScans && scans.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{scans.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Projects tab ── */}
            <TabsContent value="projects" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects…"
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {loadingProjects ? (
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
              ) : filteredProjects.length === 0 ? (
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
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredProjects.map((p) => (
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
            </TabsContent>

            {/* ── Scanned Files tab ── */}
            <TabsContent value="scans" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Scanned Files</CardTitle>
                  <CardDescription>
                    All firmware files that have completed scans in published projects. Click "View" to
                    open the hex viewer and detected maps, or download the raw binary.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by filename, project or author…"
                      className="pl-10"
                      value={scanSearch}
                      onChange={(e) => setScanSearch(e.target.value)}
                    />
                  </div>

                  {loadingScans ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : filteredScans.length === 0 ? (
                    <div className="text-center py-12">
                      <Map className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">
                        {scans.length === 0
                          ? 'No scanned files in published projects yet.'
                          : 'No matches for your search.'}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filename</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead>Maps</TableHead>
                          <TableHead>Scan time</TableHead>
                          <TableHead>Scanned</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredScans.map((s) => (
                          <TableRow key={s.scan_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[160px]" title={s.filename}>
                                  {s.filename}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatBytes(s.size_bytes)}</TableCell>
                            <TableCell>
                              <Link
                                to={`/library/${s.project_id}`}
                                className="text-primary hover:underline truncate max-w-[120px] block"
                                title={s.project_name}
                              >
                                {s.project_name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {s.owner_email.split('@')[0]}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default">
                                <Map className="w-3 h-3 mr-1" />
                                {s.candidates_count}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {formatMs(s.processing_time_ms)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {s.scanned_at ? formatRelativeTime(s.scanned_at) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <Link to={`/library/${s.project_id}/file/${s.file_id}`}>
                                    <Map className="w-4 h-4 mr-1" />
                                    View
                                  </Link>
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                  <a
                                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/library/${s.project_id}/files/${s.file_id}/download`}
                                    download={s.filename}
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
