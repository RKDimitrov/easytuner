/**
 * User Menu Component
 *
 * Dropdown menu showing user info and actions (logout, settings, etc.)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getAvatarUrl } from '../services/authService'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { toast } from 'sonner'

export function UserMenu() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      toast.success('Logged out successfully', {
        description: 'See you next time!',
      })
      navigate('/login')
    } catch (error) {
      toast.error('Logout failed', {
        description: 'Please try again.',
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (!user) {
    return null
  }

  const avatarUrl = getAvatarUrl(user.avatar_url)
  const initials = (user.display_name || user.email)
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative h-10 w-10 shrink-0 rounded-full p-0 overflow-hidden border-0 bg-transparent hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="User menu"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              width={40}
              height={40}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              {initials}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.role}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

