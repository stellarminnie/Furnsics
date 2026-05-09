import './ResultScreen.css'

export default function ResultScreen({ result, onScanAgain, onHome }) {
  const isPositive = result?.label === 'POSITIVE'
  const isAttention = result?.displayLabel === 'NEEDS ATTENTION'
  const confidence = Math.round((result?.confidence || 0) * 100)
  const msi = result?.msi || 0
  const severity = result?.severity || { tier: 'None', color: '#1E8449', action: 'Continue monitoring' }

  const headerColor = isPositive
    ? (isAttention ? 'var(--warning)' : 'var(--danger)')
    : 'var(--success)'

  return (
    <div className="result-screen">

      {/* Header */}
      <div className="result-header">
        <div className="result-icon" style={{ color: headerColor }}>
          {result?.displayLabel === 'MANGE DETECTED' && '⚠️'}
          {result?.displayLabel === 'NEEDS ATTENTION' && '🔶'}
          {result?.displayLabel === 'NO MANGE' && '✅'}
        </div>
        <h1 className="result-label" style={{ color: headerColor }}>{result?.displayLabel}</h1>
        <p className="result-confidence">
          AI Confidence: {confidence}%
        </p>
        <p className="result-votes">
          {result?.positiveVotes}/{result?.totalFrames} frames flagged positive
        </p>
      </div>

      <div className="result-body">

        {/* Heatmap */}
        {result?.heatmapImage && (
          <div className="result-section">
            <div className="section-title">Grad-CAM Activation Map</div>
            <div className="heatmap-wrap">
              <img
                src={result.heatmapImage}
                alt="Grad-CAM heatmap"
                className="heatmap-img"
              />
              <p className="heatmap-caption">
                Red areas = regions that influenced the detection
              </p>
            </div>
          </div>
        )}

        {/* MSI Score */}
        {isPositive && (
          <div className="result-section">
            <div className="section-title">Mange Severity Index (MSI)</div>
            <div className="msi-wrap">
              <div className="msi-number" style={{ color: severity.color }}>
                {msi}
                <span className="msi-unit">/100</span>
              </div>
              <div className="msi-tier" style={{ background: severity.color }}>
                {severity.tier}
              </div>
              <div className="msi-bar-bg">
                <div
                  className="msi-bar-fill"
                  style={{
                    width: `${msi}%`,
                    background: severity.color
                  }}
                />
              </div>
              <div className="msi-scale">
                <span>Mild (1–33)</span>
                <span>Moderate (34–66)</span>
                <span>Severe (67–100)</span>
              </div>
            </div>
          </div>
        )}

        {/* Action guideline */}
        <div className="result-section">
          <div className="section-title">Recommended Action</div>
          <div className="action-box" style={{ borderColor: severity.color }}>
            <p className="action-text">{severity.action}</p>
            {isPositive && (
              <p className="action-note">
                This is a preliminary screening result only.
                A licensed veterinarian must confirm the diagnosis.
              </p>
            )}
            {!isPositive && (
              <p className="action-note">
                No mange indicators detected. Continue regular
                monitoring and consult a vet if symptoms develop.
              </p>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="result-disclaimer">
          Fur-nsics is a triage aid only · Not a veterinary diagnosis
        </div>

        {/* Action buttons */}
        <div className="result-actions">
          <button className="btn-primary" onClick={onScanAgain}>
            Scan Another Dog
          </button>
          <button className="btn-secondary" onClick={onHome}>
            Home
          </button>
        </div>

      </div>
    </div>
  )
}