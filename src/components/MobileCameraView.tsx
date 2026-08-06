// MobileCameraView — Task D.3 + E.3 (phone-side Camera tab)
//
// Replaces the entire student dashboard on mobile per the spec:
//   "Trên thiết bị di động chỉ cần có... camera có thể thay đổi trước
//   sau và căn chỉnh lần đầu vào web và có thể liên kết với cùng tài
//   khoản trên máy tính để chia đôi màn hình phần camera AI".
//
// The phone is passive in the new desktop-initiated pair flow:
//   1. Phone broadcasts phone_camera_ready whenever its camera is on
//      (heartbeated every 5s so the desktop can expire a phone that
//      disappeared without an explicit off event).
//   2. Desktop, on detecting the ready phone, shows a "Pair camera?"
//      prompt and — on accept — broadcasts aux_pairing_request.
//   3. This view subscribes to aux_pairing_request; on receipt it
//      auto-starts the camera (if not already running) and sends back
//      aux_pairing_response with accepted=true. From then on the
//      useAuxCamera hook broadcasts aux landmarks on every Pose frame,
//      which the desktop merges into its split-screen view.
//
// Calibration ("căn chỉnh lần đầu") is intentionally NOT re-implemented
// here — per the spec it is done on the web (desktop) side, where the
// front-facing camera + FaceMesh are available. The phone streams raw
// side-view landmarks; the desktop's existing calibration is reused.
//
// All text uses i18n keys. Theme is token-driven via the shared CSS
// variables so light/dark + student palette stay in sync per the
// constitution.

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SwitchCamera, Smartphone, CameraOff } from 'lucide-react';
import { usePostureContext } from '../contexts/PostureContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuxCamera } from '../hooks/useAuxCamera';
import {
  broadcastPhoneCameraReady,
  broadcastAuxPairingResponse,
  subscribeAuxPairingRequest,
} from '../services/parentSync';
import { getUserIdSync } from '../services/db';
import styles from './MobileCameraView.module.css';

