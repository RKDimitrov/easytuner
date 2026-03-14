import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAnalysisStore, MapCandidate } from '../store/analysisStore'
import { formatHexOffset } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { ConfidenceGauge } from './ConfidenceGauge'
import { Filter, X, Settings2 } from 'lucide-react'

interface ResultsTableProps {
  /** When provided, double-click or configure button opens map properties */
  onConfigureCandidate?: (candidate: MapCandidate) => void
}

export function ResultsTable({ onConfigureCandidate }: ResultsTableProps) {
  const candidates = useAnalysisStore((state) => state.candidates)
  const userMaps = useAnalysisStore((state) => state.userMaps)
  const selectedCandidate = useAnalysisStore((state) => state.selectedCandidate)
  const setSelectedCandidate = useAnalysisStore((state) => state.setSelectedCandidate)

  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['single', '1D', '2D', '3D']))
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100])
  const [showFilters, setShowFilters] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  // Analysis Results = algorithm output only (exclude maps that are in My Maps)
  const analysisOnlyCandidates = useMemo(
    () => candidates.filter((c) => !userMaps.some((m) => m.id === c.id)),
    [candidates, userMaps]
  )

  // Filter by type and confidence
  const filteredCandidates = useMemo(() => {
    return analysisOnlyCandidates.filter(
      (candidate) =>
        typeFilter.has(candidate.type) &&
        candidate.confidence >= confidenceRange[0] &&
        candidate.confidence <= confidenceRange[1]
    )
  }, [analysisOnlyCandidates, typeFilter, confidenceRange])

  // Virtualizer for table rows
  const rowVirtualizer = useVirtualizer({
    count: filteredCandidates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  })

  const handleTypeToggle = (type: string) => {
    const newFilter = new Set(typeFilter)
    if (newFilter.has(type)) {
      newFilter.delete(type)
    } else {
      newFilter.add(type)
    }
    setTypeFilter(newFilter)
  }

  const handleRowClick = (candidate: MapCandidate) => {
    setSelectedCandidate(candidate)
  }

  const handleRowDoubleClick = (candidate: MapCandidate, e: React.MouseEvent) => {
    e.preventDefault()
    onConfigureCandidate?.(candidate)
  }

  const resetFilters = () => {
    setTypeFilter(new Set(['single', '1D', '2D', '3D']))
    setConfidenceRange([0, 100])
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              Analysis Results
              <span className="text-sm text-muted-foreground ml-2 font-normal">
                ({filteredCandidates.length} of {analysisOnlyCandidates.length})
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              From the scan algorithm (maps in My Maps are not listed here).
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 space-y-4 p-4 border border-border rounded-lg bg-accent/50">
            {/* Type filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-2">
                {(['single', '1D', '2D', '3D'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={typeFilter.has(type) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTypeToggle(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Confidence range filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Confidence Range: {confidenceRange[0]}% - {confidenceRange[1]}%
              </label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={confidenceRange}
                onValueChange={(value) => setConfidenceRange(value as [number, number])}
                className="w-full"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
        {filteredCandidates.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            No candidates match the current filters
          </div>
        ) : (
          <div
            ref={parentRef}
            className="flex-1 min-h-0 overflow-auto"
            style={{ contain: 'strict' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {/* Table header */}
              <div className="sticky top-0 z-10 bg-card border-b border-border">
                <div className="grid grid-cols-[80px_minmax(160px,1.4fr)_90px_1fr_90px_auto] gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground">
                  <div>Type</div>
                  <div>Name / Offset</div>
                  <div>Size</div>
                  <div>Confidence</div>
                  <div>Dim.</div>
                  {onConfigureCandidate ? <div className="w-9" /> : null}
                </div>
              </div>

              {/* Virtualized rows */}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const candidate = filteredCandidates[virtualRow.index]
                const isSelected = selectedCandidate?.id === candidate.id

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start + 40}px)`, // Offset for header
                    }}
                  >
<div
                    className={`grid grid-cols-[80px_minmax(160px,1.4fr)_90px_1fr_90px_auto] gap-3 px-4 py-3 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors ${
                        isSelected ? 'bg-primary/20 hover:bg-primary/30' : ''
                      }`}
                      onClick={() => handleRowClick(candidate)}
                      onDoubleClick={(e) => handleRowDoubleClick(candidate, e)}
                    >
                      {/* Type */}
                      <div>
                        <span
                          className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded ${
                            candidate.type === 'single'
                              ? 'bg-muted text-muted-foreground'
                              : candidate.type === '1D'
                              ? 'bg-success/20 text-success'
                              : candidate.type === '2D'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-warning/20 text-warning'
                          }`}
                        >
                          {candidate.type === 'single' ? 'Single' : candidate.type}
                        </span>
                      </div>

                      {/* Offset (with optional name prefix) */}
                      <div className="font-mono text-sm text-data">
                        {candidate.name
                          ? `${candidate.name} – ${formatHexOffset(candidate.offset)}`
                          : formatHexOffset(candidate.offset)}
                      </div>

                      {/* Size */}
                      <div className="font-mono text-sm">
                        {candidate.size} bytes
                      </div>

                      {/* Confidence */}
                      <div className="flex items-center">
                        <ConfidenceGauge confidence={candidate.confidence} />
                      </div>

                      {/* Dimensions */}
                      <div className="text-sm text-muted-foreground">
                        {candidate.dimensions
                          ? candidate.type === 'single'
                            ? '1'
                            : candidate.type === '1D'
                            ? `${candidate.dimensions.x}`
                            : candidate.type === '3D'
                            ? `${candidate.dimensions.x}×${candidate.dimensions.y || 0}×${candidate.dimensions.z || 0}`
                            : `${candidate.dimensions.x}×${candidate.dimensions.y || 0}`
                          : 'N/A'}
                      </div>

                      {/* Configure */}
                      {onConfigureCandidate ? (
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.preventDefault()
                              onConfigureCandidate(candidate)
                            }}
                            title="Configure map"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

