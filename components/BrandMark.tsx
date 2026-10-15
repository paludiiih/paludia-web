// Isotipo de PaludIA: orbe neuronal con degradé azul→violeta y núcleo dorado (el "sol").
// Componente de presentación puro: sirve tanto en Server como en Client Components.

export function BrandMark({ size = 36, idSuffix = "m", className }: { size?: number; idSuffix?: string; className?: string }) {
  const g = `pm-grad-${idSuffix}`;
  const c = `pm-core-${idSuffix}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f8dff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id={c} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#ffd97a" />
          <stop offset="1" stopColor="#f5b53d" />
        </radialGradient>
      </defs>
      {/* contorno squircle */}
      <rect x="2.5" y="2.5" width="35" height="35" rx="11" stroke={`url(#${g})`} strokeWidth="2.4" fill="#0b1322" />
      {/* red neuronal */}
      <g stroke={`url(#${g})`} strokeWidth="1.8" strokeLinecap="round">
        <path d="M13 26 L13 17 Q13 12 18 12 L22 12" opacity="0.95" />
        <path d="M22 12 Q27 12 27 17 L27 20" opacity="0.95" />
        <path d="M27 20 L22 24" opacity="0.8" />
        <path d="M13 21 L18 24" opacity="0.8" />
      </g>
      <g fill={`url(#${g})`}>
        <circle cx="13" cy="26" r="2.1" />
        <circle cx="27" cy="20" r="2.1" />
        <circle cx="22" cy="24" r="1.7" />
        <circle cx="13" cy="17" r="1.7" />
      </g>
      {/* núcleo dorado */}
      <circle cx="20.5" cy="18.5" r="3.1" fill={`url(#${c})`} />
    </svg>
  );
}
