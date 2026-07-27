// Calibration Component for setting baseline student landmarks

import React, { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Camera, CheckCircle, HelpCircle } from 'lucide-react';
import type { Landmark, CalibrationData } from '../services/postureAI';
import { saveCalibration } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';

interface CalibrationProps {
  poseLandmarks: Landmark[] | null;
  faceLandmarks: Landmark[] | null;
  onCalibrationComplete: (data: CalibrationData) => void;
  isModelReady: boolean;
}

export const Calibration: React.FC<CalibrationProps> = ({
  poseLandmarks,
  faceLandmarks,
  onCalibrationComplete,
  isModelReady,
}) => {
  const { t } = useLanguage();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [step, setStep] = useState<'idle' | 'counting' | 'saving' | 'complete'>('idle');
  const [countdown, setCountdown] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (step === 'counting') {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        performCalibration();
      }
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const startCalibration = () => {
    if (!isModelReady || !poseLandmarks || !faceLandmarks) {
      setError(t('calibration.errorModelNotReady'));
      return;
    }
    setError(null);
    setCountdown(3);
    setStep('counting');
  };

  const performCalibration = () => {
    if (!poseLandmarks || !faceLandmarks || poseLandmarks.length < 13 || faceLandmarks.length < 363) {
      setError(t('calibration.errorNoFace'));
      setStep('idle');
      return;
    }

    try {
      const nose = poseLandmarks[0];
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const headTop = faceLandmarks[10] || nose;

      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };

      // 1. Base Eye distance in pixels
      const leftEyeOuter = faceLandmarks[33];
      const leftEyeInner = faceLandmarks[133];
      const rightEyeInner = faceLandmarks[362];
      const rightEyeOuter = faceLandmarks[263];

      const leftEyeCenter = {
        x: (leftEyeOuter.x + leftEyeInner.x) / 2,
        y: (leftEyeOuter.y + leftEyeInner.y) / 2,
      };
      const rightEyeCenter = {
        x: (rightEyeInner.x + rightEyeOuter.x) / 2,
        y: (rightEyeInner.y + rightEyeOuter.y) / 2,
      };

      // We assume standard canvas size of 640x480 for calculation scaling
      const baseEyeDistance = Math.sqrt(
        Math.pow(leftEyeCenter.x - rightEyeCenter.x, 2) + Math.pow(leftEyeCenter.y - rightEyeCenter.y, 2)
      ) * 640;

      // 2. Base Neck Offset (vertical length)
      const baseNeckYOffset = (shoulderMid.y - nose.y) * 480;

      // 3. Base Shoulder height difference
      const baseShoulderYDiff = Math.abs(leftShoulder.y - rightShoulder.y) * 480;

      // 4. Base Torso Height (head top to shoulders)
      const baseTorsoHeight = (shoulderMid.y - headTop.y) * 480;

      // 5. Base Eye Aspect Ratio (EAR)
      // EAR = average left/right EAR
      const calculateEARLocal = (p1: Landmark, p2: Landmark, p3: Landmark, p4: Landmark, p5: Landmark, p6: Landmark) => {
        const v1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
        const v2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
        const h = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));
        return h === 0 ? 0 : (v1 + v2) / (2.0 * h);
      };

      const leftEAR = calculateEARLocal(
        faceLandmarks[133], faceLandmarks[159], faceLandmarks[158],
        faceLandmarks[33], faceLandmarks[145], faceLandmarks[153]
      );
      const rightEAR = calculateEARLocal(
        faceLandmarks[362], faceLandmarks[386], faceLandmarks[385],
        faceLandmarks[263], faceLandmarks[374], faceLandmarks[380]
      );

      const baseEAR = (leftEAR + rightEAR) / 2;

      const calibrationData: CalibrationData = {
        baseEyeDistance: Math.max(40, baseEyeDistance),
        baseNeckYOffset: Math.max(50, baseNeckYOffset),
        baseShoulderYDiff,
        baseTorsoHeight: Math.max(100, baseTorsoHeight),
        baseEAR: Math.max(0.18, baseEAR),
      };

      saveCalibration(calibrationData);
      setStep('complete');
      setTimeout(() => {
        onCalibrationComplete(calibrationData);
      }, 1000);
    } catch (e) {
      console.error(e);
      setError(t('calibration.errorCompute'));
      setStep('idle');
    }
  };

  return (
    <div
      className="glass-card fade-in"
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '512px',
        margin: '24px auto',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--secondary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--secondary)',
          marginBottom: '16px',
        }}
      >
        <Camera size={32} />
      </div>

      <h2
        style={{
          fontSize: '24px',
          fontWeight: 800,
          color: 'var(--text-main)',
          marginBottom: '8px',
        }}
      >
        {t('calibration.title')}
      </h2>
      <p
        style={{
          color: 'var(--text-secondary)',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}
      >
        {t('calibration.desc')}
        <br />
        <strong style={{ color: 'var(--secondary)' }}>{t('calibration.step1')}</strong>
        <br />
        <strong style={{ color: 'var(--secondary)' }}>{t('calibration.step2')}</strong>
      </p>

      {step === 'idle' && (
        <button
          onClick={startCalibration}
          disabled={!isModelReady}
          style={
            isModelReady
              ? {
                  padding: '12px 32px',
                  borderRadius: 'var(--radius-lg)',
                  fontWeight: 700,
                  background: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderBottom: '4px solid var(--primary-dark)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-glow-primary)',
                  transition: 'transform 80ms ease, box-shadow 0.2s',
                }
              : {
                  padding: '12px 32px',
                  borderRadius: 'var(--radius-lg)',
                  fontWeight: 700,
                  background: 'var(--bg-card-hover)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  cursor: 'not-allowed',
                }
          }
        >
          {isModelReady ? t('calibration.startBtn') : t('calibration.loadingModel')}
        </button>
      )}

      {step === 'counting' && (
        <div
          style={{
            fontSize: '64px',
            fontWeight: 900,
            color: 'var(--secondary)',
            animation: 'subtle-pulse 1s ease-in-out infinite',
          }}
        >
          {countdown}
        </div>
      )}

      {step === 'complete' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'var(--secondary)',
          }}
        >
          <CheckCircle size={48} style={{ animation: 'float 3s ease-in-out infinite', marginBottom: '8px' }} />
          <span style={{ fontWeight: 600, fontSize: '18px' }}>{t('calibration.completeMsg')}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '14px',
            border: '1px solid var(--danger)',
            textAlign: 'left',
          }}
        >
          {error}
        </div>
      )}

      {/* Privacy note — hidden on mobile per the spec (space is tight on
          a small phone and the note is repeated in the desktop Settings /
          parent-sync guide). The step1/step2 instructions above stay. */}
      {!isMobile && (
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'var(--bg-card-hover)',
            padding: '12px',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'left',
          }}
        >
          <HelpCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>{t('calibration.privacyNote')}</span>
        </div>
      )}
    </div>
  );
};
export default Calibration;
