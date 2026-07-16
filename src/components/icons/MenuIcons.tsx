// Icônes de navigation : traits simples, viewBox 24x24, couleur héritée
// via currentColor (même convention que les icônes soleil/lune de
// ThemeToggle), pour s'adapter automatiquement aux états actif/inactif
// et au mode sombre sans styliser chaque icône individuellement.

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M8 3.5v3.5M16 3.5v3.5" />
    </svg>
  );
}

export function IconChecklist({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 6.5 6 8l2.5-3" />
      <path d="M4.5 12.5 6 14l2.5-3" />
      <path d="M4.5 18.5 6 20l2.5-3" />
      <path d="M12 7h7.5M12 13h7.5M12 19h7.5" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.2M12 19v2.2M4.2 12H2M22 12h-2.2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" />
    </svg>
  );
}

export function IconSpeechBubble({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.5h16v10H9.5L6 19v-3.5H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}

export function IconDialogue({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 4.5h10v7H7l-2 2v-2H3.5z" />
      <path d="M20.5 9.5h-10v7h6l2 2v-2h2z" />
    </svg>
  );
}

export function IconMegaphone({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 10v4h3l6 4V6l-6 4z" />
      <path d="M12.5 9.5c1.7 0 3 1.1 3 2.5s-1.3 2.5-3 2.5" />
      <path d="M6 14v4.5" />
    </svg>
  );
}

export function IconBarChart({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconReceipt({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h12v17l-2.2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20.5z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" />
    </svg>
  );
}

export function IconInvoice({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
      <path d="M8 8h8M8 11.5h5.5" />
      <path d="M8.2 16c.4.7 1.1 1.1 1.9 1.1 1.2 0 2-1.6.7-2.2-1.1-.5-2-.4-2-1.6 0-.9.9-1.4 1.8-1.3.7 0 1.4.4 1.7 1" />
    </svg>
  );
}

export function IconFolder({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 7c0-.8.7-1.5 1.5-1.5h4l2 2h8c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5z" />
    </svg>
  );
}

export function IconBook({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 6.5c-1.5-1.2-3.8-1.7-7.5-1.7v13c3.7 0 6 .5 7.5 1.7 1.5-1.2 3.8-1.7 7.5-1.7v-13c-3.7 0-6 .5-7.5 1.7z" />
      <path d="M12 6.5V19.5" />
    </svg>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 10.5c0-3.3 2.7-6 6-6s6 2.7 6 6c0 4 1.5 5 1.5 5h-15s1.5-1 1.5-5z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconGauge({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l3.5-4.5" />
      <path d="M12 15h.01" />
    </svg>
  );
}

export function IconPeople({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8.5" r="2.6" />
      <circle cx="16" cy="9.5" r="2.1" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15 14.5c2.3.2 4 1.9 4 4.5" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15.5 4.5a8 8 0 1 0 4 12.5 6.5 6.5 0 0 1-4-12.5z" />
    </svg>
  );
}

export function IconQuestion({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.6c0-1.3 1-2.2 2.2-2.2s2.2.9 2.2 2.2c0 1.7-2.2 1.7-2.2 3.4" />
      <path d="M12 16.2v.1" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 6.5h9M16 6.5H20.5" />
      <circle cx="13.5" cy="6.5" r="2" />
      <path d="M3.5 12h4.5M11.5 12h9" />
      <circle cx="9.5" cy="12" r="2" />
      <path d="M3.5 17.5h7M14 17.5h6.5" />
      <circle cx="11.5" cy="17.5" r="2" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
