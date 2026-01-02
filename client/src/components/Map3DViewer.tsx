/**
 * Map3DViewer Component
 * 
 * Interactive 3D/2D visualization of ECU maps with proper data type interpretation
 */

import { useRef, useState, useCallback, useMemo } from 'react'
import { MapCandidate } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { RotateCcw, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { formatHexOffset } from '../lib/utils'

interface Map3DViewerProps {
  candidate: MapCandidate
  fileData: Uint8Array
  /** If true, renders without Card wrapper (for use in tabs) */
  noCard?: boolean
}

/**
 * Read a value from binary data based on data type
 */
function readValue(
  data: Uint8Array,
  offset: number,
  dataType: string,
  elementSize: number
): number {
  if (offset + elementSize > data.length) {
    return 0
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, elementSize)
  
  switch (dataType.toLowerCase()) {
    case 'u8':
      return view.getUint8(0)
    case 'u16le':
      return view.getUint16(0, true)
    case 'u16be':
      return view.getUint16(0, false)
    case 'u32le':
      return view.getUint32(0, true)
    case 'u32be':
      return view.getUint32(0, false)
    case 's16le':
      return view.getInt16(0, true)
    case 's16be':
      return view.getInt16(0, false)
    case 's32le':
      return view.getInt32(0, true)
    case 's32be':
      return view.getInt32(0, false)
    case 'float32le':
      return view.getFloat32(0, true)
    case 'float32be':
      return view.getFloat32(0, false)
    default:
      // Default to uint16 little endian
      return elementSize === 2 ? view.getUint16(0, true) : view.getUint8(0)
  }
}

/**
 * Get color for a normalized value (0-1)
 */
function getColorForValue(normalizedValue: number): string {
  // Use a better color scheme: blue (low) -> cyan -> green -> yellow -> red (high)
  if (normalizedValue < 0.25) {
    // Blue to cyan
    const t = normalizedValue / 0.25
    return `hsl(${240 - t * 60}, 80%, ${40 + t * 20}%)`
  } else if (normalizedValue < 0.5) {
    // Cyan to green
    const t = (normalizedValue - 0.25) / 0.25
    return `hsl(${180 - t * 60}, 80%, ${50 + t * 10}%)`
  } else if (normalizedValue < 0.75) {
    // Green to yellow
    const t = (normalizedValue - 0.5) / 0.25
    return `hsl(${120 - t * 60}, 80%, ${50 + t * 10}%)`
  } else {
    // Yellow to red
    const t = (normalizedValue - 0.75) / 0.25
    return `hsl(${60 - t * 60}, 80%, ${55 - t * 15}%)`
  }
}

export function Map3DViewer({ candidate, fileData, noCard = false }: Map3DViewerProps) {
  // Get modified file data from edit store (if available)
  const { modifiedFileData } = useEditStore()
  
  // Use modified data if available, otherwise use original
  const displayData = modifiedFileData || fileData
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number; value: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Get data type and element size
  const dataType = candidate.dataType || 'u16le'
  const elementSize = candidate.elementSize || 2

  // Extract and parse map data
  const mapData = useMemo(() => {
    if (!candidate.dimensions || !displayData) {
      return null
    }

    try {
      const { x: xSize, y: ySize } = candidate.dimensions
      const dataStart = candidate.offset
      const dataEnd = Math.min(dataStart + candidate.size, displayData.length)
      
      const values: number[][] = []
      let minValue = Infinity
      let maxValue = -Infinity

      // Read values based on data type
      for (let y = 0; y < ySize; y++) {
        const row: number[] = []
        for (let x = 0; x < xSize; x++) {
          const index = y * xSize + x
          const byteOffset = dataStart + index * elementSize
          
          if (byteOffset + elementSize <= dataEnd) {
            const value = readValue(displayData, byteOffset, dataType, elementSize)
            row.push(value)
            minValue = Math.min(minValue, value)
            maxValue = Math.max(maxValue, value)
          } else {
            row.push(0)
          }
        }
        values.push(row)
      }

      return {
        values,
        minValue: minValue === Infinity ? 0 : minValue,
        maxValue: maxValue === -Infinity ? 0 : maxValue,
        xSize,
        ySize,
      }
    } catch (e) {
      setError(`Failed to parse map data: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return null
    }
  }, [candidate, displayData, dataType, elementSize])

  const handleReset = () => {
    setZoom(1)
    setSelectedCell(null)
  }

  const handleFullscreen = () => {
    if (!containerRef.current) return
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const handleCellHover = useCallback((x: number, y: number, value: number) => {
    setHoveredCell({ x, y, value })
  }, [])

  const handleCellClick = useCallback((x: number, y: number, value: number) => {
    setSelectedCell({ x, y, value })
  }, [])

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null)
  }, [])

  // Render 2D map
  const render2DMap = () => {
    if (!mapData) return null

    const { values, minValue, maxValue, xSize, ySize } = mapData
    const valueRange = maxValue - minValue || 1

    return (
      <div className="w-full h-full flex flex-col">
        {/* Color Legend */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Value Scale:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getColorForValue(0) }} />
              <span className="text-xs text-muted-foreground">{minValue.toFixed(0)}</span>
              <div className="w-32 h-2 rounded-full overflow-hidden flex">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: getColorForValue(i / 19) }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{maxValue.toFixed(0)}</span>
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getColorForValue(1) }} />
            </div>
          </div>
          {selectedCell && (
            <div className="text-sm">
              <span className="text-muted-foreground">Selected: </span>
              <span className="font-mono">
                [{selectedCell.x}, {selectedCell.y}] = {selectedCell.value.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Interactive Grid */}
        <div className="flex-1 overflow-auto">
          <div
            className="inline-block border border-border rounded"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <div className="grid gap-0.5 p-1 bg-muted/20">
              {values.map((row, y) => (
                <div key={y} className="flex gap-0.5">
                  {row.map((value, x) => {
                    const normalizedValue = (value - minValue) / valueRange
                    const isHovered = hoveredCell?.x === x && hoveredCell?.y === y
                    const isSelected = selectedCell?.x === x && selectedCell?.y === y
                    
                    const cellOffset = candidate.offset + (y * xSize + x) * elementSize
                    const tooltipText = `Cell [${x}, ${y}]\nValue: ${value.toFixed(4)}\nOffset: 0x${cellOffset.toString(16).toUpperCase().padStart(8, '0')}\nNormalized: ${(normalizedValue * 100).toFixed(1)}%`
                    
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={`
                          relative flex items-center justify-center
                          min-w-[40px] min-h-[40px] 
                          border border-border/50 rounded
                          cursor-pointer transition-all group
                          ${isHovered ? 'ring-2 ring-primary ring-offset-1 scale-105 z-10' : ''}
                          ${isSelected ? 'ring-2 ring-accent ring-offset-1' : ''}
                        `}
                        style={{
                          backgroundColor: getColorForValue(normalizedValue),
                        }}
                        title={tooltipText}
                        onMouseEnter={() => handleCellHover(x, y, value)}
                        onMouseLeave={handleCellLeave}
                        onClick={() => handleCellClick(x, y, value)}
                      >
                        {/* Show value for small maps */}
                        {xSize <= 12 && ySize <= 12 && (
                          <span className="text-xs font-mono text-foreground/80 drop-shadow">
                            {value.toFixed(0)}
                          </span>
                        )}
                        {/* Highlight indicator */}
                        {(isHovered || isSelected) && (
                          <div className="absolute inset-0 border-2 border-white/50 rounded" />
                        )}
                        {/* Custom tooltip on hover */}
                        {isHovered && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-md shadow-lg z-50 pointer-events-none whitespace-nowrap">
                            <div className="space-y-1 text-sm">
                              <div className="font-semibold">Cell [{x}, {y}]</div>
                              <div>
                                <div>Value: <span className="font-mono">{value.toFixed(4)}</span></div>
                                <div>Offset: <span className="font-mono">0x{cellOffset.toString(16).toUpperCase().padStart(8, '0')}</span></div>
                                <div>Normalized: <span className="font-mono">{(normalizedValue * 100).toFixed(1)}%</span></div>
                              </div>
                            </div>
                            {/* Tooltip arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-between mt-2 px-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              disabled={zoom >= 3}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Click a cell to select • Hover for details
          </div>
        </div>
      </div>
    )
  }

  const headerContent = (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold">
          3D Map Visualization - {candidate.type} Map
        </h3>
        <div className="text-sm text-muted-foreground mt-1">
          Offset: {formatHexOffset(candidate.offset)} | 
          Size: {candidate.size} bytes | 
          Confidence: {candidate.confidence}% | 
          Dimensions: {candidate.type === '1D' 
            ? candidate.dimensions?.x 
            : candidate.type === '3D'
            ? `${candidate.dimensions?.x}×${candidate.dimensions?.y || 0}×${candidate.dimensions?.z || 0}`
            : `${candidate.dimensions?.x}×${candidate.dimensions?.y || 0}`} |
          Type: {dataType} ({elementSize} bytes)
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset View
        </Button>
        <Button variant="outline" size="sm" onClick={handleFullscreen}>
          <Maximize2 className="w-4 h-4 mr-2" />
          Fullscreen
        </Button>
      </div>
    </div>
  )

  if (error) {
    const errorContent = (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading 3D view</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )

    if (noCard) {
      return errorContent
    }

    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          {errorContent}
        </CardContent>
      </Card>
    )
  }

  if (!candidate.dimensions) {
    const noDimensionsContent = (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No dimension data available for 3D visualization</p>
      </div>
    )

    if (noCard) {
      return noDimensionsContent
    }

    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          {noDimensionsContent}
        </CardContent>
      </Card>
    )
  }

  const viewerContent = (
    <div ref={containerRef} className="w-full h-full bg-background relative flex flex-col">
      {candidate.type === '2D' && render2DMap()}
      {candidate.type === '1D' && (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">1D visualization coming soon</p>
        </div>
      )}
      {candidate.type === '3D' && (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">3D visualization coming soon</p>
        </div>
      )}
    </div>
  )

  if (noCard) {
    return (
      <div className="h-full flex flex-col p-4">
        {headerContent}
        <div className="flex-1 overflow-hidden">
          {viewerContent}
        </div>
      </div>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            3D Map Visualization - {candidate.type} Map
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset View
            </Button>
            <Button variant="outline" size="sm" onClick={handleFullscreen}>
              <Maximize2 className="w-4 h-4 mr-2" />
              Fullscreen
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          Offset: {formatHexOffset(candidate.offset)} | 
          Size: {candidate.size} bytes | 
          Confidence: {candidate.confidence}% | 
          Dimensions: {candidate.type === '1D' 
            ? candidate.dimensions.x 
            : candidate.type === '3D'
            ? `${candidate.dimensions.x}×${candidate.dimensions.y || 0}×${candidate.dimensions.z || 0}`
            : `${candidate.dimensions.x}×${candidate.dimensions.y || 0}`} |
          Type: {dataType} ({elementSize} bytes)
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-4">
        {viewerContent}
      </CardContent>
    </Card>
  )
}
