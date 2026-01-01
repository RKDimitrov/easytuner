import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAnalysisStore } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { downloadFile } from '../services/fileService'
import { formatHexOffset, byteToHex, isPrintableAscii, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { toast } from '../hooks/use-toast'
import { EditPanel } from './EditPanel'

const BYTES_PER_ROW = 16

interface HexViewerProps {
  /** If true, renders without Card wrapper (for use in tabs) */
  noCard?: boolean
}

export function HexViewer({ noCard = false }: HexViewerProps = {}) {
  const fileData = useAnalysisStore((state) => state.fileData)
  const fileId = useAnalysisStore((state) => state.fileId)
  const fileName = useAnalysisStore((state) => state.fileName)
  const setFileData = useAnalysisStore((state) => state.setFileData)
  const selectedCandidate = useAnalysisStore((state) => state.selectedCandidate)
  const bookmarks = useAnalysisStore((state) => state.bookmarks)
  const annotations = useAnalysisStore((state) => state.annotations)
  
  // Edit store
  const { modifiedFileData, edits, setFile: setEditFile } = useEditStore()
  
  const parentRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editOffset, setEditOffset] = useState<number | null>(null)

  // Use modified file data if available, otherwise original
  const displayData = modifiedFileData || fileData
  
  // Calculate total rows
  const totalRows = displayData ? Math.ceil(displayData.length / BYTES_PER_ROW) : 0

  // Virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // Estimated row height in pixels
    overscan: 10,
  })

  // Function to determine byte color based on state
  const getByteColor = (byteIndex: number) => {
    // Check if this byte is part of an edit
    const isEdited = Array.from(edits.values()).some(edit => {
      const size = edit.dataType === 'u8' ? 1 : edit.dataType.includes('16') ? 2 : 4
      return byteIndex >= edit.offset && byteIndex < edit.offset + size
    })
    
    if (isEdited) {
      return 'bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 border border-yellow-500/50'
    }
    
    // Selected candidate (blue)
    if (
      selectedCandidate &&
      byteIndex >= selectedCandidate.offset &&
      byteIndex < selectedCandidate.offset + selectedCandidate.size
    ) {
      return 'bg-primary/30 text-primary border border-primary/50'
    }

    // Bookmarks (red)
    const bookmark = bookmarks.find((b) => byteIndex === b.offset)
    if (bookmark) {
      return 'bg-destructive/30 text-destructive border border-destructive/50'
    }

    // Annotations (green)
    const annotation = annotations.find(
      (a) => byteIndex >= a.offset && byteIndex < a.offset + a.length
    )
    if (annotation) {
      return 'bg-success/30 text-success border border-success/50'
    }

    return 'text-muted-foreground'
  }
  
  // Handle double-click on hex byte
  const handleByteDoubleClick = (byteIndex: number) => {
    setEditOffset(byteIndex)
  }

  // Fetch file from backend if fileId exists but fileData doesn't
  useEffect(() => {
    if (fileId && !fileData && !isLoading) {
      setIsLoading(true)
      downloadFile(fileId)
        .then((arrayBuffer) => {
          const data = new Uint8Array(arrayBuffer)
          setFileData(data, fileName || 'file.bin', fileId)
          // Initialize edit store
          if (fileId) {
            setEditFile(fileId, data)
          }
          setIsLoading(false)
        })
        .catch((error) => {
          console.error('Failed to load file:', error)
          toast.error('Failed to load file', {
            description: error instanceof Error ? error.message : 'Could not load file from server'
          })
          setIsLoading(false)
        })
    }
  }, [fileId, fileData, fileName, setFileData, isLoading, setEditFile])
  
  // Update edit store when file data changes
  useEffect(() => {
    if (fileData && fileId) {
      setEditFile(fileId, fileData)
    }
  }, [fileData, fileId, setEditFile])

  // Auto-scroll to selected candidate
  useEffect(() => {
    if (selectedCandidate && parentRef.current && displayData) {
      const row = Math.floor(selectedCandidate.offset / BYTES_PER_ROW)
      rowVirtualizer.scrollToIndex(row, { align: 'center' })
    }
  }, [selectedCandidate, rowVirtualizer, displayData])
  
  const content = (
        <div
          ref={parentRef}
          className="h-full overflow-auto bg-card"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowOffset = virtualRow.index * BYTES_PER_ROW
              const rowBytes = displayData ? displayData.slice(rowOffset, rowOffset + BYTES_PER_ROW) : new Uint8Array(0)

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="font-mono text-sm px-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex gap-4">
                    {/* Address column */}
                    <span className="hex-address w-24 flex-shrink-0">
                      {formatHexOffset(rowOffset)}
                    </span>

                    {/* Hex bytes */}
                    <div className="flex gap-1 flex-1">
                      {Array.from(rowBytes).map((byte, colIndex) => {
                        const byteIndex = rowOffset + colIndex
                        return (
                          <span
                            key={colIndex}
                            className={cn(
                              'hex-byte rounded px-0.5 cursor-pointer hover:ring-2 hover:ring-ring',
                              getByteColor(byteIndex)
                            )}
                            title={`Offset: ${formatHexOffset(byteIndex)}, Value: ${byte} (Double-click to edit)`}
                            onDoubleClick={() => handleByteDoubleClick(byteIndex)}
                          >
                            {byteToHex(byte)}
                          </span>
                        )
                      })}
                      {/* Padding for incomplete rows */}
                      {rowBytes.length < BYTES_PER_ROW &&
                        Array.from({ length: BYTES_PER_ROW - rowBytes.length }).map((_, i) => (
                          <span key={`pad-${i}`} className="hex-byte opacity-0">
                            00
                          </span>
                        ))}
                    </div>

                    {/* ASCII column */}
                    <div className="hex-ascii w-40 flex-shrink-0 border-l border-border pl-4">
                      {Array.from(rowBytes)
                        .map((byte) => (isPrintableAscii(byte) ? String.fromCharCode(byte) : '.'))
                        .join('')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Edit Panel */}
          <EditPanel
            offset={editOffset}
            onClose={() => setEditOffset(null)}
          />
        </div>
  )

  if (!displayData) {
    const emptyContent = (
      <div className="h-full flex items-center justify-center">
        {isLoading ? (
          <p className="text-muted-foreground">Loading file...</p>
        ) : (
          <p className="text-muted-foreground">No file loaded</p>
        )}
      </div>
    )

    if (noCard) {
      return emptyContent
    }

    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading file...</p>
          ) : (
            <p className="text-muted-foreground">No file loaded</p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (noCard) {
    return content
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Hex Viewer</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {content}
      </CardContent>
    </Card>
  )
}

