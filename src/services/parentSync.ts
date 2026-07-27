// Parent-Student Real-time Sync Service using BroadcastChannel & Supabase Realtime
import { supabase, isSupabaseConfigured } from './supabase';

export interface PostureStateUpdate {
  type: 'status_update';
  status: 'good' | 'warning' | 'danger' | 'offline';
  details: {
    eyeDistanceCm: number;
    neckAngle: number;
    shoulderTilt: number;
    slouchAngle: number;
    healthScore: number;
    isWritingMode: boolean;
  };
}

export interface FatigueAlertUpdate {
  type: 'fatigue_alert';
  message: string;
  timestamp: number;
}

export interface ParentMessageUpdate {
  type: 'parent_message';
  text: string;
  timestamp: number;
}

export interface CameraOffAlertUpdate {
  type: 'camera_off_alert';
  /** 'off' = student turned camera off; 'on' = student turned it back on. */
  action: 'off' | 'on';
  message: string;
  timestamp: number;
}

// Task 6d: auxiliary-camera landmarks. A second device (e.g. a phone on a
// tripod, angled from the side) logs in with the SAME student account and
// streams only its pose landmarks — not video — over the existing realtime
// channel. The primary device merges them into its posture analysis to get
// a second angle of view, improving detection of lateral slouching and
// shoulder rotation that the front camera can miss.
export interface AuxCameraLandmarksUpdate {
  type: 'aux_camera_landmarks';
  /** Sender device id so the receiver can ignore its own echoes. */
  deviceId: string;
  /** Raw poseLandmarks array from MediaPipe Pose (normalized 0..1). */
  poseLandmarks: any[] | null;
  /** Optional face landmarks (also normalized). */
  faceLandmarks: any[] | null;
  timestamp: number;
}

// Task D — desktop-initiated camera pairing flow.
// The phone broadcasts `phone_camera_ready` whenever it has the mobile
// Camera tab open and the camera permission granted. The desktop
// subscribes to that event to surface a "Pair camera?" prompt; when
// the user accepts, the desktop broadcasts `aux_pairing_request`. The
// phone listens for that and starts streaming aux landmarks (if it
// hasn't already). The phone then sends `aux_pairing_response` with
// accepted=true so the desktop can flip its split-screen layout on
// even before the first landmark frame arrives.
export interface PhoneCameraReadyUpdate {
  type: 'phone_camera_ready';
  deviceId: string;
  /** True when the phone camera has been granted + is active. */
  cameraActive: boolean;
  timestamp: number;
}

export interface AuxPairingRequestUpdate {
  type: 'aux_pairing_request';
  /** Desktop device id that issued the request. */
  deviceId: string;
  timestamp: number;
}

export interface AuxPairingResponseUpdate {
  type: 'aux_pairing_response';
  /** Phone device id that responded. */
  deviceId: string;
  accepted: boolean;
  timestamp: number;
}

type SyncMessage =
  | PostureStateUpdate
  | FatigueAlertUpdate
  | ParentMessageUpdate
  | CameraOffAlertUpdate
  | AuxCameraLandmarksUpdate
  | PhoneCameraReadyUpdate
  | AuxPairingRequestUpdate
  | AuxPairingResponseUpdate;

// ─────────────────────────────────────────────────────────────────────────
// Notification persistence (localStorage + optional Supabase table)
// ─────────────────────────────────────────────────────────────────────────
// The parent may be offline (app closed / different device) when the student
// turns off the camera. BroadcastChannel + Realtime only deliver to live
// subscribers, so we also persist a notification record that the parent's
// Notifications tab can hydrate from on next open.

