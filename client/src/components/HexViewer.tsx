import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAnalysisStore } from '../store/analysisStore'
import { downloadFile } from '../services/fileService'
import { formatHexOffset, byteToHex, isPrintableAscii, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { toast } from '../hooks/use-toast'

const BYTES_PER_ROW = 16

export function HexViewer() {
  const fileData = useAnalysisStore((state) => state.fileData)
  const fileId = useAnalysisStore((state) => state.fileId)
  const fileName = useAnalysisStore((state) => state.fileName)
  const setFileData = useAnalysisStore((state) => state.setFileData)
  const selectedCandidate = useAnalysisStore((state) => state.selectedCandidate)
  const bookmarks = useAnalysisStore((state) => state.bookmarks)
  const annotations = useAnalysisStore((state) => state.annotations)
  
  const parentRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Calculate total rows
  const totalRows = fileData ? Math.ceil(fileData.length / BYTES_PER_ROW) : 0

  // Virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // Estimated row height in pixels
    overscan: 10,
  })

  // Function to determine byte color based on state
  const getByteColor = (byteIndex: number) => {
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

  // Fetch file from backend if fileId exists but fileData doesn't
  useEffect(() => {
    if (fileId && !fileData && !isLoading) {
      setIsLoading(true)
      downloadFile(fileId)
        .then((arrayBuffer) => {
          const data = new Uint8Array(arrayBuffer)
          setFileData(data, fileName || 'file.bin', fileId)
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
  }, [fileId, fileData, fileName, setFileData, isLoading])

  // Auto-scroll to selected candidate
  useEffect(() => {
    if (selectedCandidate && parentRef.current && fileData) {
      const row = Math.floor(selectedCandidate.offset / BYTES_PER_ROW)
      rowVirtualizer.scrollToIndex(row, { align: 'center' })
    }
  }, [selectedCandidate, rowVirtualizer, fileData])

  if (!fileData) {
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Hex Viewer</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
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
              const rowBytes = fileData.slice(rowOffset, rowOffset + BYTES_PER_ROW)

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
                              'hex-byte rounded px-0.5',
                              getByteColor(byteIndex)
                            )}
                            title={`Offset: ${formatHexOffset(byteIndex)}, Value: ${byte}`}
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
        </div>
      </CardContent>
    </Card>
  )
}

