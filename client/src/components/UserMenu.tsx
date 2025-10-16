/**
 * User Menu Component
 * 
 * Dropdown menu showing user info and actions (logout, settings, etc.)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
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

  // Get user initials for avatar
  const initials = user.email
    .split('@')[0]
    .substring(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
          aria-label="User menu"
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="text-sm font-medium">{initials}</span>
          </div>
        </Button>
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

