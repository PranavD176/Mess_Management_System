import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUtensils, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { registerStudent } from '../api'

export default function PublicRegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', roll_no: '', course: '', branch: '', year: '1' })
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await registerStudent({ ...form, year: parseInt(form.year) })
      setRegistered(data)
      toast.success('Registration successful!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <div className="login-logo">
          <div className="login-logo-icon"><FontAwesomeIcon icon={faUtensils} /></div>
          <h1 className="login-title">Student Registration</h1>
          <p className="login-subtitle">Create your account to access MessTrack</p>
        </div>

        {registered ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}><FontAwesomeIcon icon={faSpinner} spin /></div>
            <h2 style={{ marginBottom: 16 }}>Registration Submitted!</h2>
            <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '16px', marginBottom: 24, textAlign: 'left', fontSize: 14 }}>
              <p>Your registration has been submitted successfully and is now pending admin approval.</p>
              <br/>
              <p><strong>Name:</strong> {registered.name}</p>
              <p><strong>Roll Number:</strong> {registered.roll_no}</p>
              <p><strong>Course:</strong> {registered.course} {registered.branch && `· ${registered.branch}`} · Year {registered.year}</p>
              <br/>
              <p className="text-muted" style={{ fontSize: 12 }}>
                <strong>Important:</strong> You will be able to log in only after your registration is approved by admin.
                Once approved, your login credentials will be:
              </p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px', marginTop: 12, fontSize: 13 }}>
                <p><strong>Username:</strong> {registered.roll_no}</p>
                <p><strong>Password:</strong> {registered.roll_no}</p>
                <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                  Your roll number will be both username and password. You can change the password after first login.
                </p>
              </div>
            </div>
            <Link to="/login" className="btn btn-primary btn-full">
              Back to Login
            </Link>
          </div>
        ) : (
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

            <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16 }} disabled={loading}>
              {loading
                ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Registering...</>
                : 'Register Account'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
