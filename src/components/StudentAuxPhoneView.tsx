// StudentAuxPhoneView — Task F (phone-side aux camera UI)
//
// Rendered by StudentView when:
//   • this device is mobile (useMediaQuery maxWidth:768), AND
//   • another device on the same user account is a desktop
//     (otherActiveDevices.some(d => d.isDesktop))
//
// OR when the user manually toggled into aux mode via the banner.
//
// Replaces the regular student dashboard with a focused aux-camera
// screen: rear-facing camera → MediaPipe Pose → broadcast landmarks
// to the desktop over the existing parentSync channel. The desktop
// then renders the skeleton in the right half of its camera card.
//
// All text uses i18n keys (student.auxTitle, auxDesc, auxStartBtn,
// auxStopBtn, auxWaiting, auxFps, auxConnected, auxBack). Theme is
// token-driven via StudentAuxPhoneView.module.css so light/dark +
// student palette stay in sync per the constitution.

import React, { useRef, useEffect, useState } from 'react';
import { SwitchCamera } from 'lucide-react';
import { usePostureContext } from '../contexts/PostureContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuxCamera } from '../hooks/useAuxCamera';
import styles from './StudentAuxPhoneView.module.css';

interface Props {
  /** Called when the user taps "Back to dashboard". */
  onExit: () => void;
}

export const StudentAuxPhoneView: React.FC<Props> = ({ onExit }) => {
  const { ownDeviceId, otherActiveDevices } = usePostureContext();
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const {
    isLoading,
    error,
    isModelReady,
    isStreaming,
    broadcastFps,
    facingMode,
    startCamera,
    stopCamera,
    switchFacingMode,
  } = useAuxCamera(ownDeviceId);

  const desktopActive = otherActiveDevices.some((d) => d.isDesktop);
  // Track the last time we saw the desktop as active. Used to give an
  // 8s grace period before force-stopping the aux camera when the
  // presence flap drops desktopActive=false for a heartbeat. Without
  // this, a single delayed presence ping would kill the aux stream
  // mid-session even though the desktop is still alive.
  const lastDesktopSeenRef = useRef<number>(Date.now());
  useEffect(() => {
    if (desktopActive) lastDesktopSeenRef.current = Date.now();
  }, [desktopActive]);
  // Local state so the JSX can re-render when the grace timer fires.
  const [graceActive, setGraceActive] = useState<boolean>(false);

  // Stop the aux camera if the desktop goes away for more than 8s
  // while streaming — no point burning battery broadcasting into the
  // void. The 8s grace absorbs presence-ping flap; if the desktop is
  // truly gone, we still stop.
  useEffect(() => {
    if (!isStreaming) return;
    if (desktopActive) {
      setGraceActive(false);
      return;
    }
    setGraceActive(true);
    const elapsed = Date.now() - lastDesktopSeenRef.current;
    const remaining = Math.max(0, 8000 - elapsed);
    const timer = window.setTimeout(() => {
      // Re-check inside the timeout in case presence came back.
      const stillGone = Date.now() - lastDesktopSeenRef.current >= 8000;
      if (stillGone) {
        stopCamera();
        setGraceActive(false);
      }
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      setGraceActive(false);
    };
  }, [desktopActive, isStreaming, stopCamera]);

  // Cleanup on unmount: ensure camera tracks are released.
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleStart = () => {
    if (videoRef.current) startCamera(videoRef.current);
  };

  const handleSwitch = () => {
    void switchFacingMode();
  };

  // Translate the hook's error codes into human strings. The hook
  // returns either a literal code ('camera_playback_failed',
  // 'Camera permission denied', 'Could not access rear/front camera',
  // 'Failed to load Pose model') — codes get mapped to i18n, anything
  // else is shown verbatim.
  const errorText = error === 'camera_playback_failed'
    ? t('student.auxPlaybackFailed')
    : error;

  const statusText = !isModelReady || isLoading
    ? t('student.auxWaiting')
    : errorText
    ? errorText
    : isStreaming
    ? (graceActive
        ? t('student.auxWaiting')
        : (desktopActive ? t('student.auxConnected') : t('student.auxWaiting')))
    : t('student.auxWaiting');

  const statusDotClass = isStreaming && desktopActive && !graceActive
    ? styles.dotConnected
    : isStreaming
    ? styles.dotWaiting
    : styles.dotIdle;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>{t('student.auxTitle')}</div>
        <div className={styles.desc}>{t('student.auxDesc')}</div>
      </div>

      <div className={styles.cameraCard}>
        <div className={styles.cameraWrapper}>
          {errorText ? (
            <div className={styles.errorBox}>
              <span>{errorText}</span>
            </div>
          ) : null}
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            autoPlay
            playsInline
            muted
          />
          {!isStreaming && !errorText && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>📱</div>
              <div className={styles.placeholderText}>{t('student.auxWaiting')}</div>
            </div>
          )}
          {/* Camera face indicator overlay — shows which lens is
              active so the user knows whether they're on rear or
              front before / after flipping. */}
          {isStreaming && (
            <div className={styles.cameraFaceBadge}>
              {facingMode === 'environment' ? t('student.auxCameraRear') : t('student.auxCameraFront')}
            </div>
          )}
        </div>

        <div className={styles.actionRow}>
          {!isStreaming ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnStart}`}
              onClick={handleStart}
              disabled={!isModelReady || isLoading}
            >
              {t('student.auxStartBtn')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnStop}`}
                onClick={stopCamera}
              >
                {t('student.auxStopBtn')}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSwitch}`}
                onClick={handleSwitch}
                aria-label={t('student.auxCameraSwitch')}
                title={t('student.auxCameraSwitch')}
              >
                <SwitchCamera size={18} />
                <span className={styles.btnSwitchLabel}>
                  {facingMode === 'environment' ? t('student.auxCameraFront') : t('student.auxCameraRear')}
                </span>
              </button>
            </>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnExit}`}
            onClick={onExit}
          >
            {t('student.auxBack')}
          </button>
        </div>
      </div>

      <div className={styles.statsCard}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>{t('student.auxFps')}</div>
          <div className={styles.statValue}>{broadcastFps}</div>
          <div className={styles.statSub}>landmarks / s</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>{t('student.auxStatus')}</div>
          <div className={styles.statValue}>
            <span className={`${styles.dot} ${statusDotClass}`} />
            {isStreaming ? '●' : '○'}
          </div>
          <div className={styles.statSub}>{statusText}</div>
        </div>
      </div>
    </div>
  );
};

export default StudentAuxPhoneView;
