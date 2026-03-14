/**
 * Map3DViewer Component
 * 
 * Interactive 3D/2D visualization of ECU maps with proper data type interpretation
 */

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { MapCandidate } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { RotateCcw, Maximize2, ZoomIn, ZoomOut, Grid3x3, Box } from 'lucide-react'
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
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number; value: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | '3d'>('grid')
  const [rotationX, setRotationX] = useState(-Math.PI / 4) // -45 degrees (better default view)
  const [rotationY, setRotationY] = useState(Math.PI / 3) // 60 degrees (better default view)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cursor3D, setCursor3D] = useState<{ x: number; y: number; value: number } | null>(null)

  // Get data type and element size
  const dataType = candidate.dataType || 'u16le'
  const elementSize = candidate.elementSize || 2

  // Extract and parse map data
  const mapData = useMemo(() => {
    if (!candidate.dimensions || !displayData) {
      return null
    }

    try {
      const { x: xSize, y: ySize, z: zSize } = candidate.dimensions
      const skipBytes = candidate.skipBytes ?? 0
      const dataStart = candidate.offset + skipBytes
      const numElements = xSize * ySize * (zSize ?? 1)
      const dataEnd = Math.min(dataStart + numElements * elementSize, displayData.length)
      
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
    setRotationX(-Math.PI / 4) // Reset to default -45 degrees
    setRotationY(Math.PI / 3) // Reset to default 60 degrees
  }

  // 3D transformation helpers
  const rotate3D = (x: number, y: number, z: number, rotX: number, rotY: number) => {
    // Rotate around X axis
    const cosX = Math.cos(rotX)
    const sinX = Math.sin(rotX)
    const y1 = y * cosX - z * sinX
    const z1 = y * sinX + z * cosX
    
    // Rotate around Y axis
    const cosY = Math.cos(rotY)
    const sinY = Math.sin(rotY)
    const x1 = x * cosY + z1 * sinY
    const z2 = -x * sinY + z1 * cosY
    
    return { x: x1, y: y1, z: z2 }
  }

  // Mouse interaction for 3D view
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewMode === '3d') {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }, [viewMode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && viewMode === '3d') {
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      
      setRotationY(prev => prev + deltaX * 0.01)
      setRotationX(prev => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev - deltaY * 0.01)))
      
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }, [isDragging, dragStart, viewMode])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Render 3D surface view
  const render3DSurface = useCallback(() => {
    if (!mapData || !canvas3DRef.current) return null

    const canvas = canvas3DRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { values, minValue, maxValue, xSize, ySize } = mapData
    const valueRange = maxValue - minValue || 1

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height

    // Clear canvas
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw grid background (WinOLS style - more subtle)
    ctx.strokeStyle = '#1a1a2a'
    ctx.lineWidth = 0.5
    const gridSpacing = 30
    ctx.globalAlpha = 0.3
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // 3D projection parameters - improved for better visibility
    const centerX = width / 2
    const centerY = height / 2
    const baseScale = Math.min(width, height) * 0.5 // Increased scale for better zoom
    const distance = 3.2 // Closer camera for better view
    const heightScale = 1.2 // Much larger height scaling for WinOLS-like effect

    // Project 3D points to 2D with improved perspective
    const project = (x: number, y: number, z: number) => {
      const rotated = rotate3D(x, y, z, rotationX, rotationY)
      const zPos = rotated.z + distance
      const fov = 1.2
      const scale = (fov / zPos) * baseScale
      
      return {
        x: centerX + rotated.x * scale,
        y: centerY + rotated.y * scale,
        z: zPos
      }
    }

    // Draw surface
    const surfacePoints: { x: number; y: number; z: number; value: number; screen: { x: number; y: number; z: number } }[][] = []

    // Calculate all points with better scaling
    // Normalize map dimensions to fit nicely in view
    const mapAspect = xSize / ySize
    const viewAspect = width / height
    let mapWidth = 1.6 // Increased size
    let mapHeight = 1.6
    
    if (mapAspect > viewAspect) {
      mapHeight = mapWidth / mapAspect
    } else {
      mapWidth = mapHeight * mapAspect
    }
    
    for (let y = 0; y < ySize; y++) {
      const row: typeof surfacePoints[0] = []
      for (let x = 0; x < xSize; x++) {
        const value = values[y][x]
        const normalizedValue = (value - minValue) / valueRange
        // Use exponential scaling for more dramatic height differences (WinOLS style)
        const normalizedExp = Math.pow(normalizedValue, 0.8) // Slight curve for better visibility
        const z = (normalizedExp - 0.5) * heightScale * 2 // Center around 0, scale up
        
        // Center the map and scale appropriately
        const worldX = ((x / (xSize - 1)) - 0.5) * mapWidth
        const worldY = ((y / (ySize - 1)) - 0.5) * mapHeight
        const worldZ = z
        
        const screen = project(worldX, worldY, worldZ)
        
        row.push({ x: worldX, y: worldY, z: worldZ, value, screen })
      }
      surfacePoints.push(row)
    }

    // Draw surface as quads (WinOLS style) with proper depth sorting
    const quads: Array<{
      p1: typeof surfacePoints[0][0]
      p2: typeof surfacePoints[0][0]
      p3: typeof surfacePoints[0][0]
      p4: typeof surfacePoints[0][0]
      depth: number
      value: number
    }> = []
    
    // Collect all quads with depth
    for (let y = 0; y < ySize - 1; y++) {
      for (let x = 0; x < xSize - 1; x++) {
        const p1 = surfacePoints[y][x]
        const p2 = surfacePoints[y][x + 1]
        const p3 = surfacePoints[y + 1][x + 1]
        const p4 = surfacePoints[y + 1][x]

        // Calculate average Z for depth sorting
        const avgZ = (p1.screen.z + p2.screen.z + p3.screen.z + p4.screen.z) / 4
        
        // Only add if in front
        if (avgZ > 0) {
          quads.push({
            p1, p2, p3, p4,
            depth: avgZ,
            value: p1.value
          })
        }
      }
    }
    
    // Sort by depth (back to front for proper rendering)
    quads.sort((a, b) => b.depth - a.depth)
    
    // Draw sorted quads with lighting for better depth perception (WinOLS style)
    ctx.lineWidth = 1
    for (const quad of quads) {
      const normalizedValue = (quad.value - minValue) / valueRange
      let color = getColorForValue(normalizedValue)
      
      // Calculate lighting based on surface normal (WinOLS style)
      // Compute normal vector from quad points in world space
      const v1 = {
        x: quad.p2.x - quad.p1.x,
        y: quad.p2.y - quad.p1.y,
        z: quad.p2.z - quad.p1.z
      }
      const v2 = {
        x: quad.p4.x - quad.p1.x,
        y: quad.p4.y - quad.p1.y,
        z: quad.p4.z - quad.p1.z
      }
      const normal = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
      }
      const normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z)
      if (normalLength > 0) {
        normal.x /= normalLength
        normal.y /= normalLength
        normal.z /= normalLength
      }
      
      // Rotate normal to match view rotation
      const rotatedNormal = rotate3D(normal.x, normal.y, normal.z, rotationX, rotationY)
      
      // Light direction (from top-right-front, adjusted for view)
      const lightDir = { x: 0.3, y: -0.5, z: 0.8 }
      const lightLength = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z)
      if (lightLength > 0) {
        lightDir.x /= lightLength
        lightDir.y /= lightLength
        lightDir.z /= lightLength
      }
      
      // Calculate dot product for lighting
      const dot = rotatedNormal.x * lightDir.x + rotatedNormal.y * lightDir.y + rotatedNormal.z * lightDir.z
      const lightIntensity = Math.max(0.4, Math.min(1.0, 0.6 + dot * 0.4)) // 0.4 to 1.0 range
      
      // Apply lighting to color
      const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
      if (hslMatch) {
        const h = parseInt(hslMatch[1])
        const s = parseInt(hslMatch[2])
        let l = parseInt(hslMatch[3])
        l = Math.min(85, Math.max(15, l * lightIntensity)) // Adjust lightness with better range
        color = `hsl(${h}, ${s}%, ${l}%)`
      }
      
      ctx.fillStyle = color
      ctx.strokeStyle = '#00000020' // Very subtle dark outline
      ctx.globalAlpha = 0.95
      
      ctx.beginPath()
      ctx.moveTo(quad.p1.screen.x, quad.p1.screen.y)
      ctx.lineTo(quad.p2.screen.x, quad.p2.screen.y)
      ctx.lineTo(quad.p3.screen.x, quad.p3.screen.y)
      ctx.lineTo(quad.p4.screen.x, quad.p4.screen.y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    
    // Draw wireframe edges (WinOLS style) - subtle grid lines
    ctx.strokeStyle = '#ffffff15' // Very subtle white wireframe
    ctx.lineWidth = 0.5
    ctx.globalAlpha = 0.4
    for (let y = 0; y < ySize - 1; y++) {
      for (let x = 0; x < xSize - 1; x++) {
        const p1 = surfacePoints[y][x]
        const p2 = surfacePoints[y][x + 1]
        const p4 = surfacePoints[y + 1][x]
        
        // Draw horizontal edges
        if (p1.screen.z > 0 && p2.screen.z > 0) {
          ctx.beginPath()
          ctx.moveTo(p1.screen.x, p1.screen.y)
          ctx.lineTo(p2.screen.x, p2.screen.y)
          ctx.stroke()
        }
        // Draw vertical edges
        if (p1.screen.z > 0 && p4.screen.z > 0) {
          ctx.beginPath()
          ctx.moveTo(p1.screen.x, p1.screen.y)
          ctx.lineTo(p4.screen.x, p4.screen.y)
          ctx.stroke()
        }
      }
    }
    ctx.globalAlpha = 1

    // Draw grid points (yellow markers) - WinOLS style, only visible points
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffd700'
    ctx.strokeStyle = '#00000060'
    ctx.lineWidth = 1.5
    for (let y = 0; y < ySize; y++) {
      for (let x = 0; x < xSize; x++) {
        const point = surfacePoints[y][x]
        if (point.screen.z > 0 && point.screen.x >= -10 && point.screen.x <= width + 10 && 
            point.screen.y >= -10 && point.screen.y <= height + 10) {
          // Draw slightly larger points for better visibility
          ctx.beginPath()
          ctx.arc(point.screen.x, point.screen.y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Draw axes with better visibility (WinOLS style)
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.8
    
    // X axis (red) - horizontal
    const xAxisStart = project(-mapWidth * 0.55, 0, 0)
    const xAxisEnd = project(mapWidth * 0.55, 0, 0)
    if (xAxisStart.z > 0 && xAxisEnd.z > 0) {
      ctx.strokeStyle = '#ff6666'
      ctx.beginPath()
      ctx.moveTo(xAxisStart.x, xAxisStart.y)
      ctx.lineTo(xAxisEnd.x, xAxisEnd.y)
      ctx.stroke()
    }
    
    // Y axis (green) - vertical
    const yAxisStart = project(0, -mapHeight * 0.55, 0)
    const yAxisEnd = project(0, mapHeight * 0.55, 0)
    if (yAxisStart.z > 0 && yAxisEnd.z > 0) {
      ctx.strokeStyle = '#66ff66'
      ctx.beginPath()
      ctx.moveTo(yAxisStart.x, yAxisStart.y)
      ctx.lineTo(yAxisEnd.x, yAxisEnd.y)
      ctx.stroke()
    }
    
    // Z axis (blue) - height
    const zAxisStart = project(0, 0, -heightScale * 0.4)
    const zAxisEnd = project(0, 0, heightScale * 0.4)
    if (zAxisStart.z > 0 && zAxisEnd.z > 0) {
      ctx.strokeStyle = '#6699ff'
      ctx.beginPath()
      ctx.moveTo(zAxisStart.x, zAxisStart.y)
      ctx.lineTo(zAxisEnd.x, zAxisEnd.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Handle mouse hover for cursor display
    const handleCanvasMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      // Find closest point
      let closest: { x: number; y: number; value: number; dist: number } | null = null
      for (let y = 0; y < ySize; y++) {
        for (let x = 0; x < xSize; x++) {
          const point = surfacePoints[y][x]
          if (point.screen.z > 0) {
            const dist = Math.sqrt(
              Math.pow(point.screen.x - mouseX, 2) + 
              Math.pow(point.screen.y - mouseY, 2)
            )
            if (!closest || dist < closest.dist) {
              closest = { x, y, value: point.value, dist }
            }
          }
        }
      }
      
      if (closest && closest.dist < 30) {
        setCursor3D(closest)
      } else {
        setCursor3D(null)
      }
    }

    canvas.addEventListener('mousemove', handleCanvasMouseMove)
    return () => {
      canvas.removeEventListener('mousemove', handleCanvasMouseMove)
    }
  }, [mapData, rotationX, rotationY])

  // Re-render 3D surface when rotation changes
  useEffect(() => {
    if (viewMode === '3d' && mapData && canvas3DRef.current) {
      const cleanup = render3DSurface()
      return cleanup || undefined
    }
  }, [viewMode, mapData, rotationX, rotationY, render3DSurface])

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

  // Render 2D map (grid view)
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

        {/* Zoom Controls and Mode Selector */}
        <div className="flex items-center justify-between mt-2 px-2">
          <div className="flex items-center gap-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-1 border-r border-border pr-3 mr-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === '3d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('3d')}
              >
                <Box className="w-4 h-4 mr-2" />
                3D Surface
              </Button>
            </div>
            {/* Zoom Controls (only show in grid mode) */}
            {viewMode === 'grid' && (
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
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {viewMode === 'grid' ? 'Click a cell to select • Hover for details' : 'Drag to rotate • Hover for values'}
          </div>
        </div>
      </div>
    )
  }

  // Render 3D surface view
  const render3DSurfaceView = () => {
    if (!mapData) return null

    const { minValue, maxValue } = mapData

    return (
      <div className="w-full h-full flex flex-col relative">
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
          {cursor3D && (
            <div className="text-sm bg-popover/90 px-3 py-1 rounded border border-border">
              <span className="text-muted-foreground">Cursor: </span>
              <span className="font-mono">
                (X={cursor3D.x}, Y={cursor3D.y}), Value: {cursor3D.value.toFixed(0)}
              </span>
            </div>
          )}
        </div>

        {/* 3D Canvas */}
        <div className="flex-1 relative overflow-hidden border border-border rounded">
          <canvas
            ref={canvas3DRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Drag to rotate • Scroll to zoom
          </div>
        </div>

        {/* Mode Selector and Controls for 3D View */}
        <div className="flex items-center justify-between mt-2 px-2">
          <div className="flex items-center gap-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-1 border-r border-border pr-3 mr-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === '3d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('3d')}
              >
                <Box className="w-4 h-4 mr-2" />
                3D Surface
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Drag to rotate • Hover for values
          </div>
        </div>
      </div>
    )
  }

  const headerContent = (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold">
          3D Map Visualization - {candidate.type === 'single' ? 'Single value' : candidate.type} Map
        </h3>
        <div className="text-sm text-muted-foreground mt-1">
          Offset: {formatHexOffset(candidate.offset)} | 
          Size: {candidate.size} bytes | 
          Confidence: {candidate.confidence}% | 
          Dimensions: {candidate.type === 'single'
            ? '1'
            : candidate.type === '1D' 
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
      {(candidate.type === 'single' || candidate.type === '2D') && (
        <>
          {viewMode === 'grid' && render2DMap()}
          {viewMode === '3d' && render3DSurfaceView()}
        </>
      )}
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
      <div className="h-full w-full min-w-0 flex flex-col p-4">
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
            3D Map Visualization - {candidate.type === 'single' ? 'Single value' : candidate.type} Map
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
          Dimensions: {candidate.type === 'single'
            ? '1'
            : candidate.type === '1D' 
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
