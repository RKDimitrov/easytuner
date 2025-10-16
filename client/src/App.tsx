import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Upload } from './pages/Upload'
import { Analysis } from './pages/Analysis'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { setupAuthInterceptor } from './store/authStore'

function App() {
  // Setup axios interceptor for automatic token handling
  useEffect(() => {
    setupAuthInterceptor()
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
