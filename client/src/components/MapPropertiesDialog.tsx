/**
 * Map Properties Dialog – WinOLS-style map configuration
 * Tabs: Map, X-Axis, Y-Axis, Comment, Tools
 */

import { useState, useEffect } from 'react'
import { MapCandidate, DATA_ORGANIZATION_OPTIONS, type AxisConfig, type AxisDataSource } from '../store/analysisStore'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Textarea } from './ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { formatHexOffset } from '../lib/utils'

function parseHexOffset(value: string): number | null {
  const s = value.trim().replace(/^0x/i, '')
  if (!s) return null
  const n = parseInt(s, 16)
  return isNaN(n) ? null : n
}

export interface MapPropertiesForm {
  name: string
  description: string
  unit: string
  mapId: string
  startAddress: number
  type: 'single' | '1D' | '2D' | '3D'
  columns: number
  rows: number
  dataOrganization: string
  elementSize: number
  skipBytesPerLine: number
  skipBytes: number
  numberFormat: 'decimal' | 'hex' | 'system'
  sign: boolean
  difference: boolean
  originalValues: boolean
  percent: boolean
  factor: number
  offsetValue: number
  reciprocal: boolean
  precision: number
  valueRangeMin: number
  valueRangeMax: number
  mirrorMap: boolean
  xAxis: AxisConfig
  yAxis: AxisConfig
  comment: string
}

const defaultForm: MapPropertiesForm = {
  name: '',
  description: '',
  unit: '-',
  mapId: '',
  startAddress: 0,
  type: '2D',
  columns: 16,
  rows: 16,
  dataOrganization: 'u16le',
  elementSize: 2,
  skipBytesPerLine: 0,
  skipBytes: 0,
  numberFormat: 'decimal',
  sign: false,
  difference: false,
  originalValues: false,
  percent: false,
  factor: 1,
  offsetValue: 0,
  reciprocal: false,
  precision: 0,
  valueRangeMin: 0,
  valueRangeMax: 65535,
  mirrorMap: false,
  xAxis: {},
  yAxis: {},
  comment: '',
}

function candidateToForm(c: MapCandidate | null, fileSize: number): MapPropertiesForm {
  if (!c) return { ...defaultForm, valueRangeMax: 65535 }
  const dims = c.dimensions
  const cols = dims?.x ?? 16
  const rows = dims?.y ?? 16
  const dataOrg = DATA_ORGANIZATION_OPTIONS.find((o) => o.value === c.dataType) ?? DATA_ORGANIZATION_OPTIONS[1]
  const type = c.type === 'single' ? 'single' : (c.type ?? '2D')
  return {
    name: c.name ?? '',
    description: c.description ?? '',
    unit: c.unit ?? '-',
    mapId: c.mapId ?? '',
    startAddress: c.offset ?? 0,
    type,
    columns: cols,
    rows: rows,
    dataOrganization: c.dataType ?? 'u16le',
    elementSize: c.elementSize ?? dataOrg.elementSize,
    skipBytesPerLine: c.skipBytesPerLine ?? 0,
    skipBytes: c.skipBytes ?? 0,
    numberFormat: c.numberFormat ?? 'decimal',
    sign: c.sign ?? false,
    difference: c.difference ?? false,
    originalValues: c.originalValues ?? false,
    percent: c.percent ?? false,
    factor: c.factor ?? 1,
    offsetValue: c.offsetValue ?? 0,
    reciprocal: c.reciprocal ?? false,
    precision: c.precision ?? 0,
    valueRangeMin: c.valueRangeMin ?? 0,
    valueRangeMax: c.valueRangeMax ?? 65535,
    mirrorMap: c.mirrorMap ?? false,
    xAxis: c.xAxis ?? {},
    yAxis: c.yAxis ?? {},
    comment: c.comment ?? '',
  }
}

function formToCandidate(form: MapPropertiesForm, existingId?: string): MapCandidate {
  const id = existingId ?? crypto.randomUUID()
  const elementSize = form.elementSize
  const cols = form.type === 'single' ? 1 : form.columns
  const rows = form.type === 'single' ? 1 : form.rows
  const numCells = cols * rows
  const size = form.type === 'single' ? elementSize : numCells * elementSize + form.skipBytes * Math.max(0, numCells - 1)
  return {
    id,
    type: form.type,
    offset: form.startAddress,
    confidence: 100,
    size,
    dimensions: { x: cols, y: rows },
    dataType: form.dataOrganization,
    elementSize,
    name: form.name || undefined,
    description: form.description || undefined,
    unit: form.unit === '-' ? undefined : form.unit,
    mapId: form.mapId || undefined,
    skipBytesPerLine: form.skipBytesPerLine,
    skipBytes: form.skipBytes,
    numberFormat: form.numberFormat,
    sign: form.sign,
    difference: form.difference,
    originalValues: form.originalValues,
    percent: form.percent,
    factor: form.factor,
    offsetValue: form.offsetValue,
    reciprocal: form.reciprocal,
    precision: form.precision,
    valueRangeMin: form.valueRangeMin,
    valueRangeMax: form.valueRangeMax,
    mirrorMap: form.mirrorMap,
    xAxis: form.xAxis,
    yAxis: form.yAxis,
    comment: form.comment || undefined,
  }
}

