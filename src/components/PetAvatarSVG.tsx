// PetAvatarSVG — lightweight static SVG panda avatar.
//
// This is the no-WebGL alternative to <OliverPet/> (which mounts a
// @react-three/fiber Canvas + WebGL context). When the dashboard's
// MediaPipe camera is active the page already runs two heavy WebGL
// contexts (Pose + FaceMesh inference); keeping a third OliverPet
// context alive at the same time was the dominant cause of the
// "camera on → page laggy" symptom. FloatingPet now swaps in this
// SVG avatar while a study session with the camera is in progress,
// and falls back to the full 3D OliverPet when the camera is off or
// no session has started.
//
// The SVG fills its wrapper circle (viewBox 0 0 48 48 with the body
// circle at r=22) so there's no transparent margin; eyes/cheeks are
// kept inside the body to avoid white-edge halos at small sizes.

import React from 'react';
import type { PetState } from './OliverPet';

interface PetAvatarSVGProps {
  state: PetState;
  /** Pixel size of the rendered square. Defaults to 100% of parent. */
  size?: number;
  className?: string;
}

export const PetAvatarSVG: React.FC<PetAvatarSVGProps> = ({ state, size, className }) => {
  // Body color shifts slightly per state to convey mood.
  const bodyColor =
    state === 'good' ? '#60A5FA' :
    state === 'slouch' ? '#94A3B8' :
    state === 'close' ? '#F59E0B' :
    state === 'writing' ? '#A78BFA' :
    state === 'tired' ? '#94A3B8' :
    state === 'sleep' ? '#94A3B8' :
    '#60A5FA';
  const cheekColor = state === 'good' ? '#F472B6' : '#FCA5A5';
  // Mouth changes with mood.
  const mouthPath =
    state === 'good' ? 'M 18 32 Q 24 38 30 32' :
    state === 'slouch' ? 'M 18 34 Q 24 30 30 34' :
    state === 'close' ? 'M 18 34 Q 24 32 30 34' :
    state === 'tired' ? 'M 18 34 Q 24 32 30 34' :
    state === 'sleep' ? 'M 19 33 Q 24 33 29 33' :
    'M 18 33 Q 24 36 30 33';
  return (
    <svg
      viewBox="0 0 48 48"
      width={size ?? '100%'}
      height={size ?? '100%'}
      aria-hidden="true"
      className={className}
      style={{ display: 'block' }}
    >
      {/* body — enlarged to fill the wrapper circle (r=22 vs old 16) */}
      <circle cx="24" cy="24" r="22" fill={bodyColor} />
      {/* ears */}
      <circle cx="11" cy="13" r="6" fill={bodyColor} />
      <circle cx="37" cy="13" r="6" fill={bodyColor} />
      <circle cx="11" cy="13" r="3" fill="#3B82F6" opacity="0.6" />
      <circle cx="37" cy="13" r="3" fill="#3B82F6" opacity="0.6" />
      {/* eyes — pure dark, no white sparkle highlight (was creating
          white-edge artefacts at small render sizes) */}
      {state === 'sleep' ? (
        // Closed-eye arcs when sleeping
        <>
          <path d="M 15 24 Q 18 26 21 24" stroke="#0F172A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M 27 24 Q 30 26 33 24" stroke="#0F172A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="18" cy="24" r="2.6" fill="#0F172A" />
          <circle cx="30" cy="24" r="2.6" fill="#0F172A" />
        </>
      )}
      {/* cheeks — kept, but inside the body circle so they don't read
          as a white edge */}
      <circle cx="13" cy="30" r="2.4" fill={cheekColor} opacity="0.7" />
      <circle cx="35" cy="30" r="2.4" fill={cheekColor} opacity="0.7" />
      {/* mouth */}
      <path d={mouthPath} stroke="#0F172A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export default PetAvatarSVG;
