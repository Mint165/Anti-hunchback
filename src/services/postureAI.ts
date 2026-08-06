// Posture AI Analysis Service

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface CalibrationData {
  baseEyeDistance: number;    // pixel distance between left & right eyes
  baseNeckYOffset: number;    // vertical distance between nose & shoulder midpoint
  baseShoulderYDiff: number;  // baseline shoulder height difference
  baseTorsoHeight: number;    // vertical distance between head top & shoulder midpoint
  baseEAR: number;            // baseline Eye Aspect Ratio (open eyes)
}

export type PostureState = 'GOOD_POSTURE' | 'WRITING' | 'BAD_POSTURE';
export type CameraMode = 'front' | 'side';

export interface PostureMetrics {
  eyeDistanceCm: number;
  neckAngle: number;
  shoulderTilt: number;
  slouchAngle: number; // Back curvature proxy
  earValue: number;
  isBlinking: boolean;
  isWritingMode: boolean; // Context awareness: looking down + neck bent
  fidgetFactor: number;   // Variance of movements
  state: PostureState;    // AI classified state
  timestamp: number;
}

export const DEFAULT_CALIBRATION: CalibrationData = {
  baseEyeDistance: 80,       // standard for 640x480 webcam at ~60cm
  baseNeckYOffset: 120,
  baseShoulderYDiff: 0,
  baseTorsoHeight: 180,
  baseEAR: 0.28,
};