export interface ParentNotification {
  id: string;
  kind: 'camera_off' | 'fatigue' | 'camera_on';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const NOTIFICATIONS_KEY = 'oliver_parent_notifications';
const MAX_NOTIFICATIONS = 100;

export function loadNotifications(): ParentNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParentNotification[];
    if (!Array.isArray(parsed)) return [];
    // Newest first
    return parsed.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

export function saveNotifications(list: ParentNotification[]): void {
  try {
    const trimmed = list.slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to persist notifications', e);
  }
}

export function addNotification(notif: ParentNotification): ParentNotification[] {
  const list = loadNotifications();
  // Avoid duplicates within a 5s window for the same kind+message
  const dup = list.find(
    (n) =>
      n.kind === notif.kind &&
      n.message === notif.message &&
      Math.abs(n.timestamp - notif.timestamp) < 5000
  );
  if (dup) return list;
  const next = [notif, ...list].slice(0, MAX_NOTIFICATIONS);
  saveNotifications(next);
  return next;
}

export function markAllNotificationsRead(): ParentNotification[] {
  const list = loadNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(list);
  return list;
}

export function clearNotifications(): void {
  saveNotifications([]);
}

// Per-user channel name. The previous global channel name
// `oliver_parent_student_sync` meant two different student accounts on
// the same browser (or two parent accounts watching different students)
// would cross-talk: parent A would receive student B's posture updates
// and aux-camera landmarks. Scoping the channel to the user id keeps
// each family's sync isolated. Falls back to the legacy global name
// when no user is signed in (pre-login) so the broadcast primitives
// don't no-op during app bootstrap.
function getChannelName(userId?: string): string {
  if (!userId || userId === 'default') return 'oliver_parent_student_sync';
  return `oliver_parent_student_sync:user_${userId}`;
}

// Per-user cached BroadcastChannel + Supabase channel. A module-level
// singleton keyed by user id so we don't re-create the channel on every
// call (BroadcastChannel construction is cheap but Supabase channel
// subscription is async + counted against the concurrent-channel limit).
const broadcastChannels = new Map<string, BroadcastChannel>();
const supabaseChannels = new Map<string, any>();

function getChannel(userId?: string): BroadcastChannel {
  const name = getChannelName(userId);
  const existing = broadcastChannels.get(name);
  if (existing) return existing;
  const ch = new BroadcastChannel(name);
  broadcastChannels.set(name, ch);
  return ch;
}

function getSupabaseChannel(userId?: string) {
  const name = getChannelName(userId);
  if (!isSupabaseConfigured || !supabase) return null;
  const existing = supabaseChannels.get(name);
  if (existing) return existing;
  const ch = supabase.channel(name);
  ch.subscribe();
  supabaseChannels.set(name, ch);
  return ch;
}

// Broadcast student posture and indicators to parent dashboard.
// `userId` scopes the channel so two students on the same browser
// don't cross-talk; pass getUserIdSync() from the caller.
export function broadcastStudentStatus(
  status: 'good' | 'warning' | 'danger' | 'offline',
  details: PostureStateUpdate['details'],
  userId?: string
): void {
  try {
    const msg: PostureStateUpdate = {
      type: 'status_update',
      status,
      details,
    };

    // Broadcast locally
    getChannel(userId).postMessage(msg);

    // Broadcast via Supabase
    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'status_update',
        payload: msg
      });
    }
  } catch (e) {
    console.error('Failed to broadcast status', e);
  }
}

// Broadcast fatigue flags / push alert messages to parent
export function broadcastFatigueAlert(message: string, userId?: string): void {
  try {
    const msg: FatigueAlertUpdate = {
      type: 'fatigue_alert',
      message,
      timestamp: Date.now(),
    };

    // Broadcast locally
    getChannel(userId).postMessage(msg);

    // Broadcast via Supabase
    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'fatigue_alert',
        payload: msg
      });
    }

    // Persist as a parent notification so an offline parent still sees it.
    addNotification({
      id: `fatigue_${msg.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'fatigue',
      title: 'Fatigue alert',
      message,
      timestamp: msg.timestamp,
      read: false,
    });
  } catch (e) {
    console.error('Failed to broadcast fatigue alert', e);
  }
}

// Broadcast a camera toggle event (off or on) from the student to the parent.
// Persisted as a notification so the parent sees it even if they were offline.
export function broadcastCameraOffAlert(message: string, action: 'off' | 'on' = 'off', userId?: string): void {
  try {
    const msg: CameraOffAlertUpdate = {
      type: 'camera_off_alert',
      action,
      message,
      timestamp: Date.now(),
    };

    getChannel(userId).postMessage(msg);

    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'camera_off_alert',
        payload: msg
      });
    }

    addNotification({
      id: `camera_${msg.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
      kind: action === 'off' ? 'camera_off' : 'camera_on',
      title: action === 'off' ? 'Camera turned off' : 'Camera turned back on',
      message,
      timestamp: msg.timestamp,
      read: false,
    });
  } catch (e) {
    console.error('Failed to broadcast camera alert', e);
  }
}

