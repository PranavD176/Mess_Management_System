import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getPendingPlans, approvePlan, rejectPlan } from '../api'

export default function ApprovePlanPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchPendingPlans()
  }, [])

  const fetchPendingPlans = async () => {
    try {
      const data = await getPendingPlans()
      setPlans(data)
    } catch (error) {
      toast.error('Failed to fetch pending plans')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedPlan) return
    
    setProcessing(true)
    try {
      await approvePlan(selectedPlan.id, adminNotes)
      toast.success('Plan approved successfully!')
      setSelectedPlan(null)
      setAdminNotes('')
      fetchPendingPlans()
    } catch (error) {
      toast.error('Failed to approve plan')
      console.error('Error:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPlan || !adminNotes.trim()) {
      toast.error('Please provide rejection reason')
      return
    }
    
    setProcessing(true)
    try {
      await rejectPlan(selectedPlan.id, adminNotes)
      toast.success('Plan rejected successfully!')
      setSelectedPlan(null)
      setAdminNotes('')
      fetchPendingPlans()
    } catch (error) {
      toast.error('Failed to reject plan')
      console.error('Error:', error)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="page-body">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="page-title">Approve Plans</h1>
            <p className="page-subtitle">Review and approve student plan renewals</p>
          </div>
          <div className="badge badge-primary" style={{ padding: '8px 16px', fontSize: 14 }}>
            {plans.length} Pending Plans
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="grid grid-cols-3 gap-6" style={{ gridTemplateColumns: '1fr 2fr', display: 'grid', gap: 24, alignItems: 'start' }}>
          {/* Pending Plans List */}
          <div className="card">
            <h3 className="card-title">Pending Plans</h3>
            <div className="plans-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {plans.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <h3>No pending plans</h3>
                  <p>All plans have been reviewed</p>
                </div>
              ) : (
                plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`plan-item ${selectedPlan?.id === plan.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPlan(plan)
                      setAdminNotes('')
                    }}
                  >
                    <div className="plan-header">
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-roll">{plan.roll_no}</div>
                    </div>
                    <div className="plan-details">
                      <div className="plan-amount">₹ {plan.amount}</div>
                      <div className="plan-date">
                        {new Date(plan.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Plan Review Panel */}
          <div>
            {selectedPlan ? (
              <div className="card">
                <h3 className="card-title">Plan Review</h3>
                
                {/* Student Info */}
                <div className="review-section">
                  <h4 className="section-title">Student Information</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Name:</span>
                      <span className="info-value">{selectedPlan.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Roll Number:</span>
                      <span className="info-value">{selectedPlan.roll_no}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Course:</span>
                      <span className="info-value">{selectedPlan.course}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Branch:</span>
                      <span className="info-value">{selectedPlan.branch || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Year:</span>
                      <span className="info-value">{selectedPlan.year}</span>
                    </div>
                  </div>
                </div>

                {/* Plan Details */}
                <div className="review-section mt-4">
                  <h4 className="section-title">Plan Details</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Amount:</span>
                      <span className="info-value amount">₹ {selectedPlan.amount}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Plan Start:</span>
                      <span className="info-value">{selectedPlan.plan_start}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Plan End:</span>
                      <span className="info-value">{selectedPlan.plan_end}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Low Balance Threshold:</span>
                      <span className="info-value">₹ {selectedPlan.low_balance_threshold}</span>
                    </div>
                  </div>
                </div>

                {/* Fee Receipt */}
                <div className="review-section mt-4">
                  <h4 className="section-title">Fee Receipt</h4>
                  <div className="receipt-preview">
                    <div className="receipt-actions flex gap-3">
                      <a
                        href={selectedPlan.fee_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                      >
                        📄 View PDF Receipt
                      </a>
                    </div>
                    <div className="receipt-note mt-2">
                      Please verify the amount in the PDF matches the requested amount (₹{selectedPlan.amount})
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="review-section mt-4">
                  <h4 className="section-title">Admin Actions</h4>
                  <div className="admin-actions">
                    <div className="form-group">
                      <label className="form-label">Notes (Required for rejection)</label>
                      <textarea
                        className="form-input"
                        placeholder="Enter your notes here..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows="3"
                      />
                    </div>
                    <div className="action-buttons flex gap-3 mt-4">
                      <button
                        className="btn btn-success"
                        onClick={handleApprove}
                        disabled={processing}
                      >
                        {processing ? '⏳ Processing...' : '✅ Approve Plan'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={handleReject}
                        disabled={processing || !adminNotes.trim()}
                      >
                        {processing ? '⏳ Processing...' : '❌ Reject Plan'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <h3>Select a plan to review</h3>
                  <p>Choose a pending plan from the list to review details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
