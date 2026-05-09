import { useEffect, useState } from 'react'
import './SplashScreen.css'

export default function SplashScreen({ onStart }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100)
    return () => clearTimeout(t)
  }, [])

  const features = [
    { label: 'AI Detection',     desc: 'MobileNetV3 on-device' },
    { label: 'Grad-CAM Heatmaps', desc: 'Visual evidence per result' },
    { label: 'Works Offline',    desc: 'No internet required' },
  ]

  return (
    <div className={`splash ${ready ? 'ready' : ''}`}>

      <div className="splash-top">
        <div className="splash-badge">Edge-AI · Offline-First</div>
      </div>

      <div className="splash-hero">
        <div className="logo-mark">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="23" rx="5" ry="4.5" fill="white"/>
            <ellipse cx="11" cy="17" rx="3" ry="3.5" fill="white"/>
            <ellipse cx="25" cy="17" rx="3" ry="3.5" fill="white"/>
            <ellipse cx="15" cy="13" rx="2.5" ry="3" fill="white"/>
            <ellipse cx="21" cy="13" rx="2.5" ry="3" fill="white"/>
            <circle cx="24" cy="11" r="5.5" stroke="white" strokeWidth="1.8" fill="none"/>
            <line x1="28" y1="15.5" x2="32" y2="20" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="splash-title">Fur-nsics</h1>
        <p className="splash-sub">Canine Mange Screening</p>
      </div>

      <div className="splash-features">
        {features.map((f) => (
          <div className="feature-row" key={f.label}>
            <div className="feature-dot" />
            <div>
              <div className="feature-label">{f.label}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="splash-footer">
        <button className="btn-primary" onClick={onStart}>
          Begin Screening
        </button>
        <p className="splash-disclaimer">Triage use only · Not a veterinary diagnosis</p>
      </div>

    </div>
  )
}