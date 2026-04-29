import { useState, useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSun,
  faCloudSun,
  faMoon,
  faTriangleExclamation,
  faQrcode,
  faPlay,
  faStop,
  faLightbulb,
  faCircleCheck,
  faCircleXmark,
  faSpinner,
  faKeyboard,
} from '@fortawesome/free-solid-svg-icons'
import { scanMeal } from '../api'
import { useAuth } from '../context/AuthContext'
import { formatMoney, toMoneyInt } from '../utils/money'

const MEAL_ICONS = { breakfast: faCloudSun, lunch: faSun, dinner: faMoon }

export default function ScanPage() {
  useAuth()
  const [manualId, setManualId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const rafRef     = useRef(null)
  const cooldownRef = useRef(false)

  // ── Camera start/stop ────────────────────────────────────────
  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      setCameraError('Camera access denied. Please allow camera permission and try again.')
    }
  }

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── jsQR scan loop ────────────────────────────────────────────
  useEffect(() => {
    if (!cameraActive) return

    const tick = () => {
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      // Draw mirrored frame for display, but scan un-mirrored
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      if (!cooldownRef.current) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })
        if (code && code.data.trim()) {
          cooldownRef.current = true
          doScan(code.data.trim())
          setTimeout(() => { cooldownRef.current = false }, 3000)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [cameraActive])

  // ── API call ─────────────────────────────────────────────────
  const doScan = async (identifier) => {
    setLoading(true)
    try {
      const data = await scanMeal(identifier)
      setResult({ ...data, ok: true })
      if (data.warning) {
        toast(data.warning, { icon: <FontAwesomeIcon icon={faTriangleExclamation} />, style: { background: '#78350f', color: '#fef3c7' } })
      } else {
        toast.success(`${data.meal_type} recorded for ${data.student_name}`)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Scan failed — check student ID'
      setResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleManual = async (e) => {
    e.preventDefault()
    const val = manualId.trim()
    if (!val) { toast.error('Enter a roll number or student ID'); return }
    await doScan(val)
    setManualId('')
  }

  const remainingBalance = result ? toMoneyInt(result.balance_remaining) : null

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><FontAwesomeIcon icon={faQrcode} style={{ marginRight: 8 }} />QR Scan</h1>
        <p className="page-subtitle">Point camera at student QR code — meal recorded automatically</p>
      </div>

      <div className="page-body">
        {/* Hidden canvas used for jsQR frame analysis */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="scan-layout">
          {/* ── Left: Camera ── */}
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="scan-viewport">
                {/* Mirrored video display */}
                <video
                  ref={videoRef}
                  playsInline muted
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    display: cameraActive ? 'block' : 'none',
                    transform: 'scaleX(-1)',
                  }}
                />

                {!cameraActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, background: '#0a0f1a' }}>
                    <div style={{ fontSize: 48 }}><FontAwesomeIcon icon={faQrcode} /></div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Camera not started</p>
                    {cameraError && <p style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>{cameraError}</p>}
                  </div>
                )}

                {cameraActive && (
                  <div className="scan-overlay">
                    <div className="scan-frame">
                      <div className="scan-line" />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderTop: '1px solid var(--border)' }}>
                {!cameraActive
                  ? <button className="btn btn-primary btn-full" onClick={startCamera}><FontAwesomeIcon icon={faPlay} style={{ marginRight: 8 }} />Start Camera</button>
                  : <button className="btn btn-ghost btn-full" onClick={stopCamera}><FontAwesomeIcon icon={faStop} style={{ marginRight: 8 }} />Stop Camera</button>
                }
              </div>
            </div>

            <div className="alert alert-info mt-4" style={{ fontSize: 13 }}>
              <FontAwesomeIcon icon={faLightbulb} style={{ marginRight: 8 }} />Works in any modern browser. Hold the QR code steady in the frame.
              If scanning is slow, use Manual Entry instead.
            </div>
          </div>

          {/* ── Right: Result + Manual ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Scan Result */}
            {result ? (
              <div className={`scan-result ${result.ok ? 'success' : 'error'}`}>
                {result.ok ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>
                      <FontAwesomeIcon icon={MEAL_ICONS[result.meal_type] || faCircleCheck} />
                    </div>
                    <div className="scan-result-name" style={{ color: 'var(--success)' }}>
                      {result.student_name}
                    </div>
                    <div className="scan-result-meal">
                      {result.meal_type?.charAt(0).toUpperCase() + result.meal_type?.slice(1)} recorded
                    </div>
                    <div className="scan-result-row">
                      <span className="label">Amount Deducted</span>
                      <span className="value text-danger">- {formatMoney(result.amount_deducted, '₹0')}</span>
                    </div>
                    <div className="scan-result-row">
                      <span className="label">Remaining Balance</span>
                      <span className={`value ${remainingBalance > 500 ? 'text-success' : 'text-warning'}`}>
                        {remainingBalance != null ? formatMoney(remainingBalance) : 'No plan'}
                      </span>
                    </div>
                    {result.warning && (
                      <div className="warning-banner"><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 8 }} />{result.warning}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 4 }}><FontAwesomeIcon icon={faCircleXmark} /></div>
                    <div className="scan-result-name" style={{ color: 'var(--danger)' }}>Scan Failed</div>
                    <div className="scan-result-meal">{result.message}</div>
                  </>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}><FontAwesomeIcon icon={faSpinner} spin /></div>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Waiting for scan...</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Result will appear here</p>
              </div>
            )}

            {/* Manual Entry */}
            <div className="card">
              <div className="card-title"><FontAwesomeIcon icon={faKeyboard} style={{ marginRight: 8 }} />Manual Entry</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Enter the student's Roll Number or DB ID directly.
              </p>
              <form onSubmit={handleManual}>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <input
                    id="manual-student-id"
                    className="form-input"
                    type="text"
                    placeholder="Roll No or Student ID (e.g. 241080012)"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-success btn-full" disabled={loading}>
                  {loading
                    ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Processing...</>
                    : <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />Record Meal</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
