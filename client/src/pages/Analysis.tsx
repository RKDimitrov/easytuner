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
import { 
  FileCode, 
  Play, 
  Download, 
  ArrowLeft, 
  Loader2,
  CheckCircle2 
} from 'lucide-react'

export function Analysis() {
  const navigate = useNavigate()
  const {
    fileData,
    fileName,
    fileSize,
    candidates,
    setCandidates,
    isScanning,
    setIsScanning,
    scanProgress,
    setScanProgress,
  } = useAnalysisStore()

  const [scanComplete, setScanComplete] = useState(false)

  // Redirect if no file loaded
  useEffect(() => {
    if (!fileData) {
      toast.error('No file loaded', {
        description: 'Please upload a file first'
      })
      navigate('/')
    }
  }, [fileData, navigate])

  // Generate mock candidates (replace with API call)
  const generateMockCandidates = (): MapCandidate[] => {
    const mockCandidates: MapCandidate[] = []
    
    // Add some 2D map candidates
    mockCandidates.push({
      id: '1',
      type: '2D',
      offset: 0x1000,
      confidence: 94,
      size: 512,
      dimensions: { x: 16, y: 16 },
    })
    
    mockCandidates.push({
      id: '2',
      type: '2D',
      offset: 0x2000,
      confidence: 88,
      size: 256,
      dimensions: { x: 16, y: 8 },
    })
    
    mockCandidates.push({
      id: '3',
      type: '1D',
      offset: 0x3000,
      confidence: 92,
      size: 64,
      dimensions: { x: 16, y: 1 },
    })
    
    mockCandidates.push({
      id: '4',
      type: '2D',
      offset: 0x4500,
      confidence: 76,
      size: 128,
      dimensions: { x: 8, y: 8 },
    })
    
    mockCandidates.push({
      id: '5',
      type: '3D',
      offset: 0x6000,
      confidence: 81,
      size: 1024,
      dimensions: { x: 8, y: 8, z: 8 },
    })
    
    mockCandidates.push({
      id: '6',
      type: '1D',
      offset: 0x7800,
      confidence: 68,
      size: 32,
      dimensions: { x: 8, y: 1 },
    })

    return mockCandidates
  }

  const startScan = async () => {
    if (isScanning) return

    setIsScanning(true)
    setScanProgress(0)
    setScanComplete(false)
    setCandidates([])

    toast.info('Scan started', {
      description: 'Analyzing firmware file for ECU maps...'
    })

    // Simulate scan progress (replace with actual API call + WebSocket)
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        
        // Generate mock results
        const results = generateMockCandidates()
        setCandidates(results)
        setIsScanning(false)
        setScanComplete(true)
        
        toast.success('Scan complete', {
          description: `Found ${results.length} candidate maps`
        })
      }
      setScanProgress(progress)
    }, 300)

    // TODO: Replace with actual implementation:
    // 1. POST file to /api/analysis/scan
    // 2. Receive scanId
    // 3. Connect WebSocket to /api/analysis/progress/:scanId
    // 4. Update progress in real-time
    // 5. Fetch results from /api/analysis/results/:scanId when complete
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
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
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
                disabled={isScanning}
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
                <span className="font-mono text-primary">{Math.round(scanProgress)}%</span>
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
            
            {/* Hex Viewer */}
            <HexViewer />
          </div>
        )}
      </div>
    </div>
  )
}