// Calculate Eye Aspect Ratio (EAR) for blink detection
export function calculateEAR(
  eyePoints: {
    p1: Landmark; // inner corner
    p2: Landmark; // upper-mid-1
    p3: Landmark; // upper-mid-2
    p4: Landmark; // outer corner
    p5: Landmark; // lower-mid-1
    p6: Landmark; // lower-mid-2
  }
): number {
  const vertical1 = Math.sqrt(
    Math.pow(eyePoints.p2.x - eyePoints.p6.x, 2) + Math.pow(eyePoints.p2.y - eyePoints.p6.y, 2)
  );
  const vertical2 = Math.sqrt(
    Math.pow(eyePoints.p3.x - eyePoints.p5.x, 2) + Math.pow(eyePoints.p3.y - eyePoints.p5.y, 2)
  );
  const horizontal = Math.sqrt(
    Math.pow(eyePoints.p1.x - eyePoints.p4.x, 2) + Math.pow(eyePoints.p1.y - eyePoints.p4.y, 2)
  );
  
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

// Calculate the relative vertical position of the iris within the eye to detect looking down (writing mode)
export function calculateIrisYRatio(iris: Landmark, upperLid: Landmark, lowerLid: Landmark): number {
  const height = Math.abs(lowerLid.y - upperLid.y);
  if (height === 0) return 0.5;
  // 0 is upper lid, 1 is lower lid
  return (iris.y - upperLid.y) / height;
}

// Calculate posture metrics based on Pose and FaceMesh landmark inputs
export function analyzePosture(
  poseLandmarks: Landmark[] | null,
  faceLandmarks: Landmark[] | null,
  calibration: CalibrationData,
  canvasWidth: number,
  canvasHeight: number,
  movementHistory: { x: number; y: number }[],
  cameraMode: CameraMode = 'front',
  isManualWritingMode: boolean = false
): PostureMetrics {
  const metrics: PostureMetrics = {
    eyeDistanceCm: 60,
    neckAngle: 0,
    shoulderTilt: 0,
    slouchAngle: 0,
    earValue: 0.28,
    isBlinking: false,
    isWritingMode: false,
    fidgetFactor: 0,
    state: 'GOOD_POSTURE',
    timestamp: Date.now(),
  };

  // 1. FaceMesh Analysis
  let leftIrisRatio = 0.5;
  let rightIrisRatio = 0.5;

  if (faceLandmarks && faceLandmarks.length > 468) {
    // Face Mesh eyes indices:
    // Left eye corners: 33, 133. Upper/lower eyelids: 159, 145
    // Right eye corners: 362, 263. Upper/lower eyelids: 386, 374
    // Iris points (if present in FaceMesh output): 468 (L), 473 (R)
    const leftEyeOuter = faceLandmarks[33];
    const leftEyeInner = faceLandmarks[133];
    const rightEyeInner = faceLandmarks[362];
    const rightEyeOuter = faceLandmarks[263];

    // Compute center of each eye
    const leftEyeCenter = {
      x: (leftEyeOuter.x + leftEyeInner.x) / 2,
      y: (leftEyeOuter.y + leftEyeInner.y) / 2,
    };
    const rightEyeCenter = {
      x: (rightEyeInner.x + rightEyeOuter.x) / 2,
      y: (rightEyeInner.y + rightEyeOuter.y) / 2,
    };

    // Calculate Eye Distance in Pixels
    const eyeDistPx = Math.sqrt(
      Math.pow(leftEyeCenter.x - rightEyeCenter.x, 2) + Math.pow(leftEyeCenter.y - rightEyeCenter.y, 2)
    ) * canvasWidth;

    // Convert to cm (60cm is the calibration baseline distance)
    metrics.eyeDistanceCm = Math.round((60 * calibration.baseEyeDistance) / Math.max(1, eyeDistPx));
    
    // EAR calculation for blinks
    // Left Eye points: 133(p1), 159(p2), 158(p3), 33(p4), 145(p5), 153(p6)
    const leftEAR = calculateEAR({
      p1: faceLandmarks[133],
      p2: faceLandmarks[159],
      p3: faceLandmarks[158],
      p4: faceLandmarks[33],
      p5: faceLandmarks[145],
      p6: faceLandmarks[153],
    });

    // Right Eye points: 362(p1), 386(p2), 385(p3), 263(p4), 374(p5), 380(p6)
    const rightEAR = calculateEAR({
      p1: faceLandmarks[362],
      p2: faceLandmarks[386],
      p3: faceLandmarks[385],
      p4: faceLandmarks[263],
      p5: faceLandmarks[374],
      p6: faceLandmarks[380],
    });

    metrics.earValue = (leftEAR + rightEAR) / 2;
    metrics.isBlinking = metrics.earValue < (calibration.baseEAR * 0.6);

    // Look down ratio to detect writing/typing
    if (faceLandmarks[468] && faceLandmarks[473]) {
      leftIrisRatio = calculateIrisYRatio(faceLandmarks[468], faceLandmarks[159], faceLandmarks[145]);
      rightIrisRatio = calculateIrisYRatio(faceLandmarks[473], faceLandmarks[386], faceLandmarks[374]);
    }
  }

  // 2. Pose Analysis
  if (poseLandmarks && poseLandmarks.length > 24) { // ensure hips are available
    const nose = poseLandmarks[0];
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    const headTop = faceLandmarks && faceLandmarks.length > 10 ? faceLandmarks[10] : nose;

    // Shoulder midpoint
    const shoulderMid = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };

    // Shoulder tilt angle
    const shoulderAngleRad = Math.atan2(
      (leftShoulder.y - rightShoulder.y) * canvasHeight,
      (leftShoulder.x - rightShoulder.x) * canvasWidth
    );
    metrics.shoulderTilt = Math.abs(shoulderAngleRad * 180 / Math.PI);

    // Neck offset Y (vertical distance)
    const currentNeckOffset = (shoulderMid.y - nose.y) * canvasHeight;
    
    if (cameraMode === 'side') {
      // Side Profile Logic with Visibility & Saliency Check
      const leftEar = poseLandmarks[7];
      const rightEar = poseLandmarks[8];
      const leftHip = poseLandmarks[23];
      const rightHip = poseLandmarks[24];

      const calcAngle = (A: Landmark, B: Landmark, C: Landmark) => {
         const AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
         const BC = Math.sqrt(Math.pow(C.x - B.x, 2) + Math.pow(C.y - B.y, 2));
         const AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
         if (AB * BC === 0) return 180;
         const cosB = (Math.pow(AB, 2) + Math.pow(BC, 2) - Math.pow(AC, 2)) / (2 * AB * BC);
         return Math.acos(Math.max(-1, Math.min(1, cosB))) * (180 / Math.PI);
      };

      const leftAngle = calcAngle(leftEar, leftShoulder, leftHip);
      const rightAngle = calcAngle(rightEar, rightShoulder, rightHip);

      // Check visibility scores if provided by pose landmark detector
      const leftVis = ((leftEar as any)?.visibility ?? 1) * ((leftShoulder as any)?.visibility ?? 1) * ((leftHip as any)?.visibility ?? 1);
      const rightVis = ((rightEar as any)?.visibility ?? 1) * ((rightShoulder as any)?.visibility ?? 1) * ((rightHip as any)?.visibility ?? 1);

      let sideAngle: number;
      if (leftVis > rightVis * 1.5) {
        sideAngle = leftAngle;
      } else if (rightVis > leftVis * 1.5) {
        sideAngle = rightAngle;
      } else {
        sideAngle = (leftAngle + rightAngle) / 2;
      }

      // Straight back: ~170-175 deg. Slouching: drops to 135-150 deg.
      const maxStraight = 172;
      metrics.slouchAngle = Math.max(0, Math.min(90, maxStraight - sideAngle));

      // Neck angle for side mode: Angle between Nose-Ear-Shoulder
      const leftNeck = calcAngle(nose, leftEar, leftShoulder);
      const rightNeck = calcAngle(nose, rightEar, rightShoulder);
      const sideNeckAngle = leftVis > rightVis ? leftNeck : rightNeck;
      metrics.neckAngle = Math.max(0, Math.min(90, 160 - sideNeckAngle));

    } else {
      // Front Profile Logic
      // Neck angle proxy: comparing current vertical neck length with base neck length
      const neckRatio = currentNeckOffset / calibration.baseNeckYOffset;
      metrics.neckAngle = Math.max(0, Math.min(90, (1 - neckRatio) * 90));

      // Torso height / slouched back proxy
      const currentTorsoHeight = (shoulderMid.y - headTop.y) * canvasHeight;
      const slouchRatio = currentTorsoHeight / calibration.baseTorsoHeight;
      metrics.slouchAngle = Math.max(0, Math.min(90, (1 - slouchRatio) * 85));
    }

    // Fidgeting factor: calculate the standard deviation of shoulder midpoint over history
    if (movementHistory.length > 1) {
      const avg = movementHistory.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
      avg.x /= movementHistory.length;
      avg.y /= movementHistory.length;
      
      const variance = movementHistory.reduce(
        (sum, p) => sum + Math.pow(p.x - avg.x, 2) + Math.pow(p.y - avg.y, 2),
        0
      ) / movementHistory.length;
      
      // Scale variance to a readable fidget score (0 - 100)
      metrics.fidgetFactor = Math.min(100, Math.sqrt(variance) * 5000);
    }

    // Context Awareness: Check if eye orientation is looking down AND neck is bent
    const avgIrisYRatio = (leftIrisRatio + rightIrisRatio) / 2;
    if (avgIrisYRatio > 0.60 && metrics.neckAngle > 20) {
      metrics.isWritingMode = true;
    }

    // Determine Posture State (Heuristic proxy for future ML Model)
    if (metrics.isWritingMode || isManualWritingMode) {
      metrics.state = 'WRITING';
      metrics.isWritingMode = true;
    } else if (
      metrics.neckAngle > 20 || 
      metrics.shoulderTilt > 7 || 
      metrics.slouchAngle > 15 || 
      metrics.eyeDistanceCm < 45
    ) {
      metrics.state = 'BAD_POSTURE';
    } else {
      metrics.state = 'GOOD_POSTURE';
    }
  }

  return metrics;
}

