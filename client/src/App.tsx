import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Analysis } from './pages/Analysis'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Library } from './pages/Library'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { ProjectDetail } from './pages/ProjectDetail'
import { Settings } from './pages/Settings'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { setupAuthInterceptor } from './store/authStore'
import { initializeSettings } from './store/settingsStore'

function App() {
  // Setup axios interceptor for automatic token handling
  useEffect(() => {
    setupAuthInterceptor()
    // Initialize settings (theme, etc.)
    initializeSettings()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analysis"
        element={
          <ProtectedRoute>
            <Analysis />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <Library />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/*"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
