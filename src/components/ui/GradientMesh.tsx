// GradientMesh — CSS-only animated gradient mesh background.
// Replaces ParticleBackground (which used a dedicated WebGL context).
// Zero JavaScript animation loops, GPU-composited transform/opacity only.
import React from 'react';

export interface GradientMeshProps {
  /** Reduce motion: disables the drift animation (accessibility / battery). */
  static?: boolean;
  /** Opacity of the gradient layer (0-1). Default 0.6. */
  opacity?: number;
  /** Extra className for positioning / sizing. */
  className?: string;
}

const GradientMesh: React.FC<GradientMeshProps> = ({
  static: isStatic = false,
  opacity = 0.6,
  className = '',
}) => {
  return (
    <div
      className={`gradient-mesh ${isStatic ? 'gradient-mesh--static' : ''} ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
};

export default GradientMesh;
export { GradientMesh };