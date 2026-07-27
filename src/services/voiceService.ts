// Voice Service for Text-to-Speech and Speech Recognition

export class VoiceService {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private recognition: any = null;
  private isSpeaking: boolean = false;
  private voicesLoaded: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
    this.initVoice();

    // Handle dynamically loaded voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        this.voicesLoaded = true;
        this.initVoice();
      };
    }

    // Some browsers (older Chrome) never fire `onvoiceschanged`. Poll
    // getVoices() a few times shortly after construction so we still
    // pick up the vi-VN voice when it loads asynchronously.
    let attempts = 0;
    const poll = window.setInterval(() => {
      attempts += 1;
      const voices = this.synth.getVoices();
      if (voices.length > 0 || attempts > 10) {
        this.voicesLoaded = true;
        this.initVoice();
        window.clearInterval(poll);
      }
    }, 200);

    // Initialize Speech Recognition if supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'vi-VN'; // Default language
    }
  }

  private initVoice() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;
    // Prefer Vietnamese female voices if available, then any vi voice,
    // then fall back to the first available voice so we always have one.
    const viVoice = voices.find((v) => v.lang === 'vi-VN' && v.name.toLowerCase().includes('female'))
                 || voices.find((v) => v.lang === 'vi-VN')
                 || voices.find((v) => v.lang.toLowerCase().includes('vi'));
    if (viVoice) {
      this.voice = viVoice;
    } else if (voices.length > 0) {
      this.voice = voices[0];
    }
  }

  public speak(text: string, onEnd?: () => void, _isRetry: boolean = false) {
    // Re-resolve the voice on every call — voices may finish loading
    // after the singleton was constructed, and this is cheap.
    if (!this.voice || !this.voicesLoaded) {
      this.initVoice();
    }

    if (this.synth.speaking) {
      this.synth.cancel(); // Cancel currently speaking utterance to avoid overlaps
    }

    if (text === '') {
      if (onEnd) onEnd();
      return;
    }

    // Chrome pauses speechSynthesis after ~15s of page idleness, which
    // silently drops subsequent utterances. Always resume before speaking.
    try {
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    // Hint the language so engines that don't match a voice still
    // pronounce Vietnamese text correctly.
    utterance.lang = 'vi-VN';
    utterance.pitch = 1.3; // Cute pitch
    utterance.rate = 1.0;
    utterance.volume = 1;

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      this.isSpeaking = false;
      // Chrome occasionally fires `interrupted` or `canceled` right
      // after cancel() above; retry once with a tiny delay so the
      // reminder ("Chủ nhân ơi, ngồi thẳng lên nhé!") still plays.
      if (!_isRetry && (e.error === 'interrupted' || e.error === 'canceled')) {
        window.setTimeout(() => this.speak(text, onEnd, true), 120);
      } else if (onEnd) {
        onEnd();
      }
    };

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  public isCurrentlySpeaking() {
    return this.isSpeaking;
  }

  public listenForCommand(commands: string[], onCommandMatched: (cmd: string) => void, onError?: () => void) {
    if (!this.recognition) {
      console.warn('Speech recognition not supported in this browser.');
      if (onError) onError();
      return;
    }

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      const matched = commands.find(cmd => transcript.includes(cmd.toLowerCase()));
      if (matched) {
        onCommandMatched(matched);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (onError) onError();
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error('Could not start recognition', e);
    }
  }

  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }
}

export const voiceService = new VoiceService();