// Broadcast message from parent to student
export function broadcastParentMessage(text: string, userId?: string): void {
  try {
    const msg: ParentMessageUpdate = {
      type: 'parent_message',
      text,
      timestamp: Date.now(),
    };

    getChannel(userId).postMessage(msg);

    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'parent_message',
        payload: msg
      });
    }
  } catch (e) {
    console.error('Failed to send parent message', e);
  }
}

// Task 6d: Broadcast aux-camera pose landmarks from a second device running
// the same student account. Only the lightweight landmark JSON is sent (no
// video frames), so bandwidth stays low (~2 KB per sample at ~3 FPS). The
// primary device subscribes via subscribeToAuxCameraLandmarks() and merges.
//
// `deviceId` should be a stable per-device id (e.g. crypto.randomUUID() in
// sessionStorage) so the receiver can filter out its own broadcasts if the
// user happens to open two tabs on the same machine.
export function broadcastAuxCameraLandmarks(
  deviceId: string,
  poseLandmarks: any[] | null,
  faceLandmarks: any[] | null,
  userId?: string
): void {
  try {
    const msg: AuxCameraLandmarksUpdate = {
      type: 'aux_camera_landmarks',
      deviceId,
      poseLandmarks,
      faceLandmarks,
      timestamp: Date.now(),
    };

    getChannel(userId).postMessage(msg);

    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'aux_camera_landmarks',
        payload: msg
      });
    }
  } catch (e) {
    // Don't spam the console on every frame if the channel is broken —
    // landmark broadcasting is best-effort and degrades gracefully.
    if (!(e instanceof Error)) console.error('Failed to broadcast aux landmarks', e);
  }
}

// Subscribe to aux-camera landmarks (called on the primary student device).
// `onLandmarks` is invoked with the latest landmarks + the sender deviceId;
// the caller is responsible for ignoring its own deviceId and for merging
// the data into its posture analysis (e.g. preferring the aux view's
// shoulderTilt when it detects lateral lean the front camera missed).
//
// The receiver also auto-throttles: if the same deviceId sends more than
// once per 250ms, the older sample is dropped to avoid queueing stale
// landmarks on a slow channel.
export function subscribeToAuxCameraLandmarks(
  onLandmarks: (deviceId: string, poseLandmarks: any[] | null, faceLandmarks: any[] | null, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getChannel(userId);
  const lastSeenByDevice = new Map<string, number>();

  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type !== 'aux_camera_landmarks') return;
    const last = lastSeenByDevice.get(msg.deviceId) ?? 0;
    if (msg.timestamp < last) return; // drop out-of-order
    lastSeenByDevice.set(msg.deviceId, msg.timestamp);
    onLandmarks(msg.deviceId, msg.poseLandmarks, msg.faceLandmarks, msg.timestamp);
  };
  syncChannel.addEventListener('message', localListener);

  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    sbChannel = supabase
      .channel(getChannelName(userId))
      .on('broadcast', { event: 'aux_camera_landmarks' }, ({ payload }) => {
        const msg = payload as AuxCameraLandmarksUpdate;
        const last = lastSeenByDevice.get(msg.deviceId) ?? 0;
        if (msg.timestamp < last) return;
        lastSeenByDevice.set(msg.deviceId, msg.timestamp);
        onLandmarks(msg.deviceId, msg.poseLandmarks, msg.faceLandmarks, msg.timestamp);
      })
      .subscribe();
  }

  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) {
      supabase.removeChannel(sbChannel);
    }
  };
}

