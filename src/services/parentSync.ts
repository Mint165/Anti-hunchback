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

// Auxiliary-camera landmarks. A second device (e.g. phone on a tripod)
// streams its pose landmarks over realtime channel.
export interface AuxCameraLandmarksUpdate {
  type: 'aux_camera_landmarks';
  deviceId: string;
  poseLandmarks: any[] | null;
  faceLandmarks: any[] | null;
  timestamp: number;
}

export interface PhoneCameraReadyUpdate {
  type: 'phone_camera_ready';
  deviceId: string;
  cameraActive: boolean;
  timestamp: number;
}

export interface AuxPairingRequestUpdate {
  type: 'aux_pairing_request';
  deviceId: string;
  timestamp: number;
}

export interface AuxPairingResponseUpdate {
  type: 'aux_pairing_response';
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

// ─────────────────────────────────────────────────────────────────────────
// Channel & Realtime Multiplexing Infrastructure
// ─────────────────────────────────────────────────────────────────────────
function getChannelName(userId?: string): string {
  if (!userId || userId === 'default') return 'oliver_parent_student_sync';
  return `oliver_parent_student_sync:user_${userId}`;
}

const broadcastChannels = new Map<string, BroadcastChannel>();

function getBroadcastChannel(userId?: string): BroadcastChannel {
  const name = getChannelName(userId);
  const existing = broadcastChannels.get(name);
  if (existing) return existing;
  const ch = new BroadcastChannel(name);
  broadcastChannels.set(name, ch);
  return ch;
}

type EventListener<T = any> = (payload: T) => void;

interface RealtimeMultiplexer {
  channel: any;
  listeners: Map<string, Set<EventListener>>;
}

const supabaseMultiplexers = new Map<string, RealtimeMultiplexer>();

function getSupabaseMultiplexer(userId?: string): RealtimeMultiplexer | null {
  if (!isSupabaseConfigured || !supabase) return null;
  const channelName = getChannelName(userId);
  const existing = supabaseMultiplexers.get(channelName);
  if (existing) return existing;

  const listeners = new Map<string, Set<EventListener>>();
  const knownEvents = [
    'status_update',
    'fatigue_alert',
    'camera_off_alert',
    'parent_message',
    'aux_camera_landmarks',
    'phone_camera_ready',
    'aux_pairing_request',
    'aux_pairing_response',
  ];

  const ch = supabase.channel(channelName);

  // Register all event listeners BEFORE subscribing
  for (const ev of knownEvents) {
    listeners.set(ev, new Set());
    ch.on('broadcast', { event: ev }, ({ payload }: { payload: any }) => {
      const set = listeners.get(ev);
      if (set) {
        set.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error(`[realtime] listener error on ${ev}:`, err);
          }
        });
      }
    });
  }

  ch.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      console.info(`[realtime] subscribed to ${channelName}`);
    }
  });

  const mux: RealtimeMultiplexer = { channel: ch, listeners };
  supabaseMultiplexers.set(channelName, mux);
  return mux;
}

function subscribeToMuxEvent<T>(
  event: string,
  listener: EventListener<T>,
  userId?: string
): () => void {
  const mux = getSupabaseMultiplexer(userId);
  if (!mux) return () => {};

  let set = mux.listeners.get(event);
  if (!set) {
    set = new Set();
    mux.listeners.set(event, set);
  }
  set.add(listener);

  return () => {
    set?.delete(listener);
  };
}

