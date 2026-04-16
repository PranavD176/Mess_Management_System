import { useState } from 'react'
import toast from 'react-hot-toast'
import { getDailyReport } from '../api'

const MEAL_DATA = {
  breakfast: { icon: '🌅', color: 'var(--warning)' },
  lunch:     { icon: '☀️', color: 'var(--accent)' },
  dinner:    { icon: '🌙', color: '#8b5cf6' },
}

export default function DailyReportPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = async () => {
    if (!date) { toast.error('Select a date'); return }
    setLoading(true)
    try {
      const data = await getDailyReport(date)
      setReport(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📅 Daily Meal Report</h1>
        <p className="page-subtitle">Meal counts and amounts deducted for a specific day</p>
      </div>

      <div className="page-body">
        {/* Date picker */}
        <div className="card mb-6">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '0 0 200px' }}>
              <label className="form-label" htmlFor="daily-date">Select Date</label>
              <input
                id="daily-date"
                className="form-input"
                type="date"
                value={date}
                max={today}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
              {loading ? '⏳ Loading…' : '📊 Generate Report'}
            </button>
          </div>
        </div>

        {report && (
          <>
            {/* Summary stats */}
            <div className="stat-grid mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <div className="stat-card">
                <div className="stat-icon">🍽️</div>
                <div className="stat-label">Total Meals</div>
                <div className="stat-value">{report.total_entries || 0}</div>
                <div className="stat-sub">{date}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-label">Total Deducted</div>
                <div className="stat-value" style={{ fontSize: 22 }}>₹{(report.grand_total || 0).toFixed(0)}</div>
                <div className="stat-sub">Revenue collected</div>
              </div>
              {['breakfast', 'lunch', 'dinner'].map(m => {
                const row = report.by_meal?.find(r => r.meal_type === m)
                return (
                  <div key={m} className="stat-card">
                    <div className="stat-icon">{MEAL_DATA[m].icon}</div>
                    <div className="stat-label">{m.charAt(0).toUpperCase() + m.slice(1)}</div>
                    <div className="stat-value" style={{ color: MEAL_DATA[m].color }}>{row?.count || 0}</div>
                    <div className="stat-sub">₹{parseFloat(row?.total_amount || 0).toFixed(0)} collected</div>
                  </div>
                )
              })}
            </div>

            {/* Breakdown table */}
            <div className="card">
              <div className="card-title">🍽️ Meal-wise Breakdown</div>
              {!report.by_meal?.length ? (
                <div className="empty-state">
                  <div className="empty-state-icon">😴</div>
                  <p>No meals recorded on {date}</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Meal Type</th>
                        <th>Students Attended</th>
                        <th>Rate per Meal</th>
                        <th>Total Deducted</th>
                        <th>% of Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.by_meal.map(row => {
                        const meta = MEAL_DATA[row.meal_type] || {}
                        const pct = report.total_entries ? ((row.count / report.total_entries) * 100).toFixed(1) : 0
                        const rate = parseFloat(row.total_amount) / row.count
                        return (
                          <tr key={row.meal_type}>
                            <td>
                              <span>{meta.icon} </span>
                              <span className="badge badge-info" style={{ color: meta.color }}>
                                {row.meal_type}
                              </span>
                            </td>
                            <td><strong style={{ color: 'var(--text-primary)' }}>{row.count}</strong></td>
                            <td>₹{rate.toFixed(2)}</td>
                            <td><strong style={{ color: 'var(--success)' }}>₹{parseFloat(row.total_amount).toFixed(2)}</strong></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, background: meta.color, height: '100%', borderRadius: 4 }} />
                                </div>
                                <span className="text-sm">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td><strong style={{ color: 'var(--text-primary)' }}>Total</strong></td>
                        <td><strong>{report.total_entries}</strong></td>
                        <td>—</td>
                        <td><strong style={{ color: 'var(--success)', fontSize: 15 }}>₹{(report.grand_total || 0).toFixed(2)}</strong></td>
                        <td>100%</td>
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
            <div className="empty-state-icon">📅</div>
            <p>Select a date and click Generate Report</p>
          </div>
        )}
      </div>
    </>
  )
}
