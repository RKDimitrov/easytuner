/**
 * Library File View – read-only hex and map view for a file in a published project.
 * Loads file binary and scan results, then shows HexViewer and map viewers.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { HexViewer } from '../components/HexViewer'
import { ResultsTable } from '../components/ResultsTable'
import { Map3DViewer } from '../components/Map3DViewer'
import { MapTextViewer } from '../components/MapTextViewer'
import { useAnalysisStore } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { downloadLibraryFile, getLibraryFileScanResults, getLibraryProject } from '../services/libraryService'
import { convertCandidateResponse } from '../lib/candidateConversion'
import { formatBytes } from '../lib/utils'
import { ArrowLeft, FileCode, Loader2, Box, List } from 'lucide-react'

export function LibraryFileView() {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')

  const {
    setFileData,
    setCandidates,
    setSelectedCandidate,
    reset: resetAnalysisStore,
    fileData,
    candidates,
    selectedCandidate,
  } = useAnalysisStore()
  const setEditFile = useEditStore((s) => s.setFile)
  const resetEditStore = useEditStore((s) => s.reset)

  const loadFileAndScan = useCallback(async () => {
    if (!projectId || !fileId) return
    setLoading(true)
    setError(null)
    try {
      const [fileBuffer, scanResults, project] = await Promise.all([
        downloadLibraryFile(projectId, fileId),
        getLibraryFileScanResults(projectId, fileId, { limit: 200 }),
        getLibraryProject(projectId),
      ])
      const fileMeta = project.files.find((f) => f.file_id === fileId)
      const name = fileMeta?.filename ?? 'file.bin'
      setFileName(name)
      const uint8 = new Uint8Array(fileBuffer)
      const mapCandidates = scanResults.candidates.map(convertCandidateResponse)
      setFileData(uint8, name, fileId)
      setEditFile(fileId, uint8)
      setCandidates(mapCandidates)
      setSelectedCandidate(mapCandidates.length > 0 ? mapCandidates[0] : null)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }, [projectId, fileId, setFileData, setEditFile, setCandidates, setSelectedCandidate])

  useEffect(() => {
    loadFileAndScan()
    return () => {
      resetAnalysisStore()
      resetEditStore()
    }
  }, [loadFileAndScan, resetAnalysisStore, resetEditStore])

  if (!projectId || !fileId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Missing project or file.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/library">Back to Library</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading file and scan results…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={`/library/${projectId}`}>Back to project</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/library/${projectId}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to project
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-primary" />
              <span className="font-medium">{fileName}</span>
              {fileData && (
                <span className="text-sm text-muted-foreground">{formatBytes(fileData.length)}</span>
              )}
            </div>
          </div>
        </div>

        <Card className="flex flex-col flex-1 min-h-[70vh]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">View only – hex and detected maps</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 p-0">
            <Tabs defaultValue="hex" className="flex-1 flex flex-col min-h-0">
              <div className="px-4 pb-2">
                <TabsList>
                  <TabsTrigger value="hex">Hex</TabsTrigger>
                  <TabsTrigger value="results">Maps ({candidates.length})</TabsTrigger>
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="3d">3D</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="hex" className="flex-1 overflow-hidden m-0 mt-0 min-h-[60vh]">
                <div className="h-full min-h-[60vh] p-4 flex flex-col">
                  <HexViewer noCard />
                </div>
              </TabsContent>
              <TabsContent value="results" className="flex-1 overflow-hidden m-0 mt-0 min-h-[60vh]">
                <div className="h-full min-h-[60vh] p-4 overflow-auto flex flex-col">
                  <ResultsTable />
                </div>
              </TabsContent>
              <TabsContent value="text" className="flex-1 overflow-hidden m-0 mt-0">
                {selectedCandidate && fileData ? (
                  <div className="h-full p-4">
                    <MapTextViewer
                      candidate={selectedCandidate}
                      fileData={fileData}
                      noCard
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-4">
                    <div className="text-center space-y-2">
                      <List className="w-12 h-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Select a map in the Maps tab to view as text.</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="3d" className="flex-1 overflow-hidden m-0 mt-0">
                {selectedCandidate && fileData ? (
                  <div className="h-full p-4">
                    <Map3DViewer candidate={selectedCandidate} fileData={fileData} noCard />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-4">
                    <div className="text-center space-y-2">
                      <Box className="w-12 h-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Select a map in the Maps tab to view in 3D.</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
