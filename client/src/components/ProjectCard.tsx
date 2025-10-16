/**
 * ProjectCard Component
 * 
 * Displays a project as a card with metadata.
 * Used in the project dashboard grid.
 */

import { Lock, FileCode } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Project } from '../types/project'

interface ProjectCardProps {
  project: Project
  onClick: () => void
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const fileCount = project.file_count ?? 0

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-primary/50"
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="truncate">{project.name}</span>
          {project.is_private && (
            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
          )}
        </CardTitle>
        <CardDescription className="line-clamp-2 min-h-[2.5rem]">
          {project.description || 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <FileCode className="w-4 h-4" />
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </span>
          </div>
          <span>
            {formatRelativeTime(project.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

