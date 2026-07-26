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
 * If `trackState` is supplied, this device is also announced on the
 * channel: `.track()` is called from inside the `.subscribe()`
 * `SUBSCRIBED` callback. Consolidating subscribe + track into a single
 * channel/subscribe call is required — registering `.on('presence', …)`
 * or calling `.track()` AFTER `.subscribe()` has already started throws
 * `cannot add presence callbacks for … after subscribe()` because
 * Supabase dedupes channels by name (so a separately-created "track"
 * channel is the same instance as the subscriber's channel and inherits
 * its `isJoining()` state).
 */
export function subscribePresence(
  userId: string,
  ownDeviceId: string,
  onChange: (others: PresenceState[]) => void,
  trackState?: Omit<PresenceState, 'lastSeen'>
): () => void {
  if (!userId || userId === 'default') {
    // No real user — fall back to BroadcastChannel so two tabs in the
    // same browser can still demo the dual-camera flow.
    if (trackState) trackBroadcastPresence(userId || 'default', { ...trackState, lastSeen: Date.now() });
    return subscribeBroadcastPresence(userId || 'default', ownDeviceId, onChange);
  }

  if (!isSupabaseConfigured || !supabase) {
    if (trackState) trackBroadcastPresence(userId, { ...trackState, lastSeen: Date.now() });
    return subscribeBroadcastPresence(userId, ownDeviceId, onChange);
  }

  // Capture into a non-null local so TS keeps the narrowing inside the
  // closure we return below (otherwise it widens back to `SupabaseClient | null`).
  const sb = supabase;
  const channelName = `${PRESENCE_CHANNEL_PREFIX}${userId}`;
  const channel = sb.channel(channelName, {
    config: { presence: { key: ownDeviceId } },
  });

  // CRITICAL: register all `.on('presence', …)` callbacks BEFORE
  // `.subscribe()`. Calling `.on('presence', …)` after the channel has
  // started joining throws `cannot add presence callbacks … after
  // subscribe()`.
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
    .subscribe(async (status) => {
      // `.track()` must happen AFTER the channel is SUBSCRIBED, not
      // before — tracking on a non-subscribed channel is a no-op and
      // would never announce us to other devices.
      if (status === 'SUBSCRIBED' && trackState) {
        try {
          await channel.track({ ...trackState, lastSeen: Date.now() });
        } catch (e) {
          console.warn('[presence] track failed', e);
        }
      }
    });

  return () => {
    try {
      channel.untrack().catch(() => {});
      sb.removeChannel(channel);
    } catch (e) {
      console.warn('[presence] cleanup error', e);
    }
  };
}

/**
 * Track this device's presence on the user's presence channel.
 *
 * NOTE: for the Supabase path this is now a **no-op** — initial tracking
 * is performed by `subscribePresence()` (which calls `.track()` from
 * inside the `SUBSCRIBED` callback). The previous implementation created
 * its own channel and called `.subscribe()` separately, but because
 * Supabase dedupes channels by name that returned the same channel the
 * subscriber had already started joining, and subsequent `.on('presence',
 * …)` calls in the subscriber threw `cannot add presence callbacks …
 * after subscribe()`.
 *
 * The BroadcastChannel fallback path is unchanged — `trackPresence` still
 * sets up the heartbeat so other same-browser tabs see this device.
 *
 * To update the tracked state mid-session (e.g. when `isDesktop` flips),
 * re-call `subscribePresence` with the new `trackState`; the unsubscribe
 * path will untrack + removeChannel, and the new subscription re-tracks
 * on `SUBSCRIBED`.
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
  // Supabase path: intentionally a no-op. See the doc comment above —
  // subscribePresence() now owns the .track() call.
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
