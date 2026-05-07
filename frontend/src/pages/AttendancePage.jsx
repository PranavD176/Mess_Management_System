import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronLeft,
  faChevronRight,
  faCalendarCheck,
  faMugHot,
  faBowlRice,
  faMoon,
  faGraduationCap,
} from '@fortawesome/free-solid-svg-icons'
import { getMyYearlyAttendance } from '../api'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const MONTH_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
]
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Academic year months in order: July(7)..Dec(12), Jan(1)..June(6)
const ACADEMIC_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

/**
 * Get the current academic year start year.
 * If current month >= July, academic year starts this year. Otherwise, last year.
 */
function getCurrentAcademicYear() {
  const now = new Date()
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  const cells = []

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, inMonth: false, date: null })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ day: d, inMonth: true, date: `${year}-${mm}-${dd}` })
  }
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, inMonth: false, date: null })
    }
  }
  return cells
}

function getMealColor(type) {
  switch (type) {
    case 'breakfast': return '#f59e0b'
    case 'lunch': return '#3b82f6'
    case 'dinner': return '#8b5cf6'
    default: return '#64748b'
  }
}

function getMealLabel(type) {
  switch (type) {
    case 'breakfast': return 'B'
    case 'lunch': return 'L'
    case 'dinner': return 'D'
    default: return '?'
  }
}

/* ── Yearly Summary Card ───────────────────────────────────── */
function YearlySummaryCard({ yearlySummary, label }) {
  if (!yearlySummary) return null

  const pct = yearlySummary.attendance_pct || 0
  const circumference = 2 * Math.PI * 42
  const strokeDash = (pct / 100) * circumference

  return (
    <div className="attendance-summary-card yearly-summary-card">
      <div className="yearly-summary-header">
        <FontAwesomeIcon icon={faGraduationCap} style={{ color: 'var(--accent)', fontSize: 18 }} />
        <span className="yearly-summary-title">Academic Year Summary</span>
        <span className="badge badge-info">{label}</span>
      </div>

      <div className="summary-top-row">
        <div className="summary-ring-wrap" style={{ width: 96, height: 96 }}>
          <svg viewBox="0 0 96 96" className="summary-ring-svg" style={{ width: 96, height: 96 }}>
            <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle
              cx="48" cy="48" r="42" fill="none"
              stroke="url(#yearRingGrad)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              transform="rotate(-90 48 48)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
            <defs>
              <linearGradient id="yearRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="summary-ring-label">
            <span className="summary-ring-pct">{pct}%</span>
            <span className="summary-ring-sub">Yearly</span>
          </div>
        </div>

        <div className="summary-stats-col">
          <div className="summary-stat-row">
            <span className="summary-stat-label">Days Present</span>
            <span className="summary-stat-value">{yearlySummary.days_present} / {yearlySummary.total_days}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">Total Meals</span>
            <span className="summary-stat-value">{yearlySummary.total_meals}</span>
          </div>
        </div>
      </div>

      <div className="summary-meal-breakdown">
        <div className="summary-meal-chip breakfast-chip">
          <FontAwesomeIcon icon={faMugHot} />
          <span>Breakfast</span>
          <strong>{yearlySummary.breakfast_count}</strong>
        </div>
        <div className="summary-meal-chip lunch-chip">
          <FontAwesomeIcon icon={faBowlRice} />
          <span>Lunch</span>
          <strong>{yearlySummary.lunch_count}</strong>
        </div>
        <div className="summary-meal-chip dinner-chip">
          <FontAwesomeIcon icon={faMoon} />
          <span>Dinner</span>
          <strong>{yearlySummary.dinner_count}</strong>
        </div>
      </div>
    </div>
  )
}

