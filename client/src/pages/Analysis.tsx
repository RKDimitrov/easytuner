import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAnalysisStore, MapCandidate } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { formatBytes, formatHexOffset } from '../lib/utils'
import { toast } from '../hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Header } from '../components/Header'
import { HexViewer } from '../components/HexViewer'
import { ResultsTable } from '../components/ResultsTable'
import { Map3DViewer } from '../components/Map3DViewer'
import { MapTextViewer } from '../components/MapTextViewer'
import { ChecksumConfigDialog } from '../components/ChecksumConfigDialog'
import { ChecksumDetectPopup } from '../components/ChecksumDetectPopup'
import { ChecksumStatus } from '../components/ChecksumStatus'
import { ChecksumTester } from '../components/ChecksumTester'
import { ExportDialog } from '../components/ExportDialog'
import { MapPropertiesDialog } from '../components/MapPropertiesDialog'
import { MapAssistantPanel, type MapCardItem, type AssistantMessage } from '../components/MapAssistantPanel'
import { createScan, getScan, getScanResults, type CandidateResponse } from '../services/scanService'
import { assistantChat, getAssistantHistory, clearAssistantHistory } from '../services/assistantService'
import { buildAssistantPayload } from '../lib/assistantPayload'
import { getMapTableAsText } from '../lib/mapTableView'
import { useProjectStore } from '../store/projectStore'
import { applyEdits, type EditOperation, type ChecksumConfig } from '../services/editService'
import { downloadFile } from '../services/fileService'
import { validateChecksum, type ChecksumValidationResponse } from '../services/checksumService'
import { useIsMobile } from '../hooks/use-mobile'
import { fetchUserMapsForFile, saveUserMapForFile } from '../services/userMapService'
import { cn } from '../lib/utils'
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
  Shield,
  Map,
  List,
  MessageCircle
} from 'lucide-react'