// Multi-Sensor Fusion Engine: Combines Front (PC) and Aux Side (Phone) camera metrics
export function fusePostureMetrics(
  frontMetrics: PostureMetrics,
  auxMetrics: PostureMetrics | null,
  isAuxActive: boolean
): PostureMetrics {
  // If phone camera is disconnected, inactive, or null, fall back 100% to PC front camera instantly
  if (!isAuxActive || !auxMetrics) {
    return { ...frontMetrics };
  }

  // 1. Fused Slouch Angle (Góc Lưng):
  // Front camera detects vertical torso foreshortening (compression).
  // Phone side camera measures true thoracic spine curvature (ear-shoulder-hip angle).
  // Blend with adaptive weights:
  let fusedSlouch: number;
  if (auxMetrics.slouchAngle > 15 || frontMetrics.slouchAngle > 15) {
    fusedSlouch = frontMetrics.slouchAngle * 0.35 + auxMetrics.slouchAngle * 0.65;
  } else {
    fusedSlouch = frontMetrics.slouchAngle * 0.45 + auxMetrics.slouchAngle * 0.55;
  }

  // 2. Fused Neck Angle (Góc Cổ):
  // Front camera detects chin-drop / vertical shortening.
  // Phone side camera detects forward head posture (craniocervical flexion).
  let fusedNeck: number;
  if (frontMetrics.isWritingMode || auxMetrics.isWritingMode) {
    fusedNeck = Math.min(frontMetrics.neckAngle, auxMetrics.neckAngle);
  } else {
    fusedNeck = frontMetrics.neckAngle * 0.45 + auxMetrics.neckAngle * 0.55;
  }

  // 3. Fused Shoulder Tilt (Nghiêng Vai):
  // Front camera is coronal plane (authoritative for 2D height diff: 80% weight).
  // Side camera provides minor rotation guidance (20% weight).
  const fusedShoulder = frontMetrics.shoulderTilt * 0.8 + auxMetrics.shoulderTilt * 0.2;

  // 4. Writing Mode Context:
  const isWriting = frontMetrics.isWritingMode || (auxMetrics.isWritingMode && frontMetrics.neckAngle > 15);

  // 5. Posture State Classification from Fused Metrics:
  let state: PostureState = 'GOOD_POSTURE';
  if (isWriting) {
    state = 'WRITING';
  } else if (
    fusedNeck > 20 ||
    fusedShoulder > 7 ||
    fusedSlouch > 15 ||
    frontMetrics.eyeDistanceCm < 45
  ) {
    state = 'BAD_POSTURE';
  }

  return {
    ...frontMetrics, // maintains eyeDistanceCm, earValue, isBlinking, fidgetFactor from Front FaceMesh
    neckAngle: Math.round(fusedNeck * 10) / 10,
    slouchAngle: Math.round(fusedSlouch * 10) / 10,
    shoulderTilt: Math.round(fusedShoulder * 10) / 10,
    isWritingMode: isWriting,
    state,
    timestamp: Date.now(),
  };
}

// Posture health score logic (0 - 100)
export function calculateHealthScore(metrics: PostureMetrics): number {
  // Deduct points for deviations from standard postures
  let score = 100;

  // Neck tilt deductions (Threshold: normal 0-15 deg, danger >20 deg)
  if (!metrics.isWritingMode) {
    if (metrics.neckAngle > 15) {
      const diff = metrics.neckAngle - 15;
      score -= diff * 1.5; // deduct 1.5 points per degree of neck tilt
    }
  }

  // Shoulder tilt deductions (Threshold: normal 0-5 deg, danger >7 deg)
  if (metrics.shoulderTilt > 5) {
    const diff = metrics.shoulderTilt - 5;
    score -= diff * 2.0;
  }

  // Hunchback/slouch deductions (Threshold: normal 0-10 deg, danger >15 deg)
  if (metrics.slouchAngle > 10) {
    const diff = metrics.slouchAngle - 10;
    score -= diff * 2.0;
  }

  // Screen distance deductions (Threshold: normal 50-70cm, danger <50cm)
  if (metrics.eyeDistanceCm < 50) {
    const diff = 50 - metrics.eyeDistanceCm;
    score -= diff * 3.0; // severe penalty for getting too close
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
