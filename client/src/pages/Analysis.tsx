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
import { ChecksumConfigDialog } from '../components/ChecksumConfigDialog'
import { ChecksumStatus } from '../components/ChecksumStatus'
import { ChecksumTester } from '../components/ChecksumTester'
import { ExportDialog } from '../components/ExportDialog'
import { createScan, getScanResults, type CandidateResponse } from '../services/scanService'
import { applyEdits, type EditOperation, type ChecksumConfig } from '../services/editService'
import { downloadFile } from '../services/fileService'
import { validateChecksum, type ChecksumValidationResponse } from '../services/checksumService'
import { useIsMobile } from '../hooks/use-mobile'
import { 
  FileCode, 
  Play, 
  Download, 
  ArrowLeft, 
  Loader2,
  CheckCircle2,
  Box,
  Code2,
  Save,
  Shield
} from 'lucide-react'

export function Analysis() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
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
  const [checksumConfig, setChecksumConfig] = useState<ChecksumConfig | null>(null)
  const [showChecksumDialog, setShowChecksumDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [checksumValidation, setChecksumValidation] = useState<ChecksumValidationResponse | null>(null)
  const [isValidatingChecksum, setIsValidatingChecksum] = useState(false)

  // Block navigation during scan using beforeunload and history blocking
  useEffect(() => {
    if (!isScanning) return

    // Block browser navigation/refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'A scan is in progress. Are you sure you want to leave?'
      return e.returnValue
    }

    // Block browser back/forward navigation
    const handlePopState = (e: PopStateEvent) => {
      if (isScanning) {
        const shouldProceed = window.confirm(
          'A scan is currently in progress. Navigating away will cancel the scan. Do you want to continue?'
        )
        if (!shouldProceed) {
          // Push current state back to prevent navigation
          window.history.pushState(null, '', window.location.href)
        } else {
          setIsScanning(false)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    
    // Push a state to enable popstate detection
    window.history.pushState(null, '', window.location.href)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isScanning])

  // Create a wrapped navigate function that checks for scanning
  const navigateWithCheck = (path: string, options?: { replace?: boolean }) => {
    if (isScanning) {
      const shouldProceed = window.confirm(
        'A scan is currently in progress. Navigating away will cancel the scan. Do you want to continue?'
      )
      if (shouldProceed) {
        setIsScanning(false)
        navigate(path, options)
      }
    } else {
      navigate(path, options)
    }
  }

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
    let dimensions: { x: number; y: number; z?: number } | undefined
    
    // Get dimensions directly from candidate.dimensions (not from empty dims object)
    const dims = candidate.dimensions || {}
    const features = candidate.features || {}
    
    // Determine type from pattern_type field (which comes from Candidate.type: '1D', '2D', '3D', 'scalar')
    let type: '1D' | '2D' | '3D' = '2D'
    if (candidate.pattern_type) {
      const patternUpper = candidate.pattern_type.toUpperCase()
      if (patternUpper === '1D' || patternUpper.includes('1D')) {
        type = '1D'
      } else if (patternUpper === '3D' || patternUpper.includes('3D')) {
        type = '3D'
      } else if (patternUpper === '2D' || patternUpper.includes('2D')) {
        type = '2D'
      } else {
        // Default to 2D if unknown
        type = '2D'
      }
    }
    
    // Try to get dimensions from the dimensions field first
    if (dims.x !== undefined || dims.width !== undefined || dims.rows !== undefined || dims.estimated_elements !== undefined) {
      // If we have estimated_elements, try to infer dimensions
      if (dims.estimated_elements !== undefined && dims.x === undefined && dims.width === undefined) {
        // For 1D arrays, don't set dimensions (MapCandidate requires y for dimensions)
        if (type === '1D') {
          dimensions = undefined
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
        // We have explicit dimensions - prefer x, y, z format, fallback to width/height
        if (type === '1D') {
          // For 1D, use x dimension only (y will be 1 or undefined)
          if (dims.x !== undefined) {
            dimensions = { x: dims.x, y: 1 }
          } else if (dims.width !== undefined) {
            dimensions = { x: dims.width, y: 1 }
          } else {
            dimensions = undefined
          }
        } else if (type === '2D') {
          // For 2D, use x and y
          const x = dims.x !== undefined ? dims.x : (dims.width !== undefined ? dims.width : (dims.rows !== undefined ? dims.rows : 0))
          const y = dims.y !== undefined ? dims.y : (dims.height !== undefined ? dims.height : (dims.cols !== undefined ? dims.cols : 0))
          if (x > 0 && y > 0) {
            dimensions = { x, y }
          }
        } else if (type === '3D') {
          // For 3D, use x, y, z
          const x = dims.x !== undefined ? dims.x : (dims.width !== undefined ? dims.width : (dims.rows !== undefined ? dims.rows : 0))
          const y = dims.y !== undefined ? dims.y : (dims.height !== undefined ? dims.height : (dims.cols !== undefined ? dims.cols : 0))
          const z = dims.z !== undefined ? dims.z : (dims.depth !== undefined ? dims.depth : 1)
          if (x > 0 && y > 0 && z > 0) {
            dimensions = { x, y, z }
          }
        }
      }
    } else if (features.x_size !== undefined || features.width !== undefined) {
      // Fallback to features if dimensions not available
      if (type === '1D') {
        // For 1D, use x dimension
        const x = features.x_size || features.width || 0
        if (x > 0) {
          dimensions = { x, y: 1 }
        }
      } else if (type === '2D') {
        const x = features.x_size || features.width || 0
        const y = features.y_size || features.height || 0
        if (x > 0 && y > 0) {
          dimensions = { x, y }
        }
      } else {
        const x = features.x_size || features.width || 0
        const y = features.y_size || features.height || 0
        const z = features.z_size || features.depth || 1
        if (x > 0 && y > 0 && z > 0) {
          dimensions = { x, y, z }
        }
      }
    }
    
    // Final fallback: if dimensions still not set but we have width/height in dims, use them
    if (!dimensions && (dims.width !== undefined || dims.height !== undefined)) {
      const x = dims.width || dims.x || 1
      const y = dims.height || dims.y || 1
      if (x > 0 && y > 0) {
        dimensions = { x, y }
        // Update type based on dimensions if not already set correctly
        if (type === '1D' && y > 1) {
          type = '2D'
        }
      }
    }
    
    // If still no dimensions but we have size, try to infer from size and type
    if (!dimensions && candidate.size > 0) {
      // Try to infer dimensions from size
      const elementSize = dims.element_size || 2 // Default to 2 bytes (uint16)
      const numElements = Math.floor(candidate.size / elementSize)
      
      if (type === '2D' && numElements > 0) {
        // Try to find a reasonable 2D layout
        const sqrt = Math.floor(Math.sqrt(numElements))
        if (sqrt * sqrt === numElements) {
          dimensions = { x: sqrt, y: sqrt }
        } else {
          // Try common aspect ratios
          for (const ratio of [16, 8, 4, 2]) {
            if (numElements % ratio === 0) {
              dimensions = { x: numElements / ratio, y: ratio }
              break
            }
          }
          // If no good ratio found, use square-ish
          if (!dimensions) {
            const x = Math.floor(Math.sqrt(numElements))
            dimensions = { x, y: Math.ceil(numElements / x) }
          }
        }
      } else if (type === '1D' && numElements > 0) {
        dimensions = { x: numElements, y: 1 }
      }
    }
    
    // Extract data type and element size from dimensions or candidate
    const elementSize = dims.element_size || 2 // Default to 2 bytes (uint16)
    const dataType = candidate.data_type || 'u16le' // Default to uint16 little endian
    
    // Debug: Log if dimensions are missing (only in development)
    if (process.env.NODE_ENV === 'development' && !dimensions && candidate.size > 0) {
      console.debug('Candidate missing dimensions:', {
        id: candidate.candidate_id,
        dims,
        features: Object.keys(features),
        type,
        size: candidate.size
      })
    }
    
    return {
      id: candidate.candidate_id,
      type,
      offset: candidate.offset,
      confidence: Math.round(candidate.confidence * 100), // Convert to percentage
      size: candidate.size,
      dimensions,
      dataType,
      elementSize,
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
      
      // Debug: Log raw API response to check dimensions
      if (process.env.NODE_ENV === 'development' && results.candidates.length > 0) {
        console.debug('Scan results loaded:', {
          total: results.total_candidates,
          first_candidate: {
            id: results.candidates[0].candidate_id,
            dimensions: results.candidates[0].dimensions,
            has_dimensions: !!results.candidates[0].dimensions && Object.keys(results.candidates[0].dimensions).length > 0,
            pattern_type: results.candidates[0].pattern_type
          }
        })
      }
      
      const convertedCandidates = results.candidates.map(convertCandidate)
      
      // Debug: Check if any candidates are missing dimensions after conversion
      const missingDims = convertedCandidates.filter(c => !c.dimensions)
      if (missingDims.length > 0) {
        console.warn(`${missingDims.length} candidates missing dimensions after conversion`, missingDims.map(c => ({ id: c.id, type: c.type, size: c.size })))
      }
      
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
      let currentProgress = 10
      progressInterval = setInterval(() => {
        // Gradually increase progress, but cap at 90% until complete
        currentProgress = Math.min(currentProgress + Math.random() * 5, 90)
        currentProgress = Math.max(0, Math.min(100, currentProgress)) // Ensure between 0 and 100
        setScanProgress(currentProgress)
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

  const handleExportClick = async () => {
    // Validate checksum before showing export dialog
    if (checksumConfig && fileId) {
      setIsValidatingChecksum(true)
      try {
        const validation = await validateChecksum(fileId, checksumConfig)
        setChecksumValidation(validation)
      } catch (error) {
        console.error('Failed to validate checksum:', error)
        setChecksumValidation(null)
      } finally {
        setIsValidatingChecksum(false)
      }
    } else {
      setChecksumValidation(null)
    }
    setShowExportDialog(true)
  }

  const handleExport = async () => {
    if (!fileId) return

    try {
      // Download the file
      const arrayBuffer = await downloadFile(fileId)
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' })
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName || 'firmware.bin'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('File exported', {
        description: `${fileName} has been downloaded to your computer`
      })

      setShowExportDialog(false)
    } catch (error) {
      console.error('Failed to export file:', error)
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
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
      
      // Apply edits and create new file version (with checksum if configured)
      const response = await applyEdits(fileId, editOperations, true, checksumConfig || undefined)
      
      // Download the new file
      const arrayBuffer = await downloadFile(response.file_id)
      const newFileData = new Uint8Array(arrayBuffer)
      
      // Update analysis store with new file
      setFileData(newFileData, fileName || 'file.bin', response.file_id)
      
      // Clear edits
      clearEdits()
      resetEdits()
      
      const checksumMsg = checksumConfig ? ' (checksum updated)' : ''
      toast.success('File saved', {
        description: `Created new file version with ${response.edits_applied} edit(s)${checksumMsg}`
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
    <div className="min-h-screen bg-background relative">
      {/* Loading Overlay - Blocks all interaction during scan */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Scanning Firmware</h2>
            <p className="text-muted-foreground mb-4">
              Analyzing the firmware file for ECU maps. This may take a moment...
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono text-primary">
                  {typeof scanProgress === 'number' && !isNaN(scanProgress) 
                    ? Math.round(scanProgress) 
                    : 0}%
                </span>
              </div>
              <Progress value={scanProgress} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Please wait while the scan completes. Navigation is disabled during this process.
            </p>
          </div>
        </div>
      )}
      
      <Header />
      
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {/* Top row: Back button and file info */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWithCheck('/projects')}
                  disabled={isScanning}
                  className="shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Back to Projects</span>
                  <span className="md:hidden">Back</span>
                </Button>
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <FileCode className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0" />
                  <div className="min-w-0">
                    <h1 className="text-base md:text-lg font-semibold truncate">{fileName}</h1>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {formatBytes(fileSize)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom row: Action buttons - wrap on mobile */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={() => setShowChecksumDialog(true)}
                disabled={isSaving || !fileId || isScanning}
                className="flex-1 md:flex-initial"
              >
                <Shield className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Configure Checksum</span>
                <span className="md:hidden">Checksum</span>
              </Button>
              
              {isDirty && editCount > 0 && (
                <Button
                  variant="default"
                  size={isMobile ? "sm" : "default"}
                  onClick={handleSaveEdits}
                  disabled={isSaving || !fileId || isScanning}
                  className="flex-1 md:flex-initial"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 md:mr-2 animate-spin" />
                      <span className="hidden md:inline">Saving...</span>
                      <span className="md:hidden">Saving</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">
                        Save Edits ({editCount})
                        {checksumConfig && ' + Checksum'}
                      </span>
                      <span className="md:hidden">
                        Save ({editCount})
                      </span>
                    </>
                  )}
                </Button>
              )}
              
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={handleExportClick}
                disabled={!fileId || isScanning}
                className="flex-1 md:flex-initial"
              >
                <Download className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Export</span>
                <span className="md:hidden">Export</span>
              </Button>
              
              <Button
                size={isMobile ? "sm" : "default"}
                onClick={startScan}
                disabled={isScanning || !fileId}
                variant={scanComplete ? 'secondary' : 'default'}
                className="flex-1 md:flex-initial"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 md:mr-2 animate-spin" />
                    <span className="hidden md:inline">Scanning...</span>
                    <span className="md:hidden">Scanning</span>
                  </>
                ) : scanComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Rescan</span>
                    <span className="md:hidden">Rescan</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Start Scan</span>
                    <span className="md:hidden">Scan</span>
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
      <div className="container mx-auto px-4 py-6 space-y-4">
        {!scanComplete && candidates.length === 0 ? (
          <Card className="min-h-[calc(100vh-280px)] md:h-[calc(100vh-200px)] flex items-center justify-center">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Results Table */}
            <div className="min-h-[400px] lg:h-[calc(100vh-200px)]">
              <ResultsTable />
            </div>
            
            {/* Viewer Panel with Tabs */}
            <Card className="min-h-[400px] lg:h-[calc(100vh-200px)] flex flex-col">
              <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs 
                  value={viewMode} 
                  onValueChange={(value) => setViewMode(value as 'hex' | '3d')}
                  className="h-full flex flex-col"
                >
                  <div className="border-b border-border px-2 md:px-4 pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger 
                        value="hex" 
                        className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                      >
                        <Code2 className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Hex Viewer</span>
                        <span className="sm:hidden">Hex</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="3d" 
                        className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                      >
                        <Box className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">3D Visualization</span>
                        <span className="sm:hidden">3D</span>
                        {!selectedCandidate && (
                          <span className="hidden md:inline ml-1 text-xs text-muted-foreground">
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

        {/* Checksum Section - Below Analysis and Viewer */}
        {fileId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <ChecksumStatus
              config={checksumConfig}
              onConfigChange={() => setShowChecksumDialog(true)}
            />
            <ChecksumTester
              fileSize={fileSize}
              onConfigFound={(config) => {
                setChecksumConfig(config)
                toast.success('Checksum configuration applied', {
                  description: 'Valid configuration found and applied automatically'
                })
              }}
            />
          </div>
        )}
      </div>

      {/* Checksum Configuration Dialog */}
      <ChecksumConfigDialog
        open={showChecksumDialog}
        onClose={() => setShowChecksumDialog(false)}
        onSave={(config) => {
          setChecksumConfig(config)
          setShowChecksumDialog(false)
          toast.success('Checksum configuration saved', {
            description: 'Checksum will be updated when you save edits'
          })
        }}
        fileSize={fileSize}
        defaultConfig={checksumConfig || undefined}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        checksumConfig={checksumConfig}
        validationResult={checksumValidation}
        isValidating={isValidatingChecksum}
        fileName={fileName || 'firmware.bin'}
      />
    </div>
  )
}

