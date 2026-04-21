import axios from 'axios'

const api = axios.create({ baseURL: '/' })

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data.data)

// ── Students ──────────────────────────────────────────────────
export const registerStudent = (data) =>
  api.post('/students', data).then((r) => r.data.data)

export const registerStudentAdmin = (data) =>
  api.post('/students/admin', data).then((r) => r.data.data)

export const listStudents = () =>
  api.get('/students').then((r) => r.data.data)

export const getStudent = (id) =>
  api.get(`/students/${id}`).then((r) => r.data.data)

export const getStudentFull = (id) =>
  api.get(`/students/${id}/full`).then((r) => r.data.data)

export const getStudentQR = (id) =>
  api.get(`/students/${id}/qr`).then((r) => r.data.data)

export const getCurrentStudent = () =>
  api.get('/students/me').then((r) => r.data.data)

export const getPendingStudents = () =>
  api.get('/students/pending').then((r) => r.data)

export const approveStudent = (studentId) =>
  api.post(`/students/${studentId}/approve`).then((r) => r.data)

export const rejectStudent = (studentId) =>
  api.post(`/students/${studentId}/reject`).then((r) => r.data)

// ── Meals ─────────────────────────────────────────────────────
export const scanMeal = (student_id) =>
  api.post('/meals/scan', { student_id: String(student_id) }).then((r) => r.data.data)

export const getDailyReport = (date) =>
  api.get(`/meals/report/daily?date=${date}`).then((r) => r.data.data)

export const getMonthlyReport = (month, year) =>
  api.get(`/meals/report/monthly?month=${month}&year=${year}`).then((r) => r.data.data)

export const getMealHistory = (student_id) =>
  api.get(`/meals/history/${student_id}`).then((r) => r.data.data)

// ── Billing ───────────────────────────────────────────────────
export const createBillingPlan = (data) =>
  api.post('/billing/plans', data).then((r) => r.data.data)

export const createMyPlan = (data) =>
  api.post('/billing/my-plan', data).then((r) => r.data.data)

export const renewBillingPlan = (plan_id, data) =>
  api.post(`/billing/plans/${plan_id}/renew`, data).then((r) => r.data.data)

export const renewMyPlan = (data) =>
  api.post('/billing/my-plan/renew', data).then((r) => r.data.data)

export const getStudentPlans = (student_id) =>
  api.get(`/billing/plans/${student_id}`).then((r) => r.data.data)

export const getTransactions = (student_id) =>
  api.get(`/billing/transactions/${student_id}`).then((r) => r.data.data)

export const getBillingReport = () =>
  api.get('/billing/report').then((r) => r.data.data)

export const getBalance = (student_id) =>
  api.get(`/billing/balance/${student_id}`).then((r) => r.data.data)

export const adjustBalance = (data) =>
  api.post('/billing/adjust', data).then((r) => r.data.data)

// ── Pending Plans & Approvals ────────────────────────────────
export const submitPendingPlan = (formData) =>
  api.post('/billing/pending-plans', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((r) => r.data.data)

export const getPendingPlans = () =>
  api.get('/billing/pending-plans').then((r) => r.data.data)

export const approvePlan = (planId, adminNotes = '') =>
  api.post(`/billing/approve-plan/${planId}`, { admin_notes: adminNotes }).then((r) => r.data.data)

export const rejectPlan = (planId, adminNotes) =>
  api.post(`/billing/reject-plan/${planId}`, { admin_notes: adminNotes }).then((r) => r.data.data)

export const getPlanStatus = (studentId) =>
  api.get(`/billing/plan-status/${studentId}`).then((r) => r.data.data)

export default api
