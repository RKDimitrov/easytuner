/**
 * Profile Tab Component
 *
 * Displays and allows editing of user profile information and profile picture.
 */

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Calendar, Save, Upload, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import * as authService from '../../services/authService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { toast } from 'sonner'

const profileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or less')
    .regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Display name contains invalid characters'),
})

type ProfileFormData = z.infer<typeof profileSchema>

/** Max display size for profile picture (CSS) */
const AVATAR_SIZE_PX = 120

export function ProfileTab() {
  const { user, accessToken, fetchCurrentUser } = useAuthStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayNameDefault =
    user?.display_name ?? user?.email?.split('@')[0] ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: displayNameDefault,
    },
    values: { displayName: displayNameDefault },
  })

  const onSubmit = async (data: ProfileFormData) => {
    if (!accessToken) return
    setIsSaving(true)
    try {
      await authService.updateProfile(accessToken, { displayName: data.displayName })
      toast.success('Profile updated successfully', {
        description: 'Your changes have been saved.',
      })
      reset(data)
      await fetchCurrentUser()
    } catch (error) {
      toast.error('Failed to update profile', {
        description: 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const avatarUrl = user ? authService.getAvatarUrl(user.avatar_url) : null
  const initials = user
    ? (user.display_name || user.email).slice(0, 2).toUpperCase()
    : ''

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !accessToken) return
    if (!authService.AVATAR_ACCEPT.split(',').map((t) => t.trim()).includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please use JPEG, PNG, or WebP.',
      })
      return
    }
    if (file.size > authService.AVATAR_MAX_SIZE_BYTES) {
      toast.error('File too large', {
        description: 'Maximum size is 2 MB.',
      })
      return
    }
    setIsUploadingAvatar(true)
    try {
      await authService.uploadAvatar(accessToken, file)
      toast.success('Profile picture updated')
      await fetchCurrentUser()
    } catch (error) {
      toast.error('Failed to upload picture', {
        description: 'Please try again.',
      })
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!accessToken) return
    setIsRemovingAvatar(true)
    try {
      await authService.removeAvatar(accessToken)
      toast.success('Profile picture removed')
      await fetchCurrentUser()
    } catch (error) {
      toast.error('Failed to remove picture', {
        description: 'Please try again.',
      })
    } finally {
      setIsRemovingAvatar(false)
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

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Upload a profile picture (JPEG, PNG, or WebP, max 2 MB). Displayed at up to {AVATAR_SIZE_PX}×{AVATAR_SIZE_PX} px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground"
              style={{
                width: AVATAR_SIZE_PX,
                height: AVATAR_SIZE_PX,
                minWidth: AVATAR_SIZE_PX,
                minHeight: AVATAR_SIZE_PX,
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  style={{ maxWidth: AVATAR_SIZE_PX, maxHeight: AVATAR_SIZE_PX }}
                />
              ) : (
                <span className="text-2xl font-bold">{initials}</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept={authService.AVATAR_ACCEPT}
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploadingAvatar ? 'Uploading...' : 'Change picture'}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isRemovingAvatar}
                  onClick={handleRemoveAvatar}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isRemovingAvatar ? 'Removing...' : 'Remove picture'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
