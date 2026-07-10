const PETAL_ANGLES = [0, 60, 120, 180, 240, 300];

export function MargueriteLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {PETAL_ANGLES.map((angle) => (
        <ellipse
          key={angle}
          cx="50"
          cy="27"
          rx="11.5"
          ry="20"
          fill="#ffffff"
          stroke="#6B8F5E"
          strokeWidth="3"
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="13" fill="#E8B84B" />
    </svg>
  );
}
