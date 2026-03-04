/**
 * ProjectDetail Page
 * 
 * Individual project detail page showing project metadata,
 * files, scans, and management options.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileCode, Calendar, Lock, Globe, Upload, Settings, Activity, Eye, CheckCircle2, XCircle, Loader2, Trash2, Plus, Upload as UploadIcon, AlertCircle, BookMarked, FileText } from 'lucide-react'
import { Header } from '../components/Header'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { useProjectStore } from '../store/projectStore'
import { useAnalysisStore } from '../store/analysisStore'
import { convertCandidateResponse } from '../lib/candidateConversion'
import { Project, UpdateProjectData } from '../types/project'
import { getProjectFiles, ProjectFile, downloadFile, deleteFile as deleteFileService, uploadFile } from '../services/fileService'
import { updateProject, publishProject, unpublishProject, getProjectScans, type ProjectScanItem } from '../services/projectService'
import { getScanResults } from '../services/scanService'
import { formatBytes } from '../lib/utils'
import { toast } from '../hooks/use-toast'
import { useUploadStore } from '../store/uploadStore'

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
}

/**
 * Project Header Component
 */
function ProjectHeader({ project, onProjectUpdate, onUploadClick }: { project: Project; onProjectUpdate: () => void; onUploadClick: () => void }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editDescription, setEditDescription] = useState(project.description || '')
  const [editIsPrivate, setEditIsPrivate] = useState(project.is_private)
  const [editVehicleModel, setEditVehicleModel] = useState(project.vehicle_model ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const isPublished = Boolean(project.published_at)
  const canPublish = !project.is_private

  const handleEditProject = () => {
    setEditName(project.name)
    setEditDescription(project.description || '')
    setEditIsPrivate(project.is_private)
    setEditVehicleModel(project.vehicle_model ?? '')
    setEditDialogOpen(true)
  }

  const handleSaveProject = async () => {
    try {
      setIsSaving(true)
      const updates: UpdateProjectData = {
        name: editName,
        description: editDescription || undefined,
        is_private: editIsPrivate,
        vehicle_model: editVehicleModel.trim() || null
      }
      await updateProject(project.project_id, updates)
      toast.success('Project updated', {
        description: 'Project settings have been saved.'
      })
      setEditDialogOpen(false)
      onProjectUpdate()
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('Failed to update project', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadFile = () => {
    onUploadClick()
  }

  const handlePublish = async () => {
    if (!canPublish) return
    try {
      setIsPublishing(true)
      if (isPublished) {
        await unpublishProject(project.project_id)
        toast.success('Project unpublished', { description: 'Removed from the library.' })
      } else {
        await publishProject(project.project_id)
        toast.success('Project published', { description: 'Your project is now visible in the Library.' })
      }
      onProjectUpdate()
    } catch (error) {
      console.error('Publish/unpublish failed:', error)
      toast.error(isPublished ? 'Failed to unpublish' : 'Failed to publish', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <span>/</span>
        <span className="text-foreground">{project.name}</span>
      </nav>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                {project.is_private ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Private
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Public
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
              {project.vehicle_model && (
                <p className="text-sm text-muted-foreground">
                  Vehicle / ECU: <span className="font-medium text-foreground">{project.vehicle_model}</span>
                </p>
              )}
              {project.is_private && (
                <p className="text-sm text-muted-foreground">
                  To publish to the Library: <strong>Edit Project</strong> → turn off <strong>Private</strong> → then click <strong>Publish to Library</strong> below.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={isPublished ? "outline" : "secondary"}
                onClick={handlePublish}
                disabled={!canPublish || isPublishing}
                title={project.is_private ? 'Make the project public first (Edit Project → uncheck Private)' : isPublished ? 'Unpublish from Library' : 'Publish to Library'}
                className={!canPublish ? "opacity-80" : ""}
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BookMarked className="w-4 h-4 mr-2" />
                )}
                {isPublished ? 'Unpublish from Library' : 'Publish to Library'}
              </Button>
              <Button variant="outline" onClick={handleEditProject}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Project
              </Button>
              <Button onClick={handleUploadFile}>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span>{project.file_count || 0} files</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Created {formatRelativeTime(project.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Updated {formatRelativeTime(project.updated_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="My Project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Project description (optional)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-vehicle-model">Vehicle / ECU model</Label>
              <Input
                id="project-vehicle-model"
                value={editVehicleModel}
                onChange={(e) => setEditVehicleModel(e.target.value)}
                placeholder="e.g. BMW N55 2015"
              />
              <p className="text-sm text-muted-foreground">
                Used by the Map Assistant for tuning advice. Leave empty if not applicable.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="project-private">Private Project</Label>
                <p className="text-sm text-muted-foreground">
                  Only you can see this project
                </p>
              </div>
              <Switch
                id="project-private"
                checked={editIsPrivate}
                onCheckedChange={setEditIsPrivate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProject} disabled={isSaving || !editName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Upload File Dialog Component
 */
function UploadFileDialog({ 
  project, 
  open, 
  onOpenChange,
  onUploadComplete 
}: { 
  project: Project; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}) {
  const { setFileData } = useAnalysisStore()
  const { isUploading, uploadProgress, uploadError, setIsUploading, setUploadProgress, setUploadError } = useUploadStore()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const MAX_FILE_SIZE = 16 * 1024 * 1024 // 16MB

  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large', {
        description: `Maximum file size is ${formatBytes(MAX_FILE_SIZE)}. Your file is ${formatBytes(file.size)}.`
      })
      return
    }

    // Set upload state
    setIsUploading(true)
    setUploadProgress(0)
    setUploadError(null)

    try {
      // Upload file to backend
      const uploadResponse = await uploadFile(
        project.project_id,
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
          description: `${file.name} (${formatBytes(file.size)}) uploaded to project "${project.name}"${duplicateMsg}`
        })
        
        setIsUploading(false)
        onUploadComplete()
        onOpenChange(false)
        
        // Navigate to analysis page to view the hex
        navigate('/analysis')
      }
      reader.onerror = () => {
        setIsUploading(false)
        setUploadError('Failed to read file for display')
        toast.error('Upload succeeded but failed to read file', {
          description: 'The file was uploaded but could not be displayed. You can still view it in the project.'
        })
        onUploadComplete()
        onOpenChange(false)
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      setIsUploading(false)
      let errorMessage = 'Failed to upload file'
      
      console.error('Upload error:', error)
      
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      setUploadError(errorMessage)
      toast.error('Upload failed', {
        description: errorMessage
      })
    }
  }, [project.project_id, project.name, setFileData, setIsUploading, setUploadProgress, setUploadError, onUploadComplete, onOpenChange, navigate])

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
      handleFileUpload(file)
      // Reset the input
      setTimeout(() => {
        if (e.target) {
          e.target.value = ''
        }
      }, 200)
    }
  }, [handleFileUpload])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload File to {project.name}</DialogTitle>
          <DialogDescription>
            Drag and drop a binary file or click to browse (Max: {formatBytes(MAX_FILE_SIZE)})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
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
              isUploading
                ? 'border-muted bg-muted/50 cursor-not-allowed'
                : isDragging
                  ? 'border-primary bg-primary/10 cursor-pointer'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer'
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isUploading && fileInputRef.current) {
                fileInputRef.current.click()
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
                if (!isUploading && fileInputRef.current) {
                  fileInputRef.current.click()
                }
              }}
              disabled={isUploading}
            >
              <FileCode className="w-4 h-4 mr-2" />
              Select File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInput}
              accept=".bin,.hex,.ecu,.dat"
              disabled={isUploading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Files Tab Content
 */
function FilesTab({ project, onProjectUpdate, onUploadClick }: { project: Project; onProjectUpdate: () => void; onUploadClick?: () => void }) {
  const navigate = useNavigate()
  const { setFileData, setCandidates, setScanId, setIsScanning } = useAnalysisStore()
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [openingFileId, setOpeningFileId] = useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null)

  useEffect(() => {
    loadFiles()
  }, [project.project_id])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await getProjectFiles(project.project_id)
      setFiles(response.files)
    } catch (error) {
      console.error('Failed to load files:', error)
      toast.error('Failed to load files', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFile = async (file: ProjectFile) => {
    try {
      setOpeningFileId(file.file_id)
      
      // Download file
      const fileData = await downloadFile(file.file_id)
      const uint8Array = new Uint8Array(fileData)
      
      // Set file data in store
      setFileData(uint8Array, file.filename, file.file_id)

      // If there is an active (queued/processing) scan, resume polling on the analysis page
      if (file.active_scan_id) {
        setScanId(file.active_scan_id)
        setIsScanning(true)
        setCandidates([])
      } else if (file.has_scan && file.latest_scan_id) {
        // Load completed scan results
        try {
          const scanData = await getScanResults(file.latest_scan_id)
          setScanId(file.latest_scan_id)
          const candidates = scanData.candidates.map(convertCandidateResponse)
          setCandidates(candidates)
        } catch (error) {
          console.warn('Failed to load scan results:', error)
        }
      } else {
        setCandidates([])
        setScanId(null)
      }
      
      // Navigate to analysis page
      navigate('/analysis')
    } catch (error) {
      console.error('Failed to open file:', error)
      toast.error('Failed to open file', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setOpeningFileId(null)
    }
  }

  const handleDeleteFile = (file: ProjectFile) => {
    setFileToDelete(file)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return

    try {
      setDeletingFileId(fileToDelete.file_id)
      await deleteFileService(fileToDelete.file_id)
      toast.success('File deleted', {
        description: `${fileToDelete.filename} has been removed from the project.`
      })
      setDeleteConfirmOpen(false)
      setFileToDelete(null)
      await loadFiles()
      onProjectUpdate() // Refresh project to update file count
    } catch (error) {
      console.error('Failed to delete file:', error)
      toast.error('Failed to delete file', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setDeletingFileId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (files.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No files yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Upload your first firmware file to get started with analysis
        </p>
        <Button onClick={onUploadClick}>
          <Upload className="w-4 h-4 mr-2" />
          Upload First File
        </Button>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Files ({files.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadFiles}>
                Refresh
              </Button>
              <Button size="sm" onClick={onUploadClick}>
                <Plus className="w-4 h-4 mr-2" />
                Add File
              </Button>
            </div>
          </div>
      </CardHeader>
      <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Scan Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => {
                // Check if file is a modified version
                const isModified = /_v\d+/.test(file.filename)
                const versionMatch = file.filename.match(/_v(\d+)/)
                const version = versionMatch ? versionMatch[1] : null
                
                return (
                <TableRow key={file.file_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span>{file.filename}</span>
                          {version && (
                            <Badge variant="outline" className="text-xs">
                              v{version}
                            </Badge>
                          )}
                        </div>
                        {isModified && (
                          <span className="text-xs text-muted-foreground">
                            Modified version
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatBytes(file.size_bytes)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {isModified ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Uploaded {formatRelativeTime(file.uploaded_at)}
                          </span>
                          <span>Modified {formatRelativeTime(file.updated_at)}</span>
                        </>
                      ) : (
                        <span>Uploaded {formatRelativeTime(file.uploaded_at)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {file.has_scan ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="default" className="flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          {isModified ? 'Inherited scan' : 'Scanned'}
                        </Badge>
                        {file.latest_scan_at && (
                          <span className="text-xs text-muted-foreground">
                            {isModified 
                              ? `From original ${formatRelativeTime(file.latest_scan_at)}`
                              : formatRelativeTime(file.latest_scan_at)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" />
                        Not scanned
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenFile(file)}
                        disabled={openingFileId === file.file_id}
                      >
                        {openingFileId === file.file_id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Opening...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            Open
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteFile(file)}
                        disabled={deletingFileId === file.file_id}
                      >
                        {deletingFileId === file.file_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
      </CardContent>
    </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{fileToDelete?.filename}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteFile} disabled={deletingFileId !== null}>
              {deletingFileId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Scans Tab Content
 */
function ScansTab({ project, onOpenFile }: { project: Project; onOpenFile?: (fileId: string) => void }) {
  const [scans, setScans] = useState<ProjectScanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await getProjectScans(project.project_id)
        if (!cancelled) setScans(res.scans)
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load project scans:', e)
          toast.error('Failed to load scans', { description: e instanceof Error ? e.message : 'Unknown error' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [project.project_id])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (scans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No scans yet. Upload a file and run a scan from the Analysis page to see results here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scans ({scans.length})</CardTitle>
        <CardDescription>Scan history for all files in this project</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Candidates</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scans.map((scan) => (
              <TableRow key={scan.scan_id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-muted-foreground" />
                    {scan.filename}
                  </div>
                </TableCell>
                <TableCell>
                  {scan.status === 'completed' ? (
                    <Badge variant="default" className="flex items-center gap-1 w-fit">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </Badge>
                  ) : scan.status === 'failed' ? (
                    <Badge variant="destructive" className="w-fit">
                      Failed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{scan.status}</Badge>
                  )}
                </TableCell>
                <TableCell>{scan.candidates_found}</TableCell>
                <TableCell>
                  {scan.processing_time_ms != null ? `${(scan.processing_time_ms / 1000).toFixed(2)}s` : '—'}
                </TableCell>
                <TableCell>
                  {scan.completed_at ? formatRelativeTime(scan.completed_at) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {scan.status === 'completed' && onOpenFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenFile(scan.file_id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Open
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/**
 * Description Tab Content
 */
function DescriptionTab({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
        <CardDescription>Project description (visible when published to the Library)</CardDescription>
      </CardHeader>
      <CardContent>
        {project.description ? (
          <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
        ) : (
          <p className="text-muted-foreground italic">No description yet. Edit the project to add one.</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Settings Tab Content
 */
function SettingsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Project settings and configuration options will be available here.
        </p>
      </CardContent>
    </Card>
  )
}


/**
 * Loading Skeleton
 */
function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-2" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Project header skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

/**
 * Main ProjectDetail component
 */
export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { setFileData, setCandidates, setScanId, setIsScanning: setIsActivelyScanningMain } = useAnalysisStore()
  const { projects, isLoading, fetchProjects } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  usePageTitle(project ? project.name : 'Project')
  const [projectLoading, setProjectLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [, setOpeningFileId] = useState<string | null>(null)

  const handleOpenFileById = useCallback(async (fileId: string) => {
    if (!project) return
    try {
      setOpeningFileId(fileId)
      const { files } = await getProjectFiles(project.project_id)
      const file = files.find((f) => f.file_id === fileId)
      if (!file) {
        toast.error('File not found')
        return
      }
      const fileData = await downloadFile(file.file_id)
      const uint8Array = new Uint8Array(fileData)
      setFileData(uint8Array, file.filename, file.file_id)
      if (file.active_scan_id) {
        setScanId(file.active_scan_id)
        setIsActivelyScanningMain(true)
        setCandidates([])
      } else if (file.has_scan && file.latest_scan_id) {
        try {
          const scanData = await getScanResults(file.latest_scan_id)
          setScanId(file.latest_scan_id)
          setCandidates(scanData.candidates.map(convertCandidateResponse))
        } catch {
          setCandidates([])
          setScanId(null)
        }
      } else {
        setCandidates([])
        setScanId(null)
      }
      navigate('/analysis')
    } catch (error) {
      console.error('Failed to open file:', error)
      toast.error('Failed to open file', { description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setOpeningFileId(null)
    }
  }, [project, navigate, setFileData, setCandidates, setScanId, setIsActivelyScanningMain])

  const handleProjectUpdate = async () => {
    // Refresh project list to get updated project data
    await fetchProjects()
    // Update local project state from store
    if (projectId) {
      const state = useProjectStore.getState()
      const foundProject = state.projects.find(p => p.project_id === projectId)
      if (foundProject) {
        setProject(foundProject)
      }
    }
  }

  // Fetch projects if not loaded
  useEffect(() => {
    if (projects.length === 0 && !isLoading) {
      fetchProjects()
    }
  }, [projects.length, isLoading, fetchProjects])

  // Find the specific project
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const foundProject = projects.find(p => p.project_id === projectId)
      if (foundProject) {
        setProject(foundProject)
      } else {
        // Project not found - could be 404 or access denied
        console.error('Project not found:', projectId)
      }
      setProjectLoading(false)
    } else if (projectId && !isLoading && projects.length === 0) {
      // If we have a projectId but no projects loaded, try fetching
      fetchProjects()
    }
  }, [projectId, projects, isLoading, fetchProjects])

  // Show loading state
  if (projectLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <ProjectDetailSkeleton />
        </div>
      </div>
    )
  }

  // Show 404 if project not found
  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Project Not Found</h1>
            <p className="text-muted-foreground">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <ProjectHeader 
          project={project} 
          onProjectUpdate={handleProjectUpdate}
          onUploadClick={() => setUploadDialogOpen(true)}
        />

        {/* Upload File Dialog */}
        {project && (
          <UploadFileDialog 
            project={project} 
            open={uploadDialogOpen} 
            onOpenChange={setUploadDialogOpen}
            onUploadComplete={handleProjectUpdate}
          />
        )}

        {/* Tabs */}
        <Tabs defaultValue="files" className="space-y-6">
          <TabsList>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="scans" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Scans
            </TabsTrigger>
            <TabsTrigger value="description" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Description
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <FilesTab 
              project={project} 
              onProjectUpdate={handleProjectUpdate}
              onUploadClick={() => setUploadDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="scans">
            <ScansTab project={project} onOpenFile={handleOpenFileById} />
          </TabsContent>

          <TabsContent value="description">
            <DescriptionTab project={project} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
