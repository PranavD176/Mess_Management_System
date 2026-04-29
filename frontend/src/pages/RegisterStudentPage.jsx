import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserPlus,
  faUser,
  faSpinner,
  faCircleCheck,
  faPlus,
  faDownload,
  faQrcode,
} from '@fortawesome/free-solid-svg-icons'
import { registerStudentAdmin } from '../api'

export default function RegisterStudentPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', roll_no: '', course: '', branch: '', year: '1' })
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await registerStudentAdmin({ ...form, year: parseInt(form.year) })
      setRegistered(data)
      toast.success(`${data.name} registered! ID: ${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setRegistered(null)
    setForm({ name: '', roll_no: '', course: '', branch: '', year: '1' })
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><FontAwesomeIcon icon={faUserPlus} style={{ marginRight: 8 }} />Register Student</h1>
        <p className="page-subtitle">Add a new student and generate their unique QR code</p>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* Form */}
          <div className="card">
            <div className="card-title"><FontAwesomeIcon icon={faUser} style={{ marginRight: 8 }} />Student Details</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input id="reg-name" className="form-input" type="text" placeholder="e.g. Ravi Kumar"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-roll">Roll Number</label>
                <input id="reg-roll" className="form-input" type="text" placeholder="e.g. CS2021001"
                  value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-course">Course</label>
                <select id="reg-course" className="form-input form-select"
                  value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value, branch: '' })} required>
                  <option value="">Select Course</option>
                  <option value="B.Tech">B.Tech</option>
                  <option value="M.Tech">M.Tech</option>
                  <option value="MCA">MCA</option>
                  <option value="Diploma">Diploma</option>
                </select>
              </div>

              <div className="form-row">
                {(form.course === 'B.Tech' || form.course === 'Diploma' || form.course === 'M.Tech' || form.course === 'MCA') && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-branch">Branch</label>
                    <select id="reg-branch" className="form-input form-select"
                      value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required>
                      <option value="">Select Branch</option>
                      {form.course === 'B.Tech'
                        ? ['CS','IT','EXTC','Electrical','Electronics','MECH','PROD','TEXTILE','Civil'].map(b =>
                            <option key={b} value={b}>{b}</option>
                          )
                        : form.course === 'Diploma'
                        ? ['production','chemsa','electrical','electronics','textile','mechanical'].map(b =>
                            <option key={b} value={b}>{b}</option>
                          )
                        : form.course === 'M.Tech'
                        ? ['CSE','ECE','Mechanical','Electrical','Civil','VLSI','Power Electronics'].map(b =>
                            <option key={b} value={b}>{b}</option>
                          )
                        : ['MCA'].map(b =>
                            <option key={b} value={b}>{b}</option>
                          )
                      }
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-year">Year</label>
                  <select id="reg-year" className="form-input form-select"
                    value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                    {form.course === 'B.Tech' 
                      ? [1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)
                      : form.course === 'Diploma'
                      ? [1,2,3].map(y => <option key={y} value={y}>Year {y}</option>)
                      : [1,2].map(y => <option key={y} value={y}>Year {y}</option>)
                    }
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading
                    ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Registering...</>
                    : <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />Register Student</>}
                </button>
                {registered && (
                  <button type="button" className="btn btn-ghost" onClick={handleReset}>
                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: 8 }} />
                    New Registration
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* QR Display */}
          <div className="card">
            {registered ? (
              <div>
                <div className="card-title"><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />Registration Successful</div>
                <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
                  <div><strong>Name:</strong> {registered.name}</div>
                  <div><strong>Roll No:</strong> {registered.roll_no}</div>
                  <div><strong>Student ID:</strong> <span className="text-accent font-bold">{registered.id}</span></div>
                  <div><strong>Course:</strong> {registered.course} {registered.branch && `· ${registered.branch}`} · Year {registered.year}</div>
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                    <strong>Initial Balance:</strong> <span className="text-muted">₹0.00</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>(postpaid — scan ready)</span>
                  </div>
                </div>

                <div className="qr-display">
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    QR Code — Print and give to student
                  </p>
                  <img src={registered.qr_base64} alt={`QR for ${registered.name}`} />
                  <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a
                      href={registered.qr_base64}
                      download={`qr_${registered.roll_no}.png`}
                      className="btn btn-ghost btn-sm"
                    >
                      <FontAwesomeIcon icon={faDownload} style={{ marginRight: 8 }} />
                      Download QR
                    </a>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/students/${registered.id}`)}
                    >
                      <FontAwesomeIcon icon={faUser} style={{ marginRight: 8 }} />
                      View Student
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon"><FontAwesomeIcon icon={faQrcode} /></div>
                <p>QR code will appear here after registration</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
