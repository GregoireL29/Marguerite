"use client";

import { useEffect } from "react";

const PETAL_ANGLES = [0, 60, 120, 180, 240, 300];

// Longueur approchée du tracé d'un pétale (ellipse rx=11.5 ry=20),
// arrondie au-dessus pour garantir un pétale entièrement masqué au départ.
const PETAL_LENGTH = 105;

const STROKE_DURATION = 0.4;
const STROKE_STAGGER = 0.1;
const FILL_DURATION = 0.25;
const FILL_LEAD = 0.3; // le remplissage démarre avant la fin du tracé

const CENTER_DELAY = 1;
const WORDMARK_DELAY = 1.15;

// Durée totale avant de basculer vers l'écran de connexion.
const TOTAL_DURATION_MS = 1600;

interface SplashLogoProps {
  onComplete: () => void;
}

export function SplashLogo({ onComplete }: SplashLogoProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, TOTAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden="true">
        {PETAL_ANGLES.map((angle, i) => {
          const strokeDelay = i * STROKE_STAGGER;
          const fillDelay = strokeDelay + STROKE_DURATION - FILL_LEAD;

          return (
            <ellipse
              key={angle}
              cx="50"
              cy="27"
              rx="11.5"
              ry="20"
              fill="#ffffff"
              fillOpacity={0}
              stroke="#6B8F5E"
              strokeWidth="3"
              transform={`rotate(${angle} 50 50)`}
              style={{
                strokeDasharray: PETAL_LENGTH,
                strokeDashoffset: PETAL_LENGTH,
                animation: `marguerite-draw-petal ${STROKE_DURATION}s ease-out forwards, marguerite-fill-petal ${FILL_DURATION}s ease-out forwards`,
                animationDelay: `${strokeDelay}s, ${fillDelay}s`,
              }}
            />
          );
        })}
        <circle
          cx="50"
          cy="50"
          r="13"
          fill="#E8B84B"
          style={{
            opacity: 0,
            transform: "scale(0.3)",
            transformOrigin: "50px 50px",
            animation: "marguerite-pop-center 0.3s ease-out forwards",
            animationDelay: `${CENTER_DELAY}s`,
          }}
        />
      </svg>
      <span
        className="text-base font-semibold tracking-tight text-foreground"
        style={{
          opacity: 0,
          animation: "marguerite-fade-in 0.3s ease-out forwards",
          animationDelay: `${WORDMARK_DELAY}s`,
        }}
      >
        Marguerite
      </span>
    </div>
  );
}
