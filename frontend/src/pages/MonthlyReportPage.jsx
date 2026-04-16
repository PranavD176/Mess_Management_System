import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getMonthlyReport } from '../api'

export default function MonthlyReportPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const fetchReport = async () => {
    setLoading(true)
    try {
      const data = await getMonthlyReport(parseInt(month), parseInt(year))
      setReport(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const filtered = report?.students?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  ) || []

  const totalMeals  = filtered.reduce((a, s) => a + (s.total_meals  || 0), 0)
  const totalAmount = filtered.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0)

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i))

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📊 Monthly Meal Report</h1>
        <p className="page-subtitle">Per-student meal totals for any month</p>
      </div>

      <div className="page-body">
        {/* Controls */}
        <div className="card mb-6">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="rpt-month">Month</label>
              <select id="rpt-month" className="form-input form-select" style={{ width: 140 }}
                value={month} onChange={e => setMonth(e.target.value)}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="rpt-year">Year</label>
              <select id="rpt-year" className="form-input form-select" style={{ width: 110 }}
                value={year} onChange={e => setYear(e.target.value)}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
              {loading ? '⏳ Loading…' : '📊 Generate Report'}
            </button>
          </div>
        </div>

        {report && (
          <>
            {/* Summary stats */}
            <div className="stat-grid mb-6">
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-label">Month</div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {MONTH_NAMES[report.month - 1]} {report.year}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-label">Students with Meals</div>
                <div className="stat-value">{report.students.filter(s => s.total_meals).length}</div>
                <div className="stat-sub">of {report.students.length} total</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🍽️</div>
                <div className="stat-label">Total Meals</div>
                <div className="stat-value">{totalMeals}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-label">Total Collected</div>
                <div className="stat-value" style={{ fontSize: 22 }}>₹{totalAmount.toFixed(0)}</div>
              </div>
            </div>

            {/* Table */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  🎓 Student-wise Summary — {MONTH_NAMES[report.month-1]} {report.year}
                </div>
                <input
                  className="form-input"
                  placeholder="🔍 Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: 200 }}
                />
              </div>

              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📊</div>
                  <p>No data for this period</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Roll No</th>
                        <th>Total Meals</th>
                        <th>Avg meals/day</th>
                        <th>Total Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.sort((a,b) => (b.total_meals||0) - (a.total_meals||0)).map(s => (
                        <tr key={s.student_id}>
                          <td><strong style={{ color: 'var(--text-primary)' }}>{s.name}</strong></td>
                          <td><span className="badge badge-muted">{s.roll_no}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="font-bold">{s.total_meals || 0}</span>
                              <div style={{ width: 60, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                                <div style={{
                                  width: `${Math.min(100, ((s.total_meals || 0) / 90) * 100)}%`,
                                  height: '100%', background: 'var(--accent)', borderRadius: 3
                                }} />
                              </div>
                            </div>
                          </td>
                          <td className="text-muted">{s.total_meals ? (s.total_meals / 30).toFixed(1) : '0'}/day</td>
                          <td><strong style={{ color: 'var(--success)' }}>₹{parseFloat(s.total_amount || 0).toFixed(2)}</strong></td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.student_id}`)}>
                              View →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}><strong style={{ color: 'var(--text-primary)' }}>Totals</strong></td>
                        <td><strong>{totalMeals}</strong></td>
                        <td>—</td>
                        <td><strong style={{ color: 'var(--success)' }}>₹{totalAmount.toFixed(2)}</strong></td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {!report && !loading && (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <div className="empty-state-icon">📊</div>
            <p>Select month and year, then Generate Report</p>
          </div>
        )}
      </div>
    </>
  )
}
