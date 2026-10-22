import { useId } from 'react'

/* Stylised stainless-steel folder illustration, drawn per folder type.
   Used whenever a folder has no uploaded photo. */
export default function FolderArt({ type = '', size = 180, accent = '#1d5fd6' }) {
  const uid = useId().replace(/:/g, '')
  const steel = `st${uid}`, dark = `dk${uid}`, shine = `sh${uid}`, shadow = `sd${uid}`
  const t = type.toLowerCase()

  const plate = (
    <>
      <path d="M30 98 L118 76 L170 92 L82 116 Z" fill={`url(#${dark})`} />
      <path d="M30 98 L82 116 L82 121 L30 103 Z" fill="#6b7586" />
      <path d="M82 116 L170 92 L170 97 L82 121 Z" fill="#8a94a4" />
      <circle cx="58" cy="100" r="3.2" fill="#4b5563" /><circle cx="58" cy="100" r="1.4" fill="#cbd2dc" />
      <circle cx="140" cy="90" r="3.2" fill="#4b5563" /><circle cx="140" cy="90" r="1.4" fill="#cbd2dc" />
    </>
  )

  // A rolled scroll channel: the fabric enters wide and leaves folded.
  const scroll = (x, y, w = 92, curve = 0, scale = 1) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={`M0 20 C ${20 + curve} 8, ${50 - curve} 2, ${w} -6 L ${w} 14 C ${50 - curve} 20, ${22 + curve} 28, 0 38 Z`} fill={`url(#${steel})`} stroke="#7b8494" strokeWidth=".8" />
      <path d={`M0 20 C ${20 + curve} 8, ${50 - curve} 2, ${w} -6`} stroke="#fff" strokeOpacity=".8" strokeWidth="1.4" fill="none" />
      <ellipse cx={w} cy="4" rx="6" ry="10" fill={`url(#${dark})`} stroke="#6b7586" strokeWidth=".8" />
      <ellipse cx={w} cy="4" rx="3" ry="6" fill="#3b4250" />
      <path d={`M6 26 C ${26 + curve} 18, ${52 - curve} 12, ${w - 8} 6`} stroke={`url(#${shine})`} strokeWidth="3" fill="none" opacity=".7" />
    </g>
  )

  let body
  if (t.includes('gauge')) {
    // Gauge set: needle plate with feed-dog slots, presser foot and needle clamp.
    body = (
      <>
        <path d="M28 96 L120 72 L172 88 L80 114 Z" fill={`url(#${dark})`} />
        <path d="M28 96 L80 114 L80 119 L28 101 Z" fill="#6b7586" />
        <path d="M80 114 L172 88 L172 93 L80 119 Z" fill="#8a94a4" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${66 + i * 16} ${98 - i * 4} L${104 + i * 16} ${88 - i * 4}`} stroke="#3b4250" strokeWidth="3.4" strokeLinecap="round" />
        ))}
        <path d="M70 64 L118 52 L134 60 L86 74 Z" fill={`url(#${steel})`} stroke="#7b8494" />
        <path d="M70 64 L86 74 L86 80 L70 70 Z" fill="#9aa3b2" />
        <path d="M86 74 L134 60 L134 66 L86 80 Z" fill={`url(#${dark})`} />
        <rect x="96" y="24" width="14" height="34" rx="3" fill={`url(#${steel})`} stroke="#7b8494" />
        <path d="M100 58 V76 M106 56 V74" stroke="#4b5563" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="103" cy="32" r="2.4" fill="#4b5563" />
      </>
    )
  } else if (t.includes('conversion kit')) {
    // Conversion kit: a tray holding the swap parts.
    body = (
      <>
        <path d="M32 92 L116 70 L170 86 L86 110 Z" fill="#e6eaf0" stroke="#9aa3b2" />
        <path d="M32 92 L86 110 L86 120 L32 102 Z" fill="#b8c0cc" />
        <path d="M86 110 L170 86 L170 96 L86 120 Z" fill="#9aa3b2" />
        <path d="M52 88 L92 78 L104 82 L64 93 Z" fill={`url(#${steel})`} stroke="#7b8494" />
        <path d="M60 89 L94 80" stroke="#3b4250" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M104 86 L136 78 L150 83 L118 92 Z" fill={`url(#${dark})`} stroke="#6b7586" />
        <rect x="108" y="56" width="12" height="26" rx="3" fill={`url(#${steel})`} stroke="#7b8494" />
        <circle cx="78" cy="98" r="4" fill="#4b5563" /><circle cx="78" cy="98" r="1.6" fill="#cbd2dc" />
        <circle cx="132" cy="94" r="3" fill="#4b5563" />
      </>
    )
  } else if (t.includes('hang')) {
    body = (
      <>
        {plate}
        <rect x="70" y="40" width="60" height="44" rx="6" fill={`url(#${steel})`} stroke="#7b8494" />
        <path d="M100 40 V22 a12 12 0 1 1 18 10" stroke="#8a94a4" strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="80" y="52" width="40" height="6" rx="3" fill="#3b4250" />
        <rect x="80" y="64" width="28" height="4" rx="2" fill="#9aa3b2" />
      </>
    )
  } else if (t.includes('hemming')) {
    body = (
      <>
        {plate}
        <path d="M54 82 L136 52 L146 62 L64 96 Z" fill={`url(#${steel})`} stroke="#7b8494" />
        <path d="M136 52 C 154 46, 160 66, 146 62" fill={`url(#${dark})`} stroke="#6b7586" />
        <path d="M60 86 L138 56" stroke="#fff" strokeOpacity=".8" strokeWidth="1.4" />
        <path d="M70 88 C 90 70, 112 62, 140 58" stroke="#3b4250" strokeWidth="2" fill="none" />
      </>
    )
  } else if (t.includes('press')) {
    body = (
      <>
        {plate}
        <path d="M44 72 L120 52 L160 66 L84 88 Z" fill={`url(#${steel})`} stroke="#7b8494" />
        <path d="M44 72 L84 88 L84 100 L44 84 Z" fill="#9aa3b2" />
        <path d="M84 88 L160 66 L160 78 L84 100 Z" fill={`url(#${dark})`} />
        <path d="M60 74 L124 57" stroke="#3b4250" strokeWidth="4" strokeLinecap="round" />
        <path d="M66 80 L130 63" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
        <rect x="96" y="34" width="16" height="30" rx="3" fill={`url(#${steel})`} stroke="#7b8494" />
      </>
    )
  } else {
    const contour = t.includes('contour') ? 14 : 0
    const twoPart = t.includes('two part')
    body = (
      <>
        {plate}
        {twoPart ? (
          <>
            {scroll(48, 54, 88, contour, 1)}
            {scroll(58, 70, 82, contour, 0.92)}
          </>
        ) : scroll(46, 58, 96, contour, 1)}
        {t.includes('piping') && (
          <>
            <path d="M40 64 L130 40" stroke="#8a94a4" strokeWidth="6" strokeLinecap="round" />
            <path d="M40 64 L130 40" stroke="#e6eaf0" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </>
    )
  }

  return (
    <svg viewBox="0 0 200 140" width={size} height={(size * 140) / 200} role="img" aria-label={`${type || 'Folder'} illustration`}>
      <defs>
        <linearGradient id={steel} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5f7fa" /><stop offset=".45" stopColor="#c9d0da" /><stop offset=".55" stopColor="#e8ecf1" /><stop offset="1" stopColor="#9aa3b2" />
        </linearGradient>
        <linearGradient id={dark} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c3cad4" /><stop offset="1" stopColor="#7d8696" />
        </linearGradient>
        <linearGradient id={shine} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={shadow}><stop offset="0" stopColor="#0b1d3a" stopOpacity=".22" /><stop offset="1" stopColor="#0b1d3a" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="100" cy="122" rx="80" ry="10" fill={`url(#${shadow})`} />
      {body}
      <rect x="150" y="104" width="34" height="4" rx="2" fill={accent} opacity=".85" />
    </svg>
  )
}
