// Voice Service for Text-to-Speech and Speech Recognition

export class VoiceService {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private recognition: any = null;
  private isSpeaking: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
    this.initVoice();

    // Handle dynamically loaded voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = this.initVoice.bind(this);
    }

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
    // Prefer Vietnamese female voices if available
    const viVoice = voices.find((v) => v.lang === 'vi-VN' && v.name.toLowerCase().includes('female')) 
                 || voices.find((v) => v.lang.includes('vi'));
    if (viVoice) {
      this.voice = viVoice;
    } else if (voices.length > 0) {
      this.voice = voices[0];
    }
  }

  public speak(text: string, onEnd?: () => void) {
    if (this.synth.speaking) {
      this.synth.cancel(); // Cancel currently speaking utterance to avoid overlaps
    }

    if (text === '') {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.pitch = 1.3; // Cute pitch
    utterance.rate = 1.0;

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
      if (onEnd) onEnd();
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