function sendBroadcast(event: string, msg: SyncMessage, userId?: string): void {
  try {
    getBroadcastChannel(userId).postMessage(msg);
  } catch {}

  try {
    const mux = getSupabaseMultiplexer(userId);
    if (mux?.channel) {
      mux.channel.send({
        type: 'broadcast',
        event,
        payload: msg,
      });
    }
  } catch (e) {
    console.error(`[realtime] failed to send ${event}`, e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public Broadcast & Subscription APIs
// ─────────────────────────────────────────────────────────────────────────

export function broadcastStudentStatus(
  status: 'good' | 'warning' | 'danger' | 'offline',
  details: PostureStateUpdate['details'],
  userId?: string
): void {
  const msg: PostureStateUpdate = {
    type: 'status_update',
    status,
    details,
  };
  sendBroadcast('status_update', msg, userId);
}

export function broadcastFatigueAlert(message: string, userId?: string): void {
  const msg: FatigueAlertUpdate = {
    type: 'fatigue_alert',
    message,
    timestamp: Date.now(),
  };
  sendBroadcast('fatigue_alert', msg, userId);

  addNotification({
    id: `fatigue_${msg.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'fatigue',
    title: 'Fatigue alert',
    message,
    timestamp: msg.timestamp,
    read: false,
  });
}

export function broadcastCameraOffAlert(message: string, action: 'off' | 'on' = 'off', userId?: string): void {
  const msg: CameraOffAlertUpdate = {
    type: 'camera_off_alert',
    action,
    message,
    timestamp: Date.now(),
  };
  sendBroadcast('camera_off_alert', msg, userId);

  addNotification({
    id: `camera_${msg.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    kind: action === 'off' ? 'camera_off' : 'camera_on',
    title: action === 'off' ? 'Camera turned off' : 'Camera turned back on',
    message,
    timestamp: msg.timestamp,
    read: false,
  });
}

export function broadcastParentMessage(text: string, userId?: string): void {
  const msg: ParentMessageUpdate = {
    type: 'parent_message',
    text,
    timestamp: Date.now(),
  };
  sendBroadcast('parent_message', msg, userId);
}

// Compress landmarks: round coordinates to 3 decimal places to reduce payload size by ~90%
function compressLandmarks(landmarks: any[] | null): any[] | null {
  if (!landmarks || !Array.isArray(landmarks)) return null;
  return landmarks.map((l) => ({
    x: Math.round(l.x * 1000) / 1000,
    y: Math.round(l.y * 1000) / 1000,
    z: l.z !== undefined ? Math.round(l.z * 1000) / 1000 : 0,
    visibility: l.visibility !== undefined ? Math.round(l.visibility * 100) / 100 : undefined,
  }));
}

export function broadcastAuxCameraLandmarks(
  deviceId: string,
  poseLandmarks: any[] | null,
  faceLandmarks: any[] | null,
  userId?: string
): void {
  const msg: AuxCameraLandmarksUpdate = {
    type: 'aux_camera_landmarks',
    deviceId,
    poseLandmarks: compressLandmarks(poseLandmarks),
    faceLandmarks: compressLandmarks(faceLandmarks),
    timestamp: Date.now(),
  };
  sendBroadcast('aux_camera_landmarks', msg, userId);
}

export function subscribeToAuxCameraLandmarks(
  onLandmarks: (deviceId: string, poseLandmarks: any[] | null, faceLandmarks: any[] | null, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getBroadcastChannel(userId);
  const lastSeenByDevice = new Map<string, number>();

  const handleLandmarks = (msg: AuxCameraLandmarksUpdate) => {
    const last = lastSeenByDevice.get(msg.deviceId) ?? 0;
    if (msg.timestamp < last) return; // drop out-of-order
    lastSeenByDevice.set(msg.deviceId, msg.timestamp);
    onLandmarks(msg.deviceId, msg.poseLandmarks, msg.faceLandmarks, msg.timestamp);
  };

  const localListener = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type === 'aux_camera_landmarks') {
      handleLandmarks(event.data);
    }
  };
  syncChannel.addEventListener('message', localListener);

  const unsubMux = subscribeToMuxEvent<AuxCameraLandmarksUpdate>('aux_camera_landmarks', handleLandmarks, userId);

  return () => {
    syncChannel.removeEventListener('message', localListener);
    unsubMux();
  };
}

export function subscribeToStudentSync(
  onStatusChange: (status: 'good' | 'warning' | 'danger' | 'offline', details: PostureStateUpdate['details']) => void,
  onFatigueAlert: (message: string, timestamp: number) => void,
  onCameraAlert?: (action: 'off' | 'on', message: string, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getBroadcastChannel(userId);

  const handleStatus = (msg: PostureStateUpdate) => onStatusChange(msg.status, msg.details);
  const handleFatigue = (msg: FatigueAlertUpdate) => onFatigueAlert(msg.message, msg.timestamp);
  const handleCamera = (msg: CameraOffAlertUpdate) => onCameraAlert?.(msg.action, msg.message, msg.timestamp);

  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type === 'status_update') handleStatus(msg);
    else if (msg.type === 'fatigue_alert') handleFatigue(msg);
    else if (msg.type === 'camera_off_alert' && onCameraAlert) handleCamera(msg);
  };
  syncChannel.addEventListener('message', localListener);

  const unsubStatus = subscribeToMuxEvent<PostureStateUpdate>('status_update', handleStatus, userId);
  const unsubFatigue = subscribeToMuxEvent<FatigueAlertUpdate>('fatigue_alert', handleFatigue, userId);
  const unsubCamera = onCameraAlert ? subscribeToMuxEvent<CameraOffAlertUpdate>('camera_off_alert', handleCamera, userId) : () => {};

  return () => {
    syncChannel.removeEventListener('message', localListener);
    unsubStatus();
    unsubFatigue();
    unsubCamera();
  };
}

export function subscribeToParentMessage(
  onMessageReceived: (text: string) => void,
  userId?: string
): () => void {
  const syncChannel = getBroadcastChannel(userId);
  const handleMsg = (msg: ParentMessageUpdate) => onMessageReceived(msg.text);

  const localListener = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type === 'parent_message') handleMsg(event.data);
  };
  syncChannel.addEventListener('message', localListener);

  const unsubMux = subscribeToMuxEvent<ParentMessageUpdate>('parent_message', handleMsg, userId);

  return () => {
    syncChannel.removeEventListener('message', localListener);
    unsubMux();
  };
}