interface MapPropertiesDialogProps {
  open: boolean
  onClose: () => void
  onSave: (map: MapCandidate) => void
  /** When set, dialog is in "edit" mode; otherwise "create" mode */
  initialMap: MapCandidate | null
  fileSize: number
}

export function MapPropertiesDialog({
  open,
  onClose,
  onSave,
  initialMap,
  fileSize,
}: MapPropertiesDialogProps) {
  const [form, setForm] = useState<MapPropertiesForm>(() =>
    candidateToForm(initialMap, fileSize)
  )

  useEffect(() => {
    if (open) {
      setForm(candidateToForm(initialMap, fileSize))
    }
  }, [open, initialMap, fileSize])

  const update = (updates: Partial<MapPropertiesForm>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const handleDataOrgChange = (value: string) => {
    const opt = DATA_ORGANIZATION_OPTIONS.find((o) => o.value === value)
    if (opt) {
      update({ dataOrganization: value, elementSize: opt.elementSize })
    } else {
      update({ dataOrganization: value })
    }
  }

  const handleAddressChange = (value: string) => {
    const n = parseHexOffset(value)
    if (n !== null && n >= 0) update({ startAddress: n })
  }

  const handleSave = () => {
    const map = formToCandidate(form, initialMap?.id)
    onSave(map)
    onClose()
  }

  const addressStr = formatHexOffset(form.startAddress)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialMap ? 'Properties of map' : 'Create map'}
          </DialogTitle>
          <DialogDescription>
            {initialMap
              ? 'Edit map name, dimensions, data type, and axes.'
              : 'Define a new map: name, start address, dimensions, and data type.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="map" className="w-full" key={form.type}>
          <TabsList className={(form.type === '2D' || form.type === '3D') ? 'grid w-full grid-cols-5' : 'grid w-full grid-cols-3'}>
            <TabsTrigger value="map">Map</TabsTrigger>
            {(form.type === '2D' || form.type === '3D') && (
              <>
                <TabsTrigger value="xaxis">X-Axis</TabsTrigger>
                <TabsTrigger value="yaxis">Y-Axis</TabsTrigger>
              </>
            )}
            <TabsTrigger value="comment">Comment</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Map name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="-"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => update({ unit: e.target.value })}
                  placeholder="-"
                />
              </div>
              <div className="space-y-2">
                <Label>Id</Label>
                <Input
                  value={form.mapId}
                  onChange={(e) => update({ mapId: e.target.value })}
                  placeholder="Optional id"
                />
              </div>
            </div>

<div className="space-y-2">
                <Label>Start address</Label>
                <div className="flex gap-2">
                  <Input
                    value={addressStr}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    className="font-mono"
                    placeholder="0x00000"
                    title="Hex address (e.g. 0x7447A)"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Enter hex address to set map start (e.g. 0x7447A)</p>
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => {
                    const type = v as MapPropertiesForm['type']
                    update({
                      type,
                      ...(type === 'single' ? { columns: 1, rows: 1 } : {}),
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single value</SelectItem>
                    <SelectItem value="1D">1D</SelectItem>
                    <SelectItem value="2D">2D (Twodimensional)</SelectItem>
                    <SelectItem value="3D">3D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Columns × Rows</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={1024}
                    value={form.columns}
                    disabled={form.type === 'single'}
                    onChange={(e) =>
                      update({ columns: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={1}
                    max={1024}
                    value={form.rows}
                    disabled={form.type === 'single'}
                    onChange={(e) =>
                      update({ rows: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                  />
                </div>
                {form.type === 'single' && (
                  <p className="text-xs text-muted-foreground">Single value uses 1×1</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data organization</Label>
              <Select
                value={form.dataOrganization}
                onValueChange={handleDataOrgChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_ORGANIZATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Skip bytes per line</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.skipBytesPerLine}
                  onChange={(e) =>
                    update({ skipBytesPerLine: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Skip bytes</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.skipBytes}
                  onChange={(e) =>
                    update({ skipBytes: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Number format</Label>
              <Select
                value={form.numberFormat}
                onValueChange={(v) => update({ numberFormat: v as MapPropertiesForm['numberFormat'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decimal">Decimal (Base 10)</SelectItem>
                  <SelectItem value="hex">Hexadecimal</SelectItem>
                  <SelectItem value="system">(system)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sign"
                  checked={form.sign}
                  onCheckedChange={(c) => update({ sign: !!c })}
                />
                <Label htmlFor="sign" className="text-sm font-normal">Sign</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="difference"
                  checked={form.difference}
                  onCheckedChange={(c) => update({ difference: !!c })}
                />
                <Label htmlFor="difference" className="text-sm font-normal">Difference</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="originalValues"
                  checked={form.originalValues}
                  onCheckedChange={(c) => update({ originalValues: !!c })}
                />
                <Label htmlFor="originalValues" className="text-sm font-normal">Original values</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="percent"
                  checked={form.percent}
                  onCheckedChange={(c) => update({ percent: !!c })}
                />
                <Label htmlFor="percent" className="text-sm font-normal">Percent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mirrorMap"
                  checked={form.mirrorMap}
                  onCheckedChange={(c) => update({ mirrorMap: !!c })}
                />
                <Label htmlFor="mirrorMap" className="text-sm font-normal">Mirror map</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Value range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={form.valueRangeMin}
                  onChange={(e) =>
                    update({ valueRangeMin: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  value={form.valueRangeMax}
                  onChange={(e) =>
                    update({ valueRangeMax: parseInt(e.target.value, 10) || 65535 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Factor, offset</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Value =</span>
                <Input
                  type="number"
                  className="w-20"
                  value={form.factor}
                  onChange={(e) =>
                    update({ factor: parseFloat(e.target.value) || 1 })
                  }
                />
                <span className="text-sm">* Eprom +</span>
                <Input
                  type="number"
                  className="w-20"
                  value={form.offsetValue}
                  onChange={(e) =>
                    update({ offsetValue: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reciprocal"
                  checked={form.reciprocal}
                  onCheckedChange={(c) => update({ reciprocal: !!c })}
                />
                <Label htmlFor="reciprocal" className="text-sm font-normal">Reciprocal</Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precision</Label>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={form.precision}
                  onChange={(e) =>
                    update({ precision: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                />
              </div>
            </div>
          </TabsContent>

          {(form.type === '2D' || form.type === '3D') && (
          <TabsContent value="xaxis" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Description (name)</Label>
              <Input
                value={form.xAxis.description ?? ''}
                onChange={(e) =>
                  update({ xAxis: { ...form.xAxis, description: e.target.value || undefined } })
                }
                placeholder="e.g. RPM"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={form.xAxis.unit ?? ''}
                  onChange={(e) =>
                    update({ xAxis: { ...form.xAxis, unit: e.target.value || undefined } })
                  }
                  placeholder="-"
                />
              </div>
              <div className="space-y-2">
                <Label>Id</Label>
                <Input
                  value={form.xAxis.axisId ?? ''}
                  onChange={(e) =>
                    update({ xAxis: { ...form.xAxis, axisId: e.target.value || undefined } })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data source</Label>
              <Select
                value={form.xAxis.dataSource ?? 'eprom'}
                onValueChange={(v: AxisDataSource) => {
                  const ds = v as AxisDataSource
                  const count = form.columns
                  let axisValues = form.xAxis.axisValues
                  if (ds === 'editable_numbers' && (!axisValues || axisValues.length !== count)) {
                    axisValues = Array.from({ length: count }, (_, i) => axisValues?.[i] ?? i)
                  }
                  update({ xAxis: { ...form.xAxis, dataSource: ds, axisValues } })
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eprom">Eprom</SelectItem>
                  <SelectItem value="editable_numbers">Free editable numbers</SelectItem>
                  <SelectItem value="editable_texts">Free editable texts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.xAxis.dataSource ?? 'eprom') === 'eprom' && (
              <>
                <div className="space-y-2">
                  <Label>Start address (hex)</Label>
                  <Input
                    value={form.xAxis.address != null ? formatHexOffset(form.xAxis.address) : ''}
                    onChange={(e) => {
                      const n = parseHexOffset(e.target.value)
                      update({ xAxis: { ...form.xAxis, address: n ?? undefined } })
                    }}
                    className="font-mono"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Count</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.xAxis.count ?? form.columns}
                    onChange={(e) =>
                      update({
                        xAxis: { ...form.xAxis, count: Math.max(0, parseInt(e.target.value, 10) || 0) },
                      })
                    }
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Factor</Label>
                <Input
                  type="number"
                  value={form.xAxis.factor ?? 1}
                  onChange={(e) =>
                    update({ xAxis: { ...form.xAxis, factor: parseFloat(e.target.value) || 1 } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Offset</Label>
                <Input
                  type="number"
                  value={form.xAxis.offsetValue ?? 0}
                  onChange={(e) =>
                    update({ xAxis: { ...form.xAxis, offsetValue: parseFloat(e.target.value) || 0 } })
                  }
                />
              </div>
            </div>
            {(form.xAxis.dataSource ?? 'eprom') === 'editable_numbers' && form.xAxis.axisValues && (
              <div className="space-y-2">
                <Label>Axis values (edit breakpoints, e.g. RPM)</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                  {form.xAxis.axisValues.map((v, i) => (
                    <Input
                      key={i}
                      type="number"
                      className="w-20 font-mono"
                      value={v}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        const next = [...(form.xAxis.axisValues ?? [])]
                        next[i] = isNaN(n) ? 0 : n
                        update({ xAxis: { ...form.xAxis, axisValues: next } })
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          )}

          {(form.type === '2D' || form.type === '3D') && (
          <TabsContent value="yaxis" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Description (name)</Label>
              <Input
                value={form.yAxis.description ?? ''}
                onChange={(e) =>
                  update({ yAxis: { ...form.yAxis, description: e.target.value || undefined } })
                }
                placeholder="e.g. Load"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={form.yAxis.unit ?? ''}
                  onChange={(e) =>
                    update({ yAxis: { ...form.yAxis, unit: e.target.value || undefined } })
                  }
                  placeholder="-"
                />
              </div>
              <div className="space-y-2">
                <Label>Id</Label>
                <Input
                  value={form.yAxis.axisId ?? ''}
                  onChange={(e) =>
                    update({ yAxis: { ...form.yAxis, axisId: e.target.value || undefined } })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data source</Label>
              <Select
                value={form.yAxis.dataSource ?? 'eprom'}
                onValueChange={(v: AxisDataSource) => {
                  const ds = v as AxisDataSource
                  const count = form.rows
                  let axisValues = form.yAxis.axisValues
                  if (ds === 'editable_numbers' && (!axisValues || axisValues.length !== count)) {
                    axisValues = Array.from({ length: count }, (_, i) => axisValues?.[i] ?? i)
                  }
                  update({ yAxis: { ...form.yAxis, dataSource: ds, axisValues } })
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eprom">Eprom</SelectItem>
                  <SelectItem value="editable_numbers">Free editable numbers</SelectItem>
                  <SelectItem value="editable_texts">Free editable texts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.yAxis.dataSource ?? 'eprom') === 'eprom' && (
              <>
                <div className="space-y-2">
                  <Label>Start address (hex)</Label>
                  <Input
                    value={form.yAxis.address != null ? formatHexOffset(form.yAxis.address) : ''}
                    onChange={(e) => {
                      const n = parseHexOffset(e.target.value)
                      update({ yAxis: { ...form.yAxis, address: n ?? undefined } })
                    }}
                    className="font-mono"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Count</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.yAxis.count ?? form.rows}
                    onChange={(e) =>
                      update({
                        yAxis: { ...form.yAxis, count: Math.max(0, parseInt(e.target.value, 10) || 0) },
                      })
                    }
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Factor</Label>
                <Input
                  type="number"
                  value={form.yAxis.factor ?? 1}
                  onChange={(e) =>
                    update({ yAxis: { ...form.yAxis, factor: parseFloat(e.target.value) || 1 } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Offset</Label>
                <Input
                  type="number"
                  value={form.yAxis.offsetValue ?? 0}
                  onChange={(e) =>
                    update({ yAxis: { ...form.yAxis, offsetValue: parseFloat(e.target.value) || 0 } })
                  }
                />
              </div>
            </div>
            {(form.yAxis.dataSource ?? 'eprom') === 'editable_numbers' && form.yAxis.axisValues && (
              <div className="space-y-2">
                <Label>Axis values (edit breakpoints)</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                  {form.yAxis.axisValues.map((v, i) => (
                    <Input
                      key={i}
                      type="number"
                      className="w-20 font-mono"
                      value={v}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        const next = [...(form.yAxis.axisValues ?? [])]
                        next[i] = isNaN(n) ? 0 : n
                        update({ yAxis: { ...form.yAxis, axisValues: next } })
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          )}

          <TabsContent value="comment" className="pt-4">
            <Label>Comment</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => update({ comment: e.target.value })}
              placeholder="Optional comment..."
              className="min-h-[120px] mt-2"
            />
          </TabsContent>

          <TabsContent value="tools" className="pt-4">
            <p className="text-sm text-muted-foreground">
              Additional tools for map analysis can be added here.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {initialMap ? 'OK' : 'Create map'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
