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

export interface PostureMetrics {
  eyeDistanceCm: number;
  neckAngle: number;
  shoulderTilt: number;
  slouchAngle: number; // Back curvature proxy
  earValue: number;
  isBlinking: boolean;
  isWritingMode: boolean; // Context awareness: looking down + neck bent
  fidgetFactor: number;   // Variance of movements
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
  movementHistory: { x: number; y: number }[]
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
  if (poseLandmarks && poseLandmarks.length > 12) {
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
    
    // Neck angle proxy: comparing current vertical neck length with base neck length
    // Bending forward shrinks the vertical projection of the neck.
    const neckRatio = currentNeckOffset / calibration.baseNeckYOffset;
    metrics.neckAngle = Math.max(0, Math.min(90, (1 - neckRatio) * 90));

    // Torso height / slouched back proxy
    const currentTorsoHeight = (shoulderMid.y - headTop.y) * canvasHeight;
    const slouchRatio = currentTorsoHeight / calibration.baseTorsoHeight;
    metrics.slouchAngle = Math.max(0, Math.min(90, (1 - slouchRatio) * 85));

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
    // An average iris-to-lower-lid ratio > 0.75 indicates eyes looking downwards.
    const avgIrisYRatio = (leftIrisRatio + rightIrisRatio) / 2;
    if (avgIrisYRatio > 0.75 && metrics.neckAngle > 20) {
      metrics.isWritingMode = true;
    }
  }

  return metrics;
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
