import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import MemoryPage from './pages/Memory'
import { useState } from 'react'

const AppContent = () => {
  const { isAuthenticated } = useAuth()
  const [page, setPage] = useState('dashboard') // Simple router

  if (!isAuthenticated) return <Login />
  
  return (
    <>
      <div style={{ display: page === 'dashboard' ? 'block' : 'none' }}>
        <Dashboard onNavigate={setPage} />
      </div>
      {page === 'memory' && <MemoryPage onNavigate={setPage} />}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
