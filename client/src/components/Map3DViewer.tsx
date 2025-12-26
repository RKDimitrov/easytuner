/**
 * Map3DViewer Component
 * 
 * 3D visualization of ECU maps using Three.js
 */

import { useEffect, useRef, useState } from 'react'
import { MapCandidate } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { formatHexOffset } from '../lib/utils'

interface Map3DViewerProps {
  candidate: MapCandidate
  fileData: Uint8Array
  /** If true, renders without Card wrapper (for use in tabs) */
  noCard?: boolean
}

export function Map3DViewer({ candidate, fileData, noCard = false }: Map3DViewerProps) {
  // Get modified file data from edit store (if available)
  const { modifiedFileData } = useEditStore()
  
  // Use modified data if available, otherwise use original
  const displayData = modifiedFileData || fileData
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !candidate.dimensions) {
      return
    }

    // For now, show a placeholder visualization
    // In a full implementation, you would use Three.js or similar
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { dimensions } = candidate
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    canvas.width = width
    canvas.height = height

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)

    // Draw visualization based on map type (use displayData which includes edits)
    if (candidate.type === '2D' && dimensions.x && dimensions.y) {
      draw2DMap(ctx, width, height, dimensions.x, dimensions.y, candidate, displayData)
    } else if (candidate.type === '3D' && dimensions.x && dimensions.y && dimensions.z) {
      draw3DMap(ctx, width, height, dimensions.x, dimensions.y, dimensions.z, candidate, displayData)
    } else if (candidate.type === '1D' && dimensions.x) {
      draw1DMap(ctx, width, height, dimensions.x, candidate, displayData)
    }
  }, [candidate, displayData])

  const draw2DMap = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    xSize: number,
    ySize: number,
    candidate: MapCandidate,
    fileData: Uint8Array
  ) => {
    const padding = { top: 60, right: 60, bottom: 60, left: 60 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const cellWidth = plotWidth / xSize
    const cellHeight = plotHeight / ySize

    // Extract data from file
    const dataStart = candidate.offset
    const dataEnd = Math.min(dataStart + candidate.size, fileData.length)
    const data = fileData.slice(dataStart, dataEnd)

    // Find min/max for better color scaling
    let minValue = 255
    let maxValue = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i] < minValue) minValue = data[i]
      if (data[i] > maxValue) maxValue = data[i]
    }
    const valueRange = maxValue - minValue || 1

    // Draw grid background
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight)

    // Draw heatmap with improved color gradient
    for (let y = 0; y < ySize; y++) {
      for (let x = 0; x < xSize; x++) {
        const index = y * xSize + x
        if (index < data.length) {
          const value = data[index]
          const normalizedValue = (value - minValue) / valueRange
          
          // HSL color gradient: blue (low) -> cyan -> yellow -> red (high)
          const hue = 240 - (normalizedValue * 180) // 240 (blue) to 60 (yellow)
          const saturation = 70
          const lightness = 30 + (normalizedValue * 40) // 30-70% lightness
          
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
          ctx.fillRect(
            padding.left + x * cellWidth,
            padding.top + y * cellHeight,
            cellWidth - 0.5,
            cellHeight - 0.5
          )
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    for (let x = 0; x <= xSize; x++) {
      ctx.beginPath()
      ctx.moveTo(padding.left + x * cellWidth, padding.top)
      ctx.lineTo(padding.left + x * cellWidth, padding.top + plotHeight)
      ctx.stroke()
    }
    for (let y = 0; y <= ySize; y++) {
      ctx.beginPath()
      ctx.moveTo(padding.left, padding.top + y * cellHeight)
      ctx.lineTo(padding.left + plotWidth, padding.top + y * cellHeight)
      ctx.stroke()
    }

    // Draw X-axis labels
    ctx.fillStyle = '#888888'
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const xLabelInterval = Math.max(1, Math.floor(xSize / 20))
    for (let x = 0; x < xSize; x += xLabelInterval) {
      ctx.fillText(
        x.toString(),
        padding.left + x * cellWidth + cellWidth / 2,
        padding.top + plotHeight + 10
      )
    }
    if (xSize > 0 && (xSize - 1) % xLabelInterval !== 0) {
      ctx.fillText(
        (xSize - 1).toString(),
        padding.left + (xSize - 1) * cellWidth + cellWidth / 2,
        padding.top + plotHeight + 10
      )
    }
    
    // Draw Y-axis labels (rotated)
    ctx.save()
    ctx.translate(padding.left - 15, padding.top + plotHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const yLabelInterval = Math.max(1, Math.floor(ySize / 20))
    for (let y = 0; y < ySize; y += yLabelInterval) {
      ctx.fillText(
        y.toString(),
        0,
        -plotHeight / 2 + y * cellHeight + cellHeight / 2
      )
    }
    if (ySize > 0 && (ySize - 1) % yLabelInterval !== 0) {
      ctx.fillText(
        (ySize - 1).toString(),
        0,
        -plotHeight / 2 + (ySize - 1) * cellHeight + cellHeight / 2
      )
    }
    ctx.restore()
  }

  const draw3DMap = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    xSize: number,
    ySize: number,
    zSize: number,
    candidate: MapCandidate,
    fileData: Uint8Array
  ) => {
    // Draw 3D representation as multiple 2D slices
    const sliceHeight = (height - 120) / zSize
    const sliceWidth = width - 40
    const cellWidth = sliceWidth / xSize
    const cellHeight = sliceHeight / ySize

    const dataStart = candidate.offset
    const dataEnd = Math.min(dataStart + candidate.size, fileData.length)
    const data = fileData.slice(dataStart, dataEnd)

    for (let z = 0; z < zSize; z++) {
      const yOffset = 60 + z * sliceHeight
      
      // Draw slice label
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`Z=${z}`, 20, yOffset - 5)

      // Draw slice
      for (let y = 0; y < ySize; y++) {
        for (let x = 0; x < xSize; x++) {
          const index = z * (xSize * ySize) + y * xSize + x
          if (index < data.length) {
            const value = data[index]
            const intensity = value / 255
            
            const r = Math.floor(intensity * 255)
            const g = 0
            const b = Math.floor((1 - intensity) * 255)
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
            ctx.fillRect(
              20 + x * cellWidth,
              yOffset + y * cellHeight,
              cellWidth - 1,
              cellHeight - 1
            )
          }
        }
      }
    }
  }

  const draw1DMap = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    xSize: number,
    candidate: MapCandidate,
    fileData: Uint8Array
  ) => {
    const padding = { top: 60, right: 40, bottom: 60, left: 60 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const barWidth = Math.max(2, plotWidth / xSize - 1) // Minimum 2px width, with 1px gap

    const dataStart = candidate.offset
    const dataEnd = Math.min(dataStart + candidate.size, fileData.length)
    const data = fileData.slice(dataStart, dataEnd)

    // Find min/max for better visualization
    let minValue = 255
    let maxValue = 0
    for (let i = 0; i < data.length && i < xSize; i++) {
      if (data[i] < minValue) minValue = data[i]
      if (data[i] > maxValue) maxValue = data[i]
    }
    const valueRange = maxValue - minValue || 1 // Avoid division by zero

    // Draw grid lines
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + plotWidth, y)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = '#404040'
    ctx.lineWidth = 2
    ctx.beginPath()
    // Y-axis
    ctx.moveTo(padding.left, padding.top)
    ctx.lineTo(padding.left, padding.top + plotHeight)
    // X-axis
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight)
    ctx.stroke()

    // Draw bars with gradient
    for (let x = 0; x < xSize && x < data.length; x++) {
      const value = data[x]
      // Normalize value to 0-1 range based on min/max
      const normalizedValue = (value - minValue) / valueRange
      const barHeight = normalizedValue * plotHeight
      
      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(
        padding.left + x * (barWidth + 1),
        padding.top + plotHeight - barHeight,
        padding.left + x * (barWidth + 1),
        padding.top + plotHeight
      )
      
      // Color based on value: blue (low) -> cyan -> yellow -> red (high)
      const hue = 240 - (normalizedValue * 180) // 240 (blue) to 60 (yellow)
      gradient.addColorStop(0, `hsl(${hue}, 70%, 60%)`)
      gradient.addColorStop(1, `hsl(${hue}, 70%, 40%)`)
      
      ctx.fillStyle = gradient
      ctx.fillRect(
        padding.left + x * (barWidth + 1),
        padding.top + plotHeight - barHeight,
        barWidth,
        barHeight
      )
      
      // Add subtle border
      ctx.strokeStyle = `hsla(${hue}, 70%, 50%, 0.3)`
      ctx.lineWidth = 0.5
      ctx.strokeRect(
        padding.left + x * (barWidth + 1),
        padding.top + plotHeight - barHeight,
        barWidth,
        barHeight
      )
    }

    // Draw Y-axis labels (value scale)
    ctx.fillStyle = '#888888'
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotHeight / 4) * (4 - i)
      const value = minValue + (valueRange / 4) * i
      ctx.fillText(
        Math.round(value).toString(),
        padding.left - 10,
        y
      )
    }

    // Draw X-axis labels (index)
    ctx.fillStyle = '#888888'
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    
    // Only show labels for every Nth value to avoid crowding
    const labelInterval = Math.max(1, Math.floor(xSize / 20))
    for (let x = 0; x < xSize; x += labelInterval) {
      const xPos = padding.left + x * (barWidth + 1) + barWidth / 2
      ctx.fillText(
        x.toString(),
        xPos,
        padding.top + plotHeight + 10
      )
    }
    
    // Always show the last label
    if (xSize > 0 && (xSize - 1) % labelInterval !== 0) {
      const lastX = padding.left + (xSize - 1) * (barWidth + 1) + barWidth / 2
      ctx.fillText(
        (xSize - 1).toString(),
        lastX,
        padding.top + plotHeight + 10
      )
    }
  }

  const handleReset = () => {
    // Reset view (placeholder)
  }

  const handleFullscreen = () => {
    if (!containerRef.current) return
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const viewerContent = (
    <div ref={containerRef} className="w-full h-full bg-background relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  )

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
            : `${candidate.dimensions?.x}×${candidate.dimensions?.y || 0}`}
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
          <div className="text-center">
            <p className="text-destructive mb-2">Error loading 3D view</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
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
          <p className="text-muted-foreground">No dimension data available for 3D visualization</p>
        </CardContent>
      </Card>
    )
  }

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
            : `${candidate.dimensions.x}×${candidate.dimensions.y || 0}`}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {viewerContent}
      </CardContent>
    </Card>
  )
}

