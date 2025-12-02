/**
 * CreateProjectModal Component
 * 
 * Modal for creating new projects and editing existing ones.
 * Includes form validation, optimistic updates, and delete functionality.
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useProjectStore } from '../store/projectStore'
import { Project } from '../types/project'
import { useToast } from '../hooks/use-toast'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from './ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Switch } from './ui/switch'

// Form validation schema
const projectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  is_private: z.boolean().default(true)
})

type ProjectFormData = z.infer<typeof projectSchema>

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project // If editing, pass existing project
  onSuccess?: () => void
}

export function CreateProjectModal({ 
  open, 
  onOpenChange, 
  project, 
  onSuccess 
}: CreateProjectModalProps) {
  const isEditing = !!project
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { createProject, updateProject, deleteProject } = useProjectStore()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      is_private: true
    }
  })

  // Reset form when modal opens/closes or project changes
  useEffect(() => {
    if (open && project) {
      // Editing mode - populate with existing data
      setValue('name', project.name)
      setValue('description', project.description || '')
      setValue('is_private', project.is_private)
    } else if (open && !project) {
      // Create mode - reset to defaults
      reset({
        name: '',
        description: '',
        is_private: true
      })
    }
  }, [open, project, setValue, reset])

  // Form submission handler
  const onSubmit = async (data: ProjectFormData) => {
    setIsLoading(true)
    try {
      if (isEditing && project) {
        await updateProject(project.project_id, data)
        toast({
          title: 'Project updated',
          description: 'Your project has been updated successfully.'
        })
      } else {
        await createProject(data)
        toast({
          title: 'Project created',
          description: 'Your new project has been created successfully.'
        })
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: isEditing ? 'Failed to update project' : 'Failed to create project',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete project handler
  const handleDelete = async () => {
    if (!project) return
    
    setIsLoading(true)
    try {
      await deleteProject(project.project_id)
      toast({
        title: 'Project deleted',
        description: 'Your project has been deleted successfully.'
      })
      setShowDeleteConfirm(false)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Failed to delete project',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle modal close
  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onOpenChange(false)
    }
  }

  return (
    <>
      {/* Main Create/Edit Modal */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Project' : 'Create New Project'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update your project details' 
                : 'Create a new project to organize your firmware files'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g., 2024 Race ECU Analysis"
                {...register('name')}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Project Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional: Add project details..."
                rows={3}
                {...register('description')}
                disabled={isLoading}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Privacy</Label>
                <p className="text-sm text-muted-foreground">
                  {watch('is_private') 
                    ? 'Only you can see this project' 
                    : 'Visible to your team'
                  }
                </p>
              </div>
              <Switch
                checked={watch('is_private')}
                onCheckedChange={(checked) => setValue('is_private', checked)}
                disabled={isLoading}
              />
            </div>

            {/* Actions */}
            <DialogFooter className="gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                >
                  Delete Project
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project?.name}" and all associated files and scans.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