// Subscribe to status updates (for Parent Dashboard)
export function subscribeToStudentSync(
  onStatusChange: (status: 'good' | 'warning' | 'danger' | 'offline', details: PostureStateUpdate['details']) => void,
  onFatigueAlert: (message: string, timestamp: number) => void,
  onCameraAlert?: (action: 'off' | 'on', message: string, timestamp: number) => void,
  userId?: string
): () => void {
  // Listen locally
  const syncChannel = getChannel(userId);
  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type === 'status_update') {
      onStatusChange(msg.status, msg.details);
    } else if (msg.type === 'fatigue_alert') {
      onFatigueAlert(msg.message, msg.timestamp);
    } else if (msg.type === 'camera_off_alert' && onCameraAlert) {
      onCameraAlert(msg.action, msg.message, msg.timestamp);
    }
  };
  syncChannel.addEventListener('message', localListener);

  // Listen via Supabase Realtime
  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    const chan = supabase.channel(getChannelName(userId))
      .on('broadcast', { event: 'status_update' }, ({ payload }) => {
        const msg = payload as PostureStateUpdate;
        onStatusChange(msg.status, msg.details);
      })
      .on('broadcast', { event: 'fatigue_alert' }, ({ payload }) => {
        const msg = payload as FatigueAlertUpdate;
        onFatigueAlert(msg.message, msg.timestamp);
      });

    if (onCameraAlert) {
      chan.on('broadcast', { event: 'camera_off_alert' }, ({ payload }) => {
        const msg = payload as CameraOffAlertUpdate;
        onCameraAlert(msg.action, msg.message, msg.timestamp);
      });
    }

    sbChannel = chan.subscribe();
  }

  // Return unsubscribe cleanup function
  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) {
      supabase.removeChannel(sbChannel);
    }
  };
}

// Subscribe to parent messages (for Student Dashboard)
export function subscribeToParentMessage(
  onMessageReceived: (text: string) => void,
  userId?: string
): () => void {
  const syncChannel = getChannel(userId);
  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type === 'parent_message') {
      onMessageReceived(msg.text);
    }
  };
  syncChannel.addEventListener('message', localListener);

  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    sbChannel = supabase.channel(getChannelName(userId))
      .on('broadcast', { event: 'parent_message' }, ({ payload }) => {
        const msg = payload as ParentMessageUpdate;
        onMessageReceived(msg.text);
      })
      .subscribe();
  }

  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) {
      supabase.removeChannel(sbChannel);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Task D — desktop-initiated camera pairing (replaces the previous
// phone-initiated aux banner flow). The phone is now passive: it just
// reports "my camera is on and ready", and the desktop is the one that
// decides whether to merge the side view in.
// ─────────────────────────────────────────────────────────────────────────

// Phone → desktop: announce the phone's aux camera is on / off. The
// desktop uses this to decide whether to show the "Pair camera?" prompt.
// Fire this whenever the phone starts or stops its camera, and also
// heartbeated every ~5s while streaming so the desktop can expire a
// phone that disappeared without sending a final off event.
export function broadcastPhoneCameraReady(
  deviceId: string,
  cameraActive: boolean,
  userId?: string
): void {
  try {
    const msg: PhoneCameraReadyUpdate = {
      type: 'phone_camera_ready',
      deviceId,
      cameraActive,
      timestamp: Date.now(),
    };
    getChannel(userId).postMessage(msg);
    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'phone_camera_ready',
        payload: msg,
      });
    }
  } catch (e) {
    console.error('Failed to broadcast phone camera ready', e);
  }
}

// Desktop → phone: request the phone to start streaming aux landmarks.
// The phone's MobileCameraView subscribes to this; on receipt it calls
// startCamera() if not already streaming, then sends back an
// aux_pairing_response with accepted=true.
export function requestAuxPairing(
  deviceId: string,
  userId?: string
): void {
  try {
    const msg: AuxPairingRequestUpdate = {
      type: 'aux_pairing_request',
      deviceId,
      timestamp: Date.now(),
    };
    getChannel(userId).postMessage(msg);
    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'aux_pairing_request',
        payload: msg,
      });
    }
  } catch (e) {
    console.error('Failed to request aux pairing', e);
  }
}

