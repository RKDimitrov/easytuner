/**
 * Profile Tab Component
 * 
 * Displays and allows editing of user profile information
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Calendar, Save } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { toast } from 'sonner'

const profileSchema = z.object({
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or less')
    .regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Display name contains invalid characters'),
})

type ProfileFormData = z.infer<typeof profileSchema>

export function ProfileTab() {
  const { user, fetchCurrentUser } = useAuthStore()
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.email?.split('@')[0] || '',
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true)
    try {
      // TODO: Replace with actual API call when backend is ready
      // await userService.updateProfile(data)
      
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update local user data
      if (user) {
        // This would be handled by the API response in real implementation
        console.log('Profile updated:', data)
      }
      
      toast.success('Profile updated successfully', {
        description: 'Your changes have been saved.',
      })
      
      // Reset form dirty state
      reset(data)
      
      // Refresh user data
      await fetchCurrentUser()
    } catch (error) {
      toast.error('Failed to update profile', {
        description: 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please log in to view your profile.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Manage your personal information and account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                {...register('displayName')}
                placeholder="Enter your display name"
                className={errors.displayName ? 'border-red-500' : ''}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500">{errors.displayName.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This name will be displayed throughout the application
              </p>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need to update your email.
              </p>
            </div>

            {/* Account Information (Read-only) */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Account Information</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {user.user_id}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Account Created</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {user.created_at 
                        ? new Date(user.created_at).toLocaleDateString()
                        : 'Unknown'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={!isDirty || isSaving}
                className="min-w-[120px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Profile Picture Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Upload a profile picture to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <span className="text-xl font-bold">
                {user.email.split('@')[0].substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                Profile picture upload will be available in a future update.
              </p>
              <Button variant="outline" disabled>
                Upload Picture
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
