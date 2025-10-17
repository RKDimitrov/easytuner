import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Upload } from './pages/Upload'
import { Analysis } from './pages/Analysis'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { ProjectDetail } from './pages/ProjectDetail'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { setupAuthInterceptor } from './store/authStore'
import { initializeSampleProjects } from './services/mockProjectService'

function App() {
  // Setup axios interceptor for automatic token handling
  useEffect(() => {
    setupAuthInterceptor()
    // Initialize sample projects for demo purposes
    initializeSampleProjects()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Upload />
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
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
