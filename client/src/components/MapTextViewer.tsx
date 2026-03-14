/**
 * MapTextViewer – WinOLS-style text/grid view of map data
 * Shows axis labels at top and left (from config or Eprom), with data values in a table.
 * Double-click any axis or data cell to edit inline.
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { MapCandidate, DATA_ORGANIZATION_OPTIONS } from '../store/analysisStore'
import { useEditStore } from '../store/editStore'
import { cn } from '../lib/utils'

type EditingCell = { type: 'x'; i: number } | { type: 'y'; i: number } | { type: 'data'; row: number; col: number }

function readValue(
  data: Uint8Array,
  offset: number,
  dataType: string,
  elementSize: number
): number {
  if (offset + elementSize > data.length) return 0
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
    case 'float32le':
      return view.getFloat32(0, true)
    case 'float32be':
      return view.getFloat32(0, false)
    default:
      return elementSize === 2 ? view.getUint16(0, true) : view.getUint8(0)
  }
}

interface MapTextViewerProps {
  candidate: MapCandidate
  fileData: Uint8Array
  noCard?: boolean
  /** Called when user edits axis values; parent should update store */
  onUpdateAxis?: (axis: 'x' | 'y', values: number[]) => void
  /** Called when user edits a data cell; parent should update candidate.dataOverrides */
  onUpdateCell?: (row: number, col: number, value: number) => void
}

