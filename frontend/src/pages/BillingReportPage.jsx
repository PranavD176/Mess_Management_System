import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBillingReport } from '../api'

export default function BillingReportPage() {
  const navigate = useNavigate()
  const [report, setReport] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('balance')

  useEffect(() => {
    getBillingReport().then(setReport).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = report
    .filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.roll_no.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'balance') return (a.balance ?? Infinity) - (b.balance ?? Infinity)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'expiry') return new Date(a.plan_end || '9999') - new Date(b.plan_end || '9999')
      return 0
    })

  const exhausted = report.filter(r => r.balance != null && r.balance <= 0)
  const low       = report.filter(r => r.balance != null && r.balance > 0 && r.balance < (r.low_balance_threshold || 500))
  const expired   = report.filter(r => r.plan_end && new Date(r.plan_end) < new Date())
  const noplan    = report.filter(r => !r.is_active)

  const rowClass = (r) => {
    if (!r.is_active) return ''
    if (r.balance != null && r.balance <= 0) return 'row-danger'
    if (r.balance != null && r.balance < (r.low_balance_threshold || 500)) return 'row-warning'
    if (r.plan_end && new Date(r.plan_end) < new Date()) return 'row-danger'
    return ''
  }

  const balColor = (r) => {
    if (r.balance == null) return 'var(--text-muted)'
    if (r.balance <= 0) return 'var(--danger)'
    if (r.balance < (r.low_balance_threshold || 500)) return 'var(--warning)'
    return 'var(--success)'
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">💳 Billing Report</h1>
        <p className="page-subtitle">All students sorted by balance — highlights low and exhausted balances</p>
      </div>

      <div className="page-body">
        {/* Alert Summary */}
        {(exhausted.length > 0 || expired.length > 0) && (
          <div className="alert alert-error mb-4">
            🚨 <strong>{exhausted.length}</strong> student(s) have exhausted balance ·&nbsp;
            <strong>{expired.length}</strong> plan(s) have expired — action needed.
          </div>
        )}

        {/* Stats */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{report.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚨</div>
            <div className="stat-label">Exhausted</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{exhausted.length}</div>
            <div className="stat-sub">Balance ≤ ₹0</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-label">Low Balance</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{low.length}</div>
            <div className="stat-sub">Below threshold</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-label">Expired Plans</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{expired.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-label">No Plan</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{noplan.length}</div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input
              className="form-input"
              placeholder="🔍 Search by name or roll no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Sort by</label>
              <select className="form-input form-select" style={{ width: 160 }}
                value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="balance">Balance (Low → High)</option>
                <option value="name">Name (A→Z)</option>
                <option value="expiry">Expiry (Soonest)</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
            <span><span style={{ color: 'var(--danger)' }}>●</span> Exhausted / Expired plan</span>
            <span><span style={{ color: 'var(--warning)' }}>●</span> Low balance</span>
            <span><span style={{ color: 'var(--success)' }}>●</span> Healthy</span>
          </div>

          {loading ? (
            <div className="loading-indicator"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">💳</div><p>No students found</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Balance</th>
                    <th>Threshold</th>
                    <th>Installment</th>
                    <th>Consumed</th>
                    <th>Plan Expiry</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.student_id} className={rowClass(r)}>
                      <td><strong style={{ color: 'var(--text-primary)' }}>{r.name}</strong></td>
                      <td><span className="badge badge-muted">{r.roll_no}</span></td>
                      <td>
                        <span style={{ color: balColor(r), fontWeight: 700, fontSize: 15 }}>
                          {r.balance != null ? `₹${parseFloat(r.balance).toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {r.low_balance_threshold ? `₹${r.low_balance_threshold}` : '—'}
                      </td>
                      <td>{r.installment_amount ? `₹${parseFloat(r.installment_amount).toFixed(0)}` : '—'}</td>
                      <td>{r.total_consumed != null ? `₹${parseFloat(r.total_consumed).toFixed(0)}` : '—'}</td>
                      <td>
                        {r.plan_end
                          ? new Date(r.plan_end) < new Date()
                            ? <span className="text-danger text-sm">{r.plan_end} ⚠️</span>
                            : <span className="text-sm">{r.plan_end}</span>
                          : <span className="text-muted text-sm">—</span>
                        }
                      </td>
                      <td>
                        {!r.is_active
                          ? <span className="badge badge-muted">No Plan</span>
                          : r.balance <= 0
                          ? <span className="badge badge-danger">Exhausted</span>
                          : r.balance < (r.low_balance_threshold || 500)
                          ? <span className="badge badge-warning">Low</span>
                          : <span className="badge badge-success">Healthy</span>
                        }
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${r.student_id}`)}>
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
