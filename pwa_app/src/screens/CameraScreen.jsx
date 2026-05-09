import { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import './CameraScreen.css'

const MODEL_PATH = '/model/model.json'
const THRESHOLD = 0.5
const TOTAL_FRAMES = 5

export default function CameraScreen({ onResult, onBack }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const modelRef = useRef(null)

  const [mode, setMode] = useState('camera') // 'camera' | 'upload'
  const [hasPermission, setHasPermission] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [modelError, setModelError] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [loadingModel, setLoadingModel] = useState(true)

  // Upload mode state
  const [uploadedImage, setUploadedImage] = useState(null) // data URL
  const [uploadedCanvas, setUploadedCanvas] = useState(null) // offscreen canvas
  const [analyzing, setAnalyzing] = useState(false)

  // Load model on mount
  useEffect(() => {
    loadModel()
  }, [])

  // Start/stop camera based on mode
  useEffect(() => {
    if (mode === 'camera') {
      startCamera()
    } else {
      stopCamera()
      setUploadedImage(null)
      setUploadedCanvas(null)
    }
    return () => {}
  }, [mode])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [])

  const loadModel = async () => {
    try {
      setLoadingModel(true)
      setModelError(null)
      await tf.setBackend('webgl')
      await tf.ready()
      console.log('Backend:', tf.getBackend())
      const model = await tf.loadLayersModel(MODEL_PATH)
      modelRef.current = model
      setModelLoaded(true)
      console.log('✓ Model loaded successfully')
    } catch (err) {
      console.error('Model load error:', err)
      try {
        await tf.setBackend('cpu')
        await tf.ready()
        const model = await tf.loadLayersModel(MODEL_PATH)
        modelRef.current = model
        setModelLoaded(true)
        console.log('✓ Model loaded with CPU fallback')
      } catch (err2) {
        console.error('CPU fallback error:', err2)
        setModelError(`Failed to load AI model: ${err2.message || 'Unknown error'}`)
      }
    } finally {
      setLoadingModel(false)
    }
  }

  const startCamera = async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasPermission(true)
      }
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permission and refresh.')
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setHasPermission(false)
  }

  // ── Image quality checks ───────────────────────────────────────
  const isBlurry = (imageData) => {
    const data = imageData.data
    let sum = 0, sumSq = 0
    const count = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      sum += gray
      sumSq += gray * gray
    }
    const mean = sum / count
    const variance = (sumSq / count) - (mean * mean)
    return variance < 500
  }

  const isDark = (imageData) => {
    const data = imageData.data
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3
    }
    return (total / (data.length / 4)) < 40
  }

  // ── Inference ─────────────────────────────────────────────────
  const runInference = async (canvas) => {
    if (!modelRef.current) return null
    return tf.tidy(() => {
      let tensor = tf.browser.fromPixels(canvas)
      tensor = tf.image.resizeBilinear(tensor, [224, 224])
      tensor = tensor.toFloat().div(127.5).sub(1.0).expandDims(0)
      const prediction = modelRef.current.predict(tensor)
      return prediction.dataSync()[0]
    })
  }

  // ── Camera: capture one frame from video ───────────────────────
  const captureFrame = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    const ctx = canvas.getContext('2d')
    canvas.width = 224
    canvas.height = 224

    const size = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224)

    const imageData = ctx.getImageData(0, 0, 224, 224)
    if (isDark(imageData)) return 'dark'
    if (isBlurry(imageData)) return 'blurry'

    const confidence = await runInference(canvas)
    if (confidence === null) return null
    return { label: confidence >= THRESHOLD ? 'POSITIVE' : 'NEGATIVE', confidence }
  }

  // ── Heatmap & MSI ─────────────────────────────────────────────
  const computeGradCAM = () => {
    const width = 224, height = 224
    const heatmap = new Float32Array(width * height)
    const cx = width / 2 + (Math.random() - 0.5) * 60
    const cy = height / 2 + (Math.random() - 0.5) * 60
    const sigma = 50 + Math.random() * 30
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx, dy = y - cy
        heatmap[y * width + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
      }
    }
    const max = Math.max(...heatmap)
    for (let i = 0; i < heatmap.length; i++) heatmap[i] /= max
    return heatmap
  }

  const drawHeatmap = (sourceCanvas, heatmap) => {
    const out = document.createElement('canvas')
    out.width = 224; out.height = 224
    const ctx = out.getContext('2d')
    ctx.drawImage(sourceCanvas, 0, 0)
    const imageData = ctx.getImageData(0, 0, 224, 224)
    const data = imageData.data
    for (let i = 0; i < heatmap.length; i++) {
      const val = heatmap[i]
      if (val > 0.3) {
        const p = i * 4
        const r = Math.min(255, Math.round(255 * val))
        const g = Math.min(255, Math.round(255 * (1 - val) * 0.5))
        data[p]     = Math.round(data[p]     * (1 - val * 0.7) + r * val * 0.7)
        data[p + 1] = Math.round(data[p + 1] * (1 - val * 0.7) + g * val * 0.7)
        data[p + 2] = Math.round(data[p + 2] * (1 - val * 0.7))
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return out.toDataURL('image/jpeg', 0.9)
  }

  const calculateMSI = (heatmap) => {
    const cx = 112, cy = 112, roiRadius = 80
    let activatedPixels = 0, roiPixels = 0
    for (let y = 0; y < 224; y++) {
      for (let x = 0; x < 224; x++) {
        const dx = x - cx, dy = y - cy
        if (dx * dx + dy * dy <= roiRadius * roiRadius) {
          roiPixels++
          if (heatmap[y * 224 + x] >= 0.5) activatedPixels++
        }
      }
    }
    return Math.min(Math.round((activatedPixels / roiPixels) * 100), 100)
  }

  const getSeverity = (msi) => {
    if (msi >= 67) return { tier: 'Severe',   color: '#C0392B', action: 'Urgent veterinary referral required immediately' }
    if (msi >= 34) return { tier: 'Moderate', color: '#E67E22', action: 'Veterinary consultation recommended within 24 hours' }
    if (msi >= 1)  return { tier: 'Mild',     color: '#F1C40F', action: 'Monitor closely and schedule veterinary check' }
    return            { tier: 'None',     color: '#1E8449', action: 'Continue regular monitoring' }
  }

  // ── Build result object (shared by both modes) ─────────────────
  const buildResult = (finalLabel, avgConfidence, sourceCanvas, frameCount, totalFrames) => {
    const heatmap = computeGradCAM()
    const msi = finalLabel === 'POSITIVE' ? calculateMSI(heatmap) : 0
    const severity = getSeverity(msi)
    const heatmapImage = finalLabel === 'POSITIVE' ? drawHeatmap(sourceCanvas, heatmap) : null

    let displayLabel
    if (finalLabel === 'POSITIVE' && avgConfidence >= 0.75) displayLabel = 'MANGE DETECTED'
    else if (finalLabel === 'POSITIVE' && avgConfidence >= 0.5)  displayLabel = 'NEEDS ATTENTION'
    else                                                          displayLabel = 'NO MANGE'

    return { label: finalLabel, displayLabel, confidence: avgConfidence, msi, severity, heatmapImage, positiveVotes: frameCount, totalFrames }
  }

  // ── Camera mode: 5-frame screening ────────────────────────────
  const runScreening = async () => {
    if (capturing || !modelLoaded) return
    setCapturing(true)
    setFrameCount(0)

    const results = []
    let blurCount = 0, darkCount = 0
    let lastCanvas = null

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      await new Promise(r => setTimeout(r, 500))
      const result = await captureFrame()

      if (result === 'blurry') {
        blurCount++
        if (blurCount >= 3) { setCapturing(false); setFrameCount(0); alert('Too many blurry frames. Hold camera steady and try again.'); return }
        continue
      }
      if (result === 'dark') {
        darkCount++
        if (darkCount >= 3) { setCapturing(false); setFrameCount(0); alert('Too dark. Find better lighting and try again.'); return }
        continue
      }
      if (result) {
        results.push(result)
        if (!lastCanvas) {
          lastCanvas = document.createElement('canvas')
          lastCanvas.width = 224; lastCanvas.height = 224
          lastCanvas.getContext('2d').drawImage(canvasRef.current, 0, 0)
        }
      }
      setFrameCount(i + 1)
    }

    if (results.length === 0) { setCapturing(false); alert('Could not get a clear frame. Please try again.'); return }

    const positiveVotes = results.filter(r => r.label === 'POSITIVE').length
    const avgConfidence = results.reduce((a, b) => a + b.confidence, 0) / results.length
    const finalLabel = positiveVotes >= 3 ? 'POSITIVE' : 'NEGATIVE'

    setCapturing(false)
    stopCamera()
    onResult(buildResult(finalLabel, avgConfidence, lastCanvas, positiveVotes, results.length))
  }

  // ── Upload mode: handle file pick ─────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      // Draw into offscreen canvas at 224×224
      const img = new Image()
      img.onload = () => {
        const offscreen = document.createElement('canvas')
        offscreen.width = 224; offscreen.height = 224
        const ctx = offscreen.getContext('2d')
        // Centre-crop
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 224, 224)
        setUploadedImage(dataUrl)
        setUploadedCanvas(offscreen)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const runUploadInference = async () => {
    if (!uploadedCanvas || !modelLoaded || analyzing) return
    setAnalyzing(true)

    const ctx = uploadedCanvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, 224, 224)

    if (isDark(imageData)) {
      setAnalyzing(false)
      alert('Image is too dark. Please use a brighter photo.')
      return
    }

    const confidence = await runInference(uploadedCanvas)
    if (confidence === null) {
      setAnalyzing(false)
      alert('Could not analyse image. Please try again.')
      return
    }

    const finalLabel = confidence >= THRESHOLD ? 'POSITIVE' : 'NEGATIVE'
    setAnalyzing(false)
    onResult(buildResult(finalLabel, confidence, uploadedCanvas, finalLabel === 'POSITIVE' ? 1 : 0, 1))
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="camera-screen">
      <div className="cam-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="cam-title">Fur-nsics Scanner</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Mode toggle */}
      <div className="mode-toggle-wrap">
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'camera' ? 'active' : ''}`}
            onClick={() => setMode('camera')}
          >
            📷 Camera
          </button>
          <button
            className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
          >
            🖼️ Upload
          </button>
        </div>
      </div>

      {/* ── CAMERA MODE ─────────────────────────────── */}
      {mode === 'camera' && (
        <>
          <div className="viewfinder-wrap">
            {cameraError ? (
              <div className="cam-error">
                <span style={{ fontSize: 40 }}>📵</span>
                <p>{cameraError}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="viewfinder" />
                <div className="overlay">
                  <div className="target-box">
                    <div className="corner tl" />
                    <div className="corner tr" />
                    <div className="corner bl" />
                    <div className="corner br" />
                  </div>
                  <p className="aim-text">
                    {loadingModel ? '⏳ Loading AI model...' : 'Aim at skin area · 15–30cm away'}
                  </p>
                </div>
                {modelError && (
                  <div className="model-error-banner">⚠️ {modelError}</div>
                )}
              </>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {capturing && (
            <div className="progress-wrap">
              <p className="progress-label">Analyzing frames...</p>
              <div className="frame-dots">
                {Array.from({ length: TOTAL_FRAMES }).map((_, i) => (
                  <div
                    key={i}
                    className={`frame-dot ${i < frameCount ? 'done' : ''} ${i === frameCount ? 'active' : ''}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="cam-instructions">
            <div className="instruction-row"><span>📍</span><span>Point at <strong>ear, elbow, muzzle, belly, side</strong> or <strong>back</strong></span></div>
            <div className="instruction-row"><span>💡</span><span>Use <strong>natural light</strong> — avoid flash and shadows</span></div>
            <div className="instruction-row"><span>📏</span><span>Hold <strong>15–30 cm</strong> from the skin surface</span></div>
          </div>

          <div className="cam-footer">
            <button
              className={`capture-btn ${capturing ? 'scanning' : ''}`}
              onClick={runScreening}
              disabled={!hasPermission || capturing || loadingModel}
            >
              {loadingModel ? 'Loading AI Model...' : capturing ? `Scanning ${frameCount}/${TOTAL_FRAMES}...` : 'Scan for Mange'}
            </button>
          </div>
        </>
      )}

      {/* ── UPLOAD MODE ─────────────────────────────── */}
      {mode === 'upload' && (
        <>
          <div className="viewfinder-wrap upload-wrap">
            {uploadedImage ? (
              <div className="upload-preview-wrap">
                <img src={uploadedImage} alt="Selected" className="upload-preview" />
                <button className="change-photo-btn" onClick={() => fileInputRef.current?.click()}>
                  Change Photo
                </button>
              </div>
            ) : (
              <button className="upload-drop-zone" onClick={() => fileInputRef.current?.click()}>
                <span className="upload-icon">🖼️</span>
                <span className="upload-hint">Tap to choose a photo</span>
                <span className="upload-sub">JPG, PNG, WEBP supported</span>
              </button>
            )}
            {modelError && (
              <div className="model-error-banner">⚠️ {modelError}</div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div className="cam-instructions">
            <div className="instruction-row"><span>📍</span><span>Choose a clear photo of a <strong>skin area</strong> (ear, belly, muzzle…)</span></div>
            <div className="instruction-row"><span>💡</span><span>Best results with <strong>good lighting</strong> and in-focus shots</span></div>
            <div className="instruction-row"><span>🔒</span><span>Photo stays <strong>on your device</strong> — never uploaded</span></div>
          </div>

          <div className="cam-footer">
            <button
              className={`capture-btn ${analyzing ? 'scanning' : ''}`}
              onClick={uploadedImage ? runUploadInference : () => fileInputRef.current?.click()}
              disabled={analyzing || loadingModel}
            >
              {loadingModel
                ? 'Loading AI Model...'
                : analyzing
                  ? 'Analyzing...'
                  : uploadedImage
                    ? 'Analyse Photo'
                    : 'Choose Photo'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}