export function MapTextViewer({ candidate, fileData, noCard = false, onUpdateAxis, onUpdateCell }: MapTextViewerProps) {
  const { modifiedFileData } = useEditStore()
  const displayData = modifiedFileData || fileData
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editingCell) inputRef.current?.focus()
  }, [editingCell])

  const dataType = candidate.dataType || 'u16le'
  const elementSize = candidate.elementSize || 2
  const xAxisDataType = candidate.xAxis?.dataType || candidate.dataType || 'u16le'
  const yAxisDataType = candidate.yAxis?.dataType || candidate.dataType || 'u16le'
  const xAxisElementSize = DATA_ORGANIZATION_OPTIONS.find((o) => o.value === xAxisDataType)?.elementSize ?? 2
  const yAxisElementSize = DATA_ORGANIZATION_OPTIONS.find((o) => o.value === yAxisDataType)?.elementSize ?? 2

  const { values, xSize, ySize } = useMemo(() => {
    if (!candidate.dimensions || !displayData) {
      return { values: [] as number[][], xSize: 0, ySize: 0 }
    }
    const { x: xSize, y: ySize } = candidate.dimensions
    const skipBytes = candidate.skipBytes ?? 0
    const dataStart = candidate.offset + skipBytes
    const dataLength = xSize * ySize * elementSize
    const dataEnd = Math.min(dataStart + dataLength, displayData.length)
    const values: number[][] = []
    for (let y = 0; y < ySize; y++) {
      const row: number[] = []
      for (let x = 0; x < xSize; x++) {
        const index = y * xSize + x
        const byteOffset = dataStart + index * elementSize
        if (byteOffset + elementSize <= dataEnd) {
          row.push(readValue(displayData, byteOffset, dataType, elementSize))
        } else {
          row.push(0)
        }
      }
      values.push(row)
    }
    return { values, xSize, ySize }
  }, [candidate, displayData, dataType, elementSize])

  // X-axis labels: from axisValues (editable), or read from Eprom, or indices
  const xLabels = useMemo(() => {
    const xAxis = candidate.xAxis
    const count = xSize
    if (!count) return [] as number[]
    if (xAxis?.dataSource === 'editable_numbers' && xAxis.axisValues && xAxis.axisValues.length >= count) {
      return xAxis.axisValues.slice(0, count)
    }
    if (xAxis?.address != null && displayData && (xAxis.dataSource === 'eprom' || !xAxis.dataSource)) {
      const factor = xAxis.factor ?? 1
      const offset = xAxis.offsetValue ?? 0
      const out: number[] = []
      for (let i = 0; i < count; i++) {
        const byteOff = xAxis.address + i * xAxisElementSize
        const raw = readValue(displayData, byteOff, xAxisDataType, xAxisElementSize)
        out.push(raw * factor + offset)
      }
      return out
    }
    return Array.from({ length: count }, (_, i) => i)
  }, [candidate.xAxis, xSize, displayData, xAxisDataType, xAxisElementSize])

  // Y-axis labels: same logic
  const yLabels = useMemo(() => {
    const yAxis = candidate.yAxis
    const count = ySize
    if (!count) return [] as number[]
    if (yAxis?.dataSource === 'editable_numbers' && yAxis.axisValues && yAxis.axisValues.length >= count) {
      return yAxis.axisValues.slice(0, count)
    }
    if (yAxis?.address != null && displayData && (yAxis.dataSource === 'eprom' || !yAxis.dataSource)) {
      const factor = yAxis.factor ?? 1
      const offset = yAxis.offsetValue ?? 0
      const out: number[] = []
      for (let i = 0; i < count; i++) {
        const byteOff = yAxis.address + i * yAxisElementSize
        const raw = readValue(displayData, byteOff, yAxisDataType, yAxisElementSize)
        out.push(raw * factor + offset)
      }
      return out
    }
    return Array.from({ length: count }, (_, i) => i)
  }, [candidate.yAxis, ySize, displayData, yAxisDataType, yAxisElementSize])

  const getDataDisplayValue = useCallback((row: number, col: number): number => {
    const key = `${row},${col}`
    if (candidate.dataOverrides && key in candidate.dataOverrides) {
      return candidate.dataOverrides[key]
    }
    return values[row]?.[col] ?? 0
  }, [candidate.dataOverrides, values])

  const commitAxisEdit = useCallback((axis: 'x' | 'y', index: number, raw: string) => {
    const num = parseFloat(raw)
    if (axis === 'x') {
      const next = [...xLabels]
      if (index < next.length) { next[index] = Number.isNaN(num) ? 0 : num; onUpdateAxis?.('x', next) }
    } else {
      const next = [...yLabels]
      if (index < next.length) { next[index] = Number.isNaN(num) ? 0 : num; onUpdateAxis?.('y', next) }
    }
    setEditingCell(null)
  }, [xLabels, yLabels, onUpdateAxis])

  const commitDataEdit = useCallback((row: number, col: number, raw: string) => {
    const num = parseFloat(raw)
    if (!Number.isNaN(num)) onUpdateCell?.(row, col, num)
    setEditingCell(null)
  }, [onUpdateCell])

  if (!candidate.dimensions || values.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-muted-foreground">
        No dimension data for text view
      </div>
    )
  }

  const firstRowIsXAxis = candidate.firstRowIsXAxis === true
  const dataRows = firstRowIsXAxis ? values.slice(1) : values
  const dataRowOffset = firstRowIsXAxis ? 1 : 0

  const tableContent = (
    <div className="h-full w-full min-w-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <table className="border-collapse font-mono text-sm w-max">
          <thead>
            <tr>
              <th className="border border-border bg-muted/50 px-2 py-1 text-left text-muted-foreground min-w-[3rem]">
                {firstRowIsXAxis ? 'Row' : (candidate.yAxis?.description || candidate.yAxis?.unit || '–')}
              </th>
              {Array.from({ length: xSize }, (_, i) => {
                const isEditing = editingCell?.type === 'x' && editingCell.i === i
                const displayVal = xLabels[i] ?? i
                const displayStr = typeof displayVal === 'number' && !Number.isInteger(displayVal) ? displayVal.toFixed(2) : String(displayVal)
                return (
                  <th
                    key={i}
                    className={cn(
                      'border border-border px-2 py-1 text-right min-w-[2.5rem]',
                      selectedCell?.x === i ? 'bg-primary/30 text-primary' : 'bg-muted/50 text-muted-foreground',
                      onUpdateAxis && 'cursor-pointer'
                    )}
                    onDoubleClick={() => onUpdateAxis && setEditingCell({ type: 'x', i })}
                    title={onUpdateAxis ? 'Double-click to edit X-axis (e.g. RPM)' : undefined}
                  >
                    {isEditing ? (
                      <input
                        ref={editingCell?.type === 'x' && editingCell.i === i ? inputRef : undefined}
                        type="text"
                        className="w-full min-w-[2.5rem] bg-background text-right border rounded px-1 focus:ring-1 focus:ring-ring outline-none"
                        defaultValue={displayStr}
                        onBlur={(e) => commitAxisEdit('x', i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.currentTarget.blur(); commitAxisEdit('x', i, e.currentTarget.value) }
                          if (e.key === 'Escape') setEditingCell(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      displayStr
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, d) => {
              const valuesRowIndex = d + dataRowOffset
              return (
                <tr key={d}>
                <td
                  className={cn(
                    'border border-border px-2 py-1 text-right bg-muted/30 text-muted-foreground sticky left-0 z-10',
                    selectedCell?.y === d ? 'bg-primary/20' : '',
                    onUpdateAxis && 'cursor-pointer'
                  )}
                  onDoubleClick={() => onUpdateAxis && setEditingCell({ type: 'y', i: valuesRowIndex })}
                  title={onUpdateAxis ? 'Double-click to edit Y-axis' : undefined}
                >
                  {editingCell?.type === 'y' && editingCell.i === valuesRowIndex ? (
                    <input
                      ref={editingCell?.type === 'y' && editingCell.i === valuesRowIndex ? inputRef : undefined}
                      type="text"
                      className="w-full min-w-[2.5rem] bg-background text-right border rounded px-1 focus:ring-1 focus:ring-ring outline-none"
                      defaultValue={typeof yLabels[valuesRowIndex] === 'number' && !Number.isInteger(yLabels[valuesRowIndex]) ? (yLabels[valuesRowIndex] as number).toFixed(2) : String(yLabels[valuesRowIndex] ?? d)}
                      onBlur={(e) => commitAxisEdit('y', valuesRowIndex, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.currentTarget.blur(); commitAxisEdit('y', valuesRowIndex, e.currentTarget.value) }
                        if (e.key === 'Escape') setEditingCell(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    typeof yLabels[valuesRowIndex] === 'number' && !Number.isInteger(yLabels[valuesRowIndex])
                      ? (yLabels[valuesRowIndex] as number).toFixed(2)
                      : (yLabels[valuesRowIndex] ?? d)
                  )}
                </td>
                {row.map((_, x) => {
                  const val = getDataDisplayValue(valuesRowIndex, x)
                  const isHovered = hoveredCell?.x === x && hoveredCell?.y === d
                  const isSelected = selectedCell?.x === x && selectedCell?.y === d
                  const isEditing = editingCell?.type === 'data' && editingCell.row === valuesRowIndex && editingCell.col === x
                  const displayStr = Number.isInteger(val) ? String(val) : val.toFixed(2)
                  return (
                    <td
                      key={x}
                      className={cn(
                        'border border-border px-2 py-1 text-right tabular-nums',
                        (onUpdateCell || isEditing) && 'cursor-pointer',
                        isSelected && 'bg-primary/30 text-primary ring-1 ring-primary',
                        isHovered && !isSelected && 'bg-accent/50'
                      )}
                      onMouseEnter={() => setHoveredCell({ x, y: d })}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => setSelectedCell({ x, y: d })}
                      onDoubleClick={() => onUpdateCell && setEditingCell({ type: 'data', row: valuesRowIndex, col: x })}
                    >
                      {isEditing ? (
                        <input
                          ref={editingCell?.type === 'data' && editingCell.row === valuesRowIndex && editingCell.col === x ? inputRef : undefined}
                          type="text"
                          className="w-full min-w-[2.5rem] bg-background text-right border rounded px-1 focus:ring-1 focus:ring-ring outline-none"
                          defaultValue={displayStr}
                          onBlur={(e) => commitDataEdit(valuesRowIndex, x, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.currentTarget.blur(); commitDataEdit(valuesRowIndex, x, e.currentTarget.value) }
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        displayStr
                      )}
                    </td>
                  )
                })}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
      {hoveredCell != null && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          Cell [{hoveredCell.x}, {hoveredCell.y}] = {getDataDisplayValue(hoveredCell.y + dataRowOffset, hoveredCell.x)}
        </div>
      )}
    </div>
  )

  if (noCard) return tableContent
  return (
    <div className="h-full flex flex-col p-4">
      <h3 className="text-sm font-semibold mb-2">Text view – {candidate.name || 'Map'}</h3>
      {tableContent}
    </div>
  )
}
