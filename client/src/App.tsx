import { Routes, Route } from 'react-router-dom'
import { Upload } from './pages/Upload'
import { Analysis } from './pages/Analysis'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Upload />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
