/**
 * Produce the Text Viewer table as plain text for the Map Assistant.
 * Mirrors MapTextViewer logic so the AI sees the same axis labels and data the user sees.
 */

import type { MapCandidate } from '../store/analysisStore'
import { DATA_ORGANIZATION_OPTIONS } from '../store/analysisStore'
import { formatHexOffset } from './utils'

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

function getDataDisplayValue(
  values: number[][],
  row: number,
  col: number,
  dataOverrides?: Record<string, number>
): number {
  const key = `${row},${col}`
  if (dataOverrides && key in dataOverrides) return dataOverrides[key]
  return values[row]?.[col] ?? 0
}

/**
 * Build the exact Text Viewer table as a string (axis labels + data grid).
 * Uses the same axis and data logic as MapTextViewer so the assistant can reference
 * specific columns/rows (e.g. "change the value at 4.5k RPM to ...").
 */
export function getMapTableAsText(
  candidate: MapCandidate,
  displayData: Uint8Array
): string | null {
  if (!candidate.dimensions || !displayData) return null
  const { x: xSize, y: ySize } = candidate.dimensions
  if (xSize === 0 || ySize === 0) return null

  const dataType = candidate.dataType || 'u16le'
  const elementSize = candidate.elementSize ?? DATA_ORGANIZATION_OPTIONS.find((o) => o.value === dataType)?.elementSize ?? 2
  const xAxisDataType = candidate.xAxis?.dataType || candidate.dataType || 'u16le'
  const yAxisDataType = candidate.yAxis?.dataType || candidate.dataType || 'u16le'
  const xAxisElementSize = DATA_ORGANIZATION_OPTIONS.find((o) => o.value === xAxisDataType)?.elementSize ?? 2
  const yAxisElementSize = DATA_ORGANIZATION_OPTIONS.find((o) => o.value === yAxisDataType)?.elementSize ?? 2

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

  const firstRowIsXAxis = candidate.firstRowIsXAxis === true

  // X-axis labels (when firstRowIsXAxis, first row of values is the x-axis)
  let xLabels: number[] = []
  const xAxis = candidate.xAxis
  if (xAxis?.dataSource === 'editable_numbers' && xAxis.axisValues && xAxis.axisValues.length >= xSize) {
    xLabels = xAxis.axisValues.slice(0, xSize)
  } else if (firstRowIsXAxis && values.length > 0 && values[0].length >= xSize) {
    xLabels = values[0].slice(0, xSize)
  } else if (xAxis?.address != null && (xAxis.dataSource === 'eprom' || !xAxis.dataSource)) {
    const factor = xAxis.factor ?? 1
    const offset = xAxis.offsetValue ?? 0
    for (let i = 0; i < xSize; i++) {
      const byteOff = xAxis.address + i * xAxisElementSize
      const raw = readValue(displayData, byteOff, xAxisDataType, xAxisElementSize)
      xLabels.push(raw * factor + offset)
    }
  } else {
    xLabels = Array.from({ length: xSize }, (_, i) => i)
  }

  // Y-axis labels
  let yLabels: number[] = []
  const yAxis = candidate.yAxis
  if (yAxis?.dataSource === 'editable_numbers' && yAxis.axisValues && yAxis.axisValues.length >= ySize) {
    yLabels = yAxis.axisValues.slice(0, ySize)
  } else if (yAxis?.address != null && (yAxis.dataSource === 'eprom' || !yAxis.dataSource)) {
    const factor = yAxis.factor ?? 1
    const offset = yAxis.offsetValue ?? 0
    for (let i = 0; i < ySize; i++) {
      const byteOff = yAxis.address + i * yAxisElementSize
      const raw = readValue(displayData, byteOff, yAxisDataType, yAxisElementSize)
      yLabels.push(raw * factor + offset)
    }
  } else {
    yLabels = Array.from({ length: ySize }, (_, i) => i)
  }

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  const pad = (s: string, w: number) => s.padStart(w, ' ')

  const name = candidate.name || 'Map'
  const hexOffset = formatHexOffset(candidate.offset)
  const lines: string[] = [
    `[Text Viewer – selected map]`,
    `Map: ${name} (${candidate.type}, offset ${hexOffset}, ${xSize}×${ySize})`,
    `X-axis (column headers, e.g. RPM): ${xLabels.map(fmt).join(', ')}`,
    `Y-axis (row labels): ${yLabels.map(fmt).join(', ')}`,
    `Data table (each row = one Y value; columns = X values):`,
  ]

  const colWidth = 8
  const headerCells = ['', ...xLabels.map((v) => pad(fmt(v), colWidth))]
  lines.push(headerCells.join(' '))
  const dataRowStart = firstRowIsXAxis ? 1 : 0
  const dataRowCount = firstRowIsXAxis ? ySize - 1 : ySize
  for (let i = 0; i < dataRowCount; i++) {
    const y = dataRowStart + i
    const rowCells = [pad(fmt(yLabels[y] ?? i), colWidth)]
    for (let x = 0; x < xSize; x++) {
      const val = getDataDisplayValue(values, y, x, candidate.dataOverrides)
      rowCells.push(pad(fmt(val), colWidth))
    }
    lines.push(rowCells.join(' '))
  }

  return lines.join('\n')
}