/* ── Monthly Summary Card (for selected month) ─────────────── */
function MonthlySummaryCard({ summary, monthName, year }) {
  if (!summary) return null

  const pct = summary.attendance_pct || 0
  const circumference = 2 * Math.PI * 38
  const strokeDash = (pct / 100) * circumference

  return (
    <div className="attendance-summary-card">
      <div className="summary-top-row">
        <div className="summary-ring-wrap">
          <svg viewBox="0 0 88 88" className="summary-ring-svg">
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle
              cx="44" cy="44" r="38" fill="none"
              stroke="url(#monthRingGrad)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              transform="rotate(-90 44 44)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
            <defs>
              <linearGradient id="monthRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="summary-ring-label">
            <span className="summary-ring-pct">{pct}%</span>
            <span className="summary-ring-sub">Present</span>
          </div>
        </div>

        <div className="summary-stats-col">
          <div className="summary-stat-title">{monthName} {year}</div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">Days Present</span>
            <span className="summary-stat-value">{summary.days_present} / {summary.total_days_in_month}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">Total Meals</span>
            <span className="summary-stat-value">{summary.total_meals}</span>
          </div>
        </div>
      </div>

      <div className="summary-meal-breakdown">
        <div className="summary-meal-chip breakfast-chip">
          <FontAwesomeIcon icon={faMugHot} />
          <span>Breakfast</span>
          <strong>{summary.breakfast_count}</strong>
        </div>
        <div className="summary-meal-chip lunch-chip">
          <FontAwesomeIcon icon={faBowlRice} />
          <span>Lunch</span>
          <strong>{summary.lunch_count}</strong>
        </div>
        <div className="summary-meal-chip dinner-chip">
          <FontAwesomeIcon icon={faMoon} />
          <span>Dinner</span>
          <strong>{summary.dinner_count}</strong>
        </div>
      </div>
    </div>
  )
}

/* ── Month Selector Strip ──────────────────────────────────── */
function MonthStrip({ activeMonth, academicYear, onSelect, monthsData }) {
  return (
    <div className="month-strip">
      {ACADEMIC_MONTHS.map((m) => {
        const yr = m >= 7 ? academicYear : academicYear + 1
        const mData = monthsData?.find(md => md.month === m && md.year === yr)
        const meals = mData?.summary?.total_meals || 0
        const isActive = activeMonth === m
        const now = new Date()
        const isFuture = yr > now.getFullYear() || (yr === now.getFullYear() && m > now.getMonth() + 1)

        return (
          <button
            key={`${yr}-${m}`}
            className={`month-strip-btn ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''} ${meals > 0 ? 'has-data' : ''}`}
            onClick={() => onSelect(m)}
            disabled={isFuture}
            title={`${MONTH_NAMES[m - 1]} ${yr}${meals > 0 ? ` — ${meals} meals` : ''}`}
          >
            <span className="month-strip-name">{MONTH_SHORT[m - 1]}</span>
            {meals > 0 && <span className="month-strip-dot"></span>}
          </button>
        )
      })}
    </div>
  )
}

