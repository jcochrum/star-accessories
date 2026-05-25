/** Inline SVG truck manufacturer logos for reliable rendering */

export function FordLogo({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 80" className={className} aria-label="Ford">
      <ellipse cx="100" cy="40" rx="96" ry="36" fill="#003478" stroke="#003478" strokeWidth="2"/>
      <text x="100" y="52" textAnchor="middle" fill="white" fontFamily="serif" fontWeight="bold" fontSize="42" fontStyle="italic">Ford</text>
    </svg>
  );
}

export function RamLogo({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 80" className={className} aria-label="Ram">
      <rect x="2" y="2" width="196" height="76" rx="6" fill="#000" stroke="#000" strokeWidth="2"/>
      <text x="100" y="56" textAnchor="middle" fill="white" fontFamily="sans-serif" fontWeight="900" fontSize="48" letterSpacing="8">RAM</text>
    </svg>
  );
}

export function ChevyLogo({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-label="Chevrolet">
      {/* Bowtie shape */}
      <polygon points="0,30 70,30 100,0 130,30 200,30 200,90 130,90 100,120 70,90 0,90" fill="#D4AF37" stroke="#D4AF37" strokeWidth="1"/>
      <polygon points="8,34 68,34 100,6 132,34 192,34 192,86 132,86 100,114 68,86 8,86" fill="white" stroke="white" strokeWidth="1"/>
      <polygon points="18,38 70,38 100,12 130,38 182,38 182,82 130,82 100,108 70,82 18,82" fill="#D4AF37" stroke="#D4AF37" strokeWidth="1"/>
    </svg>
  );
}
