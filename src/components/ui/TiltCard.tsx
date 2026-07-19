// TiltCard — 3D tilt effect on hover using react-spring
import React, { useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  intensity?: number; // max tilt degrees, default 8
  scale?: number; // hover scale, default 1.02
  onClick?: () => void;
}

const calc = (x: number, y: number, rect: DOMRect, intensity: number) => [
  -(y - rect.top - rect.height / 2) / (rect.height / 2) * intensity,
  (x - rect.left - rect.width / 2) / (rect.width / 2) * intensity,
  1.02,
];

const trans = (x: number, y: number, s: number) =>
  `perspective(800px) rotateX(${x}deg) rotateY(${y}deg) scale(${s})`;

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  glowColor,
  intensity = 6,
  scale = 1.02,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [springProps, api] = useSpring(() => ({
    xys: [0, 0, 1],
    config: { mass: 1, tension: 350, friction: 40 },
  }));

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const [rx, ry] = calc(e.clientX, e.clientY, rect, intensity);
    api.start({ xys: [rx, ry, scale] });
  };

  const handleMouseLeave = () => {
    api.start({ xys: [0, 0, 1] });
  };

  return (
    <animated.div
      ref={ref}
      className={`tilt-card ${className}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: springProps.xys.to(trans),
        ...(glowColor ? { '--glow-color': glowColor } as React.CSSProperties : {}),
      }}
    >
      {children}
    </animated.div>
  );
};

export default TiltCard;
