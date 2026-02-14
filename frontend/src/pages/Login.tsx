import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const Login = () => {
  const { login } = useAuth()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
        const endpoint = isRegister ? '/auth/register' : '/auth/token'
        // OAuth2PasswordRequestForm expects form data, but our register expects JSON
        const payload = isRegister 
            ? { email, password } 
            : new URLSearchParams({ username: email, password })
        
        const config = isRegister ? {} : { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }

        const res = await api.post(endpoint, payload, config)
        login(res.data.access_token)
    } catch (err: any) {
        showToast('Error: ' + (err.response?.data?.detail || err.message), 'error')
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4 font-bold text-center">{isRegister ? 'Register' : 'Login'}</h2>
        <input 
            className="w-full p-2 mb-3 border rounded outline-none focus:border-blue-500" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
        />
        <input 
            className="w-full p-2 mb-4 border rounded outline-none focus:border-blue-500" 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">
            {isRegister ? 'Sign Up' : 'Sign In'}
        </button>
        <div className="mt-4 text-center text-sm text-blue-600 cursor-pointer hover:underline" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
        </div>
      </form>
    </div>
  )
}

export default Login
