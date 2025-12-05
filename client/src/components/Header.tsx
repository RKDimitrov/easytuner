/**
 * Header Component
 * 
 * Application header with logo, navigation, and user menu
 */

import { Link } from 'react-router-dom'
import { UserMenu } from './UserMenu'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and App Name */}
        <div className="flex items-center gap-6">
          <Link to="/projects" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">E</span>
            </div>
            <span className="text-xl font-bold">EasyTuner</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link
              to="/upload"
              className="transition-colors hover:text-primary text-foreground/60"
            >
              Upload
            </Link>
            <Link
              to="/analysis"
              className="transition-colors hover:text-primary text-foreground/60"
            >
              Analysis
            </Link>
            <Link
              to="/projects"
              className="transition-colors hover:text-primary text-foreground/60"
            >
              Projects
            </Link>
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

