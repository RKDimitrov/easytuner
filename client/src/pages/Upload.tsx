import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAnalysisStore } from '../store/analysisStore'
import { useUploadStore } from '../store/uploadStore'
import { useProjectStore } from '../store/projectStore'
import { useAuthStore } from '../store/authStore'
import { formatBytes } from '../lib/utils'
import { toast } from '../hooks/use-toast'
import { uploadFile } from '../services/fileService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { ProjectSelector } from '../components/ProjectSelector'
import { Header } from '../components/Header'
import { Upload as UploadIcon, FileCode, Zap, AlertCircle } from 'lucide-react'

const MAX_FILE_SIZE = 16 * 1024 * 1024 // 16MB

export function Upload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setFileData } = useAnalysisStore()
  const { selectedProject, setSelectedProject, isUploading, uploadProgress, uploadError, setIsUploading, setUploadProgress, setUploadError, associateFileWithProject } = useUploadStore()
  const { projects, fetchProjects } = useProjectStore()
  const { isAuthenticated, accessToken } = useAuthStore()
  
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle project context from URL parameters
  useEffect(() => {
    const projectId = searchParams.get('project')
    if (projectId) {
      // Find the project by ID and set it as selected
      const project = projects.find(p => p.project_id === projectId)
      if (project) {
        setSelectedProject(project)
      }
    }
  }, [searchParams, projects, setSelectedProject])

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleFileUpload = useCallback(async (file: File) => {
    // Check authentication first
    if (!isAuthenticated || !accessToken) {
      toast.error('Authentication required', {
        description: 'Please log in to upload files.'
      })
      navigate('/login', { state: { from: '/upload' } })
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large', {
        description: `Maximum file size is ${formatBytes(MAX_FILE_SIZE)}. Your file is ${formatBytes(file.size)}.`
      })
      return
    }

    // Check if project is selected (required for upload)
    if (!selectedProject) {
      toast.error('Project required', {
        description: 'Please select a project before uploading a file.'
      })
      return
    }

    // Set upload state
    setIsUploading(true)
    setUploadProgress(0)
    setUploadError(null)

    try {
      // Validate project_id is a valid UUID
      if (!selectedProject?.project_id) {
        throw new Error('Invalid project selected')
      }
      
      // Upload file to backend
      const uploadResponse = await uploadFile(
        selectedProject.project_id,
        file,
        (progress) => {
          setUploadProgress(progress)
        }
      )

      // Read file for local display
    const reader = new FileReader()
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        setFileData(data, file.name, uploadResponse.file_id)
      
        // Show success message
        const duplicateMsg = uploadResponse.duplicate ? ' (duplicate file, using existing)' : ''
        toast.success('File uploaded successfully', {
          description: `${file.name} (${formatBytes(file.size)}) uploaded to project "${selectedProject.name}"${duplicateMsg}`
      })
      
      setIsUploading(false)
        
        // Refresh projects to update file count
        fetchProjects()
        
        // Navigate to analysis page to view the hex
      navigate('/analysis')
    }
    reader.onerror = () => {
      setIsUploading(false)
        setUploadError('Failed to read file for display')
        toast.error('Upload succeeded but failed to read file', {
          description: 'The file was uploaded but could not be displayed. You can still view it in the project.'
      })
    }
    reader.readAsArrayBuffer(file)
    } catch (error) {
      setIsUploading(false)
      let errorMessage = 'Failed to upload file'
      
      console.error('Upload error:', error)
      
      if (error instanceof Error) {
        errorMessage = error.message
        // Check for authentication errors
        if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Not authenticated') || errorMessage.includes('Unauthorized')) {
          errorMessage = 'Authentication required. Please log in again.'
          // Redirect to login after a short delay
          setTimeout(() => {
            navigate('/login', { state: { from: '/upload' } })
          }, 2000)
        }
      } else if (typeof error === 'object' && error !== null) {
        // Handle case where error might be an object
        errorMessage = JSON.stringify(error)
      }
      
      setUploadError(errorMessage)
      toast.error('Upload failed', {
        description: errorMessage
      })
    }
  }, [isAuthenticated, accessToken, setFileData, navigate, selectedProject, setIsUploading, setUploadProgress, setUploadError, fetchProjects])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      console.log('File selected:', file.name, file.size)
      handleFileUpload(file)
      // Reset the input after a delay to allow the file dialog to close
      // This allows selecting the same file again
      setTimeout(() => {
        if (e.target) {
          e.target.value = ''
        }
      }, 200)
    } else {
      console.log('No file selected')
    }
  }, [handleFileUpload])

  const generateMockFirmware = async () => {
    toast.info('Generating demo firmware...', {
      description: 'Creating synthetic ECU firmware for testing'
    })

    // Generate 64KB of mock firmware data
    const mockData = new Uint8Array(65536)
    
    // Fill with random data
    for (let i = 0; i < mockData.length; i++) {
      mockData[i] = Math.floor(Math.random() * 256)
    }
    
    // Add some recognizable patterns (mock 2D maps)
    // Pattern 1: 16x16 map at offset 0x1000
    const offset1 = 0x1000
    for (let i = 0; i < 256; i++) {
      mockData[offset1 + i] = Math.floor(50 + Math.random() * 50)
    }
    
    // Pattern 2: 8x8 map at offset 0x2000
    const offset2 = 0x2000
    for (let i = 0; i < 64; i++) {
      mockData[offset2 + i] = Math.floor(100 + Math.random() * 100)
    }
    
    // Pattern 3: 1D table at offset 0x3000
    const offset3 = 0x3000
    for (let i = 0; i < 16; i++) {
      mockData[offset3 + i] = i * 10
    }

    // Add some marker bytes
    for (let i = 0; i < 50; i++) {
      const offset = Math.floor(Math.random() * (mockData.length - 16))
      mockData[offset] = 0x7E
      mockData[offset + 1] = 0x2F
    }

    setFileData(mockData, 'demo_firmware.bin')
    
    // Associate demo file with project if one is selected
    if (selectedProject) {
      await associateFileWithProject('demo_firmware.bin')
    }
    
    // Show success message with project context
    const projectContext = selectedProject 
      ? ` to project "${selectedProject.name}"`
      : ' (no project selected)'
    
    toast.success('Demo firmware generated', {
      description: `${formatBytes(mockData.byteLength)} of synthetic data${projectContext}`
    })
    navigate('/analysis')
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center p-4 pt-8">
        <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">ECU Map Recognition</h1>
          <p className="text-lg text-muted-foreground">
            Upload firmware files for automated analysis and visualization
          </p>
        </div>

        {/* Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Project Organization</CardTitle>
            <CardDescription>
              Choose a project to organize your uploaded files, or upload without a project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectSelector 
              onProjectChange={(project) => {
                // Project change is handled by the store
                console.log('Project selected:', project?.name || 'No Project')
              }}
              disabled={isDragging}
            />
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Firmware File</CardTitle>
            <CardDescription>
              {selectedProject 
                ? `Drag and drop a binary file or click to browse (Max: ${formatBytes(MAX_FILE_SIZE)})`
                : 'Please select a project above before uploading a file'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Upload Progress */}
            {isUploading && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Upload Error</span>
                </div>
                <p className="text-sm text-destructive mt-1">{uploadError}</p>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isUploading || !selectedProject
                  ? 'border-muted bg-muted/50 cursor-not-allowed'
                  : isDragging
                    ? 'border-primary bg-primary/10 cursor-pointer'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer'
              }`}
              onClick={(e) => {
                // Only trigger if clicking directly on the drop zone, not on child elements
                if (e.target === e.currentTarget) {
                  e.preventDefault()
                  if (!isUploading && selectedProject && fileInputRef.current) {
                    fileInputRef.current.click()
                  }
                }
              }}
            >
              <UploadIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg mb-2">
                {isDragging ? 'Drop file here' : 'Drag and drop your firmware file here'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <Button 
                variant="outline"
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Select File button clicked', { 
                    isUploading, 
                    selectedProject: !!selectedProject, 
                    hasRef: !!fileInputRef.current,
                    inputDisabled: fileInputRef.current?.disabled 
                  })
                  if (!isUploading && selectedProject && fileInputRef.current) {
                    // Ensure the input is enabled before clicking
                    if (fileInputRef.current.disabled) {
                      console.warn('File input is disabled, enabling it temporarily')
                      fileInputRef.current.disabled = false
                    }
                    try {
                      fileInputRef.current.click()
                      console.log('File input click triggered')
                    } catch (error) {
                      console.error('Error clicking file input:', error)
                    }
                  } else {
                    console.warn('Cannot open file dialog:', { isUploading, selectedProject: !!selectedProject, hasRef: !!fileInputRef.current })
                  }
                }}
                disabled={!selectedProject || isUploading}
              >
                <FileCode className="w-4 h-4 mr-2" />
                Select File
              </Button>
              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                className="hidden"
                onChange={handleFileInput}
                accept=".bin,.hex,.ecu,.dat"
                disabled={!selectedProject || isUploading}
                style={{ display: 'none' }}
              />
            </div>

            {/* Demo data button */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">No firmware file?</p>
                  <p className="text-sm text-muted-foreground">
                    Generate synthetic demo data to explore the platform
                  </p>
                </div>
                <Button 
                  variant="secondary" 
                  onClick={generateMockFirmware}
                  disabled={isUploading}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Demo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="w-5 h-5" />
              Legal Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              This platform is designed for <strong>research and educational purposes only</strong>.
            </p>
            <div className="space-y-1">
              <p>✅ Authorized research, education, and motorsport (off-road) applications</p>
              <p>❌ NO modification of production vehicle ECUs without authorization</p>
              <p>❌ NO tampering with emissions systems</p>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}