export const MobileCameraView: React.FC = () => {
  const { ownDeviceId, otherActiveDevices, setIsAuxStreaming } = usePostureContext();
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

  // Track whether a desktop on the same account is currently active.
  // We surface this in the status row so the user knows whether the
  // stream is reaching anyone.
  const desktopActive = otherActiveDevices.some((d) => d.isDesktop);

  // Pair state: true once we've responded to a desktop pairing request
  // (or the desktop's aux landmarks subscription has started consuming
  // our broadcasts). Used only to flip the status text + badge.
  const [paired, setPaired] = useState<boolean>(false);

  // Heartbeat phone_camera_ready while streaming so the desktop can
  // expire us if we disappear. Also send an explicit off event when
  // streaming stops (either user-tapped stop or component unmount).
  //
  // We also broadcast a `cameraActive=false` heartbeat every 5s when a
  // desktop is detected but the camera isn't streaming yet (loading,
  // permission pending, or a previous `camera_playback_failed`). This
  // keeps the desktop's pair-prompt visible ("phone online, camera not
  // on yet") instead of silently dropping the phone off the desktop's
  // radar the moment the camera fails — which was the root cause of
  // the user never seeing the desktop-side "Đồng ý ghép đôi" prompt:
  // the phone's `phone_camera_ready` heartbeat only fired while
  // `isStreaming` was true, so any camera start failure left the
  // desktop with `phoneCameraReady=false` and the prompt never shown.
  useEffect(() => {
    const cameraActive = isStreaming;
    broadcastPhoneCameraReady(ownDeviceId, cameraActive, getUserIdSync());
    const hb = window.setInterval(() => {
      broadcastPhoneCameraReady(ownDeviceId, isStreamingRef.current, getUserIdSync());
    }, 1500);
    return () => {
      clearInterval(hb);
      if (isStreamingRef.current) {
        broadcastPhoneCameraReady(ownDeviceId, false, getUserIdSync());
      }
    };
  }, [isStreaming, ownDeviceId, desktopActive]);

  // Also clear the paired flag when streaming stops — once we stop
  // broadcasting the desktop's aux landmark watcher will time out and
  // revert its split-screen, so our status should match.
  useEffect(() => {
    if (!isStreaming) setPaired(false);
  }, [isStreaming]);

  // Mirror `isStreaming` into the PostureContext's `isAuxStreaming` so
  // the presence tracker re-announces us with `isAux: true` while
  // we're streaming. Without this, the presence `isAux` flag stayed
  // false forever (the context's presence effect only ran on mount
  // with `isAux: false`) — contradicting the comment that claimed
  // "the phone sets this when it starts its camera". Other devices
  // therefore never saw us transition into the aux-streaming state.
  useEffect(() => {
    setIsAuxStreaming(isStreaming);
    return () => setIsAuxStreaming(false);
  }, [isStreaming, setIsAuxStreaming]);

  // Subscribe to aux_pairing_request from the desktop. On receipt:
  //   • if not streaming yet, auto-start the camera
  //   • send back aux_pairing_response with accepted=true (or false if
  //     startCamera failed / permission denied)
  //   • flip paired=true so the status row updates
  // We use a ref for the "is currently streaming" check inside the
  // callback so the subscription doesn't need to re-bind every time
  // streaming flips (which would drop mid-session events).
  const isStreamingRef = useRef<boolean>(isStreaming);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  useEffect(() => {
    const unsub = subscribeAuxPairingRequest((_desktopDeviceId) => {
      // Already streaming — just acknowledge.
      if (isStreamingRef.current && videoRef.current) {
        broadcastAuxPairingResponse(ownDeviceId, true, getUserIdSync());
        setPaired(true);
        return;
      }
      // Need to start the camera first. The hook's startCamera kicks
      // off getUserMedia + the rAF loop; we optimistically send
      // accepted=true if the model is ready and the video element is
      // mounted, then let the hook's error path surface failures via
      // the on-screen error box. If getUserMedia / play() ultimately
      // rejects, the desktop's aux-landmark watcher will simply not
      // see any frames, time out after 5s, and revert — and on this
      // side we'll flip `paired` back to false via the
      // `!isStreaming → setPaired(false)` effect below.
      //
      // If the model isn't ready yet OR there's no video element, we
      // send an explicit `accepted=false` so the desktop doesn't wait
      // the full 5s for landmarks that will never arrive — instead it
      // can surface "Phone camera failed to start, retry on mobile"
      // immediately.
      if (videoRef.current && isModelReady) {
        startCamera(videoRef.current);
        broadcastAuxPairingResponse(ownDeviceId, true, getUserIdSync());
        setPaired(true);
      } else {
        broadcastAuxPairingResponse(ownDeviceId, false, getUserIdSync());
      }
    }, getUserIdSync());
    return () => unsub();
  }, [ownDeviceId, isModelReady, startCamera]);

  // Cleanup on unmount: stop camera tracks + broadcast off so the
  // desktop's pair prompt disappears promptly.
  useEffect(() => {
    return () => {
      stopCamera();
      broadcastPhoneCameraReady(ownDeviceId, false, getUserIdSync());
    };
  }, [stopCamera, ownDeviceId]);

  const handleStart = useCallback(() => {
    if (videoRef.current) startCamera(videoRef.current);
  }, [startCamera]);

  const handleStop = useCallback(() => {
    stopCamera();
  }, [stopCamera]);

  const handleSwitch = useCallback(() => {
    void switchFacingMode();
  }, [switchFacingMode]);

  // Translate the hook's error codes into human strings (mirrors
  // StudentAuxPhoneView's mapping for consistency).
  const errorText = error === 'camera_playback_failed'
    ? t('student.auxPlaybackFailed')
    : error;

  const statusText = !isModelReady || isLoading
    ? t('student.auxWaiting')
    : errorText
    ? errorText
    : isStreaming
    ? (paired
        ? (desktopActive ? t('student.auxConnected') : t('student.mobileCameraPairWaiting'))
        : (desktopActive ? t('student.mobileCameraPairWaiting') : t('student.auxWaiting')))
    : t('student.auxWaiting');

  const statusDotClass = isStreaming && paired && desktopActive
    ? styles.dotConnected
    : isStreaming
    ? styles.dotWaiting
    : styles.dotIdle;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>{t('student.mobileCameraTitle')}</div>
        <div className={styles.desc}>{t('student.mobileCameraDesc')}</div>
      </div>

      <div className={styles.cameraCard}>
        <div className={styles.cameraWrapper}>
          {errorText ? (
            <div className={styles.errorBox}>
              <span>{errorText}</span>
              {/* Retry button — when the camera failed to start (the
                  common `camera_playback_failed` path on mobile), give
                  the user a one-tap way to re-atquire the stream
                  instead of leaving them stuck on the error box with
                  only the disabled "Bật camera" button below. */}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnStart}`}
                onClick={handleStart}
                disabled={!isModelReady || isLoading}
                style={{ marginTop: 8 }}
              >
                {t('student.mobileCameraRetryBtn')}
              </button>
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
              <CameraOff size={36} className={styles.placeholderIcon} />
              <div className={styles.placeholderText}>{t('student.auxWaiting')}</div>
            </div>
          )}
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
              {t('student.mobileCameraStartBtn')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnStop}`}
                onClick={handleStop}
              >
                {t('student.mobileCameraStopBtn')}
              </button>
              {/* Round front/back switch button — circle with two
                  arrows pointing at each other (SwitchCamera icon
                  matches the spec's "hình tròn với 2 mũi tên"). */}
              <button
                type="button"
                className={styles.btnSwitchRound}
                onClick={handleSwitch}
                aria-label={t('student.auxCameraSwitch')}
                title={t('student.auxCameraSwitch')}
              >
                <SwitchCamera size={22} />
              </button>
            </>
          )}
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

      {/* Pairing hint — only shown when a desktop is detected but the
          user hasn't started the camera yet. Acts as a gentle nudge to
          tap "Bật camera" so the desktop can see us as ready. */}
      {desktopActive && !isStreaming && (
        <div className={styles.pairHint} role="status">
          <Smartphone size={16} aria-hidden="true" />
          <span>{t('student.mobileCameraPairWaiting')}</span>
        </div>
      )}
    </div>
  );
};

export default MobileCameraView;
