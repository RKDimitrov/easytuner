import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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
import { useAuthStore } from './store/authStore'
import { Button } from './components/ui/button'
import { AlertCircle } from 'lucide-react'

/** Redirects / to /dashboard when authenticated, /login when not (after auth init). */
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function App() {
  const navigate = useNavigate()
  const { sessionExpired, logout, isAuthenticated } = useAuthStore()

  // Setup axios interceptor and revalidate session on load (so expired tokens send user to login)
  useEffect(() => {
    setupAuthInterceptor()
    initializeSettings()
    useAuthStore.getState().initializeAuth()
  }, [])

  // Redirect to login when session expires
  useEffect(() => {
    if (sessionExpired && !isAuthenticated) {
      // Small delay to allow state to update
      const timer = setTimeout(() => {
        navigate('/login', { replace: true })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [sessionExpired, isAuthenticated, navigate])

  const handleSessionExpiredLogin = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative min-h-screen">
      <div className={sessionExpired ? 'pointer-events-none blur-sm' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RootRedirect />} />
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
      </div>

      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-destructive/40 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Session expired</h2>
            <p className="text-muted-foreground mb-6">
              Your session has expired. Please log in again to continue.
            </p>
            <Button onClick={handleSessionExpiredLogin} className="w-full">
              Go to Login
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
