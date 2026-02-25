/**
 * Settings Page Component
 * 
 * Main settings page with tabbed navigation for different setting categories
 */

import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { 
  User, 
  Palette, 
  Shield, 
  Database,
  ChevronRight 
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { ProfileTab } from '../components/settings/ProfileTab'
import { AppearanceTab } from '../components/settings/AppearanceTab'
import { SecurityTab } from '../components/settings/SecurityTab'
import { DataPrivacyTab } from '../components/settings/DataPrivacyTab'

const settingsTabs = [
  {
    id: 'profile',
    label: 'Profile',
    description: 'Manage your account information',
    icon: User,
    path: '/settings/profile',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Customize theme and display',
    icon: Palette,
    path: '/settings/appearance',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password and security settings',
    icon: Shield,
    path: '/settings/security',
  },
  {
    id: 'data-privacy',
    label: 'Data & Privacy',
    description: 'Manage your data and privacy',
    icon: Database,
    path: '/settings/data-privacy',
  },
]

export function Settings() {
  usePageTitle('Settings')
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link to="/projects" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>Settings</span>
        </div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account preferences and application settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings</CardTitle>
              <CardDescription>
                Choose a category to manage your preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = currentPath === tab.path || 
                    (currentPath === '/settings' && tab.id === 'profile')
                  
                  return (
                    <Link
                      key={tab.id}
                      to={tab.path}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${
                        isActive 
                          ? 'bg-muted text-foreground border-r-2 border-primary' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {tab.description}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Routes>
            <Route path="/" element={<ProfileTab />} />
            <Route path="/profile" element={<ProfileTab />} />
            <Route path="/appearance" element={<AppearanceTab />} />
            <Route path="/security" element={<SecurityTab />} />
            <Route path="/data-privacy" element={<DataPrivacyTab />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
