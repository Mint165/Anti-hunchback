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

import React, { useRef, useEffect } from 'react';
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
    startCamera,
    stopCamera,
  } = useAuxCamera(ownDeviceId);

  const desktopActive = otherActiveDevices.some((d) => d.isDesktop);

  // Stop the aux camera if the desktop goes away while streaming —
  // no point burning battery broadcasting into the void.
  useEffect(() => {
    if (!desktopActive && isStreaming) {
      stopCamera();
    }
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

  const statusText = !isModelReady || isLoading
    ? t('student.auxWaiting')
    : error
    ? error
    : isStreaming
    ? (desktopActive ? t('student.auxConnected') : t('student.auxWaiting'))
    : t('student.auxWaiting');

  const statusDotClass = isStreaming && desktopActive
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
          {error ? (
            <div className={styles.errorBox}>
              <span>{error}</span>
            </div>
          ) : null}
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            autoPlay
            playsInline
            muted
          />
          {!isStreaming && !error && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>📱</div>
              <div className={styles.placeholderText}>{t('student.auxWaiting')}</div>
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
            <button
              type="button"
              className={`${styles.btn} ${styles.btnStop}`}
              onClick={stopCamera}
            >
              {t('student.auxStopBtn')}
            </button>
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
