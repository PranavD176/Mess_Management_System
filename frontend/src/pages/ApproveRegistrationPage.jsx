import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSpinner,
  faUserCheck,
  faCircleCheck,
  faClipboardList,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons'
import { getPendingStudents, approveStudent, rejectStudent } from '../api'

export default function ApproveRegistrationPage() {
  const [pendingStudents, setPendingStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState({})

  useEffect(() => {
    loadPendingStudents()
  }, [])

  const loadPendingStudents = async () => {
    try {
      const response = await getPendingStudents()
      setPendingStudents(response.data)
    } catch (error) {
      toast.error('Failed to load pending registrations')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (studentId) => {
    setProcessing(prev => ({ ...prev, [studentId]: 'approving' }))
    try {
      const response = await approveStudent(studentId)
      toast.success(response.message)
      // Remove from pending list and show QR with login credentials
      setPendingStudents(prev => prev.filter(s => s.id !== studentId))
      
      // Show approval notification with credentials
      if (response.data.login_info) {
        toast.success(`${response.data.name} can now login!`, {
          duration: 8000,
          icon: <FontAwesomeIcon icon={faCircleCheck} />,
          style: {
            background: '#10b981',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
          },
        })
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve student')
    } finally {
      setProcessing(prev => ({ ...prev, [studentId]: null }))
    }
  }

  const handleReject = async (studentId) => {
    if (!window.confirm('Are you sure you want to reject this registration?')) {
      return
    }
    
    setProcessing(prev => ({ ...prev, [studentId]: 'rejecting' }))
    try {
      const response = await rejectStudent(studentId)
      toast.success(response.message)
      setPendingStudents(prev => prev.filter(s => s.id !== studentId))
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject student')
    } finally {
      setProcessing(prev => ({ ...prev, [studentId]: null }))
    }
  }

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title"><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Loading pending registrations...</h1>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><FontAwesomeIcon icon={faUserCheck} style={{ marginRight: 8 }} />Approve Student Registration</h1>
        <p className="page-subtitle">Review and approve pending student registrations</p>
      </div>

      <div className="page-body">
        {pendingStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FontAwesomeIcon icon={faCircleCheck} /></div>
            <h3>No Pending Registrations</h3>
            <p>All student registrations have been processed.</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-title">
              <FontAwesomeIcon icon={faClipboardList} style={{ marginRight: 8 }} />
              Pending Registrations ({pendingStudents.length})
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pendingStudents.map(student => (
                <div
                  key={student.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    background: 'var(--surface)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 16,
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <strong style={{ fontSize: 16 }}>{student.name}</strong>
                      <span className="badge badge-warning">Pending</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                      <div><strong>Roll No:</strong> {student.roll_no}</div>
                      <div><strong>Course:</strong> {student.course}</div>
                      {student.branch && <div><strong>Branch:</strong> {student.branch}</div>}
                      <div><strong>Year:</strong> {student.year}</div>
                      <div><strong>Applied:</strong> {new Date(student.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-success"
                      onClick={() => handleApprove(student.id)}
                      disabled={processing[student.id]}
                      style={{ minWidth: 100 }}
                    >
                      {processing[student.id] === 'approving'
                        ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Approving...</>
                        : <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />Approve</>}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleReject(student.id)}
                      disabled={processing[student.id]}
                      style={{ minWidth: 100 }}
                    >
                      {processing[student.id] === 'rejecting'
                        ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Rejecting...</>
                        : <><FontAwesomeIcon icon={faCircleXmark} style={{ marginRight: 8 }} />Reject</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
