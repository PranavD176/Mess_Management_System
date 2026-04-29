import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faScaleBalanced,
  faFileInvoiceDollar,
  faSpinner,
  faTriangleExclamation,
  faCircleCheck,
  faUser,
  faClipboardList,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons'
import { listStudents, adjustBalance } from '../api'
import { formatMoney, toMoneyInt } from '../utils/money'

export default function ManualAdjustPage() {
  const [students, setStudents]   = useState([])
  const [form, setForm]           = useState({ student_id: '', amount: '', note: '' })
  const [saving, setSaving]       = useState(false)
  const [history, setHistory]     = useState([])     // accumulate all adjustments this session
  const [currentBalance, setCurrentBalance] = useState(null)

  useEffect(() => {
    listStudents().then(data => {
      setStudents(data)
    }).catch(console.error)
  }, [])

  // Update currentBalance whenever student selection changes
  useEffect(() => {
    if (!form.student_id) { setCurrentBalance(null); return }
    const s = students.find(s => s.id === parseInt(form.student_id))
    if (s) setCurrentBalance(toMoneyInt(s.balance))
  }, [form.student_id, students])

  const selected = students.find(s => s.id === parseInt(form.student_id))
  const amountValue = toMoneyInt(form.amount)
  const previewBalance = currentBalance != null && form.amount
    ? currentBalance + (amountValue ?? 0)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const adjustmentAmount = toMoneyInt(form.amount)
    if (!form.student_id) { toast.error('Select a student'); return }
    if (adjustmentAmount == null || adjustmentAmount === 0) { toast.error('Enter a non-zero amount'); return }
    if (!form.note.trim()) { toast.error('Add a note explaining the adjustment'); return }

    setSaving(true)
    try {
      const data = await adjustBalance({
        student_id: parseInt(form.student_id),
        amount: adjustmentAmount,
        note: form.note.trim(),
      })

      const newBalance = toMoneyInt(data.new_balance) ?? 0
      const adjAmount  = toMoneyInt(data.adjustment_amount) ?? 0

      toast.success(
        `${adjAmount > 0 ? 'Payment' : 'Deduction'} of ₹${Math.abs(adjAmount)} recorded. Balance: ₹${newBalance}`
      )

      // Update balance in the local students list immediately (no refetch needed)
      setStudents(prev => prev.map(s =>
        s.id === parseInt(form.student_id) ? { ...s, balance: newBalance } : s
      ))
      // currentBalance now updates via the useEffect above

      // Keep student selected — just clear amount & note for the next payment
      setForm(f => ({ ...f, amount: '', note: '' }))

      // Prepend to session history
      setHistory(prev => [{
        id: Date.now(),
        studentName: selected?.name,
        amount: adjAmount,
        newBalance,
        note: form.note.trim(),
      }, ...prev])

    } catch (err) {
      toast.error(err.response?.data?.detail || 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  const isCredit = (amountValue ?? 0) > 0
  const isDeduct = (amountValue ?? 0) < 0
  const balColor = (bal) =>
    bal == null ? 'var(--text-muted)' : bal < 0 ? 'var(--danger)' : bal < 500 ? 'var(--warning)' : 'var(--success)'

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><FontAwesomeIcon icon={faScaleBalanced} style={{ marginRight: 8 }} />Manual Balance Adjustment</h1>
        <p className="page-subtitle">Record a payment or manual deduction to a student's account</p>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, alignItems: 'start' }}>

          {/* ── Form ── */}
          <div className="card">
            <div className="card-title"><FontAwesomeIcon icon={faFileInvoiceDollar} style={{ marginRight: 8 }} />Adjustment Form</div>
            <div className="alert alert-info mb-4">
              Use <strong>positive amounts</strong> to add payment (e.g. +1000), <strong>negative amounts</strong> for deductions (e.g. -200).
              You can submit multiple times for the same student.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="adj-student">Student</label>
                <select
                  id="adj-student"
                  className="form-input form-select"
                  value={form.student_id}
                  onChange={e => setForm({ ...form, student_id: e.target.value })}
                  required
                >
                  <option value="">Select a student…</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.roll_no}) — {formatMoney(s.balance, 'No plan')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current balance display */}
              {selected && (
                <div style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span className="text-muted">Current Balance</span>
                  <span className="font-bold" style={{ color: balColor(currentBalance), fontSize: 16 }}>
                    {formatMoney(currentBalance, 'No plan')}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="adj-amount">Amount (₹)</label>
                <input
                  id="adj-amount"
                  className="form-input"
                  type="number"
                  step="1"
                  placeholder="e.g. 1000 for payment · -200 for deduction"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                  style={{ borderColor: isCredit ? 'rgba(16,185,129,0.5)' : isDeduct ? 'rgba(239,68,68,0.5)' : undefined }}
                />
                {form.amount && (
                  <div style={{ fontSize: 12, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isCredit ? 'var(--success)' : isDeduct ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {isCredit
                        ? <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} />Payment - balance will increase</>
                        : isDeduct
                          ? <><FontAwesomeIcon icon={faCircleXmark} style={{ marginRight: 6 }} />Deduction - balance will decrease</>
                          : ''}
                    </span>
                    {previewBalance != null && (
                      <span style={{ color: balColor(previewBalance) }}>
                        → <strong>{formatMoney(previewBalance, '₹0')}</strong> after
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adj-note">Reason / Note</label>
                <textarea
                  id="adj-note"
                  className="form-input"
                  rows={2}
                  placeholder="e.g. 'Cash payment received' or 'Fee correction'"
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={saving}>
                {saving
                  ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Processing...</>
                  : isDeduct
                    ? <><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 8 }} />Apply Deduction</>
                    : <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />Record Payment</>}
              </button>
            </form>
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Selected student live preview */}
            {selected && (
              <div className="card">
                <div className="card-title"><FontAwesomeIcon icon={faUser} style={{ marginRight: 8 }} />{selected.name}</div>
                <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="flex justify-between">
                    <span className="text-muted">Roll No</span>
                    <span>{selected.roll_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Branch</span>
                    <span>{selected.branch} — Year {selected.year}</span>
                  </div>
                  <hr className="divider" style={{ margin: '2px 0' }} />
                  <div className="flex justify-between">
                    <span className="text-muted">Current Balance</span>
                    <span className="font-bold" style={{ color: balColor(currentBalance), fontSize: 18 }}>
                      {formatMoney(currentBalance, 'No plan')}
                    </span>
                  </div>
                  {previewBalance != null && form.amount && (
                    <div className="flex justify-between">
                      <span className="text-muted">Balance After</span>
                      <span className="font-bold" style={{ color: balColor(previewBalance), fontSize: 18 }}>
                        {formatMoney(previewBalance, '₹0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session history */}
            {history.length > 0 && (
              <div className="card">
                <div className="card-title"><FontAwesomeIcon icon={faClipboardList} style={{ marginRight: 8 }} />This Session</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(h => (
                    <div key={h.id} style={{
                      background: h.amount > 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                      border: `1px solid ${h.amount > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      borderRadius: 8, padding: '10px 12px', fontSize: 13,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span className="font-bold">{h.studentName}</span>
                        <span className="font-bold" style={{ color: h.amount > 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {h.amount > 0 ? '+' : ''}₹{Math.abs(h.amount)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">{h.note}</span>
                        <span className="text-muted">→ ₹{h.newBalance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
