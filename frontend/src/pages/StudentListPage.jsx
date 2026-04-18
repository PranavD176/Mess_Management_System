import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listStudents } from '../api'

export default function StudentListPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    listStudents().then(setStudents).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(search.toLowerCase()) ||
    s.course?.toLowerCase().includes(search.toLowerCase()) ||
    s.branch?.toLowerCase().includes(search.toLowerCase())
  )

  // Treat null balance (no plan) as ₹0 for display purposes
  const displayBalance = (b) => b != null ? parseFloat(b) : 0

  const balanceColor = (b) => {
    const v = displayBalance(b)
    if (v < 0)   return 'var(--danger)'
    if (v < 500) return 'var(--warning)'
    return 'var(--text-muted)'  // ₹0 shown neutral
  }

  const rowClass = (b) => {
    const v = displayBalance(b)
    if (v < 0)   return 'row-danger'
    if (v < 500) return 'row-warning'
    return ''
  }

  return (
    <>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="page-title">Students</h1>
            <p className="page-subtitle">Manage all registered students and their meal plans</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/students/new')}>
            <span>Register Student</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Enhanced Stats */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon">Students</div>
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{students.length}</div>
            <div className="stat-sub">Registered users</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">Active Plans</div>
            <div className="stat-label">Active Plans</div>
            <div className="stat-value">{students.filter(s => s.has_active_plan).length}</div>
            <div className="stat-sub">Currently active</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">Low Balance</div>
            <div className="stat-label">Low Balance</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {students.filter(s => s.balance != null && s.balance < 500 && s.balance > 0).length}
            </div>
            <div className="stat-sub">Below 500</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">Exhausted</div>
            <div className="stat-label">Exhausted</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              {students.filter(s => s.balance != null && s.balance <= 0).length}
            </div>
            <div className="stat-sub">Zero balance</div>
          </div>
        </div>

        {/* Enhanced Search and Filter */}
        <div className="card mb-6">
          <div style={{ marginBottom: 16 }}>
            <div style={{ position: 'relative', maxWidth: 400 }}>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{ 
                  position: 'absolute', 
                  left: 12, 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="form-input"
                placeholder="Search students by name, roll no, course, or branch..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Enhanced Table */}
        <div className="card">
          {loading ? (
            <div className="loading-indicator">
              <div className="spinner" />
              <p>Loading students...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">Students</div>
              <h3>{search ? 'No students found' : 'No students registered'}</h3>
              <p>{search ? 'Try adjusting your search terms' : 'Start by registering your first student'}</p>
              {!search && (
                <button className="btn btn-primary" onClick={() => navigate('/students/new')}>
                  Register First Student
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Details</th>
                    <th>Balance</th>
                    <th>Plan Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className={rowClass(s.balance)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, var(--accent), #8b5cf6)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            fontWeight: 600,
                            color: 'white'
                          }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: #{s.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          <span className="badge badge-muted">{s.roll_no}</span>
                          <span className="badge badge-primary">{s.course}</span>
                          {s.branch && <span className="badge badge-info">{s.branch}</span>}
                          <span className="badge badge-warning">Year {s.year}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6,
                          fontWeight: 700,
                          fontSize: 14,
                          color: balanceColor(s.balance)
                        }}>
                          <span style={{ 
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: balanceColor(s.balance)
                          }} />
                          {displayBalance(s.balance).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {s.balance < 0 ? 'Overdrawn' : s.balance === 0 ? 'No balance' : 'Available'}
                        </div>
                      </td>
                      <td>
                        {s.plan_end ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {s.has_active_plan ? (
                                <span className="badge badge-success">Active</span>
                              ) : (
                                <span className="badge badge-muted">Inactive</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              {new Date(s.plan_end) < new Date() ? 'Expired' : `Expires ${s.plan_end}`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="badge badge-muted">No Plan</span>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              No billing plan
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => navigate(`/students/${s.id}`)}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6,
                            padding: '6px 12px'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
