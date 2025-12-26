import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisStore, MapCandidate } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { formatBytes } from '../lib/utils'
import { toast } from '../hooks/use-toast'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Header } from '../components/Header'
import { HexViewer } from '../components/HexViewer'
import { ResultsTable } from '../components/ResultsTable'
import { Map3DViewer } from '../components/Map3DViewer'
import { createScan, getScanResults, type CandidateResponse } from '../services/scanService'
import { applyEdits, type EditOperation } from '../services/editService'
import { downloadFile } from '../services/fileService'
import { 
  FileCode, 
  Play, 
  Download, 
  ArrowLeft, 
  Loader2,
  CheckCircle2,
  Box,
  Code2,
  Save
} from 'lucide-react'

export function Analysis() {
  const navigate = useNavigate()
  const {
    fileData,
    fileName,
    fileSize,
    fileId,
    candidates,
    setCandidates,
    isScanning,
    setIsScanning,
    scanProgress,
    setScanProgress,
    scanId,
    setScanId,
    selectedCandidate,
    setFileData,
  } = useAnalysisStore()
  
  // Use selectors to ensure reactivity
  const edits = useEditStore((state) => state.edits)
  const editCount = useEditStore((state) => state.editCount)
  const isDirty = useEditStore((state) => state.isDirty)
  const isSaving = useEditStore((state) => state.isSaving)
  const setIsSaving = useEditStore((state) => state.setIsSaving)
  const clearEdits = useEditStore((state) => state.clearEdits)
  const resetEdits = useEditStore((state) => state.reset)
  const setEditFile = useEditStore((state) => state.setFile)
  
  // Initialize edit store when file data is available
  useEffect(() => {
    if (fileData && fileId) {
      setEditFile(fileId, fileData)
    }
  }, [fileData, fileId, setEditFile])

  const [scanComplete, setScanComplete] = useState(false)
  const [viewMode, setViewMode] = useState<'hex' | '3d'>('hex')

  // Redirect if no file loaded (check both fileData and fileId)
  // Don't redirect if fileId exists - HexViewer will load it
  useEffect(() => {
    if (!fileData && !fileId) {
      toast.error('No file loaded', {
        description: 'Please select a file from a project first'
      })
      navigate('/projects')
    }
  }, [fileData, fileId, navigate])

  // Convert backend candidate to frontend format
  const convertCandidate = (candidate: CandidateResponse): MapCandidate => {
    let dimensions: { x: number; y?: number; z?: number } | undefined
    
    // Extract dimensions from the dimensions field (preferred) or features
    const dims = candidate.dimensions || {}
    const features = candidate.features || {}
    
    // Determine type first to handle dimensions correctly
    let type: '1D' | '2D' | '3D' = '2D'
    if (candidate.pattern_type) {
      const patternLower = candidate.pattern_type.toLowerCase()
      if (patternLower.includes('1d') || patternLower === '1d_array') {
        type = '1D'
      } else if (patternLower.includes('3d') || patternLower === '3d_table') {
        type = '3D'
      } else if (patternLower.includes('2d') || patternLower === '2d_table') {
        type = '2D'
      }
    }
    
    // Try to get dimensions from the dimensions field first
    if (dims.x || dims.width || dims.rows || dims.estimated_elements) {
      // If we have estimated_elements, try to infer dimensions
      if (dims.estimated_elements && !dims.x && !dims.width) {
        // For 1D arrays, x = estimated_elements, no y
        if (type === '1D') {
          dimensions = { x: dims.estimated_elements }
        } else if (type === '2D') {
          // For 2D, try to infer square dimensions
          const sqrt = Math.sqrt(dims.estimated_elements)
          if (Number.isInteger(sqrt)) {
            dimensions = { x: sqrt, y: sqrt }
          } else {
            // Fallback: use estimated_elements as x, 1 as y
            dimensions = { x: dims.estimated_elements, y: 1 }
          }
        } else if (type === '3D') {
          // For 3D, try to infer cubic dimensions
          const cubeRoot = Math.cbrt(dims.estimated_elements)
          if (Number.isInteger(cubeRoot)) {
            dimensions = { x: cubeRoot, y: cubeRoot, z: cubeRoot }
          } else {
            dimensions = { x: dims.estimated_elements, y: 1, z: 1 }
          }
        }
      } else {
        // We have explicit dimensions
        if (type === '1D') {
          // For 1D, only set x
          dimensions = { x: dims.x || dims.width || dims.rows || dims.estimated_elements || 0 }
        } else if (type === '2D') {
          dimensions = {
            x: dims.x || dims.width || dims.rows || 0,
            y: dims.y || dims.height || dims.cols || 0
          }
        } else if (type === '3D') {
          dimensions = {
            x: dims.x || dims.width || dims.rows || 0,
            y: dims.y || dims.height || dims.cols || 0,
            z: dims.z || dims.depth
          }
        }
      }
    } else if (features.x_size || features.width) {
      // Fallback to features if dimensions not available
      if (type === '1D') {
        dimensions = { x: features.x_size || features.width || 0 }
      } else if (type === '2D') {
        dimensions = {
          x: features.x_size || features.width || 0,
          y: features.y_size || features.height || 0
        }
      } else {
        dimensions = {
          x: features.x_size || features.width || 0,
          y: features.y_size || features.height || 0,
          z: features.z_size || features.depth
        }
      }
    }
    
    
    return {
      id: candidate.candidate_id,
      type,
      offset: candidate.offset,
      confidence: Math.round(candidate.confidence * 100), // Convert to percentage
      size: candidate.size,
      dimensions,
    }
  }

  // Load existing scan results if scanId exists
  useEffect(() => {
    if (scanId && candidates.length === 0 && !isScanning) {
      loadScanResults(scanId)
    } else if (scanId && candidates.length > 0 && !scanComplete) {
      // If candidates are already loaded (e.g., from ProjectDetail), mark scan as complete
      setScanComplete(true)
    }
  }, [scanId, candidates.length, isScanning, scanComplete])

  // Optional: Auto-switch to 3D view when a candidate is selected
  // Uncomment if you want automatic switching to 3D view on selection:
  // useEffect(() => {
  //   if (selectedCandidate && scanComplete && fileData) {
  //     setViewMode('3d')
  //   }
  // }, [selectedCandidate, scanComplete, fileData])

  const loadScanResults = async (id: string) => {
    try {
      const results = await getScanResults(id)
      const convertedCandidates = results.candidates.map(convertCandidate)
      setCandidates(convertedCandidates)
      setScanComplete(true)
      if (results.candidates.length > 0) {
        toast.success('Scan results loaded', {
          description: `Found ${results.total_candidates} candidate maps`
        })
      }
    } catch (error) {
      console.error('Failed to load scan results:', error)
      toast.error('Failed to load scan results', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const startScan = async () => {
    if (isScanning || !fileId) return

    setIsScanning(true)
    setScanProgress(0)
    setScanComplete(false)
    setCandidates([])
    setViewMode('hex')

    toast.info('Scan started', {
      description: 'Analyzing firmware file for ECU maps...'
    })

    let progressInterval: NodeJS.Timeout | null = null
    
    try {
      // Create scan job (this executes synchronously on the backend)
      setScanProgress(10)
      
      // Simulate progress while waiting for scan to complete
      progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          // Ensure prev is a valid number
          const currentProgress = typeof prev === 'number' && !isNaN(prev) ? prev : 10
          // Gradually increase progress, but cap at 90% until complete
          const newProgress = Math.min(currentProgress + Math.random() * 5, 90)
          return Math.max(0, Math.min(100, newProgress)) // Ensure between 0 and 100
        })
      }, 200)

      const scanResponse = await createScan({
        file_id: fileId,
        data_types: ['u8', 'u16le', 'u16be', 'u32le'],
        window_size: 64,
        stride: 32,
        min_confidence: 0.5,
      })

      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      
      setScanId(scanResponse.scan_id)
      setScanProgress(95)

      // Fetch results
      const results = await getScanResults(scanResponse.scan_id)
      setScanProgress(100)

      // Convert and set candidates
      const convertedCandidates = results.candidates.map(convertCandidate)
      setCandidates(convertedCandidates)
        setIsScanning(false)
        setScanComplete(true)
        
        toast.success('Scan complete', {
        description: `Found ${results.total_candidates} candidate maps`
        })
    } catch (error) {
      console.error('Scan failed:', error)
      
      // Clear progress interval if it exists
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      
      setIsScanning(false)
      setScanProgress(0)
      toast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  const handleExport = async () => {
    // TODO: Implement export functionality
    toast.info('Export feature', {
      description: 'Coming soon! Will support JSON, CSV, and XML formats.'
    })
  }
  
  const handleSaveEdits = async () => {
    if (!fileId || !edits || edits.size === 0) return
    
    setIsSaving(true)
    
    try {
      // Convert edits to API format
      const editOperations: EditOperation[] = Array.from(edits.values()).map(edit => ({
        offset: edit.offset,
        value: edit.value,
        data_type: edit.dataType,
        original_value: edit.originalValue,
      }))
      
      // Apply edits and create new file version
      const response = await applyEdits(fileId, editOperations, true)
      
      // Download the new file
      const arrayBuffer = await downloadFile(response.file_id)
      const newFileData = new Uint8Array(arrayBuffer)
      
      // Update analysis store with new file
      setFileData(newFileData, fileName || 'file.bin', response.file_id)
      
      // Clear edits
      clearEdits()
      resetEdits()
      
      toast.success('File saved', {
        description: `Created new file version with ${response.edits_applied} edit(s)`
      })
      
    } catch (error) {
      console.error('Failed to save edits:', error)
      toast.error('Failed to save edits', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!fileData) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/projects')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Projects
              </Button>
              <div className="flex items-center gap-3">
                <FileCode className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold">{fileName}</h1>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(fileSize)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isDirty && editCount > 0 && (
                <Button
                  variant="default"
                  onClick={handleSaveEdits}
                  disabled={isSaving || !fileId}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Edits ({editCount})
                    </>
                  )}
                </Button>
              )}
              
              {scanComplete && (
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={candidates.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
              
              <Button
                onClick={startScan}
                disabled={isScanning || !fileId}
                variant={scanComplete ? 'secondary' : 'default'}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : scanComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Rescan
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Scan
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {isScanning && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Scan Progress</span>
                <span className="font-mono text-primary">
                  {typeof scanProgress === 'number' && !isNaN(scanProgress) 
                    ? Math.round(scanProgress) 
                    : 0}%
                </span>
              </div>
              <Progress value={scanProgress} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        {!scanComplete && candidates.length === 0 ? (
          <Card className="h-[calc(100vh-200px)] flex items-center justify-center">
            <CardContent className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Ready to Scan</h2>
                <p className="text-muted-foreground max-w-md">
                  Click "Start Scan" to begin analyzing the firmware file for potential ECU maps and data structures.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            {/* Results Table */}
            <ResultsTable />
            
            {/* Viewer Panel with Tabs */}
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs 
                  value={viewMode} 
                  onValueChange={(value) => setViewMode(value as 'hex' | '3d')}
                  className="h-full flex flex-col"
                >
                  <div className="border-b border-border px-4 pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger 
                        value="hex" 
                        className="flex items-center gap-2"
                      >
                        <Code2 className="w-4 h-4" />
                        Hex Viewer
                      </TabsTrigger>
                      <TabsTrigger 
                        value="3d" 
                        className="flex items-center gap-2"
                      >
                        <Box className="w-4 h-4" />
                        3D Visualization
                        {!selectedCandidate && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (Select a map)
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="hex" className="flex-1 overflow-hidden m-0 mt-0">
                    <div className="h-full p-4">
                      <HexViewer noCard />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="3d" className="flex-1 overflow-hidden m-0 mt-0">
                    {selectedCandidate && fileData ? (
                      <div className="h-full">
                        <Map3DViewer candidate={selectedCandidate} fileData={fileData} noCard />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center p-4">
                        <div className="text-center space-y-2">
                          <Box className="w-12 h-12 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {!selectedCandidate 
                              ? 'Select a map from the results table to view in 3D'
                              : !fileData 
                              ? 'File data is loading...'
                              : 'Unable to load 3D visualization'}
                          </p>
                          {!fileData && fileId && (
                            <p className="text-xs text-muted-foreground mt-2">
                              The file is being loaded from the server
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

