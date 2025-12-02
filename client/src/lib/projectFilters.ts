/**
 * Project Filtering Logic
 * 
 * Advanced filtering functions for projects including date ranges,
 * file counts, privacy settings, and search functionality.
 */

import { Project, SortOption } from '../types/project'
import { ProjectFilters } from './ProjectFilters'

/**
 * Check if a project matches the date range filter
 */
function matchesDateRange(project: Project, dateRange: string, customFrom?: string, customTo?: string): boolean {
  if (dateRange === 'all') return true
  
  const now = new Date()
  const projectDate = new Date(project.created_at)
  
  switch (dateRange) {
    case 'today':
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return projectDate >= today
      
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return projectDate >= weekAgo
      
    case 'month':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return projectDate >= monthAgo
      
    case 'year':
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      return projectDate >= yearAgo
      
    case 'custom':
      if (!customFrom && !customTo) return true
      const fromDate = customFrom ? new Date(customFrom) : new Date(0)
      const toDate = customTo ? new Date(customTo) : new Date()
      return projectDate >= fromDate && projectDate <= toDate
      
    default:
      return true
  }
}

/**
 * Check if a project matches the file count filter
 */
function matchesFileCount(project: Project, fileCount: string): boolean {
  if (fileCount === 'all') return true
  
  const count = project.file_count || 0
  
  switch (fileCount) {
    case '0':
      return count === 0
    case '1-5':
      return count >= 1 && count <= 5
    case '6-10':
      return count >= 6 && count <= 10
    case '10+':
      return count > 10
    default:
      return true
  }
}

/**
 * Check if a project matches the privacy filter
 */
function matchesPrivacy(project: Project, privacy: string): boolean {
  if (privacy === 'all') return true
  
  switch (privacy) {
    case 'private':
      return project.is_private === true
    case 'public':
      return project.is_private === false
    default:
      return true
  }
}

/**
 * Check if a project matches the search term
 */
function matchesSearch(project: Project, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true
  
  const term = searchTerm.toLowerCase()
  const name = project.name.toLowerCase()
  const description = project.description?.toLowerCase() || ''
  
  return name.includes(term) || description.includes(term)
}

/**
 * Filter projects based on all criteria
 */
export function filterProjects(projects: Project[], filters: ProjectFilters): Project[] {
  return projects.filter(project => {
    return (
      matchesSearch(project, filters.search) &&
      matchesDateRange(project, filters.dateRange, filters.customDateFrom, filters.customDateTo) &&
      matchesFileCount(project, filters.fileCount) &&
      matchesPrivacy(project, filters.privacy)
    )
  })
}

/**
 * Sort projects by the specified criteria
 */
export function sortProjects(projects: Project[], sortBy: SortOption): Project[] {
  return [...projects].sort((a, b) => {
    switch (sortBy) {
      case 'lastModified':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      default:
        return 0
    }
  })
}

/**
 * Filter and sort projects in one operation
 */
export function filterAndSortProjects(
  projects: Project[], 
  filters: ProjectFilters, 
  sortBy: SortOption
): Project[] {
  const filtered = filterProjects(projects, filters)
  return sortProjects(filtered, sortBy)
}

/**
 * Debounce utility for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Get filter summary for display
 */
export function getFilterSummary(filters: ProjectFilters): string {
  const parts: string[] = []
  
  if (filters.search) {
    parts.push(`"${filters.search}"`)
  }
  
  if (filters.dateRange !== 'all') {
    const dateLabels: Record<string, string> = {
      today: 'today',
      week: 'past week',
      month: 'past month',
      year: 'past year',
      custom: 'custom range'
    }
    parts.push(dateLabels[filters.dateRange] || filters.dateRange)
  }
  
  if (filters.fileCount !== 'all') {
    parts.push(`${filters.fileCount} files`)
  }
  
  if (filters.privacy !== 'all') {
    parts.push(filters.privacy)
  }
  
  return parts.length > 0 ? parts.join(', ') : 'all projects'
}
