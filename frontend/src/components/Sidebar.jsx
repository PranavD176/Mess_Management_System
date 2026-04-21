import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/scan',             icon: '📷', label: 'Scan QR Code' },
  { to: '/students',         icon: '👥', label: 'Students' },
  { to: '/students/new',     icon: '➕', label: 'Register Student' },
  { to: '/approve-registration', icon: '✔️', label: 'Approve Registration' },
  { to: '/approve-plans',    icon: '✅', label: 'Approve Plans' },
  { to: '/adjust',           icon: '⚖️',  label: 'Manual Adjustment' },
  { to: '/reports/daily',    icon: '📅', label: 'Daily Report' },
  { to: '/reports/monthly',  icon: '📊', label: 'Monthly Report' },
  { to: '/reports/billing',  icon: '💳', label: 'Billing Report' },
]

const staffLinks = [
  { to: '/scan', icon: '📷', label: 'Scan QR Code' },
]

const studentLinks = [
  { to: '/dashboard', icon: '�', label: 'My Dashboard' },
]

export default function Sidebar() {
  const { role, username, logout } = useAuth()
  const navigate = useNavigate()
  const links = role === 'admin' ? adminLinks : role === 'staff' ? staffLinks : studentLinks

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🍽️</div>
        <div>
          <div className="sidebar-logo-text">MessTrack</div>
          <div className="sidebar-logo-sub">QR Management System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} end={l.to === '/scan'}>
            <span className="nav-icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>
          Logged in as <strong style={{ color: 'var(--text-secondary)' }}>{username}</strong>
          <span className={`badge ${role === 'admin' ? 'badge-info' : 'badge-success'}`} style={{ marginLeft: 6 }}>{role}</span>
        </div>
        <button className="btn btn-ghost btn-full btn-sm" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}
