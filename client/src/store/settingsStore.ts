/**
 * Settings State Store (Zustand)
 * 
 * Manages user settings including theme, appearance, and preferences
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type FontSize = 'small' | 'medium' | 'large'

interface SettingsState {
  // Theme settings
  theme: Theme
  density: Density
  fontSize: FontSize
  
  // Actions
  setTheme: (theme: Theme) => void
  setDensity: (density: Density) => void
  setFontSize: (fontSize: FontSize) => void
  resetSettings: () => void
}

const initialState = {
  theme: 'system' as Theme,
  density: 'comfortable' as Density,
  fontSize: 'medium' as FontSize,
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        /**
         * Set theme preference
         */
        setTheme: (theme: Theme) => {
          set({ theme })
          // Apply theme to document
          applyTheme(theme)
        },

        /**
         * Set density preference
         */
        setDensity: (density: Density) => {
          set({ density })
          // Apply density to document
          applyDensity(density)
        },

        /**
         * Set font size preference
         */
        setFontSize: (fontSize: FontSize) => {
          set({ fontSize })
          // Apply font size to document
          applyFontSize(fontSize)
        },

        /**
         * Reset all settings to defaults
         */
        resetSettings: () => {
          set(initialState)
          applyTheme('system')
          applyDensity('comfortable')
          applyFontSize('medium')
        },
      }),
      {
        name: 'settings-storage',
        // Persist all settings
        partialize: (state) => ({
          theme: state.theme,
          density: state.density,
          fontSize: state.fontSize,
        }),
      }
    ),
    { name: 'settings-store' }
  )
)

/**
 * Apply theme to document element
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  
  // Remove existing theme classes
  root.classList.remove('light', 'dark')
  
  if (theme === 'system') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    root.classList.add(theme)
  }
}

/**
 * Apply density to document element
 */
function applyDensity(density: Density) {
  const root = document.documentElement
  
  // Remove existing density classes
  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious')
  
  // Add new density class
  root.classList.add(`density-${density}`)
}

/**
 * Apply font size to document element
 */
function applyFontSize(fontSize: FontSize) {
  const root = document.documentElement
  
  // Remove existing font size classes
  root.classList.remove('font-small', 'font-medium', 'font-large')
  
  // Add new font size class
  root.classList.add(`font-${fontSize}`)
}

/**
 * Initialize settings on app startup
 */
export function initializeSettings() {
  const { theme, density, fontSize } = useSettingsStore.getState()
  
  // Apply saved settings
  applyTheme(theme)
  applyDensity(density)
  applyFontSize(fontSize)
  
  // Listen for system theme changes when theme is 'system'
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const currentTheme = useSettingsStore.getState().theme
      if (currentTheme === 'system') {
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    
    // Return cleanup function
    return () => mediaQuery.removeEventListener('change', handleChange)
  }
}
