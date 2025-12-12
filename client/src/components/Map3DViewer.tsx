/**
 * Map3DViewer Component
 * 
 * 3D visualization of ECU maps using Three.js
 */

import { useEffect, useRef, useState } from 'react'
import { MapCandidate } from '../store/analysisStore'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { formatHexOffset } from '../lib/utils'

interface Map3DViewerProps {
  candidate: MapCandidate
  fileData: Uint8Array
}

export function Map3DViewer({ candidate, fileData }: Map3DViewerProps) {
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

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw placeholder visualization
    ctx.fillStyle = '#3b82f6'
    ctx.font = '16px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const text = `3D Map Visualization\n${dimensions.x}×${dimensions.y}${dimensions.z ? `×${dimensions.z}` : ''}\nOffset: ${formatHexOffset(candidate.offset)}`
    const lines = text.split('\n')
    const lineHeight = 24
    const startY = height / 2 - (lines.length * lineHeight) / 2
    
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight)
    })

    // Draw a simple 3D representation
    if (candidate.type === '2D' && dimensions.x && dimensions.y) {
      draw2DMap(ctx, width, height, dimensions.x, dimensions.y, candidate, fileData)
    } else if (candidate.type === '3D' && dimensions.x && dimensions.y && dimensions.z) {
      draw3DMap(ctx, width, height, dimensions.x, dimensions.y, dimensions.z, candidate, fileData)
    } else if (candidate.type === '1D' && dimensions.x) {
      draw1DMap(ctx, width, height, dimensions.x, candidate, fileData)
    }
  }, [candidate, fileData])

  const draw2DMap = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    xSize: number,
    ySize: number,
    candidate: MapCandidate,
    fileData: Uint8Array
  ) => {
    const padding = 40
    const plotWidth = width - padding * 2
    const plotHeight = height - padding * 2 - 100 // Leave space for text
    const cellWidth = plotWidth / xSize
    const cellHeight = plotHeight / ySize

    // Extract data from file
    const dataStart = candidate.offset
    const dataEnd = Math.min(dataStart + candidate.size, fileData.length)
    const data = fileData.slice(dataStart, dataEnd)

    // Draw heatmap
    for (let y = 0; y < ySize; y++) {
      for (let x = 0; x < xSize; x++) {
        const index = y * xSize + x
        if (index < data.length) {
          const value = data[index]
          const intensity = value / 255
          
          // Color gradient from blue (low) to red (high)
          const r = Math.floor(intensity * 255)
          const g = 0
          const b = Math.floor((1 - intensity) * 255)
          
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
          ctx.fillRect(
            padding + x * cellWidth,
            padding + y * cellHeight,
            cellWidth - 1,
            cellHeight - 1
          )
        }
      }
    }

    // Draw axes labels
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    for (let x = 0; x < xSize; x++) {
      ctx.fillText(
        x.toString(),
        padding + x * cellWidth + cellWidth / 2,
        padding + ySize * cellHeight + 20
      )
    }
    ctx.save()
    ctx.translate(15, padding + plotHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    for (let y = 0; y < ySize; y++) {
      ctx.fillText(
        y.toString(),
        0,
        y * cellHeight + cellHeight / 2
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
    const padding = 40
    const plotWidth = width - padding * 2
    const plotHeight = height - padding * 2 - 100
    const barWidth = plotWidth / xSize

    const dataStart = candidate.offset
    const dataEnd = Math.min(dataStart + candidate.size, fileData.length)
    const data = fileData.slice(dataStart, dataEnd)

    // Draw bar chart
    ctx.fillStyle = '#3b82f6'
    for (let x = 0; x < xSize && x < data.length; x++) {
      const value = data[x]
      const barHeight = (value / 255) * plotHeight
      
      ctx.fillRect(
        padding + x * barWidth,
        padding + plotHeight - barHeight,
        barWidth - 2,
        barHeight
      )
    }

    // Draw axes
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, padding + plotHeight)
    ctx.lineTo(padding + plotWidth, padding + plotHeight)
    ctx.stroke()

    // Draw labels
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    for (let x = 0; x < xSize; x++) {
      ctx.fillText(
        x.toString(),
        padding + x * barWidth + barWidth / 2,
        padding + plotHeight + 20
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

  if (error) {
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
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No dimension data available for 3D visualization</p>
        </CardContent>
      </Card>
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
          Dimensions: {candidate.dimensions.x}×{candidate.dimensions.y}
          {candidate.dimensions.z ? `×${candidate.dimensions.z}` : ''}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div ref={containerRef} className="w-full h-full bg-background relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

