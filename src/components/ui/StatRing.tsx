// StatRing — animated circular progress ring using SVG + framer-motion.
// Reusable for score displays, XP progress, streak counters, etc.
import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export interface StatRingProps {
  /** Current value (0-max). */
  value: number;
  /** Maximum value. Default 100. */
  max?: number;
  /** Ring diameter in px. Default 120. */
  size?: number;
  /** Stroke width in px. Default 10. */
  strokeWidth?: number;
  /** Track color (the un-filled background ring). */
  trackColor?: string;
  /** Progress arc color — accepts a CSS color or gradient id. */
  progressColor?: string;
  /** Optional gradient definition for the arc (id → stops). */
  gradient?: { id: string; from: string; to: string };
  /** Label shown above the number. */
  label?: string;
  /** Suffix appended to the number (e.g. '%', ' XP'). */
  suffix?: string;
  /** Round the number when displaying. */
  roundValue?: boolean;
  /** Extra className. */
  className?: string;
  /** Animate the number counting up. Default true. */
  animateCount?: boolean;
}

const StatRingBase: React.FC<StatRingProps> = ({
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  trackColor = 'rgba(124, 58, 237, 0.1)',
  progressColor = 'var(--primary)',
  gradient,
  label,
  suffix = '',
  roundValue = true,
  className = '',
  animateCount = true,
}) => {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? clamped / max : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcId = React.useId();
  const gradId = gradient?.id ?? `ring-grad-${arcId}`;

  // Animated number counter
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => {
    const n = roundValue ? Math.round(v) : Math.round(v * 10) / 10;
    return `${n}${suffix}`;
  });
  const [displayStr, setDisplayStr] = useState(`0${suffix}`);

  useEffect(() => {
    if (animateCount) {
      spring.set(clamped);
      const unsub = display.on('change', (v) => setDisplayStr(v));
      return () => unsub();
    } else {
      setDisplayStr(`${roundValue ? Math.round(clamped) : clamped}${suffix}`);
    }
  }, [clamped, animateCount, spring, display, roundValue, suffix]);

  const arcUrl = gradient ? `url(#${gradId})` : progressColor;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
      >
        {gradient && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
        )}
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arcUrl}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
        {label && (
          <span
            style={{
              fontSize: size * 0.09,
              fontWeight: 800,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}
          >
            {label}
          </span>
        )}
        <span
          style={{
            fontSize: size * (label ? 0.28 : 0.32),
            fontWeight: 900,
            color: 'var(--text-main)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayStr}
        </span>
      </div>
    </div>
  );
};

const StatRing = React.memo(StatRingBase);

export default StatRing;
export { StatRing };