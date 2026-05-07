import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarCheck,
  faSearch,
  faUserGraduate,
  faChevronLeft,
  faChevronRight,
  faGraduationCap,
} from '@fortawesome/free-solid-svg-icons'
import { listStudents, getStudentYearlyAttendance } from '../api'
import { AttendanceCalendar } from './AttendancePage'

const ACADEMIC_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

function getCurrentAcademicYear() {
  const now = new Date()
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

export default function AdminAttendancePage() {
  const now = new Date()
  const [students, setStudents] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear())
  const [activeMonth, setActiveMonth] = useState(now.getMonth() + 1)
  const [yearlyData, setYearlyData] = useState(null)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    if (selectedStudent) {
      fetchAttendance(selectedStudent.id)
    }
  }, [academicYear, selectedStudent])

  useEffect(() => {
    const q = search.toLowerCase().trim()
    if (!q) {
      setFilteredStudents(students)
    } else {
      setFilteredStudents(
        students.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.roll_no.toLowerCase().includes(q) ||
            (s.course && s.course.toLowerCase().includes(q))
        )
      )
    }
  }, [search, students])

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true)
      const list = await listStudents()
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name))
      setStudents(sorted)
      setFilteredStudents(sorted)
    } catch (err) {
      toast.error('Failed to load students')
      console.error(err)
    } finally {
      setLoadingStudents(false)
    }
  }

  const fetchAttendance = async (studentId) => {
    try {
      setLoadingAttendance(true)
      const result = await getStudentYearlyAttendance(studentId, academicYear)
      setYearlyData(result)
    } catch (err) {
      toast.error('Failed to load attendance')
      console.error(err)
    } finally {
      setLoadingAttendance(false)
    }
  }

  const selectStudent = (student) => {
    setSelectedStudent(student)
    setYearlyData(null)
    setAcademicYear(getCurrentAcademicYear())
    setActiveMonth(now.getMonth() + 1)
  }

  const handleMonthSelect = (m) => setActiveMonth(m)

  const handlePrevMonth = () => {
    const idx = ACADEMIC_MONTHS.indexOf(activeMonth)
    if (idx > 0) setActiveMonth(ACADEMIC_MONTHS[idx - 1])
  }

  const handleNextMonth = () => {
    const idx = ACADEMIC_MONTHS.indexOf(activeMonth)
    if (idx < ACADEMIC_MONTHS.length - 1) {
      const nextMonth = ACADEMIC_MONTHS[idx + 1]
      const nextYear = nextMonth >= 7 ? academicYear : academicYear + 1
      const now = new Date()
      if (nextYear > now.getFullYear() || (nextYear === now.getFullYear() && nextMonth > now.getMonth() + 1)) return
      setActiveMonth(nextMonth)
    }
  }

  const handlePrevYear = () => {
    setAcademicYear(y => y - 1)
    setActiveMonth(7)
  }

  const handleNextYear = () => {
    const currentAY = getCurrentAcademicYear()
    if (academicYear >= currentAY) return
    setAcademicYear(y => y + 1)
    setActiveMonth(7)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FontAwesomeIcon icon={faCalendarCheck} style={{ marginRight: 12, color: 'var(--success)' }} />
            Student Attendance
          </h1>
          <p className="page-subtitle">View meal attendance calendar for any student across academic years</p>
        </div>
      </div>

      <div className="page-body">
        <div className="admin-attendance-layout">
          {/* ── Left: Student List ── */}
          <div className="attendance-student-list card">
            <div className="attendance-search-bar">
              <FontAwesomeIcon icon={faSearch} className="search-icon" />
              <input
                type="text"
                className="form-input attendance-search-input"
                placeholder="Search by name, roll no, course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="attendance-list-scroll">
              {loadingStudents ? (
                <div className="loading-indicator"><div className="spinner"></div></div>
              ) : filteredStudents.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p>No students found</p>
                </div>
              ) : (
                filteredStudents.map((s) => (
                  <div
                    key={s.id}
                    className={`attendance-student-item ${selectedStudent?.id === s.id ? 'selected' : ''}`}
                    onClick={() => selectStudent(s)}
                  >
                    <div className="att-student-avatar">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="att-student-info">
                      <div className="att-student-name">{s.name}</div>
                      <div className="att-student-meta">
                        <span className="badge badge-muted">{s.roll_no}</span>
                        <span className="badge badge-primary">{s.course}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="attendance-list-footer">
              <span>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* ── Right: Calendar ── */}
          <div className="attendance-calendar-panel">
            {!selectedStudent ? (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <FontAwesomeIcon icon={faUserGraduate} />
                  </div>
                  <h3>Select a Student</h3>
                  <p>Choose a student from the list to view their meal attendance calendar</p>
                </div>
              </div>
            ) : (
              <>
                {/* Student info bar */}
                <div className="card attendance-student-banner mb-4">
                  <div className="att-banner-avatar">
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedStudent.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className="badge badge-muted">{selectedStudent.roll_no}</span>
                      <span className="badge badge-primary">{selectedStudent.course}</span>
                      {selectedStudent.branch && <span className="badge badge-info">{selectedStudent.branch}</span>}
                      <span className="badge badge-warning">Year {selectedStudent.year}</span>
                    </div>
                  </div>
                </div>

                {/* Academic Year Selector */}
                <div className="academic-year-selector">
                  <button className="btn btn-ghost btn-sm calendar-nav-btn" onClick={handlePrevYear} title="Previous academic year">
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <div className="academic-year-label">
                    <FontAwesomeIcon icon={faGraduationCap} style={{ marginRight: 8 }} />
                    Academic Year {academicYear}–{academicYear + 1}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm calendar-nav-btn"
                    onClick={handleNextYear}
                    disabled={academicYear >= getCurrentAcademicYear()}
                    title="Next academic year"
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>

                {loadingAttendance && !yearlyData ? (
                  <div className="card loading-indicator" style={{ padding: 48 }}>
                    <div className="spinner"></div>Loading attendance...
                  </div>
                ) : (
                  <AttendanceCalendar
                    yearlyData={yearlyData}
                    activeMonth={activeMonth}
                    academicYear={academicYear}
                    onMonthSelect={handleMonthSelect}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    loading={loadingAttendance}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
