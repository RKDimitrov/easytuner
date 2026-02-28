/**
 * Unit tests for Project Filtering and Sorting Logic
 */

import { describe, it, expect } from 'vitest'
import { Project, ProjectFilters } from '../types/project'
import {
  filterProjects,
  sortProjects,
  filterAndSortProjects,
  getFilterSummary,
} from './projectFilters'

const mockProjects: Project[] = [
  {
    project_id: '1',
    owner_user_id: 'user1',
    name: 'ECU Firmware Analysis',
    description: 'Analysis of automotive ECU firmware for security vulnerabilities',
    is_private: false,
    published_at: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
    file_count: 5,
  },
  {
    project_id: '2',
    owner_user_id: 'user1',
    name: 'Private Research',
    description: 'Confidential research project',
    is_private: true,
    published_at: null,
    created_at: '2024-01-10T09:00:00Z',
    updated_at: '2024-01-18T12:00:00Z',
    file_count: 12,
  },
  {
    project_id: '3',
    owner_user_id: 'user1',
    name: 'Test Project',
    description: 'Empty test project',
    is_private: false,
    published_at: null,
    created_at: '2024-01-25T14:00:00Z',
    updated_at: '2024-01-25T14:00:00Z',
    file_count: 0,
  },
  {
    project_id: '4',
    owner_user_id: 'user1',
    name: 'Large Dataset Analysis',
    description: 'Analysis of large firmware dataset with multiple files',
    is_private: true,
    published_at: null,
    created_at: '2024-01-05T08:00:00Z',
    updated_at: '2024-01-22T16:45:00Z',
    file_count: 25,
  },
  {
    project_id: '5',
    owner_user_id: 'user1',
    name: 'Automotive Security',
    description: 'Security analysis of automotive systems',
    is_private: false,
    published_at: null,
    created_at: '2024-01-12T11:30:00Z',
    updated_at: '2024-01-19T09:15:00Z',
    file_count: 8,
  },
]

const defaultFilters: ProjectFilters = {
  search: '',
  dateRange: 'all',
  fileCount: 'all',
  privacy: 'all',
}

// ─── filterProjects ───────────────────────────────────────────────────────────

describe('filterProjects – search', () => {
  it('returns all projects when search is empty', () => {
    const result = filterProjects(mockProjects, defaultFilters)
    expect(result).toHaveLength(5)
  })

  it('filters by name (case-insensitive)', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, search: 'automotive' })
    const names = result.map(p => p.name)
    expect(names).toContain('ECU Firmware Analysis')
    expect(names).toContain('Automotive Security')
    expect(result).toHaveLength(2)
  })

  it('filters by description', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, search: 'confidential' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Private Research')
  })

  it('returns empty array when no match', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, search: 'nonexistent_xyz' })
    expect(result).toHaveLength(0)
  })

  it('returns no results when search is only whitespace', () => {
    // matchesSearch uses trim() — blank-only search returns all projects
    const result = filterProjects(mockProjects, { ...defaultFilters, search: '   ' })
    expect(result).toHaveLength(5)
  })
})

describe('filterProjects – privacy', () => {
  it('returns only private projects', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, privacy: 'private' })
    expect(result).toHaveLength(2)
    result.forEach(p => expect(p.is_private).toBe(true))
  })

  it('returns only public projects', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, privacy: 'public' })
    expect(result).toHaveLength(3)
    result.forEach(p => expect(p.is_private).toBe(false))
  })

  it('returns all projects when privacy is "all"', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, privacy: 'all' })
    expect(result).toHaveLength(5)
  })
})

describe('filterProjects – fileCount', () => {
  it('returns projects with 0 files', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, fileCount: '0' })
    expect(result).toHaveLength(1)
    expect(result[0].file_count).toBe(0)
  })

  it('returns projects with 1–5 files', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, fileCount: '1-5' })
    expect(result).toHaveLength(1)
    expect(result[0].file_count).toBe(5)
  })

  it('returns projects with 6–10 files', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, fileCount: '6-10' })
    expect(result).toHaveLength(1)
    expect(result[0].file_count).toBe(8)
  })

  it('returns projects with more than 10 files', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, fileCount: '10+' })
    expect(result).toHaveLength(2)
    result.forEach(p => expect(p.file_count).toBeGreaterThan(10))
  })

  it('returns all projects when fileCount is "all"', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, fileCount: 'all' })
    expect(result).toHaveLength(5)
  })
})

