// SkeletonLoader — shimmer placeholder for loading states.
// Drop-in replacement for spinners; renders shapes that match the
// layout of the content being loaded.
import React from 'react';

export interface SkeletonLoaderProps {
  /** Width (CSS value). Default '100%'. */
  width?: string | number;
  /** Height (CSS value). Default 16. */
  height?: string | number;
  /** Render as a circle (avatar/icon placeholder). */
  circle?: boolean;
  /** Number of stacked lines (text block placeholder). */
  lines?: number;
  /** Border radius override. */
  radius?: string;
  /** Extra className. */
  className?: string;
  /** Inline style override. */
  style?: React.CSSProperties;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 16,
  circle = false,
  lines,
  radius,
  className = '',
  style = {},
}) => {
  // Multi-line text block
  if (lines && lines > 0) {
    return (
      <div className={className} style={style} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton skeleton-text"
            style={{
              width: i === lines - 1 ? '70%' : '100%',
              height: typeof height === 'number' ? `${height}px` : height,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton ${circle ? 'skeleton-circle' : ''} ${className}`}
      aria-hidden="true"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius ?? (circle ? '50%' : undefined),
        ...style,
      }}
    />
  );
};

export default SkeletonLoader;
export { SkeletonLoader };