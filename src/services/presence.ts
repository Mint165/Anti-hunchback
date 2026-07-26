// Per-user presence channel for the dual-camera feature (Task F).
//
// The aux-camera flow needs each device running the same student account
// to know about the others — specifically, the phone needs to detect
// that the desktop is active before offering the "Start aux camera"
// button, and the desktop needs to know a phone is streaming so it can
// render the split-screen skeleton overlay.
//
// Transport: Supabase Realtime presence when configured (works
// cross-device), BroadcastChannel fallback when not (same-browser only
// — useful for development demos with two tabs).
//
// The presence key is the device id (from PostureContext.ownDeviceIdRef),
// and the state carries { deviceId, role, isDesktop, lastSeen } so the
// phone can specifically look for an active desktop.

import { supabase, isSupabaseConfigured } from './supabase';
import { getUserIdSync } from './db';

export interface PresenceState {
  deviceId: string;
  /** 'student' | 'parent' — kept for future parent-side presence. */
  role: 'student' | 'parent';
  /** True when the device is the desktop running the primary camera. */
  isDesktop: boolean;
  /** True when the device is a phone acting as the aux camera. */
  isAux: boolean;
  lastSeen: number;
}

const PRESENCE_CHANNEL_PREFIX = 'oliver_presence:user_';

/**
 * Subscribe to presence for the current user. Calls `onChange` with the
 * full list of OTHER active devices (excluding the caller's own deviceId)
 * whenever the presence set changes. Returns an unsubscribe function.
 *
 * The caller is responsible for `trackPresence()` — typically called
 * once on mount from PostureContext so the device joins the presence
 * set, then `untrack()` on unmount.
 */