describe('filterProjects – dateRange', () => {
  it('returns all projects when dateRange is "all"', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, dateRange: 'all' })
    expect(result).toHaveLength(5)
  })

  it('returns no projects for "today" when all are from 2024', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, dateRange: 'today' })
    expect(result).toHaveLength(0)
  })

  it('returns no projects for "week" when all are from 2024', () => {
    const result = filterProjects(mockProjects, { ...defaultFilters, dateRange: 'week' })
    expect(result).toHaveLength(0)
  })

  it('custom range returns projects within bounds', () => {
    const result = filterProjects(mockProjects, {
      ...defaultFilters,
      dateRange: 'custom',
      customDateFrom: '2024-01-10',
      customDateTo: '2024-01-16',
    })
    const ids = result.map(p => p.project_id)
    expect(ids).toContain('1') // created 2024-01-15
    expect(ids).toContain('2') // created 2024-01-10
    expect(ids).not.toContain('4') // created 2024-01-05
  })

  it('custom range with no bounds returns all', () => {
    const result = filterProjects(mockProjects, {
      ...defaultFilters,
      dateRange: 'custom',
    })
    expect(result).toHaveLength(5)
  })
})

describe('filterProjects – combined filters', () => {
  it('combines search and fileCount correctly', () => {
    // "Large Dataset Analysis" has 25 files and "analysis" in its name
    // "ECU Firmware Analysis" has only 5 files — excluded by 10+ filter
    const result = filterProjects(mockProjects, {
      ...defaultFilters,
      search: 'analysis',
      fileCount: '10+',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Large Dataset Analysis')
    expect(result[0].file_count).toBeGreaterThan(10)
  })

  it('combines privacy and search correctly', () => {
    const result = filterProjects(mockProjects, {
      ...defaultFilters,
      search: 'research',
      privacy: 'private',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Private Research')
  })

  it('returns empty array when combined filters match nothing', () => {
    const result = filterProjects(mockProjects, {
      ...defaultFilters,
      search: 'automotive',
      privacy: 'private',
    })
    expect(result).toHaveLength(0)
  })
})

// ─── sortProjects ─────────────────────────────────────────────────────────────

describe('sortProjects', () => {
  it('sorts by name alphabetically', () => {
    const result = sortProjects(mockProjects, 'name')
    expect(result[0].name).toBe('Automotive Security')
    expect(result[result.length - 1].name).toBe('Test Project')
  })

  it('sorts by created date (newest first)', () => {
    const result = sortProjects(mockProjects, 'created')
    expect(result[0].name).toBe('Test Project') // 2024-01-25
    expect(result[result.length - 1].name).toBe('Large Dataset Analysis') // 2024-01-05
  })

  it('sorts by last modified (newest first)', () => {
    const result = sortProjects(mockProjects, 'lastModified')
    expect(result[0].name).toBe('Test Project') // updated 2024-01-25
    expect(result[result.length - 1].name).toBe('Private Research') // updated 2024-01-18
  })

  it('does not mutate the original array', () => {
    const original = [...mockProjects]
    sortProjects(mockProjects, 'name')
    expect(mockProjects.map(p => p.project_id)).toEqual(original.map(p => p.project_id))
  })
})

// ─── filterAndSortProjects ────────────────────────────────────────────────────

describe('filterAndSortProjects', () => {
  it('filters then sorts in a single call', () => {
    const result = filterAndSortProjects(
      mockProjects,
      { ...defaultFilters, privacy: 'public' },
      'name'
    )
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Automotive Security')
    result.forEach(p => expect(p.is_private).toBe(false))
  })
})

// ─── getFilterSummary ─────────────────────────────────────────────────────────

describe('getFilterSummary', () => {
  it('returns "all projects" when no filters are active', () => {
    expect(getFilterSummary(defaultFilters)).toBe('all projects')
  })

  it('includes search term in summary', () => {
    const summary = getFilterSummary({ ...defaultFilters, search: 'firmware' })
    expect(summary).toContain('"firmware"')
  })

  it('includes date range label in summary', () => {
    const summary = getFilterSummary({ ...defaultFilters, dateRange: 'week' })
    expect(summary).toContain('past week')
  })

  it('includes file count in summary', () => {
    const summary = getFilterSummary({ ...defaultFilters, fileCount: '10+' })
    expect(summary).toContain('10+ files')
  })

  it('includes privacy in summary', () => {
    const summary = getFilterSummary({ ...defaultFilters, privacy: 'private' })
    expect(summary).toContain('private')
  })

  it('combines multiple active filters in summary', () => {
    const summary = getFilterSummary({
      ...defaultFilters,
      search: 'ecu',
      privacy: 'public',
    })
    expect(summary).toContain('"ecu"')
    expect(summary).toContain('public')
  })
})
