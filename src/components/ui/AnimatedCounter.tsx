// AnimatedCounter — number that eases from 0 (or previous) to target.
// Uses requestAnimationFrame with an ease-out cubic curve; cheaper than
// framer-motion springs for simple count-up displays and avoids re-renders.
import React, { useEffect, useRef, useState } from 'react';

export interface AnimatedCounterProps {
  /** Target value. */
  value: number;
  /** Duration in ms. Default 1000. */
  duration?: number;
  /** Number of decimal places. Default 0. */
  decimals?: number;
  /** Prefix string (e.g. '$'). */
  prefix?: string;
  /** Suffix string (e.g. '%', ' XP'). */
  suffix?: string;
  /** Thousands separator. Default false. */
  thousandsSeparator?: boolean;
  /** Ease function. Default easeOutCubic. */
  ease?: (t: number) => number;
  /** Play animation each time value changes. Default true. */
  animateOnChange?: boolean;
  /** Extra className. */
  className?: string;
  /** Inline style. */
  style?: React.CSSProperties;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const formatNumber = (n: number, decimals: number, thousandsSeparator: boolean) => {
  const fixed = n.toFixed(decimals);
  if (!thousandsSeparator) return fixed;
  const [int, frac] = fixed.split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${withSep}.${frac}` : withSep;
};

const AnimatedCounterBase: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  thousandsSeparator = false,
  ease = easeOutCubic,
  animateOnChange = true,
  className = '',
  style = {},
}) => {
  const [display, setDisplay] = useState(animateOnChange ? 0 : value);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animateOnChange) {
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;

    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = ease(t);
      const current = from + delta * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        setDisplay(value);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration, ease, animateOnChange]);

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}
      {formatNumber(display, decimals, thousandsSeparator)}
      {suffix}
    </span>
  );
};

const AnimatedCounter = React.memo(AnimatedCounterBase);

export default AnimatedCounter;
export { AnimatedCounter };