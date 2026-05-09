import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { VJTI_LOGO_BASE64 } from '../assets/vjti-logo'

// ── Configuration ─────────────────────────────────────────────
const HEADER_TEXT = 'e-Receipt for VJTI Mess Management System'
const INSTITUTION_NAME = 'VJTI MESS'
const INSTITUTION_ADDRESS = 'MATUNGA, MUMBAI-400019'
const FOOTER_LINE1 = 'This is a computer-generated document from the VJTI Mess Management System.'
const FOOTER_LINE2 = 'For queries, please contact the mess administration office.'

const COLORS = {
  primary: [30, 64, 175],     // deep blue
  headerBg: [235, 240, 255],  // light blue bg
  rowAlt: [248, 250, 255],    // very light blue
  border: [200, 210, 230],    // subtle border
  text: [30, 30, 30],         // near-black
  muted: [120, 120, 130],     // grey text
  success: [16, 185, 129],    // green
  danger: [220, 38, 38],      // red
  warning: [245, 158, 11],    // amber
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(val) {
  if (val === null || val === undefined || val === '') return '--'
  const n = Number(val)
  if (!Number.isFinite(n)) return '--'
  return `Rs.${Math.round(n).toLocaleString('en-IN')}`
}

// Opens PDF in a new browser tab for viewing/saving
function downloadPDF(doc, filename) {
  // Get PDF as base64 data URI and open in new tab
  const pdfDataUri = doc.output('dataurlstring')
  const newWindow = window.open()
  if (newWindow) {
    newWindow.document.write(
      `<html><head><title>${filename}</title></head>` +
      `<body style="margin:0;overflow:hidden;">` +
      `<embed width="100%" height="100%" src="${pdfDataUri}" type="application/pdf" />` +
      `</body></html>`
    )
    newWindow.document.close()
  } else {
    // Fallback: direct data URI navigation
    window.open(pdfDataUri, '_blank')
  }
}

// ── Core: Create PDF with header/logo/footer ─────────────────
function createBasePDF(title, dateLabel) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // ── Header line
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 3, 'F')

  // ── Header text
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.primary)
  doc.text(HEADER_TEXT, 15, 12)

  // ── Logo
  let yPos = 20
  try {
    doc.addImage(VJTI_LOGO_BASE64, 'JPEG', (pageWidth - 28) / 2, yPos, 28, 28)
    yPos += 32
  } catch (e) {
    console.warn('Failed to add logo:', e)
    yPos += 5
  }

  // ── Institution name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COLORS.text)
  doc.text(INSTITUTION_NAME, pageWidth / 2, yPos, { align: 'center' })
  yPos += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text(INSTITUTION_ADDRESS, pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  doc.setFontSize(9)
  doc.text(`Date: ${dateLabel || formatDate()}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  // ── Divider
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, pageWidth - 15, yPos)
  yPos += 6

  // ── Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text(title, pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  return { doc, yPos, pageWidth, pageHeight }
}

function addKeyValueRows(doc, startY, rows, pageWidth) {
  let y = startY
  const leftMargin = 20
  const valueX = pageWidth / 2 + 5

  rows.forEach((row, i) => {
    // Alternate row background
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.rowAlt)
      doc.rect(15, y - 4, pageWidth - 30, 8, 'F')
    }

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLORS.text)
    doc.text(`${row.label} :`, leftMargin, y)

    // Value
    doc.setFont('helvetica', 'normal')
    const valColor =
      row.color === 'success' ? COLORS.success :
      row.color === 'danger' ? COLORS.danger :
      row.color === 'warning' ? COLORS.warning :
      COLORS.text
    doc.setTextColor(...valColor)
    doc.text(String(row.value), valueX, y)

    // Bottom border
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.15)
    doc.line(15, y + 3.5, pageWidth - 15, y + 3.5)

    y += 8
  })

  return y
}

function addFooter(doc, pageWidth, pageHeight) {
  const footerY = pageHeight - 22

  // Divider
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(15, footerY, pageWidth - 15, footerY)

  // Footer text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLORS.muted)
  doc.text(FOOTER_LINE1, pageWidth / 2, footerY + 5, { align: 'center' })
  doc.text(FOOTER_LINE2, pageWidth / 2, footerY + 9, { align: 'center' })

  // Bottom bar
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, pageHeight - 3, pageWidth, 3, 'F')
}

// ── Daily Report PDF ─────────────────────────────────────────
export function generateDailyReportPDF(report, date) {
  const { doc, yPos, pageWidth, pageHeight } = createBasePDF(
    'Daily Meal Report',
    formatDate(date)
  )

  let y = yPos

  // Summary key-value rows
  y = addKeyValueRows(doc, y, [
    { label: 'Report Date', value: formatDate(date) },
    { label: 'Students Scanned', value: String(report.by_student?.length || 0) },
    { label: 'Total Meals Served', value: String(report.total_entries || 0) },
    { label: 'Total Amount Deducted', value: formatMoney(report.grand_total), color: 'success' },
    { label: 'Average per Student', value: report.by_student?.length ? formatMoney(Math.round((Number(report.grand_total) || 0) / report.by_student.length)) : '₹0' },
  ], pageWidth)

  y += 6

  // Student-wise breakdown table
  if (report.by_student && report.by_student.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('Student-wise Breakdown', 15, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['#', 'Student Name', 'Roll No', 'Scans', 'Total Amount']],
      body: report.by_student.map((row, i) => [
        String(i + 1),
        row.student_name,
        row.roll_no,
        String(row.scan_count),
        formatMoney(row.total_amount),
      ]),
      foot: [['', 'Total', `${report.by_student.length} Students`, String(report.total_entries), formatMoney(report.grand_total)]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: 15, right: 15 },
    })
  }

  addFooter(doc, pageWidth, pageHeight)

  downloadPDF(doc, `VJTI_Mess_Daily_Report_${date}.pdf`)
}

// ── Monthly Report PDF ───────────────────────────────────────
export function generateMonthlyReportPDF(report, monthNum, year) {
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const monthName = MONTH_NAMES[monthNum - 1]
  const totalMeals = report.students?.reduce((a, s) => a + (s.total_meals || 0), 0) || 0
  const totalAmount = report.students?.reduce((a, s) => a + (Number(s.total_amount) || 0), 0) || 0

  const { doc, yPos, pageWidth, pageHeight } = createBasePDF(
    'Monthly Meal Report',
    formatDate()
  )

  let y = yPos

  // Summary
  y = addKeyValueRows(doc, y, [
    { label: 'Report Month', value: `${monthName} ${year}` },
    { label: 'Total Students', value: String(report.students?.length || 0) },
    { label: 'Students with Meals', value: String(report.students?.filter(s => s.total_meals).length || 0) },
    { label: 'Total Meals Served', value: String(totalMeals) },
    { label: 'Total Amount Collected', value: formatMoney(totalAmount), color: 'success' },
  ], pageWidth)

  y += 6

  // Student table
  if (report.students && report.students.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text(`Student-wise Summary — ${monthName} ${year}`, 15, y)
    y += 4

    const sorted = [...report.students].sort((a, b) => (b.total_meals || 0) - (a.total_meals || 0))

    autoTable(doc, {
      startY: y,
      head: [['#', 'Student Name', 'Roll No', 'Total Meals', 'Avg/Day', 'Total Amount']],
      body: sorted.map((s, i) => [
        String(i + 1),
        s.name,
        s.roll_no,
        String(s.total_meals || 0),
        s.total_meals ? `${(s.total_meals / 30).toFixed(1)}` : '0',
        formatMoney(s.total_amount),
      ]),
      foot: [['', 'Total', `${sorted.length} Students`, String(totalMeals), '—', formatMoney(totalAmount)]],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: 15, right: 15 },
    })
  }

  addFooter(doc, pageWidth, pageHeight)

  downloadPDF(doc, `VJTI_Mess_Monthly_Report_${monthName}_${year}.pdf`)
}

// ── Billing Report PDF ───────────────────────────────────────
export function generateBillingReportPDF(report) {
  const exhausted = report.filter(r => Number(r.balance) <= 0 && r.is_active).length
  const total = report.length

  const { doc, yPos, pageWidth, pageHeight } = createBasePDF(
    'Billing Report',
    formatDate()
  )

  let y = yPos

  // Summary
  y = addKeyValueRows(doc, y, [
    { label: 'Report Type', value: 'Student Balance & Plan Status' },
    { label: 'Generated On', value: formatDate() },
    { label: 'Total Students', value: String(total) },
    { label: 'Exhausted Balance', value: String(exhausted), color: exhausted > 0 ? 'danger' : 'success' },
  ], pageWidth)

  y += 6

  // Student table
  if (report.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('Student Billing Details', 15, y)
    y += 4

    const sorted = [...report].sort((a, b) => (Number(a.balance) || Infinity) - (Number(b.balance) || Infinity))

    autoTable(doc, {
      startY: y,
      head: [['#', 'Student', 'Roll No', 'Balance', 'Installment', 'Plan Expiry', 'Status']],
      body: sorted.map((r, i) => {
        const bal = Number(r.balance)
        const status = !r.is_active ? 'No Plan' : bal <= 0 ? 'Exhausted' : bal < 500 ? 'Low' : 'Healthy'
        return [
          String(i + 1),
          r.name,
          r.roll_no,
          formatMoney(r.balance),
          formatMoney(r.installment_amount),
          r.plan_end || '—',
          status,
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        // Color the Balance column
        if (data.section === 'body' && data.column.index === 3) {
          const bal = Number(sorted[data.row.index]?.balance)
          if (bal <= 0) data.cell.styles.textColor = COLORS.danger
          else if (bal < 500) data.cell.styles.textColor = COLORS.warning
          else data.cell.styles.textColor = COLORS.success
          data.cell.styles.fontStyle = 'bold'
        }
        // Color the Status column
        if (data.section === 'body' && data.column.index === 6) {
          const status = data.cell.raw
          if (status === 'Exhausted') data.cell.styles.textColor = COLORS.danger
          else if (status === 'Low') data.cell.styles.textColor = COLORS.warning
          else if (status === 'Healthy') data.cell.styles.textColor = COLORS.success
          else data.cell.styles.textColor = COLORS.muted
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  addFooter(doc, pageWidth, pageHeight)

  downloadPDF(doc, `VJTI_Mess_Billing_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Student Receipt PDF ──────────────────────────────────────
export function generateStudentReceiptPDF(student, plan, entries, transactions) {
  const { doc, yPos, pageWidth, pageHeight } = createBasePDF(
    'Student Mess Receipt',
    formatDate()
  )

  let y = yPos

  // Student details in SBI Collect style
  const rows = [
    { label: 'Name of the Student', value: student.name },
    { label: 'Registration Number', value: student.roll_no },
    { label: 'Course', value: student.course || '—' },
    { label: 'Branch', value: student.branch || '—' },
    { label: 'Year', value: String(student.year || '—') },
  ]

  if (plan) {
    rows.push(
      { label: 'Plan Status', value: plan.is_active ? 'Active' : 'Inactive', color: plan.is_active ? 'success' : 'danger' },
      { label: 'Installment Amount', value: formatMoney(plan.installment_amount) },
      { label: 'Current Balance', value: formatMoney(plan.balance), color: Number(plan.balance) <= 0 ? 'danger' : Number(plan.balance) < 500 ? 'warning' : 'success' },
      { label: 'Plan Start', value: plan.plan_start || '—' },
      { label: 'Plan End', value: plan.plan_end || '—' },
      { label: 'Amount Consumed', value: formatMoney((Number(plan.installment_amount) || 0) - (Number(plan.balance) || 0)) },
      { label: 'Total Meals (Last 30)', value: String(entries?.length || 0) },
    )
  } else {
    rows.push({ label: 'Plan Status', value: 'No Active Plan', color: 'danger' })
  }

  y = addKeyValueRows(doc, y, rows, pageWidth)

  // Recent meal history table
  if (entries && entries.length > 0) {
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('Recent Meal History', 15, y)
    y += 4

    const recentEntries = entries.slice(0, 30) // last 30

    autoTable(doc, {
      startY: y,
      head: [['#', 'Meal Type', 'Date & Time', 'Amount Deducted']],
      body: recentEntries.map((e, i) => [
        String(i + 1),
        e.meal_type.charAt(0).toUpperCase() + e.meal_type.slice(1),
        new Date(e.entry_time).toLocaleString('en-IN'),
        `-${formatMoney(e.amount_deducted)}`,
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: 15, right: 15 },
    })
  }

  addFooter(doc, pageWidth, pageHeight)

  downloadPDF(doc, `VJTI_Mess_Receipt_${student.roll_no}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Student List PDF ─────────────────────────────────────────
export function generateStudentListPDF(students) {
  const active = students.filter(s => s.has_active_plan).length
  const lowBal = students.filter(s => s.balance != null && s.balance < 500 && s.balance > 0).length
  const exhausted = students.filter(s => s.balance != null && s.balance <= 0).length

  const { doc, yPos, pageWidth, pageHeight } = createBasePDF(
    'Student Directory',
    formatDate()
  )

  let y = yPos

  // Summary
  y = addKeyValueRows(doc, y, [
    { label: 'Report Type', value: 'All Registered Students' },
    { label: 'Generated On', value: formatDate() },
    { label: 'Total Students', value: String(students.length) },
    { label: 'Active Plans', value: String(active), color: 'success' },
    { label: 'Low Balance', value: String(lowBal), color: lowBal > 0 ? 'warning' : 'success' },
    { label: 'Exhausted', value: String(exhausted), color: exhausted > 0 ? 'danger' : 'success' },
  ], pageWidth)

  y += 6

  // Student table
  if (students.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('Student Details', 15, y)
    y += 4

    const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name))

    autoTable(doc, {
      startY: y,
      head: [['#', 'Name', 'Roll No', 'Course', 'Branch', 'Year', 'Balance', 'Plan Status']],
      body: sorted.map((s, i) => {
        const bal = Number(s.balance) || 0
        const status = !s.has_active_plan ? 'No Plan'
          : (s.plan_end && new Date(s.plan_end) < new Date()) ? 'Expired'
          : bal <= 0 ? 'Exhausted'
          : bal < 500 ? 'Low'
          : 'Active'
        return [
          String(i + 1),
          s.name,
          s.roll_no,
          s.course || '--',
          s.branch || '--',
          String(s.year || '--'),
          formatMoney(s.balance),
          status,
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        // Color the Balance column
        if (data.section === 'body' && data.column.index === 6) {
          const bal = Number(sorted[data.row.index]?.balance) || 0
          if (bal <= 0) data.cell.styles.textColor = COLORS.danger
          else if (bal < 500) data.cell.styles.textColor = COLORS.warning
          else data.cell.styles.textColor = COLORS.success
          data.cell.styles.fontStyle = 'bold'
        }
        // Color the Status column
        if (data.section === 'body' && data.column.index === 7) {
          const status = data.cell.raw
          if (status === 'Exhausted' || status === 'Expired') data.cell.styles.textColor = COLORS.danger
          else if (status === 'Low') data.cell.styles.textColor = COLORS.warning
          else if (status === 'Active') data.cell.styles.textColor = COLORS.success
          else data.cell.styles.textColor = COLORS.muted
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  addFooter(doc, pageWidth, pageHeight)

  downloadPDF(doc, `VJTI_Mess_Student_Directory_${new Date().toISOString().slice(0, 10)}.pdf`)
}
