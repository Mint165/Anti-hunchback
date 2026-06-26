// Parent-Student Real-time Sync Service using BroadcastChannel API

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

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
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
    getChannel().postMessage(msg);
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
    getChannel().postMessage(msg);
  } catch (e) {
    console.error('Failed to broadcast fatigue alert', e);
  }
}

// Subscribe to status updates (for Parent Dashboard)
export function subscribeToStudentSync(
  onStatusChange: (status: 'good' | 'warning' | 'danger' | 'offline', details: PostureStateUpdate['details']) => void,
  onFatigueAlert: (message: string, timestamp: number) => void
): () => void {
  const syncChannel = getChannel();
  
  const listener = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data;
    if (msg.type === 'status_update') {
      onStatusChange(msg.status, msg.details);
    } else if (msg.type === 'fatigue_alert') {
      onFatigueAlert(msg.message, msg.timestamp);
    }
  };

  syncChannel.addEventListener('message', listener);

  // Return unsubscribe cleanup function
  return () => {
    syncChannel.removeEventListener('message', listener);
  };
}
