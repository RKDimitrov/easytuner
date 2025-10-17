/**
 * ProjectFilters Component
 * 
 * Advanced filtering system for projects with expandable panel,
 * filter chips, and URL state management.
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Filter, 
  X, 
  Calendar, 
  FileText, 
  Lock, 
  Unlock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Switch } from './ui/switch'

export interface ProjectFilters {
  search: string
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
  customDateFrom?: string
  customDateTo?: string
  fileCount: 'all' | '0' | '1-5' | '6-10' | '10+'
  privacy: 'all' | 'private' | 'public'
}

interface ProjectFiltersProps {
  onFiltersChange: (filters: ProjectFilters) => void
  resultCount: number
  totalCount: number
}

/**
 * Filter chip component for active filters
 */
function FilterChip({ 
  label, 
  value, 
  onRemove 
}: { 
  label: string
  value: string
  onRemove: () => void 
}) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
      <span className="text-xs">
        {label}: {value}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 hover:bg-transparent"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  )
}

/**
 * Date range filter component
 */
function DateRangeFilter({ 
  value, 
  onChange, 
  customFrom, 
  customTo, 
  onCustomChange 
}: {
  value: string
  onChange: (value: string) => void
  customFrom?: string
  customTo?: string
  onCustomChange: (field: 'from' | 'to', value: string) => void
}) {
  const isCustom = value === 'custom'
  
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Date Range</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">Past week</SelectItem>
          <SelectItem value="month">Past month</SelectItem>
          <SelectItem value="year">Past year</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      
      {isCustom && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={customFrom || ''}
              onChange={(e) => onCustomChange('from', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={customTo || ''}
              onChange={(e) => onCustomChange('to', e.target.value)}
              className="text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * File count filter component
 */
function FileCountFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">File Count</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select file count" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          <SelectItem value="0">No files (0)</SelectItem>
          <SelectItem value="1-5">1-5 files</SelectItem>
          <SelectItem value="6-10">6-10 files</SelectItem>
          <SelectItem value="10+">10+ files</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Privacy filter component
 */
function PrivacyFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Privacy</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select privacy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          <SelectItem value="private">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Private
            </div>
          </SelectItem>
          <SelectItem value="public">
            <div className="flex items-center gap-2">
              <Unlock className="h-4 w-4" />
              Public
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Main ProjectFilters component
 */
export function ProjectFilters({ onFiltersChange, resultCount, totalCount }: ProjectFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<ProjectFilters>({
    search: searchParams.get('search') || '',
    dateRange: (searchParams.get('dateRange') as any) || 'all',
    customDateFrom: searchParams.get('dateFrom') || undefined,
    customDateTo: searchParams.get('dateTo') || undefined,
    fileCount: (searchParams.get('fileCount') as any) || 'all',
    privacy: (searchParams.get('privacy') as any) || 'all',
  })

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (filters.search) params.set('search', filters.search)
    if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange)
    if (filters.customDateFrom) params.set('dateFrom', filters.customDateFrom)
    if (filters.customDateTo) params.set('dateTo', filters.customDateTo)
    if (filters.fileCount !== 'all') params.set('fileCount', filters.fileCount)
    if (filters.privacy !== 'all') params.set('privacy', filters.privacy)
    
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange(filters)
  }, [filters, onFiltersChange])

  // Update individual filter
  const updateFilter = <K extends keyof ProjectFilters>(
    key: K, 
    value: ProjectFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      search: '',
      dateRange: 'all',
      customDateFrom: undefined,
      customDateTo: undefined,
      fileCount: 'all',
      privacy: 'all',
    })
  }

  // Remove specific filter
  const removeFilter = (key: keyof ProjectFilters) => {
    const defaultValues: ProjectFilters = {
      search: '',
      dateRange: 'all',
      customDateFrom: undefined,
      customDateTo: undefined,
      fileCount: 'all',
      privacy: 'all',
    }
    updateFilter(key, defaultValues[key])
  }

  // Get active filter chips
  const getActiveFilters = () => {
    const active: Array<{ key: keyof ProjectFilters; label: string; value: string }> = []
    
    if (filters.search) {
      active.push({ key: 'search', label: 'Search', value: filters.search })
    }
    
    if (filters.dateRange !== 'all') {
      const dateLabels: Record<string, string> = {
        today: 'Today',
        week: 'Past week',
        month: 'Past month',
        year: 'Past year',
        custom: 'Custom range'
      }
      active.push({ 
        key: 'dateRange', 
        label: 'Date', 
        value: dateLabels[filters.dateRange] || filters.dateRange 
      })
    }
    
    if (filters.fileCount !== 'all') {
      const fileLabels: Record<string, string> = {
        '0': 'No files',
        '1-5': '1-5 files',
        '6-10': '6-10 files',
        '10+': '10+ files'
      }
      active.push({ 
        key: 'fileCount', 
        label: 'Files', 
        value: fileLabels[filters.fileCount] || filters.fileCount 
      })
    }
    
    if (filters.privacy !== 'all') {
      active.push({ 
        key: 'privacy', 
        label: 'Privacy', 
        value: filters.privacy === 'private' ? 'Private' : 'Public' 
      })
    }
    
    return active
  }

  const activeFilters = getActiveFilters()
  const hasActiveFilters = activeFilters.length > 0

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Input
          type="search"
          placeholder="Search projects by name or description..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10"
        />
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {activeFilters.length}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Result Count */}
        <div className="text-sm text-muted-foreground">
          {resultCount} of {totalCount} projects
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(({ key, label, value }) => (
            <FilterChip
              key={key}
              label={label}
              value={value}
              onRemove={() => removeFilter(key)}
            />
          ))}
        </div>
      )}

      {/* Expandable Filter Panel */}
      {isExpanded && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DateRangeFilter
                value={filters.dateRange}
                onChange={(value) => updateFilter('dateRange', value)}
                customFrom={filters.customDateFrom}
                customTo={filters.customDateTo}
                onCustomChange={(field, value) => {
                  if (field === 'from') {
                    updateFilter('customDateFrom', value)
                  } else {
                    updateFilter('customDateTo', value)
                  }
                }}
              />
              
              <FileCountFilter
                value={filters.fileCount}
                onChange={(value) => updateFilter('fileCount', value)}
              />
              
              <PrivacyFilter
                value={filters.privacy}
                onChange={(value) => updateFilter('privacy', value)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
