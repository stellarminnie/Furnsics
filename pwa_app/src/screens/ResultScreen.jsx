import './ResultScreen.css'

export default function ResultScreen({ result, onScanAgain, onHome }) {
  const isPositive = result?.label === 'POSITIVE'
  const confidence = Math.round((result?.confidence || 0) * 100)
  const msi        = result?.msi || 0

  return (
    <div className="result-screen">

      {/* Status icon */}
      <div className={`result-icon ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 6L19.5 13.5H27L21 18.5L23.5 26L16 21.5L8.5 26L11 18.5L5 13.5H12.5L16 6Z"
              fill="#B0281E" opacity="0.85"/>
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M9 16.5L14 21.5L23 11.5" stroke="#1A7A40" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Verdict */}
      <h2 className={`result-verdict ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? 'Mange Detected' : 'No Mange'}
      </h2>

      {/* Stats */}
      <div className="result-stats">
        <div className="stat-pill">Confidence {confidence}%</div>
        {isPositive && <div className="stat-pill">MSI {msi}/100</div>}
      </div>

      <div className="result-divider" />

      {/* Actions */}
      <div className="result-actions">
        <button className="btn-primary" onClick={onScanAgain}>Scan Again</button>
        <button className="btn-secondary" onClick={onHome}>Home</button>
      </div>

    </div>
  )
}