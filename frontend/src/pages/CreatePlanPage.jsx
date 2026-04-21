import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getStudent, getCurrentStudent, submitPendingPlan } from '../api'

export default function CreatePlanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feeReceipt, setFeeReceipt] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const sixMonthsLater = new Date(Date.now() + 183 * 86400000).toISOString().slice(0, 10)

  const [form, setForm] = useState({
    installment_amount: '',
    plan_start: today,
    plan_end: sixMonthsLater,
    low_balance_threshold: 500,
  })
  const [renewal, setRenewal] = useState(null)

  useEffect(() => {
    if (id) {
      // Admin accessing student's plan
      getStudent(id)
        .then(s => {
          setStudent(s)
          if (s.active_plan) {
            setRenewal(s.active_plan)
            setForm(f => ({ ...f, plan_start: today }))
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      // Student accessing their own plan
      getCurrentStudent()
        .then(data => {
          setStudent(data.student)
          if (data.student.active_plan) {
            setRenewal(data.student.active_plan)
            setForm(f => ({ ...f, plan_start: today }))
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [id])

  const isRenewal = !!renewal

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are allowed')
        return
      }
      if (file.size > 3 * 1024 * 1024) {
        toast.error('File size must be less than 3MB')
        return
      }
      setFeeReceipt(file)
      toast.success('PDF file selected successfully')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!feeReceipt) {
      toast.error('Please upload fee receipt PDF (mandatory)')
      return
    }
    
    if (!form.installment_amount || parseFloat(form.installment_amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('fee_receipt', feeReceipt)
      formData.append('student_id', student.id)
      formData.append('amount', form.installment_amount)
      formData.append('plan_start', form.plan_start)
      formData.append('plan_end', form.plan_end)
      formData.append('low_balance_threshold', form.low_balance_threshold)

      await submitPendingPlan(formData)
      toast.success('Plan submitted for admin approval! You will be notified once reviewed.')
      
      if (id) {
        navigate(`/students/${id}`) 
      } else {
        navigate('/dashboard') 
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to submit plan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-body"><div className="spinner" /></div>

  const carryForward = isRenewal ? parseFloat(renewal.balance) : 0
  const newBalance = (parseFloat(form.installment_amount) || 0) + carryForward

  return (
    <>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }} onClick={() => id ? navigate(`/students/${id}`) : navigate('/dashboard')}>
          {id ? 'Back to Student' : 'Back to Dashboard'}
        </button>
        <h1 className="page-title">{isRenewal ? 'Renew Billing Plan' : 'Create Billing Plan'}</h1>
        <p className="page-subtitle">
          {student?.name} · {student?.roll_no}
          {isRenewal && <span className="badge badge-info" style={{ marginLeft: 8 }}>Renewal</span>}
        </p>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

          <div className="card">
            <div className="card-title">{isRenewal ? '🔄 Renewal Details' : '💳 Plan Details'}</div>

            {isRenewal && (
              <div className="alert alert-info mb-4">
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Previous Plan Balance</div>
                  <div style={{ fontSize: 13 }}>
                    Current balance: <strong style={{ color: carryForward < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {carryForward < 0 ? `- ₹${Math.abs(carryForward).toFixed(2)} (debt)` : `₹${carryForward.toFixed(2)}`}
                    </strong>.
                    Payment received will settle this {carryForward < 0 ? 'debt' : 'and add credit'}.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-4">
                <label className="form-label">Fee Receipt (Mandatory PDF, max 3MB)</label>
                <div className="file-upload-container">
                  <input
                    type="file"
                    id="feeReceipt"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="file-input"
                    required
                  />
                  <label htmlFor="feeReceipt" className="file-upload-label">
                    <div className="file-upload-icon">📄</div>
                    <div className="file-upload-text">
                      {feeReceipt ? feeReceipt.name : 'Choose PDF file or drag and drop'}
                    </div>
                    <div className="file-upload-subtext">
                      {feeReceipt ? `(${(feeReceipt.size / 1024 / 1024).toFixed(2)} MB)` : 'Click to select a file'}
                    </div>
                  </label>
                </div>
                {feeReceipt && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost mt-2"
                    onClick={() => setFeeReceipt(null)}
                  >
                    Remove File
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="plan-amount">
                  Installment Amount (₹) {isRenewal && '— new payment received'}
                </label>
                <input
                  id="plan-amount"
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 22000"
                  value={form.installment_amount}
                  onChange={e => setForm({ ...form, installment_amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="plan-start">Plan Start Date</label>
                  <input
                    id="plan-start"
                    className="form-input"
                    type="date"
                    value={form.plan_start}
                    onChange={e => setForm({ ...form, plan_start: e.target.value })}
                    disabled={isRenewal}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="plan-end">Plan End Date</label>
                  <input
                    id="plan-end"
                    className="form-input"
                    type="date"
                    value={form.plan_end}
                    onChange={e => setForm({ ...form, plan_end: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Low Balance Warning Threshold (₹)</label>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  ₹500 (Fixed)
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Staff sees a warning when balance drops below this amount</span>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={saving || !feeReceipt}>
                {saving ? '⏳ Submitting…' : '✅ Submit for Approval'}
              </button>
            </form>
          </div>

          {/* Summary */}
          <div>
            <div className="card">
              <div className="card-title">📊 Plan Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div className="flex justify-between">
                  <span className="text-muted">{isRenewal ? 'Payment Received' : 'Expected Payment'}</span>
                  <span className="font-bold">₹{parseFloat(form.installment_amount || 0).toFixed(2)}</span>
                </div>
                {isRenewal && (
                  <div className="flex justify-between">
                    <span className="text-muted">{carryForward < 0 ? '⚠️ Outstanding Debt' : 'Credit carry-over'}</span>
                    <span className="font-bold" style={{ color: carryForward < 0 ? 'var(--danger)' : 'var(--accent)' }}>
                      {carryForward < 0 ? `- ₹${Math.abs(carryForward).toFixed(2)}` : `+ ₹${carryForward.toFixed(2)}`}
                    </span>
                  </div>
                )}
                <hr className="divider" style={{ margin: '4px 0' }} />
                <div className="flex justify-between">
                  <span className="text-muted">Opening Balance</span>
                  {isRenewal ? (
                    <span className="font-bold" style={{ color: newBalance < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 18 }}>₹{newBalance.toFixed(2)}</span>
                  ) : (
                    <span className="font-bold text-success" style={{ fontSize: 18 }}>₹{newBalance.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Period</span>
                  <span>{form.plan_start} → {form.plan_end}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Low Balance Alert</span>
                  <span>₹{form.low_balance_threshold}</span>
                </div>
              </div>
            </div>

            {isRenewal && (
              <div className="card mt-4" style={{ background: 'var(--bg-card)' }}>
                <div className="card-title">📜 Previous Plan</div>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="flex justify-between"><span className="text-muted">Installment Paid</span><span>₹{parseFloat(renewal.installment_amount).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Remaining</span><span className="text-warning font-bold">₹{parseFloat(renewal.balance).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Period</span><span>{renewal.plan_start} → {renewal.plan_end}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