export function Analysis() {
  usePageTitle('Analysis')
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
    setSelectedCandidate,
    setFileData,
    userMaps,
    addUserMap,
    updateUserMap,
    setUserMaps,
    updateCandidate,
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
  const modifiedFileData = useEditStore((state) => state.modifiedFileData)
  
  // Initialize edit store when file data is available
  useEffect(() => {
    if (fileData && fileId) {
      setEditFile(fileId, fileData)
    }
  }, [fileData, fileId, setEditFile])

  // Load user-created maps (My Maps) from the server when a file is selected
  useEffect(() => {
    if (!fileId) return
    ;(async () => {
      try {
        const maps = await fetchUserMapsForFile(fileId)
        setUserMaps(maps)
      } catch (error) {
        console.error('Failed to load user maps for file', fileId, error)
      }
    })()
  }, [fileId, setUserMaps])

  const [scanComplete, setScanComplete] = useState(false)
  const [viewMode, setViewMode] = useState<'hex' | 'text' | '3d'>('hex')
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState<number | null>(null)
  const [checksumConfig, setChecksumConfig] = useState<ChecksumConfig | null>(null)
  const [showChecksumDetectPopup, setShowChecksumDetectPopup] = useState(false)
  const [showChecksumDialog, setShowChecksumDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [checksumValidation, setChecksumValidation] = useState<ChecksumValidationResponse | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([])
  const currentProject = useProjectStore((s) => s.currentProject)
  const [isValidatingChecksum, setIsValidatingChecksum] = useState(false)
  const [showMapPropsDialog, setShowMapPropsDialog] = useState(false)
  /** null = create new; otherwise edit this map (user or analysis) */
  const [mapPropsTarget, setMapPropsTarget] = useState<MapCandidate | null | 'new'>(null)

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
    const handlePopState = (_e: PopStateEvent) => {
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

  // Load Map Assistant chat history when a file is selected
  useEffect(() => {
    if (!fileId) {
      setAssistantMessages([])
      return
    }
    ;(async () => {
      try {
        const history = await getAssistantHistory(fileId)
        const mapped: AssistantMessage[] = history.map((m) =>
          m.role === 'user'
            ? { role: 'user', userText: m.user_text ?? '' }
            : {
                role: 'assistant',
                summary: m.summary ?? '',
                issues: m.issues ?? [],
                suggestions: m.suggestions ?? [],
                ask_vehicle: m.ask_vehicle ?? null,
              }
        )
        setAssistantMessages(mapped)
      } catch (error) {
        console.error('Failed to load assistant history for file', fileId, error)
      }
    })()
  }, [fileId])

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

  // Load existing scan results if scanId exists, or resume polling if scan is active
  useEffect(() => {
    if (!scanId) return
    if (isScanning) {
      // isScanning was set (e.g. by ProjectDetail when opening a file with an active scan)
      // but the poll loop isn't running yet — start it now
      pollUntilComplete(scanId)
    } else if (candidates.length === 0 && !scanComplete) {
      loadScanResults(scanId)
    } else if (candidates.length > 0 && !scanComplete) {
      setScanComplete(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId])

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

  const formatWait = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return 'soon'
    if (seconds < 60) return `~${seconds}s`
    const mins = Math.round(seconds / 60)
    return `~${mins} min${mins !== 1 ? 's' : ''}`
  }

  /**
   * Poll a scan job until it completes (or fails), then load results.
   * Safe to call both from startScan and from the mount effect (resume after reload).
   */
  const pollUntilComplete = async (activeScanId: string) => {
    let pollInterval: NodeJS.Timeout | null = null
    let progressInterval: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
      if (progressInterval) { clearInterval(progressInterval); progressInterval = null }
    }

    try {
      // Determine initial progress based on current status
      const initial = await getScan(activeScanId)
      const startProgress = initial.status === 'processing' ? 30 : 5
      setScanProgress(startProgress)
      setQueuePosition(initial.queue_position)
      setEstimatedWaitSeconds(initial.estimated_wait_seconds)

      // If already completed (e.g. finished between page load and first poll), go straight to results
      if (initial.status === 'completed') {
        setScanProgress(95)
        const results = await getScanResults(activeScanId)
        setScanProgress(100)
        setQueuePosition(null)
        setEstimatedWaitSeconds(null)
        setCandidates(results.candidates.map(convertCandidate))
        setIsScanning(false)
        setScanComplete(true)
        toast.success('Scan complete', { description: `Found ${results.total_candidates} candidate maps` })
        return
      }
      if (initial.status === 'failed') {
        setIsScanning(false)
        setScanProgress(0)
        setQueuePosition(null)
        setEstimatedWaitSeconds(null)
        toast.error('Scan failed', { description: initial.error_message || 'The scan failed on the server' })
        return
      }

      // Slowly animate progress while processing (30% → 90% over ~10 minutes)
      // Advances ~0.1% every 2 seconds = ~60% in 10 min, capped at 90
      let currentProgress = startProgress
      progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 0.1, 90)
        setScanProgress(currentProgress)
      }, 2000)

      // Poll status every 6 seconds
      await new Promise<void>((resolve, reject) => {
        pollInterval = setInterval(async () => {
          try {
            const statusRes = await getScan(activeScanId)
            setQueuePosition(statusRes.queue_position)
            setEstimatedWaitSeconds(statusRes.estimated_wait_seconds)

            if (statusRes.status === 'processing' && currentProgress < 30) {
              currentProgress = 30
              setScanProgress(30)
            }
            if (statusRes.status === 'completed') {
              cleanup()
              resolve()
            } else if (statusRes.status === 'failed') {
              cleanup()
              reject(new Error(statusRes.error_message || 'Scan failed on the server'))
            }
          } catch (pollError) {
            cleanup()
            reject(pollError)
          }
        }, 6000)
      })

      setScanProgress(95)
      const results = await getScanResults(activeScanId)
      setScanProgress(100)
      setQueuePosition(null)
      setEstimatedWaitSeconds(null)
      setCandidates(results.candidates.map(convertCandidate))
      setIsScanning(false)
      setScanComplete(true)
      toast.success('Scan complete', { description: `Found ${results.total_candidates} candidate maps` })
    } catch (error) {
      console.error('Scan polling failed:', error)
      cleanup()
      setIsScanning(false)
      setScanProgress(0)
      setQueuePosition(null)
      setEstimatedWaitSeconds(null)
      toast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
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
    setQueuePosition(null)
    setEstimatedWaitSeconds(null)

    try {
      // Enqueue the scan — returns immediately with queued status
      const scanResponse = await createScan({
        file_id: fileId,
        data_types: ['u8', 'u16le', 'u16be', 'u32le'],
        window_size: 64,
        stride: 32,
        min_confidence: 0.5,
      })

      setScanId(scanResponse.scan_id)

      if ((scanResponse.queue_position ?? 0) > 1) {
        toast.info('Added to scan queue', {
          description: `Position ${scanResponse.queue_position} in queue — estimated wait ${formatWait(scanResponse.estimated_wait_seconds)}`
        })
      } else {
        toast.info('Scan started', {
          description: 'Analyzing firmware file for ECU maps...'
        })
      }

      await pollUntilComplete(scanResponse.scan_id)
    } catch (error) {
      console.error('Scan failed:', error)
      setIsScanning(false)
      setScanProgress(0)
      setQueuePosition(null)
      setEstimatedWaitSeconds(null)
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

  const handleAssistantSend = async (userMessage: string) => {
    // Prefer user-created maps first, then backend candidates (no duplicates)
    const combinedMaps: MapCandidate[] = [
      ...userMaps,
      ...candidates.filter((c) => !userMaps.some((m) => m.id === c.id)),
    ]

    // Include the Text Viewer table for the selected map and for all scanned maps so the AI can give step-by-step instructions and say what each result relates to
    const displayData = modifiedFileData ?? fileData ?? null
    const selectedMapTextView =
      selectedCandidate && displayData
        ? getMapTableAsText(selectedCandidate, displayData)
        : null

    const MAX_MAPS_FOR_TEXT_VIEWS = 15
    let allMapsTextViews: string | null = null
    if (displayData) {
      const parts: string[] = []
      for (const c of combinedMaps.slice(0, MAX_MAPS_FOR_TEXT_VIEWS)) {
        const tableText = getMapTableAsText(c, displayData)
        const header = `--- Map: ${c.name || c.id} (${c.type}, offset ${formatHexOffset(c.offset)}, ${(c.dimensions?.x ?? 0)}×${(c.dimensions?.y ?? 0)}) ---`
        if (tableText) {
          parts.push(`${header}\n${tableText}`)
        } else {
          parts.push(header + '\n(No table data — dimensions or data not available for text view)')
        }
      }
      if (parts.length > 0) allMapsTextViews = parts.join('\n\n')
    }

    const payload = buildAssistantPayload({
      project: currentProject,
      fileId,
      fileName,
      fileSize,
      scanId,
      candidates: combinedMaps,
      userMessage,
      selectedMapTextView: selectedMapTextView ?? undefined,
      allMapsTextViews: allMapsTextViews ?? undefined,
    })
    const res = await assistantChat(payload)
    // Optimistically append new messages to local state so history reflects them immediately
    setAssistantMessages((prev) => [
      ...prev,
      { role: 'user', userText: userMessage },
      {
        role: 'assistant',
        summary: res.summary,
        issues: res.issues,
        suggestions: res.suggestions,
        ask_vehicle: res.ask_vehicle ?? null,
      },
    ])
    return res
  }

  const handleClearAssistantChat = async () => {
    if (!fileId) return
    try {
      await clearAssistantHistory(fileId)
      setAssistantMessages([])
      toast.success('Chat cleared', { description: 'Map Assistant history for this file has been deleted.' })
    } catch (error) {
      console.error('Failed to clear assistant history', error)
      toast.error('Failed to clear chat', {
        description: error instanceof Error ? error.message : 'Unknown error while clearing chat history',
      })
    }
  }

  const handleAskVehicle = () => {
    setAssistantOpen(false)
    if (currentProject?.project_id) {
      navigate(`/projects/${currentProject.project_id}`)
    }
  }

  // Maps shown as small cards in the assistant, mirroring what we send to the AI.
  // User-created maps come first so the assistant focuses on them.
  const mapsForAssistant: MapCandidate[] = [
    ...userMaps,
    ...candidates.filter((c) => !userMaps.some((m) => m.id === c.id)),
  ]

  const mapsInContext: MapCardItem[] = mapsForAssistant.slice(0, 50).map((c) => ({
    map_id: c.id,
    type: c.type,
    dimensions: c.dimensions || { x: 1 },
    offset_hex: formatHexOffset(c.offset),
    confidence: typeof c.confidence === 'number' ? c.confidence / 100 : 0,
    name: c.name ?? null,
  }))

  const handleOpenMapFromAssistant = (mapId: string) => {
    const candidate = candidates.find((c) => c.id === mapId) ?? userMaps.find((m) => m.id === mapId)
    if (candidate) {
      setSelectedCandidate(candidate)
      setMapPropsTarget(candidate)
      setShowMapPropsDialog(true)
    }
  }

  if (!fileData) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background relative">
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
                disabled={isSaving || !fileId}
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
                  disabled={isSaving || !fileId}
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
                disabled={!fileId}
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

              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={() => {
                  setMapPropsTarget('new')
                  setShowMapPropsDialog(true)
                }}
                disabled={!fileId}
                className="flex-1 md:flex-initial"
              >
                <Map className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Make a map</span>
                <span className="md:hidden">Map</span>
              </Button>

              <Button
                variant={assistantOpen ? "secondary" : "outline"}
                size={isMobile ? "sm" : "default"}
                onClick={() => setAssistantOpen(!assistantOpen)}
                className="flex-1 md:flex-initial ml-auto"
              >
                <MessageCircle className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Map Assistant</span>
                <span className="md:hidden">AI</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: when closed = same width as buttons (aligns); when assistant open = wider area so all three sections expand, with smooth left-column animation */}
      <div
        className={cn(
          'mx-auto px-4 py-6 space-y-4 transition-[max-width] duration-300 ease-out',
          assistantOpen ? 'container max-w-[1600px]' : 'container'
        )}
      >
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          {/* Left column: 50% when closed (matches buttons), animates to 360px when assistant opens */}
          <div
            className={cn(
              'flex flex-col gap-6 min-h-[400px] lg:h-[calc(100vh-200px)] flex-shrink-0 transition-[width] duration-300 ease-out',
              assistantOpen ? 'lg:w-[360px]' : 'lg:w-1/2'
            )}
          >
            {isScanning ? (
              <Card className="shrink-0">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin shrink-0" />
                    <div>
                      {queuePosition !== null && queuePosition > 0 ? (
                        <>
                          <h2 className="text-lg font-semibold">Waiting in queue</h2>
                          <p className="text-sm text-muted-foreground">
                            Your scan will start once the current job finishes.
                          </p>
                        </>
                      ) : (
                        <>
                          <h2 className="text-lg font-semibold">Scanning firmware</h2>
                          <p className="text-sm text-muted-foreground">
                            Analyzing the file for ECU maps. You can keep editing on the right.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Queue position badge */}
                  {queuePosition !== null && queuePosition > 0 && (
                    <div className="mb-4 flex flex-wrap gap-3">
                      <div className="flex-1 min-w-[120px] rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Queue position</p>
                        <p className="text-2xl font-bold text-primary">#{queuePosition}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Estimated wait</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatWait(estimatedWaitSeconds)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Processing indicator when position is 0 (actively scanning) */}
                  {(queuePosition === 0 || queuePosition === null) && (
                    <div className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <p className="text-sm font-semibold text-primary">Processing your file…</p>
                      <p className="text-xs text-muted-foreground mt-1">This typically takes 7–10 minutes</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {queuePosition !== null && queuePosition > 0 ? 'Queued' : 'Progress'}
                      </span>
                      <span className="font-mono text-primary">
                        {typeof scanProgress === 'number' && !isNaN(scanProgress)
                          ? Math.round(scanProgress)
                          : 0}%
                      </span>
                    </div>
                    <Progress value={scanProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ) : !scanComplete && candidates.length === 0 ? (
              <Card className="shrink-0">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <Play className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">File not yet scanned</h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                    Scan this file to discover ECU maps and add them to the analysis results below.
                  </p>
                  <Button onClick={startScan} disabled={!fileId}>
                    <Play className="w-4 h-4 mr-2" />
                    Scan file
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            {userMaps.length > 0 && (
                <Card className="overflow-hidden shrink-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">My Maps</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Click a map to view; double-click to configure.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border-t border-border">
                      <div className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_100px] gap-4 px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                        <div>Name</div>
                        <div>Type</div>
                        <div>Offset</div>
                        <div>Size</div>
                        <div>Dimensions</div>
                      </div>
                      {userMaps.map((map) => {
                        const isSelected = selectedCandidate?.id === map.id
                        return (
                          <div
                            key={map.id}
                            className={`grid grid-cols-[minmax(0,1fr)_80px_100px_100px_100px] gap-4 px-4 py-3 border-t border-border cursor-pointer hover:bg-accent/50 transition-colors ${
                              isSelected ? 'bg-primary/20 hover:bg-primary/30' : ''
                            }`}
                            onClick={() => setSelectedCandidate(map)}
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              setMapPropsTarget(map)
                              setShowMapPropsDialog(true)
                            }}
                          >
                            <div className="min-w-0 truncate font-medium">
                              {map.name || map.description || 'Unnamed map'}
                            </div>
                            <div>
                              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded bg-primary/20 text-primary">
                                {map.type === 'single' ? 'Single' : map.type}
                              </span>
                            </div>
                            <div className="font-mono text-sm text-muted-foreground">
                              {formatHexOffset(map.offset)}
                            </div>
                            <div className="font-mono text-sm text-muted-foreground">
                              {map.size} B
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {map.dimensions
                                ? `${map.dimensions.x}×${map.dimensions.y ?? 0}`
                                : '–'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="flex-1 min-h-0">
                <ResultsTable
                  onConfigureCandidate={(c) => {
                    setMapPropsTarget(c)
                    setShowMapPropsDialog(true)
                  }}
                />
              </div>
            </div>

          {/* Middle column: Hex / Text / 3D viewer – takes remaining space (not squished) */}
          <Card className="flex-1 min-w-0 min-h-[400px] lg:h-[calc(100vh-200px)] flex flex-col">
              <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs 
                  value={viewMode} 
                  onValueChange={(value) => setViewMode(value as 'hex' | 'text' | '3d')}
                  className="h-full flex flex-col"
                >
                  <div className="border-b border-border px-2 md:px-4 pt-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger 
                        value="hex" 
                        className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                      >
                        <Code2 className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Hex Viewer</span>
                        <span className="sm:hidden">Hex</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="text" 
                        className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                      >
                        <List className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Text Viewer</span>
                        <span className="sm:hidden">Text</span>
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

                  <TabsContent value="text" className="flex-1 overflow-hidden m-0 mt-0">
                    {selectedCandidate && fileData ? (
                      <div className="h-full">
                        <MapTextViewer
                          candidate={selectedCandidate}
                          fileData={fileData}
                          noCard
                          onUpdateAxis={(axis, values) => {
                            const key = axis === 'x' ? 'xAxis' : 'yAxis'
                            const axisConfig = selectedCandidate[key] ?? {}
                            const next = {
                              ...selectedCandidate,
                              [key]: { ...axisConfig, dataSource: 'editable_numbers' as const, axisValues: values },
                            }
                            if (userMaps.some((m) => m.id === selectedCandidate.id)) {
                              updateUserMap(selectedCandidate.id, next)
                            } else {
                              updateCandidate(selectedCandidate.id, next)
                            }
                          }}
                          onUpdateCell={(row, col, value) => {
                            const key = `${row},${col}`
                            const next = {
                              ...selectedCandidate,
                              dataOverrides: { ...(selectedCandidate.dataOverrides ?? {}), [key]: value },
                            }
                            if (userMaps.some((m) => m.id === selectedCandidate.id)) {
                              updateUserMap(selectedCandidate.id, next)
                            } else {
                              updateCandidate(selectedCandidate.id, next)
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center p-4">
                        <div className="text-center space-y-2">
                          <List className="w-12 h-12 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {!selectedCandidate
                              ? 'Select a map to view as text grid'
                              : !fileData
                              ? 'File data is loading...'
                              : 'Unable to load text view'}
                          </p>
                        </div>
                      </div>
                    )}
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

          {/* Third column: Map Assistant – slides in with width + opacity animation */}
          <div
            className={cn(
              'overflow-hidden flex-shrink-0 transition-[width,opacity] duration-300 ease-out',
              assistantOpen ? 'w-full lg:w-[360px] opacity-100' : 'w-0 opacity-0'
            )}
            style={{ minWidth: assistantOpen ? undefined : 0 }}
          >
            <div className="w-[360px] max-w-full h-full min-h-[400px] lg:min-h-[calc(100vh-200px)] lg:h-[calc(100vh-200px)] transition-opacity duration-300">
              <MapAssistantPanel
                open={assistantOpen}
                inline
                onClose={() => setAssistantOpen(false)}
                onSendMessage={handleAssistantSend}
                onAskVehicle={currentProject?.project_id ? handleAskVehicle : undefined}
                mapsInContext={mapsInContext}
                onOpenMap={handleOpenMapFromAssistant}
                initialMessages={assistantMessages}
                onClearChat={fileId ? handleClearAssistantChat : undefined}
              />
            </div>
          </div>
        </div>

        {/* Checksum Section - Below Analysis and Viewer */}
        {fileId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <ChecksumStatus
              config={checksumConfig}
              onConfigChange={() => setShowChecksumDetectPopup(true)}
              onFixSuccess={async () => {
                if (!fileId || !fileName) return
                const arrayBuffer = await downloadFile(fileId)
                setFileData(new Uint8Array(arrayBuffer), fileName, fileId)
              }}
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

      {/* Small checksum detect popup (opens first when clicking Configure Checksum) */}
      <ChecksumDetectPopup
        open={showChecksumDetectPopup}
        onClose={() => setShowChecksumDetectPopup(false)}
        fileId={fileId ?? undefined}
        fileSize={fileSize}
        onApplyConfig={(config) => {
          setChecksumConfig(config)
          toast.success('Checksum configuration applied', {
            description: 'Configuration from detection applied. Checksum will be updated when you save edits.'
          })
        }}
        onOpenFullConfig={() => {
          setShowChecksumDetectPopup(false)
          setShowChecksumDialog(true)
        }}
      />

      {/* Full Checksum Configuration Dialog */}
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
        fileId={fileId ?? undefined}
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

      {/* Map Properties Dialog (create or edit map) */}
      <MapPropertiesDialog
        open={showMapPropsDialog}
        onClose={() => {
          setShowMapPropsDialog(false)
          setMapPropsTarget(null)
        }}
        onSave={async (map) => {
          try {
            let saved = map
            if (fileId) {
              // Persist user maps on the server; analysis candidates remain local-only.
              saved = await saveUserMapForFile(fileId, map)
            }

            if (mapPropsTarget === 'new' || mapPropsTarget === null) {
              addUserMap(saved)
              setSelectedCandidate({ ...saved, id: saved.id, confidence: 100 })
              toast.success('Map created', { description: saved.name || 'Custom map added to My Maps.' })
            } else if (userMaps.some((m) => m.id === mapPropsTarget.id)) {
              updateUserMap(saved.id, saved)
              setSelectedCandidate(saved)
              toast.success('Map updated', { description: 'Map properties saved.' })
            } else {
              updateCandidate(saved.id, saved)
              setSelectedCandidate(saved)
              toast.success('Map updated', { description: 'Analysis map properties saved.' })
            }
          } catch (error) {
            console.error('Failed to save user map', error)
            toast.error('Failed to save map', {
              description: error instanceof Error ? error.message : 'Unknown error while saving map',
            })
          } finally {
            setShowMapPropsDialog(false)
            setMapPropsTarget(null)
          }
        }}
        initialMap={
          showMapPropsDialog && mapPropsTarget !== null && mapPropsTarget !== 'new'
            ? mapPropsTarget
            : null
        }
        fileSize={fileSize}
      />

    </div>
  )
}

