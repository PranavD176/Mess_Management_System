import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faQrcode,
  faUsers,
  faUserPlus,
  faUserCheck,
  faClipboardCheck,
  faScaleBalanced,
  faCalendarDay,
  faChartColumn,
  faFileInvoiceDollar,
  faGaugeHigh,
  faUtensils,
  faSun,
  faMoon,
  faTriangleExclamation,
  faRightFromBracket,
  faCalendarCheck,
} from '@fortawesome/free-solid-svg-icons'
import { getMyPlanStatus } from '../api'

const adminLinks = [
  { to: '/scan', icon: faQrcode, label: 'Scan QR Code' },
  { to: '/students', icon: faUsers, label: 'Students' },
  { to: '/students/new', icon: faUserPlus, label: 'Register Student' },
  { to: '/approve-registration', icon: faUserCheck, label: 'Approve Registration' },
  { to: '/approve-plans', icon: faClipboardCheck, label: 'Approve Plans' },
  { to: '/attendance', icon: faCalendarCheck, label: 'Attendance' },
  { to: '/adjust', icon: faScaleBalanced, label: 'Manual Adjustment' },
  { to: '/reports/daily', icon: faCalendarDay, label: 'Daily Report' },
  { to: '/reports/monthly', icon: faChartColumn, label: 'Monthly Report' },
  { to: '/reports/billing', icon: faFileInvoiceDollar, label: 'Billing Report' },
]

const staffLinks = [
  { to: '/scan', icon: faQrcode, label: 'Scan QR Code' },
]

const studentLinks = [
  { to: '/dashboard', icon: faGaugeHigh, label: 'My Dashboard' },
  { to: '/my-attendance', icon: faCalendarCheck, label: 'My Attendance' },
]

export default function Sidebar() {
  const { role, username, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [planStatus, setPlanStatus] = useState(null)
  const links = role === 'admin' ? adminLinks : role === 'staff' ? staffLinks : studentLinks

  useEffect(() => {
    if (role === 'student') {
      getMyPlanStatus()
        .then(data => {
          if (data && data.status) {
            setPlanStatus(data.status)
          }
        })
        .catch(err => console.error("Failed to load plan status in sidebar:", err))
    }
  }, [role])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><FontAwesomeIcon icon={faUtensils} /></div>
          <div>
            <div className="sidebar-logo-text">MessTrack</div>
            <div className="sidebar-logo-sub">QR Management System</div>
          </div>
        </div>
        <button 
          className="btn btn-ghost btn-sm theme-toggle-btn" 
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} end={l.to === '/scan'}>
            <span className="nav-icon"><FontAwesomeIcon icon={l.icon} /></span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      {planStatus === 'rejected' && (
        <div style={{ margin: '16px', padding: '16px', background: 'var(--danger-light, #fee2e2)', borderRadius: '8px', border: '1px solid var(--danger, #ef4444)' }}>
          <div style={{ color: 'var(--danger, #b91c1c)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 8 }} />
            Plan Rejected
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
            Your recent plan application was not approved. Please reapply.
          </div>
          <button 
            className="btn btn-sm btn-primary" 
            style={{ width: '100%', background: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
            onClick={() => navigate('/renew-plan')}
          >
            Reapply Now
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>
          Logged in as <strong style={{ color: 'var(--text-secondary)' }}>{username}</strong>
          <span className={`badge ${role === 'admin' ? 'badge-info' : 'badge-success'}`} style={{ marginLeft: 6 }}>{role}</span>
        </div>
        <button className="btn btn-ghost btn-full btn-sm" onClick={handleLogout}>
          <FontAwesomeIcon icon={faRightFromBracket} style={{ marginRight: 8 }} />
          Logout
        </button>
      </div>
    </aside>
  )
}
