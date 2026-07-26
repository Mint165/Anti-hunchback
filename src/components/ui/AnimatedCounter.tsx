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
    let rafId: number | null = null;
    // Pause the count-up animation when the tab is hidden (e.g. user
    // alt-tabbed away mid-count). rAF is throttled to 0Hz in hidden
    // tabs by browsers anyway, but the explicit guard avoids leaving
    // a pending rAF callback queued until the tab is refocused, which
    // would make the digit snap to its final value on return instead
    // of completing smoothly. We just settle to the final value
    // immediately when hidden — visually equivalent since the user
    // can't see it.
    const settleIfHidden = () => {
      if (document.hidden) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        fromRef.current = value;
        setDisplay(value);
        return true;
      }
      return false;
    };
    if (settleIfHidden()) return;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = ease(t);
      const current = from + delta * eased;
      setDisplay(current);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = null;
        fromRef.current = value;
        setDisplay(value);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
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