import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getCurrentStudent } from '../api'
import { formatMoney, toMoneyInt } from '../utils/money'

export default function StudentDashboardPage() {
  const navigate = useNavigate()
  const [studentData, setStudentData] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('meals')

  useEffect(() => {
    fetchStudentData()
  }, [])

  const fetchStudentData = async () => {
    try {
      setLoading(true)
      const data = await getCurrentStudent()
      setStudentData(data)
      setQrCode(data.qr_base64)
    } catch (error) {
      toast.error('Failed to load student data')
      console.error('Error fetching student data:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    if (!qrCode) return
    
    const link = document.createElement('a')
    link.href = qrCode
    link.download = `student-qr-${studentData?.student?.roll_no || 'code'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  if (!studentData) {
    return (
      <div className="page-error">
        <div className="error-message">
          <h3>Student data not found</h3>
          <p>Please contact administration if you believe this is an error.</p>
        </div>
      </div>
    )
  }

  const { student, entries, transactions, plans } = studentData
  const activePlan = student.active_plan
  const activeBalance = activePlan ? (toMoneyInt(activePlan.balance) ?? 0) : null

  return (
    <>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="page-title">My Dashboard</h1>
            <p className="page-subtitle">Welcome back, {student.name}! Here's your mess account overview</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Student Profile Card */}
        <div className="card mb-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '24px' }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `linear-gradient(135deg, var(--accent), #8b5cf6)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
              color: 'white',
              flexShrink: 0
            }}>
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                {student.name}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <span className="badge badge-muted">{student.roll_no}</span>
                <span className="badge badge-primary">{student.course}</span>
                {student.branch && <span className="badge badge-info">{student.branch}</span>}
                <span className="badge badge-warning">Year {student.year}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Student ID: #{student.id}
              </div>
            </div>
            
            {activePlan && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: activeBalance > 500 ? 'var(--success)' : 'var(--warning)', marginBottom: 4 }}>
                  {activePlan.balance != null ? formatMoney(activePlan.balance) : 'No Plan'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Current Balance
                </div>
                <div className={`badge ${activeBalance > 500 ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: 8 }}>
                  {activeBalance > 500 ? 'Sufficient' : 'Low Balance'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon">Meals</div>
            <div className="stat-label">Meal Count</div>
            <div className="stat-value">{entries?.length || 0}</div>
            <div className="stat-sub">This month</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">Transactions</div>
            <div className="stat-label">Payment Records</div>
            <div className="stat-value">{transactions?.length || 0}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">Plans</div>
            <div className="stat-label">Current Plan</div>
            <div className="stat-value">{plans?.filter(p => p.is_active).length || 0}</div>
            <div className="stat-sub">Currently active</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">QR</div>
            <div className="stat-label">QR Code</div>
            <div className="stat-value">Ready</div>
            <div className="stat-sub">Download available</div>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="card mb-6">
          <div style={{ padding: '24px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
              Your QR Code
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {qrCode && (
                <div style={{
                  width: 120,
                  height: 120,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid var(--border)',
                  background: 'white'
                }}>
                  <img src={qrCode} alt="Student QR Code" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Show this QR code for mess entry and identification
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  <div>Student ID: #{student.id}</div>
                  <div>Roll Number: {student.roll_no}</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-primary" onClick={downloadQR}>
                    <span>Download QR Code</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  {student.fee_receipt && (
                    <a href={student.fee_receipt} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
                      📄 View Fee Receipt
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card">
          <div className="tabs" style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--border)',
            marginBottom: 0
          }}>
            {[
              { id: 'meals', label: 'Meals', count: entries?.length || 0, icon: 'Meals' },
              { id: 'transactions', label: 'Transactions', count: transactions?.length || 0, icon: 'Transactions' },
              { id: 'plans', label: 'Plans', count: plans?.length || 0, icon: 'Plans' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="badge badge-muted" style={{ fontSize: 10 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>
            {activeTab === 'meals' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                  Meal History
                </h3>
                {entries && entries.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Meal Type</th>
                          <th>Amount</th>
                          <th>Recorded By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((meal) => (
                          <tr key={meal.id}>
                            <td>
                              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                                {new Date(meal.entry_time).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {new Date(meal.entry_time).toLocaleTimeString()}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-primary">
                                {meal.meal_type?.charAt(0).toUpperCase() + meal.meal_type?.slice(1)}
                              </span>
                            </td>
                            <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                              -{formatMoney(meal.amount_deducted, '₹0')}
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                              {meal.recorded_by}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🍽️</div>
                    <h3>No meal records found</h3>
                    <p>You haven't had any meals recorded yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                  Transaction History
                </h3>
                {transactions && transactions.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Balance After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((txn) => (
                          <tr key={txn.id}>
                            <td>
                              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                                {new Date(txn.created_at).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {new Date(txn.created_at).toLocaleTimeString()}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-info">
                                {txn.transaction_type}
                              </span>
                            </td>
                            <td style={{ 
                              color: (toMoneyInt(txn.amount) ?? 0) < 0 ? 'var(--danger)' : 'var(--success)', 
                              fontWeight: 600 
                            }}>
                              {(toMoneyInt(txn.amount) ?? 0) < 0 ? '-' : '+'}{formatMoney(Math.abs(toMoneyInt(txn.amount) ?? 0), '₹0')}
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                              {formatMoney(txn.balance_after, '₹0')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">💳</div>
                    <h3>No transaction records found</h3>
                    <p>You don't have any transactions yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plans' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                  Billing Plans
                </h3>
                {plans && plans.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Plan Period</th>
                          <th>Status</th>
                          <th>Installment</th>
                          <th>Current Balance</th>
                          <th>Low Balance Threshold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map((plan) => (
                          <tr key={plan.id}>
                            <td>
                              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                                {plan.plan_start}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                to {plan.plan_end}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${plan.is_active ? 'badge-success' : 'badge-muted'}`}>
                                {plan.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                              {formatMoney(plan.installment_amount, '₹0')}
                            </td>
                            <td style={{ 
                              color: (toMoneyInt(plan.balance) ?? 0) < 500 ? 'var(--warning)' : 'var(--text-secondary)', 
                              fontWeight: 600 
                            }}>
                              {formatMoney(plan.balance, '₹0')}
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                              {formatMoney(plan.low_balance_threshold, '₹500')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <h3>No billing plans found</h3>
                    <p>Create your first plan to start using mess facility</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          {activePlan ? (
            <button className="btn btn-primary" onClick={() => navigate('/renew-plan')}>
              <span>Renew Plan</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6"/>
                <path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/renew-plan')}>
              <span>Create Plan</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
