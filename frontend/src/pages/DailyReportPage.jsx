import { useState } from 'react'
import toast from 'react-hot-toast'
import { getDailyReport } from '../api'
import { formatMoney, toMoneyInt } from '../utils/money'

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
                <div className="stat-icon">👥</div>
                <div className="stat-label">Students Scanned</div>
                <div className="stat-value">{report.by_student?.length || 0}</div>
                <div className="stat-sub">Unique students</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🍽️</div>
                <div className="stat-label">Total Meals</div>
                <div className="stat-value">{report.total_entries || 0}</div>
                <div className="stat-sub">{date}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-label">Total Deducted</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{formatMoney(report.grand_total, '₹0')}</div>
                <div className="stat-sub">Revenue collected</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-label">Avg per Student</div>
                <div className="stat-value">
                  ₹{report.by_student?.length ? Math.round((toMoneyInt(report.grand_total) ?? 0) / report.by_student.length) : 0}
                </div>
                <div className="stat-sub">Average amount</div>
              </div>
            </div>

            {/* Student breakdown table */}
            <div className="card">
              <div className="card-title">👥 Student-wise Breakdown</div>
              {!report.by_student?.length ? (
                <div className="empty-state">
                  <div className="empty-state-icon">😴</div>
                  <p>No students scanned on {date}</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Roll No</th>
                        <th>No of Scans in Day</th>
                        <th>AVG Meals/3</th>
                        <th>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.by_student.map(row => (
                        <tr key={row.student_id}>
                          <td><strong style={{ color: 'var(--text-primary)' }}>{row.student_name}</strong></td>
                          <td><span className="badge badge-info">{row.roll_no}</span></td>
                          <td><strong>{row.scan_count}</strong></td>
                          <td>{row.avg_meals_divided_by_3?.toFixed(2) || '0.00'}</td>
                          <td><strong style={{ color: 'var(--success)' }}>{formatMoney(row.total_amount, '₹0')}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td><strong style={{ color: 'var(--text-primary)' }}>Total</strong></td>
                        <td><strong>{report.by_student?.length || 0} Students</strong></td>
                        <td><strong>{report.total_entries}</strong></td>
                        <td>—</td>
                        <td><strong style={{ color: 'var(--success)', fontSize: 15 }}>{formatMoney(report.grand_total, '₹0')}</strong></td>
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
