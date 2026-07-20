// TiltCard — 3D tilt effect on hover using framer-motion.
// Replaces the previous @react-spring/web implementation so the app
// has a single animation library. Adds an optional glowOnHover aura.
import React, { useRef, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Color used for the hover glow aura. */
  glowColor?: string;
  /** Show a soft radial glow that follows the cursor on hover. */
  glowOnHover?: boolean;
  /** Max tilt degrees. Default 6. */
  intensity?: number;
  /** Hover scale. Default 1.02. */
  scale?: number;
  onClick?: () => void;
}

const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  glowColor,
  glowOnHover = false,
  intensity = 6,
  scale = 1.02,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Raw pointer position (-1 .. 1 from card center)
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  // Smoothed values
  const springConfig = { stiffness: 350, damping: 30, mass: 1 };
  const rx = useSpring(useTransform(py, (p) => p * intensity), springConfig);
  const ry = useSpring(useTransform(px, (p) => p * -intensity), springConfig);
  const sc = useSpring(1, springConfig);

  // Glow position (percentage of card)
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowOpacity = useMotionValue(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width; // 0..1
      const ny = (e.clientY - rect.top) / rect.height; // 0..1
      px.set((nx - 0.5) * 2); // -1..1
      py.set((ny - 0.5) * 2);
      sc.set(scale);
      if (glowOnHover) {
        glowX.set(nx * 100);
        glowY.set(ny * 100);
        glowOpacity.set(1);
      }
    },
    [px, py, sc, scale, glowOnHover, glowX, glowY, glowOpacity],
  );

  const handleMouseLeave = useCallback(() => {
    px.set(0);
    py.set(0);
    sc.set(1);
    if (glowOnHover) glowOpacity.set(0);
  }, [px, py, sc, glowOnHover, glowOpacity]);

  const transform = useTransform(
    [rx, ry, sc] as MotionValue[],
    ([rxx, ryy, s]: number[]) =>
      `perspective(800px) rotateX(${rxx}deg) rotateY(${ryy}deg) scale(${s})`,
  );

  const glowBg = useTransform(
    [glowX, glowY, glowOpacity] as MotionValue[],
    ([gx, gy]: number[]) =>
      `radial-gradient(220px circle at ${gx}% ${gy}%, ${
        glowColor ?? 'rgba(124, 58, 237, 0.25)'
      }, transparent 65%)`,
  );

  return (
    <motion.div
      ref={ref}
      className={`tilt-card ${className}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        position: 'relative',
        ...(glowColor && !glowOnHover
          ? ({ '--glow-color': glowColor } as React.CSSProperties)
          : {}),
      }}
    >
      {glowOnHover && (
        <motion.div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: glowBg,
            opacity: glowOpacity,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {children}
    </motion.div>
  );
};

const MemoizedTiltCard = React.memo(TiltCard);

export default MemoizedTiltCard;
export { MemoizedTiltCard as TiltCard };