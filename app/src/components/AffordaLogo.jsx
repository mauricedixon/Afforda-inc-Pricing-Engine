import { useState } from 'react'

const AffordaLogo = ({ className = '', variant = 'default' }) => {
  const [imgSrc, setImgSrc] = useState('/logo.png')
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (imgSrc === '/logo.png') {
      setImgSrc('/logo.svg')
    } else {
      setHasError(true)
    }
  }

  if (hasError) {
    return (
      <div 
        className={`afforda-logo-fallback ${className}`.trim()} 
        style={{ 
          fontWeight: 'bold', 
          color: '#0f172a',
          fontSize: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <span style={{ fontSize: '1.2em', lineHeight: 1 }}>⟁</span>
        Afforda Inc.
      </div>
    )
  }

  return (
    <img
      src={imgSrc}
      alt="Afforda Inc. Logo"
      className={`afforda-logo ${className}`.trim()}
      onError={handleError}
    />
  )
}

export default AffordaLogo
