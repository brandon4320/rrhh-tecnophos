// ============================================================
// Logo ADC S.R.L. (Fumigation) como SVG inline.
// El texto usa currentColor para adaptarse a fondo claro/oscuro;
// el naranja de marca queda fijo. Para reemplazar por el archivo
// oficial: dejar /public/logo-adc.svg y usar <img> en su lugar.
// ============================================================

const NARANJA = '#F26F21'

interface Props {
  className?: string
  /** 'mark' = adc + punto + S.R.L. (compacto); 'full' = agrega FUMIGATION. */
  variant?: 'mark' | 'full'
  title?: string
}

export function AdcLogo({ className, variant = 'mark', title = 'ADC S.R.L.' }: Props) {
  const full = variant === 'full'
  // viewBox más alto cuando incluye FUMIGATION
  const viewBox = full ? '0 0 250 132' : '0 0 250 96'

  return (
    <svg
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* sol / punto naranja */}
      <circle cx="171" cy="26" r="17" fill={NARANJA} />

      {/* wordmark adc */}
      <text
        x="2"
        y="80"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="84"
        letterSpacing="-4"
        fill="currentColor"
      >
        adc
      </text>

      {/* badge S.R.L. */}
      <rect x="150" y="58" width="84" height="26" rx="6" fill={NARANJA} />
      <text
        x="192"
        y="77"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="16"
        letterSpacing="1.5"
        fill="#ffffff"
      >
        S.R.L.
      </text>

      {full && (
        <text
          x="4"
          y="120"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="600"
          fontSize="18"
          letterSpacing="7.5"
          fill="currentColor"
        >
          FUMIGATION
        </text>
      )}
    </svg>
  )
}
