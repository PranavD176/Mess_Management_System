import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStudentFull } from '../api'

const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }
const TXN_COLOR  = { deduction: 'var(--danger)', installment: 'var(--success)', carry_forward: 'var(--accent)', adjustment: 'var(--warning)' }

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
        background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  )
}

export default function StudentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('meals')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    getStudentFull(id)
      .then(setData)
      .catch(() => setError('Failed to load student data.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>Loading student data…</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="page-body"><div className="alert alert-error">{error || 'Student not found'}</div></div>
  )

  const { student, entries, plans, transactions, qr_base64 } = data
  const plan = student.active_plan
  const balAmt = plan ? parseFloat(plan.balance) : null
  const balColor = balAmt == null ? 'var(--text-muted)'
    : balAmt < 0   ? 'var(--danger)'
    : balAmt < 500 ? 'var(--warning)'
    : 'var(--success)'

  return (
    <>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }} onClick={() => navigate('/students')}>
              ← All Students
            </button>
            <h1 className="page-title">👤 {student.name}</h1>
            <p className="page-subtitle">{student.roll_no} · {student.course} {student.branch && `· ${student.branch}`} · Year {student.year}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {student.fee_receipt && (
              <a href={student.fee_receipt} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
                📄 Fee Receipt
              </a>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/students/${id}/plan`)}>
              {plan ? '🔄 Renew Plan' : '💳 Create Plan'}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Current Balance</div>
            <div className="stat-value" style={{ color: balColor }}>
              {balAmt != null ? `₹${balAmt.toFixed(2)}` : '—'}
            </div>
            <div className="stat-sub">
              {balAmt == null  ? 'No active plan'
               : balAmt < 0   ? '🔴 In debt — payment needed'
               : balAmt < 500 ? '⚠️ Low balance'
               : '✅ Sufficient'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Plan Expires</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{plan ? plan.plan_end : '—'}</div>
            <div className="stat-sub">{plan ? `Started ${plan.plan_start}` : '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Installment Paid</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{plan ? `₹${parseFloat(plan.installment_amount).toFixed(0)}` : '—'}</div>
            <div className="stat-sub">This plan period</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Consumed</div>
            <div className="stat-value" style={{ fontSize: 20 }}>
              {plan ? `₹${(parseFloat(plan.installment_amount) - parseFloat(plan.balance)).toFixed(0)}` : '—'}
            </div>
            <div className="stat-sub">{entries.length} meals (last 30)</div>
          </div>
        </div>

        {/* QR Code */}
        {qr_base64 && (
          <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <img src={qr_base64} alt="Student QR" style={{ width: 100, background: 'white', padding: 6, borderRadius: 8 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Student QR Code</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                DB ID #{student.id} · Roll No: {student.roll_no}
              </div>
              <a href={qr_base64} download={`qr_${student.roll_no}.png`} className="btn btn-ghost btn-sm">⬇️ Download QR</a>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
            <TabBtn label={`🍽️ Meals (${entries.length})`}  active={tab==='meals'} onClick={() => setTab('meals')} />
            <TabBtn label={`💰 Transactions (${transactions.length})`} active={tab==='txns'}  onClick={() => setTab('txns')} />
            <TabBtn label={`📋 Plans (${plans.length})`}     active={tab==='plans'} onClick={() => setTab('plans')} />
          </div>

          <div style={{ padding: 20 }}>
            {/* Meal History */}
            {tab === 'meals' && (
              entries.length === 0
                ? <div className="empty-state"><div className="empty-state-icon">🍽️</div><p>No meal history yet</p></div>
                : <div className="table-wrapper">
                    <table>
                      <thead><tr><th>#</th><th>Meal</th><th>Date & Time</th><th>Amount</th><th>Recorded By</th></tr></thead>
                      <tbody>
                        {entries.map(e => (
                          <tr key={e.id}>
                            <td className="text-muted text-sm">#{e.id}</td>
                            <td><span>{MEAL_ICONS[e.meal_type]} </span><span className="badge badge-info">{e.meal_type}</span></td>
                            <td>{new Date(e.entry_time).toLocaleString('en-IN')}</td>
                            <td className="text-danger font-bold">- ₹{e.amount_deducted}</td>
                            <td className="text-muted text-sm">{e.recorded_by || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}

            {/* Transactions */}
            {tab === 'txns' && (
              transactions.length === 0
                ? <div className="empty-state"><div className="empty-state-icon">💳</div><p>No transactions yet</p></div>
                : <div className="table-wrapper">
                    <table>
                      <thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Note</th><th>Date</th></tr></thead>
                      <tbody>
                        {transactions.map(t => (
                          <tr key={t.id}>
                            <td className="text-muted text-sm">#{t.id}</td>
                            <td><span className="badge badge-muted" style={{ color: TXN_COLOR[t.transaction_type] }}>{t.transaction_type}</span></td>
                            <td style={{ color: parseFloat(t.amount) < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                              {parseFloat(t.amount) >= 0 ? '+' : ''}₹{Math.abs(t.amount).toFixed(2)}
                            </td>
                            <td className="font-bold">₹{parseFloat(t.balance_after).toFixed(2)}</td>
                            <td className="text-muted text-sm">{t.note || (t.meal_entry_id ? `Meal #${t.meal_entry_id}` : '—')}</td>
                            <td className="text-sm">{new Date(t.created_at).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}

            {/* Plan History */}
            {tab === 'plans' && (
              plans.length === 0
                ? <div className="empty-state"><div className="empty-state-icon">📋</div><p>No plans yet</p></div>
                : <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Plan #</th><th>Installment</th><th>Balance</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                      <tbody>
                        {plans.map(p => (
                          <tr key={p.id}>
                            <td className="text-muted text-sm">#{p.id}</td>
                            <td className="font-bold">₹{parseFloat(p.installment_amount).toFixed(2)}</td>
                            <td style={{ color: parseFloat(p.balance) < 500 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                              ₹{parseFloat(p.balance).toFixed(2)}
                            </td>
                            <td>{p.plan_start}</td>
                            <td>{p.plan_end}</td>
                            <td>
                              {p.is_active
                                ? <span className="badge badge-success">Active</span>
                                : <span className="badge badge-muted">Inactive</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
