import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { token, role } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (requireAdmin && role !== 'admin') return <Navigate to="/scan" replace />
  return children
}
