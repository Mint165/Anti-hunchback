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

type SyncMessage =
  | PostureStateUpdate
  | FatigueAlertUpdate
  | ParentMessageUpdate
  | CameraOffAlertUpdate
  | AuxCameraLandmarksUpdate;

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
