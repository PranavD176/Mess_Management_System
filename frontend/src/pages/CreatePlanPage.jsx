import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getStudent, createBillingPlan, createMyPlan, renewBillingPlan, renewMyPlan, getCurrentStudent } from '../api'

export default function CreatePlanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isRenewal) {
        if (!renewal || !renewal.id) {
          toast.error('Plan information not available for renewal. Please refresh and try again.')
          return
        }
        // Use appropriate endpoint based on access type
        let data;
        if (id) {
          // Admin renewing student's plan
          data = await renewBillingPlan(renewal.id, {
            new_installment_amount: parseFloat(form.installment_amount),
            new_plan_end: form.plan_end,
            low_balance_threshold: parseFloat(form.low_balance_threshold),
          })
        } else {
          // Student renewing their own plan
          data = await renewMyPlan({
            new_installment_amount: parseFloat(form.installment_amount),
            new_plan_end: form.plan_end,
            low_balance_threshold: parseFloat(form.low_balance_threshold),
          })
        }
        toast.success(
          `Payment recorded! New balance: ${parseFloat(data.new_plan.balance).toFixed(2)}` +
          (data.carry_forward_amount < 0
            ? ` (debt of ${Math.abs(data.carry_forward_amount).toFixed(2)} cleared)`
            : data.carry_forward_amount > 0 ? ` (+ ${data.carry_forward_amount.toFixed(2)} credit)` : '')
        )
      } else {
        if (!student || !student.id) {
          toast.error('Student information not available. Please refresh and try again.')
          return
        }
        // Use appropriate endpoint based on access type
        if (id) {
          // Admin creating plan for student
          await createBillingPlan({
            student_id: student.id,
            installment_amount: parseFloat(form.installment_amount),
            plan_start: form.plan_start,
            plan_end: form.plan_end,
            low_balance_threshold: parseFloat(form.low_balance_threshold),
          })
        } else {
          // Student creating their own plan
          await createMyPlan({
            student_id: student.id,
            installment_amount: parseFloat(form.installment_amount),
            plan_start: form.plan_start,
            plan_end: form.plan_end,
            low_balance_threshold: parseFloat(form.low_balance_threshold),
          })
        }
        toast.success('Billing plan created!')
      }
      // Navigate back based on context
      if (id) {
        navigate(`/students/${id}`) // Admin goes back to student detail
      } else {
        navigate('/dashboard') // Student goes back to dashboard
      }
    } catch (error) {
      console.error('Plan creation error:', error)
      toast.error(error.response?.data?.detail || 'Failed to create plan. Please try again.')
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

              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                {saving ? '⏳ Saving…' : isRenewal ? '🔄 Renew Plan' : '✅ Create Plan'}
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
