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
            <h1 className="page-title">👥 Students</h1>
            <p className="page-subtitle">All registered students with current balance</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/students/new')}>
            ➕ Register Student
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{students.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-label">Active Plans</div>
            <div className="stat-value">{students.filter(s => s.has_active_plan).length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-label">Low Balance (&lt;₹500)</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {students.filter(s => s.balance != null && s.balance < 500 && s.balance > 0).length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚨</div>
            <div className="stat-label">Exhausted Balance</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              {students.filter(s => s.balance != null && s.balance <= 0).length}
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <input
              className="form-input"
              placeholder="🔍 Search by name, roll no, course, or branch…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 380 }}
            />
          </div>

          {loading ? (
            <div className="loading-indicator"><div className="spinner" /><p>Loading students…</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <p>{search ? 'No students match your search' : 'No students registered yet'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Roll No</th>
                    <th>Course</th>
                    <th>Branch</th>
                    <th>Year</th>
                    <th>Balance</th>
                    <th>Plan Expiry</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className={rowClass(s.balance)}>
                      <td><span className="text-muted text-sm">#{s.id}</span></td>
                      <td><strong style={{ color: 'var(--text-primary)' }}>{s.name}</strong></td>
                      <td><span className="badge badge-muted">{s.roll_no}</span></td>
                      <td><span className="badge badge-primary">{s.course}</span></td>
                      <td>{s.branch || '-'}</td>
                      <td>Year {s.year}</td>
                      <td>
                        <span style={{ color: balanceColor(s.balance), fontWeight: 700 }}>
                          ₹{displayBalance(s.balance).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        {s.plan_end
                          ? new Date(s.plan_end) < new Date()
                            ? <span className="text-danger text-sm">{s.plan_end} (Expired)</span>
                            : <span className="text-sm">{s.plan_end}</span>
                          : <span className="text-muted text-sm">No plan</span>
                        }
                      </td>
                      <td>
                        {s.has_active_plan
                          ? <span className="badge badge-success">Active</span>
                          : <span className="badge badge-muted">No Plan</span>
                        }
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>
                          View →
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