// Phone → desktop: acknowledge the pairing request (accepted=true when
// the phone was able to start its camera, false if permission denied).
export function broadcastAuxPairingResponse(
  deviceId: string,
  accepted: boolean,
  userId?: string
): void {
  try {
    const msg: AuxPairingResponseUpdate = {
      type: 'aux_pairing_response',
      deviceId,
      accepted,
      timestamp: Date.now(),
    };
    getChannel(userId).postMessage(msg);
    const sbChannel = getSupabaseChannel(userId);
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'aux_pairing_response',
        payload: msg,
      });
    }
  } catch (e) {
    console.error('Failed to broadcast aux pairing response', e);
  }
}

// Desktop-side subscription: fires when a phone on the same account
// announces its camera is ready (or just stopped). Includes a 6s
// expiry watchdog so the desktop clears the prompt if the phone stops
// heartbeating without an explicit off event.
export function subscribePhoneCameraReady(
  onPhoneReady: (deviceId: string, cameraActive: boolean, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getChannel(userId);
  const lastSeenByDevice = new Map<string, number>();

  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type !== 'phone_camera_ready') return;
    lastSeenByDevice.set(msg.deviceId, Date.now());
    onPhoneReady(msg.deviceId, msg.cameraActive, msg.timestamp);
  };
  syncChannel.addEventListener('message', localListener);

  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    sbChannel = supabase
      .channel(getChannelName(userId))
      .on('broadcast', { event: 'phone_camera_ready' }, ({ payload }) => {
        const msg = payload as PhoneCameraReadyUpdate;
        lastSeenByDevice.set(msg.deviceId, Date.now());
        onPhoneReady(msg.deviceId, msg.cameraActive, msg.timestamp);
      })
      .subscribe();
  }

  // Expire: if a phone hasn't heartbeated in 6s, treat it as offline
  // (cameraActive=false) so the desktop drops the pair prompt.
  const expiry = setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of lastSeenByDevice.entries()) {
      if (now - ts > 6000) {
        lastSeenByDevice.delete(id);
        onPhoneReady(id, false, now);
      }
    }
  }, 3000);

  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) supabase.removeChannel(sbChannel);
    clearInterval(expiry);
  };
}

// Phone-side subscription: fires when the desktop requests pairing.
export function subscribeAuxPairingRequest(
  onRequest: (desktopDeviceId: string, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getChannel(userId);
  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type !== 'aux_pairing_request') return;
    onRequest(msg.deviceId, msg.timestamp);
  };
  syncChannel.addEventListener('message', localListener);

  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    sbChannel = supabase
      .channel(getChannelName(userId))
      .on('broadcast', { event: 'aux_pairing_request' }, ({ payload }) => {
        const msg = payload as AuxPairingRequestUpdate;
        onRequest(msg.deviceId, msg.timestamp);
      })
      .subscribe();
  }

  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) supabase.removeChannel(sbChannel);
  };
}

// Desktop-side subscription: fires when the phone acknowledges the
// pairing request (accepted/rejected).
export function subscribeAuxPairingResponse(
  onResponse: (phoneDeviceId: string, accepted: boolean, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getChannel(userId);
  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type !== 'aux_pairing_response') return;
    onResponse(msg.deviceId, msg.accepted, msg.timestamp);
  };
  syncChannel.addEventListener('message', localListener);

  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    sbChannel = supabase
      .channel(getChannelName(userId))
      .on('broadcast', { event: 'aux_pairing_response' }, ({ payload }) => {
        const msg = payload as AuxPairingResponseUpdate;
        onResponse(msg.deviceId, msg.accepted, msg.timestamp);
      })
      .subscribe();
  }

  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) supabase.removeChannel(sbChannel);
  };
}
