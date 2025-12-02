/**
 * Appearance Tab Component
 * 
 * Manages theme, density, and font size preferences
 */

import { Palette, Monitor, Sun, Moon, Type, Layout } from 'lucide-react'
import { useSettingsStore, type Theme, type Density, type FontSize } from '../../store/settingsStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
// import { Switch } from '../ui/switch'
// import { Separator } from '../ui/separator'

export function AppearanceTab() {
  const { 
    theme, 
    density, 
    fontSize, 
    setTheme, 
    setDensity, 
    setFontSize 
  } = useSettingsStore()

  const themeOptions = [
    {
      value: 'light' as const,
      label: 'Light',
      description: 'Always use light theme',
      icon: Sun,
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      description: 'Always use dark theme',
      icon: Moon,
    },
    {
      value: 'system' as const,
      label: 'System',
      description: 'Use system preference',
      icon: Monitor,
    },
  ]

  const densityOptions = [
    {
      value: 'compact' as const,
      label: 'Compact',
      description: 'Tighter spacing for more content',
    },
    {
      value: 'comfortable' as const,
      label: 'Comfortable',
      description: 'Balanced spacing (recommended)',
    },
    {
      value: 'spacious' as const,
      label: 'Spacious',
      description: 'Larger spacing for easier reading',
    },
  ]

  const fontSizeOptions = [
    {
      value: 'small' as const,
      label: 'Small',
      description: '12px base font size',
    },
    {
      value: 'medium' as const,
      label: 'Medium',
      description: '14px base font size (recommended)',
    },
    {
      value: 'large' as const,
      label: 'Large',
      description: '16px base font size',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose your preferred color scheme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value: Theme) => setTheme(value)}
            className="space-y-3"
          >
            {themeOptions.map((option) => {
              const Icon = option.icon
              return (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex items-center gap-3 cursor-pointer flex-1">
                    <Icon className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Density Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Density
          </CardTitle>
          <CardDescription>
            Control the spacing and layout density
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={density}
            onValueChange={(value: Density) => setDensity(value)}
            className="space-y-3"
          >
            {densityOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="cursor-pointer flex-1">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Font Size Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Font Size
          </CardTitle>
          <CardDescription>
            Adjust the text size for better readability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={fontSize}
            onValueChange={(value: FontSize) => setFontSize(value)}
            className="space-y-3"
          >
            {fontSizeOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="cursor-pointer flex-1">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your settings look in practice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-card">
              <h4 className="font-semibold mb-2">Sample Card</h4>
              <p className="text-muted-foreground mb-3">
                This is how text and spacing will appear with your current settings.
              </p>
              <div className="flex gap-2">
                <Button size="sm">Small Button</Button>
                <Button size="sm" variant="outline">Outline Button</Button>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Current settings:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Theme: {theme}</li>
                <li>Density: {density}</li>
                <li>Font Size: {fontSize}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
