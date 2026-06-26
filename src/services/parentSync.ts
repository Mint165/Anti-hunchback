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

type SyncMessage = PostureStateUpdate | FatigueAlertUpdate;

const CHANNEL_NAME = 'oliver_parent_student_sync';
let channel: BroadcastChannel | null = null;
let supabaseChannel: any = null;

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

function getSupabaseChannel() {
  if (isSupabaseConfigured && supabase && !supabaseChannel) {
    supabaseChannel = supabase.channel(CHANNEL_NAME);
    supabaseChannel.subscribe();
  }
  return supabaseChannel;
}

// Broadcast student posture and indicators to parent dashboard
export function broadcastStudentStatus(
  status: 'good' | 'warning' | 'danger' | 'offline',
  details: PostureStateUpdate['details']
): void {
  try {
    const msg: PostureStateUpdate = {
      type: 'status_update',
      status,
      details,
    };
    
    // Broadcast locally
    getChannel().postMessage(msg);
    
    // Broadcast via Supabase
    const sbChannel = getSupabaseChannel();
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
export function broadcastFatigueAlert(message: string): void {
  try {
    const msg: FatigueAlertUpdate = {
      type: 'fatigue_alert',
      message,
      timestamp: Date.now(),
    };
    
    // Broadcast locally
    getChannel().postMessage(msg);
    
    // Broadcast via Supabase
    const sbChannel = getSupabaseChannel();
    if (sbChannel) {
      sbChannel.send({
        type: 'broadcast',
        event: 'fatigue_alert',
        payload: msg
      });
    }
  } catch (e) {
    console.error('Failed to broadcast fatigue alert', e);
  }
}

// Subscribe to status updates (for Parent Dashboard)
export function subscribeToStudentSync(
  onStatusChange: (status: 'good' | 'warning' | 'danger' | 'offline', details: PostureStateUpdate['details']) => void,
  onFatigueAlert: (message: string, timestamp: number) => void
): () => void {
  // Listen locally
  const syncChannel = getChannel();
  const localListener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type === 'status_update') {
      onStatusChange(msg.status, msg.details);
    } else if (msg.type === 'fatigue_alert') {
      onFatigueAlert(msg.message, msg.timestamp);
    }
  };
  syncChannel.addEventListener('message', localListener);

  // Listen via Supabase Realtime
  let sbChannel: any = null;
  if (isSupabaseConfigured && supabase) {
    sbChannel = supabase.channel(CHANNEL_NAME)
      .on('broadcast', { event: 'status_update' }, ({ payload }) => {
        const msg = payload as PostureStateUpdate;
        onStatusChange(msg.status, msg.details);
      })
      .on('broadcast', { event: 'fatigue_alert' }, ({ payload }) => {
        const msg = payload as FatigueAlertUpdate;
        onFatigueAlert(msg.message, msg.timestamp);
      })
      .subscribe();
  }

  // Return unsubscribe cleanup function
  return () => {
    syncChannel.removeEventListener('message', localListener);
    if (sbChannel && supabase) {
      supabase.removeChannel(sbChannel);
    }
  };
}
