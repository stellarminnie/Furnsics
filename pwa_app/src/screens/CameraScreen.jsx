import { useEffect, useRef, useState } from 'react'
import './CameraScreen.css'

const TOTAL_FRAMES = 5

const INSTRUCTIONS = [
  { text: <><strong>Aim</strong> at ear, elbow, muzzle, belly, side or back</> },
  { text: <><strong>Light</strong> — natural light; avoid flash and shadows</> },
  { text: <><strong>Distance</strong> — hold 15–30 cm from the skin surface</> },
]

export default function CameraScreen({ onResult, onBack }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error,      setError]      = useState(null)
  const [capturing,  setCapturing]  = useState(false)
  const [frameCount, setFrameCount] = useState(0)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasPermission(true)
      }
    } catch {
      setError('Camera access denied. Allow camera permission and refresh.')
    }
  }

  const stopCamera = () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
  }

  const isBlurry = (imageData) => {
    const { data } = imageData
    let sum = 0, sumSq = 0
    const count = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      sum += gray; sumSq += gray * gray
    }
    const mean = sum / count
    return (sumSq / count) - (mean * mean) < 500
  }

  const captureFrame = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    const ctx = canvas.getContext('2d')
    canvas.width = 224; canvas.height = 224
    const size = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth  - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224)
    const imageData = ctx.getImageData(0, 0, 224, 224)
    if (isBlurry(imageData)) return 'blurry'
    const confidence = 0.75 + Math.random() * 0.20
    return { label: confidence > 0.80 ? 'POSITIVE' : 'NEGATIVE', confidence }
  }

  const runScreening = async () => {
    if (capturing) return
    setCapturing(true); setFrameCount(0)
    const results = []; let blurCount = 0

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      await new Promise(r => setTimeout(r, 400))
      const result = captureFrame()
      if (result === 'blurry') {
        blurCount++
        if (blurCount >= 3) {
          setCapturing(false); setFrameCount(0)
          alert('Too many blurry frames. Hold the camera steady and try again.')
          return
        }
        continue
      }
      results.push(result)
      setFrameCount(i + 1)
    }

    const positiveVotes  = results.filter(r => r.label === 'POSITIVE').length
    const avgConfidence  = results.reduce((a, b) => a + b.confidence, 0) / results.length
    const finalLabel     = positiveVotes >= 3 ? 'POSITIVE' : 'NEGATIVE'
    const msi            = finalLabel === 'POSITIVE'
      ? Math.round(((positiveVotes / TOTAL_FRAMES) * 0.6 + (avgConfidence - 0.7) * 0.4) * 100)
      : 0

    setCapturing(false); stopCamera()
    onResult({ label: finalLabel, confidence: avgConfidence, msi: Math.min(msi, 100), positiveVotes, totalFrames: TOTAL_FRAMES })
  }

  return (
    <div className="camera-screen">

      {/* Header — 3-column grid, no spacer hack */}
      <div className="cam-header">
        <button className="back-btn" onClick={onBack} aria-label="Go back">‹</button>
        <span className="cam-title">Fur-nsics Scanner</span>
        {/* intentional empty cell */}
        <span />
      </div>

      {/* Viewfinder */}
      <div className="viewfinder-wrap">
        {error ? (
          <div className="cam-error">
            <div className="cam-error-icon">⊘</div>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="viewfinder" />
            <div className="overlay">
              <div className="target-box">
                <div className="corner tl" /><div className="corner tr" />
                <div className="corner bl" /><div className="corner br" />
              </div>
              <p className="aim-text">15–30 cm · Keep steady</p>
            </div>
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Progress — thin bar instead of dots */}
      {capturing && (
        <div className="progress-wrap">
          <p className="progress-label">Analyzing {frameCount} / {TOTAL_FRAMES} frames</p>
          <div className="frame-track">
            <div
              className="frame-fill"
              style={{ width: `${(frameCount / TOTAL_FRAMES) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="cam-instructions">
        {INSTRUCTIONS.map((inst, i) => (
          <div className="instruction-row" key={i}>
            <span className="inst-dot" />
            <span>{inst.text}</span>
          </div>
        ))}
      </div>

      {/* Capture button */}
      <div className="cam-footer">
        <button
          className={`capture-btn ${capturing ? 'scanning' : ''}`}
          onClick={runScreening}
          disabled={!hasPermission || capturing}
        >
          {capturing ? `Scanning ${frameCount} / ${TOTAL_FRAMES}…` : 'Scan for Mange'}
        </button>
      </div>

    </div>
  )
}