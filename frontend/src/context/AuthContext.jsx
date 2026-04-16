import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [role, setRole] = useState(() => localStorage.getItem('role'))
  const [username, setUsername] = useState(() => localStorage.getItem('username'))

  const login = async (usernameInput, password) => {
    const data = await apiLogin(usernameInput, password)
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', data.role)
    localStorage.setItem('username', data.username)
    setToken(data.token)
    setRole(data.role)
    setUsername(data.username)
    return data
  }

  const logout = () => {
    localStorage.clear()
    setToken(null)
    setRole(null)
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ token, role, username, login, logout, isAdmin: role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
