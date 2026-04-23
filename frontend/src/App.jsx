import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'

import LoginPage          from './pages/LoginPage'
import ScanPage           from './pages/ScanPage'
import RegisterStudentPage from './pages/RegisterStudentPage'
import PublicRegisterPage  from './pages/PublicRegisterPage'
import ApproveRegistrationPage from './pages/ApproveRegistrationPage'
import ApprovePlanPage      from './pages/ApprovePlanPage'
import StudentListPage    from './pages/StudentListPage'
import StudentDetailPage  from './pages/StudentDetailPage'
import StudentDashboardPage from './pages/StudentDashboardPage'
import CreatePlanPage     from './pages/CreatePlanPage'
import ManualAdjustPage   from './pages/ManualAdjustPage'
import DailyReportPage    from './pages/DailyReportPage'
import MonthlyReportPage  from './pages/MonthlyReportPage'
import BillingReportPage  from './pages/BillingReportPage'

function RoleBasedRedirect() {
  const { role } = useAuth()
  const redirectPath = role === 'student' ? '/dashboard' : '/scan'
  return <Navigate to={redirectPath} replace />
}

function AppShell() {
  const { token } = useAuth()
  if (!token) return null
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/scan"            element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
          <Route path="/dashboard"       element={<ProtectedRoute><StudentDashboardPage /></ProtectedRoute>} />
          <Route path="/renew-plan"      element={<ProtectedRoute><CreatePlanPage /></ProtectedRoute>} />
          <Route path="/students"        element={<ProtectedRoute requireAdmin><StudentListPage /></ProtectedRoute>} />
          <Route path="/students/new"    element={<ProtectedRoute requireAdmin><RegisterStudentPage /></ProtectedRoute>} />
          <Route path="/students/:id"    element={<ProtectedRoute requireAdmin><StudentDetailPage /></ProtectedRoute>} />
          <Route path="/students/:id/plan" element={<ProtectedRoute requireAdmin><CreatePlanPage /></ProtectedRoute>} />
          <Route path="/approve-registration" element={<ProtectedRoute requireAdmin><ApproveRegistrationPage /></ProtectedRoute>} />
          <Route path="/approve-plans"   element={<ProtectedRoute requireAdmin><ApprovePlanPage /></ProtectedRoute>} />
          <Route path="/adjust"          element={<ProtectedRoute requireAdmin><ManualAdjustPage /></ProtectedRoute>} />
          <Route path="/reports/daily"   element={<ProtectedRoute requireAdmin><DailyReportPage /></ProtectedRoute>} />
          <Route path="/reports/monthly" element={<ProtectedRoute requireAdmin><MonthlyReportPage /></ProtectedRoute>} />
          <Route path="/reports/billing" element={<ProtectedRoute requireAdmin><BillingReportPage /></ProtectedRoute>} />
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<PublicRegisterPage />} />
            <Route path="/*" element={<AppShellWrapper />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

function AppShellWrapper() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <AppShell />
}