export function subscribePresence(
  userId: string,
  ownDeviceId: string,
  onChange: (others: PresenceState[]) => void
): () => void {
  if (!userId || userId === 'default') {
    // No real user — fall back to BroadcastChannel so two tabs in the
    // same browser can still demo the dual-camera flow.
    return subscribeBroadcastPresence(userId || 'default', ownDeviceId, onChange);
  }

  if (!isSupabaseConfigured || !supabase) {
    return subscribeBroadcastPresence(userId, ownDeviceId, onChange);
  }

  const channelName = `${PRESENCE_CHANNEL_PREFIX}${userId}`;
  const channel = supabase.channel(channelName, {
    config: { presence: { key: ownDeviceId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>();
      const others: PresenceState[] = [];
      for (const [key, records] of Object.entries(state)) {
        if (key === ownDeviceId) continue;
        const rec = records?.[0] as PresenceState | undefined;
        if (rec) others.push(rec);
      }
      onChange(others);
    })
    .subscribe();

  return () => {
    try {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn('[presence] cleanup error', e);
    }
  };
}

/**
 * Track this device's presence on the user's presence channel. Call
 * once on mount; the channel is shared with `subscribePresence` via
 * the channel name. Idempotent — re-tracking with the same key is safe.
 */
export async function trackPresence(state: Omit<PresenceState, 'lastSeen'>): Promise<void> {
  const userId = getUserIdSync();
  if (!userId || userId === 'default') {
    trackBroadcastPresence(userId || 'default', { ...state, lastSeen: Date.now() });
    return;
  }
  if (!isSupabaseConfigured || !supabase) {
    trackBroadcastPresence(userId, { ...state, lastSeen: Date.now() });
    return;
  }
  const channelName = `${PRESENCE_CHANNEL_PREFIX}${userId}`;
  // Note: this creates a *separate* channel instance from the one
  // subscribePresence manages. Supabase dedupes by name internally, so
  // both instances see the same presence state. We can't reuse the
  // subscriber's channel handle because track/untrack need to be
  // callable independently of subscription lifecycle.
  const trackChannel = supabase.channel(channelName, {
    config: { presence: { key: state.deviceId } },
  });
  await trackChannel.subscribe(async () => {
    await trackChannel.track({ ...state, lastSeen: Date.now() });
  });
}

/**
 * Untrack this device from the presence channel. Call on unmount /
 * logout so other devices see the device leave promptly.
 */
export async function untrackPresence(deviceId: string): Promise<void> {
  const userId = getUserIdSync();
  if (!userId || userId === 'default') {
    untrackBroadcastPresence(userId || 'default', deviceId);
    return;
  }
  if (!isSupabaseConfigured || !supabase) {
    untrackBroadcastPresence(userId, deviceId);
    return;
  }
  // Best-effort: Supabase's removeChannel will untrack implicitly. We
  // don't hold a handle to the track channel here, so this is a no-op
  // for the Supabase path. Callers that want explicit untrack should
  // keep their own channel handle.
}

// ── BroadcastChannel fallback (no Supabase) ──────────────────────────
// Same-browser only — useful for development demos with two tabs.
// State is heartbeated every 2s and expired after 6s of silence.

const broadcastChannels = new Map<string, BroadcastChannel>();
const broadcastStates = new Map<string, Map<string, PresenceState>>();

function getBroadcastChannel(userId: string): BroadcastChannel {
  const name = `${PRESENCE_CHANNEL_PREFIX}${userId}`;
  let ch = broadcastChannels.get(name);
  if (!ch) {
    ch = new BroadcastChannel(name);
    broadcastChannels.set(name, ch);
  }
  return ch;
}

function trackBroadcastPresence(userId: string, state: PresenceState): void {
  const ch = getBroadcastChannel(userId);
  let states = broadcastStates.get(userId);
  if (!states) {
    states = new Map();
    broadcastStates.set(userId, states);
  }
  states.set(state.deviceId, state);
  ch.postMessage({ kind: 'track', state });
  // Heartbeat so others see us as alive; expires after 6s if we go silent.
  const hbId = window.setInterval(() => {
    const fresh: PresenceState = { ...state, lastSeen: Date.now() };
    states?.set(state.deviceId, fresh);
    ch.postMessage({ kind: 'track', state: fresh });
  }, 2000);
  // Stash the interval id on the state map for untrack to clear.
  (states.get(state.deviceId) as any).__hbId = hbId;
}

function untrackBroadcastPresence(userId: string, deviceId: string): void {
  const ch = getBroadcastChannel(userId);
  const states = broadcastStates.get(userId);
  const existing = states?.get(deviceId) as any;
  if (existing?.__hbId) clearInterval(existing.__hbId);
  states?.delete(deviceId);
  ch.postMessage({ kind: 'untrack', deviceId });
}

function subscribeBroadcastPresence(
  userId: string,
  ownDeviceId: string,
  onChange: (others: PresenceState[]) => void
): () => void {
  const ch = getBroadcastChannel(userId);
  const listener = (event: MessageEvent<{ kind: 'track' | 'untrack'; state?: PresenceState; deviceId?: string }>) => {
    const msg = event.data;
    let states = broadcastStates.get(userId);
    if (!states) {
      states = new Map();
      broadcastStates.set(userId, states);
    }
    if (msg.kind === 'track' && msg.state) {
      states.set(msg.state.deviceId, msg.state);
    } else if (msg.kind === 'untrack' && msg.deviceId) {
      states.delete(msg.deviceId);
    }
    // Expire stale entries (> 6s old) and emit.
    const now = Date.now();
    const others: PresenceState[] = [];
    for (const [id, s] of states.entries()) {
      if (id === ownDeviceId) continue;
      if (now - s.lastSeen > 6000) {
        states.delete(id);
        continue;
      }
      others.push(s);
    }
    onChange(others);
  };
  ch.addEventListener('message', listener);

  // Polling cleanup: every 3s drop stale entries and re-emit so the
  // caller sees devices disappear even if no untrack message arrives.
  const poll = window.setInterval(() => {
    const states = broadcastStates.get(userId);
    if (!states) return;
    const now = Date.now();
    let changed = false;
    for (const [id, s] of states.entries()) {
      if (id === ownDeviceId) continue;
      if (now - s.lastSeen > 6000) {
        states.delete(id);
        changed = true;
      }
    }
    if (changed) {
      const others: PresenceState[] = [];
      for (const [id, s] of states.entries()) {
        if (id === ownDeviceId) continue;
        others.push(s);
      }
      onChange(others);
    }
  }, 3000);

  return () => {
    ch.removeEventListener('message', listener);
    clearInterval(poll);
  };
}
