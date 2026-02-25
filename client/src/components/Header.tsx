/**
 * Header Component
 * 
 * Application header with logo, navigation, and user menu
 */

import { Link, useLocation } from 'react-router-dom'
import { UserMenu } from './UserMenu'
import { 
  LayoutDashboard, 
  FolderOpen, 
  BookOpen, 
  Settings 
} from 'lucide-react'
import { cn } from '../lib/utils'
import etlogo from '../etlogo.png'

export function Header() {
  const location = useLocation()

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      to: '/projects',
      label: 'Projects',
      icon: FolderOpen,
    },
    {
      to: '/library',
      label: 'Library',
      icon: BookOpen,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and App Name */}
        <div className="flex items-center gap-2 md:gap-6 min-w-0">
          <Link to="/dashboard" className="flex items-center space-x-2 shrink-0">
            <img src={etlogo} alt="EasyTuner" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-lg md:text-xl font-bold hidden sm:inline">EasyTuner</span>
            <span className="text-lg md:text-xl font-bold sm:hidden">ET</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to || 
                (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
              
              return (
            <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/60 hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
            </Link>
              )
            })}
          </nav>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

