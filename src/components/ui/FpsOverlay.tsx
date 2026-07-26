// FpsOverlay — dev-only rolling-average FPS counter pinned to the
// top-right corner. Renders ONLY when import.meta.env.DEV is true, so
// it is stripped from production builds and never affects end users.
//
// Why: Task D perf package needs a measurable signal. Before/after the
// MediaPipe throttle + StatRing debounce + OliverPet lowDetail + motion
// pause changes, compare the rolling FPS here. The counter uses a
// 60-frame rolling window so transient GC spikes don't dominate the
// reading.
import React, { useEffect, useRef, useState } from 'react';

const WINDOW = 60; // rolling average over the last 60 frames

export const FpsOverlay: React.FC = () => {
  const [fps, setFps] = useState<number>(0);
  const [slow, setSlow] = useState<boolean>(false);
  const frames = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (delta > 0) {
        frames.current.push(1000 / delta);
        if (frames.current.length > WINDOW) frames.current.shift();
      }
      // Sample the rolling average to setState ~4Hz — frequent enough to
      // be useful, infrequent enough not to perturb the very FPS we're
      // measuring.
      if (frames.current.length === WINDOW) {
        const sum = frames.current.reduce((a, b) => a + b, 0);
        const avg = sum / frames.current.length;
        setFps(avg);
        setSlow(avg < 30);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Theme-aware: reads tokens so it looks right in light/dark mode and
  // under both student and parent data-theme. Color shifts to --danger
  // when FPS drops below 30 so regressions are obvious.
  const color = slow ? 'var(--danger)' : 'var(--secondary)';
  const bg = 'var(--bg-card)';
  const border = 'var(--border-color)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 9999,
        padding: '4px 10px',
        borderRadius: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: 'var(--shadow-sm)',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.92,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      aria-hidden="true"
      title="Dev-only FPS overlay (rolling 60-frame average)"
    >
      {fps > 0 ? `${fps.toFixed(1)} FPS` : '… FPS'}
    </div>
  );
};

export default FpsOverlay;
