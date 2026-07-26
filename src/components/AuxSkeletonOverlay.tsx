// AuxSkeletonOverlay — Task F (desktop split-screen)
//
// Renders a "ghost" skeleton from aux-camera pose landmarks streamed
// from a second device (typically a phone on a tripod, angled from
// the side). The skeleton is drawn as an SVG inside a wrapper that
// mirrors the size of the front-camera video card so the user can
// visually compare the two views.
//
// Landmarks come in normalized 0..1 coordinates (MediaPipe Pose).
// We map them to a 100×100 viewBox and connect the standard
// shoulders / elbows / wrists / hips / knees / ankles plus a nose
// head node. Stroke uses var(--secondary) so it auto-adapts to
// light/dark + student/parent themes per the constitution.

import React from 'react';
import type { Landmark } from '../services/postureAI';
import styles from './AuxSkeletonOverlay.module.css';

interface AuxSkeletonOverlayProps {
  landmarks: Landmark[] | null;
  /** Optional label shown top-left ("📱 Camera phụ"). */
  label?: string;
}

// MediaPipe Pose landmark indices we care about.
const NOSE = 0;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;

interface Seg { from: number; to: number; }

// Bone connections to draw.
const BONES: Seg[] = [
  // shoulders
  { from: L_SHOULDER, to: R_SHOULDER },
  // arms
  { from: L_SHOULDER, to: L_ELBOW },
  { from: L_ELBOW, to: L_WRIST },
  { from: R_SHOULDER, to: R_ELBOW },
  { from: R_ELBOW, to: R_WRIST },
  // torso
  { from: L_SHOULDER, to: L_HIP },
  { from: R_SHOULDER, to: R_HIP },
  { from: L_HIP, to: R_HIP },
  // legs
  { from: L_HIP, to: L_KNEE },
  { from: L_KNEE, to: L_ANKLE },
  { from: R_HIP, to: R_KNEE },
  { from: R_KNEE, to: R_ANKLE },
];

// Landmark indices to render as joint dots.
const JOINTS = [
  NOSE,
  L_SHOULDER, R_SHOULDER,
  L_ELBOW, R_ELBOW,
  L_WRIST, R_WRIST,
  L_HIP, R_HIP,
  L_KNEE, R_KNEE,
  L_ANKLE, R_ANKLE,
];

export const AuxSkeletonOverlay: React.FC<AuxSkeletonOverlayProps> = ({ landmarks, label }) => {
  // When we have no landmarks yet (or the stream paused), show a
  // quiet placeholder so the right column doesn't look broken.
  if (!landmarks || landmarks.length === 0) {
    return (
      <div className={styles.wrapper} aria-hidden="true">
        {label && <div className={styles.label}>{label}</div>}
        <div className={styles.placeholder} />
      </div>
    );
  }

  const pt = (i: number) => {
    const lm = landmarks[i];
    if (!lm) return null;
    // MediaPipe normalized coords: x in [0..1] left→right, y in [0..1] top→bottom.
    // Mirror x so the aux view matches the user's mental model (person facing
    // the camera appears on the same side as in the front view).
    return { x: (1 - lm.x) * 100, y: lm.y * 100 };
  };

  return (
    <div className={styles.wrapper} aria-hidden="true">
      {label && <div className={styles.label}>{label}</div>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.svg}>
        {/* Bones */}
        {BONES.map((seg, idx) => {
          const a = pt(seg.from);
          const b = pt(seg.to);
          if (!a || !b) return null;
          return (
            <line
              key={`bone-${idx}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              className={styles.bone}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          );
        })}
        {/* Joints */}
        {JOINTS.map((i, idx) => {
          const p = pt(i);
          if (!p) return null;
          const isHead = i === NOSE;
          return (
            <circle
              key={`joint-${idx}`}
              cx={p.x}
              cy={p.y}
              r={isHead ? 2.4 : 1.4}
              className={isHead ? styles.head : styles.joint}
            />
          );
        })}
      </svg>
    </div>
  );
};

export default AuxSkeletonOverlay;