/* ── Calendar Component ────────────────────────────────────── */
export function AttendanceCalendar({
  yearlyData,
  activeMonth,
  academicYear,
  onMonthSelect,
  onPrevMonth,
  onNextMonth,
  loading,
}) {
  // Find the current month's data from the yearly response
  const calYear = activeMonth >= 7 ? academicYear : academicYear + 1
  const currentMonthData = useMemo(() => {
    if (!yearlyData?.months) return null
    return yearlyData.months.find(m => m.month === activeMonth && m.year === calYear)
  }, [yearlyData, activeMonth, calYear])

  const days = currentMonthData?.days || {}
  const summary = currentMonthData?.summary || null
  const cells = buildCalendarGrid(calYear, activeMonth)
  const todayStr = new Date().toISOString().slice(0, 10)

  // Navigation bounds: July of academicYear to current month (or June of academicYear+1)
  const now = new Date()
  const academicMonthIndex = ACADEMIC_MONTHS.indexOf(activeMonth)
  const canGoPrev = academicMonthIndex > 0
  const isCurrentOrFuture = (calYear > now.getFullYear()) || (calYear === now.getFullYear() && activeMonth >= now.getMonth() + 1)
  const isLastAcademicMonth = academicMonthIndex === ACADEMIC_MONTHS.length - 1
  const canGoNext = !isLastAcademicMonth && !isCurrentOrFuture

  return (
    <div className="attendance-calendar-wrapper">
      {/* Yearly Summary */}
      <YearlySummaryCard
        yearlySummary={yearlyData?.yearly_summary}
        label={yearlyData?.academic_year_label || `${academicYear}–${academicYear + 1}`}
      />

      {/* Month Strip */}
      <MonthStrip
        activeMonth={activeMonth}
        academicYear={academicYear}
        onSelect={onMonthSelect}
        monthsData={yearlyData?.months}
      />

      {/* Monthly Summary */}
      <MonthlySummaryCard
        summary={summary}
        monthName={MONTH_NAMES[activeMonth - 1]}
        year={calYear}
      />

      {/* Calendar Grid */}
      <div className="calendar-container card">
        <div className="calendar-nav">
          <button
            className="btn btn-ghost btn-sm calendar-nav-btn"
            onClick={onPrevMonth}
            disabled={!canGoPrev || loading}
            title="Previous month"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <h3 className="calendar-month-label">
            {MONTH_NAMES[activeMonth - 1]} {calYear}
          </h3>
          <button
            className="btn btn-ghost btn-sm calendar-nav-btn"
            onClick={onNextMonth}
            disabled={!canGoNext || loading}
            title="Next month"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        <div className="calendar-grid">
          {DAY_LABELS.map((d) => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}

          {cells.map((cell, idx) => {
            const meals = cell.date ? (days[cell.date] || []) : []
            const mealCount = meals.length
            const isToday = cell.date === todayStr
            const greenLevel = mealCount >= 3 ? 'green-3' : mealCount === 2 ? 'green-2' : mealCount === 1 ? 'green-1' : ''

            return (
              <div
                key={idx}
                className={[
                  'calendar-day-cell',
                  !cell.inMonth && 'outside-month',
                  isToday && 'today',
                  greenLevel,
                ].filter(Boolean).join(' ')}
              >
                <span className="day-number">{cell.day}</span>
                {cell.inMonth && mealCount > 0 && (
                  <>
                    <div className="meal-dots-row">
                      {['breakfast', 'lunch', 'dinner'].map((mt) => (
                        <span
                          key={mt}
                          className={`meal-dot ${meals.includes(mt) ? 'active' : 'inactive'}`}
                          style={meals.includes(mt) ? { background: getMealColor(mt) } : {}}
                          title={mt.charAt(0).toUpperCase() + mt.slice(1)}
                        >
                          {getMealLabel(mt)}
                        </span>
                      ))}
                    </div>
                    <div className="meal-count-badge">{mealCount}/3</div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="calendar-legend">
          <div className="legend-item"><span className="legend-swatch" style={{background: '#f59e0b'}}></span> B = Breakfast</div>
          <div className="legend-item"><span className="legend-swatch" style={{background: '#3b82f6'}}></span> L = Lunch</div>
          <div className="legend-item"><span className="legend-swatch" style={{background: '#8b5cf6'}}></span> D = Dinner</div>
          <div className="legend-item"><span className="legend-swatch green-1-swatch"></span> 1 meal</div>
          <div className="legend-item"><span className="legend-swatch green-2-swatch"></span> 2 meals</div>
          <div className="legend-item"><span className="legend-swatch green-3-swatch"></span> 3 meals</div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page Component (Student) ─────────────────────────── */
export default function AttendancePage() {
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear())
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth() + 1)
  const [yearlyData, setYearlyData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchYearlyAttendance()
  }, [academicYear])

  const fetchYearlyAttendance = async () => {
    try {
      setLoading(true)
      const result = await getMyYearlyAttendance(academicYear)
      setYearlyData(result)
    } catch (err) {
      toast.error('Failed to load attendance')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthSelect = (m) => {
    setActiveMonth(m)
  }

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
    setActiveMonth(7) // Reset to July
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
            My Attendance
          </h1>
          <p className="page-subtitle">Track your daily meal attendance across the academic year</p>
        </div>
      </div>

      <div className="page-body">
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

        {loading && !yearlyData ? (
          <div className="loading-indicator"><div className="spinner"></div>Loading attendance...</div>
        ) : (
          <AttendanceCalendar
            yearlyData={yearlyData}
            activeMonth={activeMonth}
            academicYear={academicYear}
            onMonthSelect={handleMonthSelect}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            loading={loading}
          />
        )}
      </div>
    </>
  )
}
