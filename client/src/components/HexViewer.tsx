import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAnalysisStore } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { downloadFile } from '../services/fileService'
import { formatHexOffset, wordToHexLE, isPrintableAscii, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { toast } from '../hooks/use-toast'
import { EditPanel } from './EditPanel'
import { ArrowRight } from 'lucide-react'

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
  const [goToAddressInput, setGoToAddressInput] = useState('')

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

  /** Color for 16-bit word cell if either byte is in selection/edit/bookmark/annotation */
  const getWordColor = (byteIndex: number) => {
    const byte2 = byteIndex + 1
    const isEdited = Array.from(edits.values()).some(edit => {
      const size = edit.dataType === 'u8' ? 1 : edit.dataType.includes('16') ? 2 : 4
      const end = edit.offset + size
      return (byteIndex >= edit.offset && byteIndex < end) || (byte2 >= edit.offset && byte2 < end)
    })
    if (isEdited) return 'bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 border border-yellow-500/50'
    if (selectedCandidate) {
      const end = selectedCandidate.offset + selectedCandidate.size
      if ((byteIndex >= selectedCandidate.offset && byteIndex < end) || (byte2 >= selectedCandidate.offset && byte2 < end))
        return 'bg-primary/30 text-primary border border-primary/50'
    }
    const bookmarkLo = bookmarks.find((b) => b.offset === byteIndex)
    const bookmarkHi = bookmarks.find((b) => b.offset === byte2)
    if (bookmarkLo || bookmarkHi) return 'bg-destructive/30 text-destructive border border-destructive/50'
    const annotationLo = annotations.find((a) => byteIndex >= a.offset && byteIndex < a.offset + a.length)
    const annotationHi = annotations.find((a) => byte2 >= a.offset && byte2 < a.offset + a.length)
    if (annotationLo || annotationHi) return 'bg-success/30 text-success border border-success/50'
    return 'text-muted-foreground'
  }
  
  // Handle double-click on hex byte (or word start in word view)
  const handleByteDoubleClick = (byteIndex: number) => {
    setEditOffset(byteIndex)
  }

  // Go to address: parse hex and scroll to that row
  const handleGoToAddress = (e: React.FormEvent) => {
    e.preventDefault()
    const s = goToAddressInput.trim().replace(/^0x/i, '')
    if (!s) return
    const offset = parseInt(s, 16)
    if (isNaN(offset) || offset < 0) {
      toast.error('Invalid address', { description: 'Enter a valid hex address (e.g. 0x100 or 100)' })
      return
    }
    const maxOffset = displayData ? displayData.length - 1 : 0
    const clampedOffset = Math.min(Math.max(0, offset), maxOffset)
    const row = Math.floor(clampedOffset / BYTES_PER_ROW)
    rowVirtualizer.scrollToIndex(row, { align: 'center' })
    setGoToAddressInput(formatHexOffset(clampedOffset))
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
        <div className="h-full flex flex-col min-h-0">
          {/* Go to address bar */}
          <form
            onSubmit={handleGoToAddress}
            className="flex items-center gap-2 p-2 border-b border-border bg-muted/30 shrink-0"
          >
            <label htmlFor="hex-goto-address" className="text-sm font-medium whitespace-nowrap">
              Go to address
            </label>
            <Input
              id="hex-goto-address"
              type="text"
              value={goToAddressInput}
              onChange={(e) => setGoToAddressInput(e.target.value)}
              placeholder="0x00000"
              className="font-mono w-28 h-8"
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <div
            ref={parentRef}
            className="flex-1 overflow-auto bg-card min-h-0"
            style={{
              contain: 'strict',
              ...(displayData?.length ? { minHeight: '60vh' } : {}),
            }}
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

                    {/* 16-bit words (WinOLS-style, 4 hex digits per word) */}
                    <div className="flex gap-1 flex-1 flex-wrap">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((wordIndex) => {
                        const byteIndex = rowOffset + wordIndex * 2
                        const wordStr = displayData ? wordToHexLE(displayData, byteIndex) : '????'
                        return (
                          <span
                            key={wordIndex}
                            className={cn(
                              'hex-word rounded px-1 cursor-pointer hover:ring-2 hover:ring-ring',
                              getWordColor(byteIndex)
                            )}
                            title={`Offset: ${formatHexOffset(byteIndex)} (16-bit LE). Double-click to edit.`}
                            onDoubleClick={() => handleByteDoubleClick(byteIndex)}
                          >
                            {wordStr}
                          </span>
                        )
                      })}
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

