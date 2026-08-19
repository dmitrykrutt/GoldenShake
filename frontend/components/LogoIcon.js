export default function LogoIcon({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id="logoGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#1c1914" />
          <stop offset="60%" stopColor="#0d0c0a" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF3C4" />
          <stop offset="25%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="75%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="logoGoldLight" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#logoGlow)" stroke="url(#logoGold)" strokeWidth="4" strokeOpacity="0.4" />
      <g transform="translate(0, -6)">
        <path d="M 120,310 C 120,180 200,135 285,135 C 345,135 385,170 385,215 C 385,245 365,270 330,270 L 245,270 C 230,270 215,260 215,245 C 215,230 230,220 245,220 L 315,220 C 328,220 335,210 335,200 C 335,180 305,170 275,170 C 220,170 170,210 170,295 C 170,335 185,360 215,375 L 180,410 C 140,385 120,350 120,310 Z" fill="url(#logoGold)" />
        <path d="M 392,210 C 392,340 312,385 227,385 C 167,385 127,350 127,305 C 127,275 147,250 182,250 L 267,250 C 282,250 297,260 297,275 C 297,290 282,300 267,300 L 197,300 C 184,300 177,310 177,320 C 177,340 207,350 237,350 C 292,350 342,310 342,225 C 342,185 327,160 297,145 L 332,110 C 372,135 392,170 392,210 Z" fill="url(#logoGoldLight)" />
        <polygon points="256,230 274,248 256,266 238,248" fill="#FFFBEB" />
        <circle cx="256" cy="248" r="4" fill="#D97706" />
        <path d="M 370,125 Q 370,140 385,140 Q 370,140 370,155 Q 370,140 355,140 Q 370,140 370,125 Z" fill="#FFFDF0" />
        <path d="M 145,390 Q 145,398 153,398 Q 145,398 145,406 Q 145,398 137,398 Q 145,398 145,390 Z" fill="#FFFDF0" />
      </g>
    </svg>
  );
}
