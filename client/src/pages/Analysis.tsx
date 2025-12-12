import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisStore, MapCandidate } from '../store/analysisStore'
import { formatBytes } from '../lib/utils'
import { toast } from '../hooks/use-toast'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Header } from '../components/Header'
import { HexViewer } from '../components/HexViewer'
import { ResultsTable } from '../components/ResultsTable'
import { Map3DViewer } from '../components/Map3DViewer'
import { createScan, getScanResults, type CandidateResponse } from '../services/scanService'
import { 
  FileCode, 
  Play, 
  Download, 
  ArrowLeft, 
  Loader2,
  CheckCircle2,
  Box
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
  } = useAnalysisStore()

  const [scanComplete, setScanComplete] = useState(false)
  const [show3DView, setShow3DView] = useState(false)

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
    const features = candidate.features || {}
    let dimensions: { x: number; y: number; z?: number } | undefined
    
    // Extract dimensions from features
    if (features.x_size || features.width) {
      dimensions = {
        x: features.x_size || features.width || 0,
        y: features.y_size || features.height || 0,
        z: features.z_size || features.depth
      }
    }
    
    // Determine type from pattern_type
    // Backend uses: '1d_array', '2d_table', 'unknown'
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
    }
  }, [scanId])

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
    setShow3DView(false)

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
              {scanComplete && selectedCandidate && (
                <Button
                  variant="outline"
                  onClick={() => setShow3DView(!show3DView)}
                >
                  <Box className="w-4 h-4 mr-2" />
                  {show3DView ? 'Hide 3D View' : 'Show 3D View'}
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
        ) : show3DView && selectedCandidate ? (
          <div className="h-[calc(100vh-200px)]">
            <Map3DViewer candidate={selectedCandidate} fileData={fileData!} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            {/* Results Table */}
            <ResultsTable />
            
            {/* Hex Viewer */}
            <HexViewer />
          </div>
        )}
      </div>
    </div>
  )
}