export function broadcastPhoneCameraReady(
  deviceId: string,
  cameraActive: boolean,
  userId?: string
): void {
  const msg: PhoneCameraReadyUpdate = {
    type: 'phone_camera_ready',
    deviceId,
    cameraActive,
    timestamp: Date.now(),
  };
  sendBroadcast('phone_camera_ready', msg, userId);
}

export function requestAuxPairing(
  deviceId: string,
  userId?: string
): void {
  const msg: AuxPairingRequestUpdate = {
    type: 'aux_pairing_request',
    deviceId,
    timestamp: Date.now(),
  };
  sendBroadcast('aux_pairing_request', msg, userId);
}

export function broadcastAuxPairingResponse(
  deviceId: string,
  accepted: boolean,
  userId?: string
): void {
  const msg: AuxPairingResponseUpdate = {
    type: 'aux_pairing_response',
    deviceId,
    accepted,
    timestamp: Date.now(),
  };
  sendBroadcast('aux_pairing_response', msg, userId);
}

export function subscribePhoneCameraReady(
  onPhoneReady: (deviceId: string, cameraActive: boolean, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getBroadcastChannel(userId);
  const lastSeenByDevice = new Map<string, number>();

  const handlePhoneReady = (msg: PhoneCameraReadyUpdate) => {
    lastSeenByDevice.set(msg.deviceId, Date.now());
    onPhoneReady(msg.deviceId, msg.cameraActive, msg.timestamp);
  };

  const localListener = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type === 'phone_camera_ready') handlePhoneReady(event.data);
  };
  syncChannel.addEventListener('message', localListener);

  const unsubMux = subscribeToMuxEvent<PhoneCameraReadyUpdate>('phone_camera_ready', handlePhoneReady, userId);

  // Fast watchdog: detect disconnect in 2.5s (checked every 500ms)
  const expiry = setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of lastSeenByDevice.entries()) {
      if (now - ts > 2500) {
        lastSeenByDevice.delete(id);
        onPhoneReady(id, false, now);
      }
    }
  }, 500);

  return () => {
    syncChannel.removeEventListener('message', localListener);
    unsubMux();
    clearInterval(expiry);
  };
}

export function subscribeAuxPairingRequest(
  onRequest: (desktopDeviceId: string, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getBroadcastChannel(userId);
  const handleReq = (msg: AuxPairingRequestUpdate) => onRequest(msg.deviceId, msg.timestamp);

  const localListener = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type === 'aux_pairing_request') handleReq(event.data);
  };
  syncChannel.addEventListener('message', localListener);

  const unsubMux = subscribeToMuxEvent<AuxPairingRequestUpdate>('aux_pairing_request', handleReq, userId);

  return () => {
    syncChannel.removeEventListener('message', localListener);
    unsubMux();
  };
}

export function subscribeAuxPairingResponse(
  onResponse: (phoneDeviceId: string, accepted: boolean, timestamp: number) => void,
  userId?: string
): () => void {
  const syncChannel = getBroadcastChannel(userId);
  const handleResp = (msg: AuxPairingResponseUpdate) => onResponse(msg.deviceId, msg.accepted, msg.timestamp);

  const localListener = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type === 'aux_pairing_response') handleResp(event.data);
  };
  syncChannel.addEventListener('message', localListener);

  const unsubMux = subscribeToMuxEvent<AuxPairingResponseUpdate>('aux_pairing_response', handleResp, userId);

  return () => {
    syncChannel.removeEventListener('message', localListener);
    unsubMux();
  };
}
