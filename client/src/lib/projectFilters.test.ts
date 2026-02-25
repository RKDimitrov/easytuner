/**
 * Test file for Project Filters
 * 
 * This file contains test data and functions to verify
 * the filtering logic works correctly.
 */

import { Project } from '../types/project'
import { ProjectFilters } from '../types/project'
import { filterProjects, sortProjects } from '../lib/projectFilters'

// Test data
export const mockProjects: Project[] = [
  {
    project_id: '1',
    owner_user_id: 'user1',
    name: 'ECU Firmware Analysis',
    description: 'Analysis of automotive ECU firmware for security vulnerabilities',
    is_private: false,
    published_at: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
    file_count: 5
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
    file_count: 12
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
    file_count: 0
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
    file_count: 25
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
    file_count: 8
  }
]

// Test functions
export function testSearchFilter() {
  console.log('Testing search filter...')
  
  const filters: ProjectFilters = {
    search: 'automotive',
    dateRange: 'all',
    fileCount: 'all',
    privacy: 'all'
  }
  
  const results = filterProjects(mockProjects, filters)
  console.log(`Search "automotive" found ${results.length} projects:`, results.map(p => p.name))
  
  // Should find projects with "automotive" in name or description
  const expected = ['ECU Firmware Analysis', 'Automotive Security']
  const actual = results.map(p => p.name)
  
  console.log('Expected:', expected)
  console.log('Actual:', actual)
  console.log('Test passed:', JSON.stringify(expected.sort()) === JSON.stringify(actual.sort()))
}

export function testPrivacyFilter() {
  console.log('Testing privacy filter...')
  
  const privateFilters: ProjectFilters = {
    search: '',
    dateRange: 'all',
    fileCount: 'all',
    privacy: 'private'
  }
  
  const publicFilters: ProjectFilters = {
    search: '',
    dateRange: 'all',
    fileCount: 'all',
    privacy: 'public'
  }
  
  const privateResults = filterProjects(mockProjects, privateFilters)
  const publicResults = filterProjects(mockProjects, publicFilters)
  
  console.log(`Private projects: ${privateResults.length}`, privateResults.map(p => p.name))
  console.log(`Public projects: ${publicResults.length}`, publicResults.map(p => p.name))
  
  // Should find 2 private and 3 public projects
  console.log('Private test passed:', privateResults.length === 2)
  console.log('Public test passed:', publicResults.length === 3)
}

export function testFileCountFilter() {
  console.log('Testing file count filter...')
  
  const filters: ProjectFilters = {
    search: '',
    dateRange: 'all',
    fileCount: '1-5',
    privacy: 'all'
  }
  
  const results = filterProjects(mockProjects, filters)
  console.log(`Projects with 1-5 files: ${results.length}`, results.map(p => `${p.name} (${p.file_count})`))
  
  // Should find 1 project with 1-5 files
  console.log('File count test passed:', results.length === 1)
}

export function testDateRangeFilter() {
  console.log('Testing date range filter...')
  
  const filters: ProjectFilters = {
    search: '',
    dateRange: 'month',
    fileCount: 'all',
    privacy: 'all'
  }
  
  const results = filterProjects(mockProjects, filters)
  console.log(`Projects from past month: ${results.length}`, results.map(p => p.name))
  
  // Should find all projects since they're all from January 2024
  console.log('Date range test passed:', results.length === mockProjects.length)
}

export function testCombinedFilters() {
  console.log('Testing combined filters...')
  
  const filters: ProjectFilters = {
    search: 'analysis',
    dateRange: 'all',
    fileCount: '10+',
    privacy: 'all'
  }
  
  const results = filterProjects(mockProjects, filters)
  console.log(`Combined filter results: ${results.length}`, results.map(p => p.name))
  
  // Should find projects with "analysis" in name/description AND 5+ files
  console.log('Combined filter test passed:', results.length === 2)
}

export function testSorting() {
  console.log('Testing sorting...')
  
  const byName = sortProjects(mockProjects, 'name')
  const byCreated = sortProjects(mockProjects, 'created')
  const byModified = sortProjects(mockProjects, 'lastModified')
  
  console.log('Sorted by name:', byName.map(p => p.name))
  console.log('Sorted by created:', byCreated.map(p => p.name))
  console.log('Sorted by modified:', byModified.map(p => p.name))
  
  // Verify sorting works
  console.log('Name sort test passed:', byName[0].name === 'Automotive Security')
  console.log('Created sort test passed:', byCreated[0].name === 'Large Dataset Analysis')
}

// Run all tests
export function runAllTests() {
  console.log('Running Project Filter Tests...\n')
  
  testSearchFilter()
  console.log('')
  
  testPrivacyFilter()
  console.log('')
  
  testFileCountFilter()
  console.log('')
  
  testDateRangeFilter()
  console.log('')
  
  testCombinedFilters()
  console.log('')
  
  testSorting()
  console.log('')
  
  console.log('All tests completed!')
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testProjectFilters = {
    mockProjects,
    runAllTests,
    testSearchFilter,
    testPrivacyFilter,
    testFileCountFilter,
    testDateRangeFilter,
    testCombinedFilters,
    testSorting
  }
}
