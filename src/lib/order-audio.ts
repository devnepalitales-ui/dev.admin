/**
 * Web Audio Chime for Nepali Tales Admin
 * Synthesizes a high-definition restaurant kitchen order chime.
 * Self-contained, works offline, zero network requests, zero external assets required.
 */

export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  repeat: 1 | 2; // chime once or twice
}

const STORAGE_KEY = "nepali_tales_admin_audio_settings";

const DEFAULT_SETTINGS: AudioSettings = {
  enabled: true,
  volume: 0.85,
  repeat: 2,
};

class OrderSoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private autoUnlockBound = false;
  private listeners: Array<(settings: AudioSettings) => void> = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.loadSettings();
      this.setupAutoUnlock();
    }
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  public saveSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // localStorage may fail in restricted/private modes
    }
    this.notifyListeners();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public subscribe(callback: (settings: AudioSettings) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners() {
    const current = this.getSettings();
    this.listeners.forEach((l) => {
      try {
        l(current);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  /**
   * Lazily obtain or create an AudioContext.
   */
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    return this.ctx;
  }

  /**
   * Automatically unlocks the AudioContext on first user interaction anywhere in the window.
   */
  private setupAutoUnlock() {
    if (typeof window === "undefined" || this.autoUnlockBound) return;
    this.autoUnlockBound = true;

    const unlockHandler = () => {
      this.unlock();
      window.removeEventListener("pointerdown", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
      window.removeEventListener("touchstart", unlockHandler);
    };

    window.addEventListener("pointerdown", unlockHandler, { once: true, passive: true });
    window.addEventListener("keydown", unlockHandler, { once: true, passive: true });
    window.addEventListener("touchstart", unlockHandler, { once: true, passive: true });
  }

  /**
   * Resume/unlock the AudioContext. Returns true if context is active.
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === "running";
  }

  /**
   * Whether the AudioContext is ready to play sound.
   */
  public isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /**
   * Synthesize a single resonant bell strike with fundamental and harmonic overtone.
   */
  private playBellNote(
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    startTime: number,
    duration = 0.55,
    relativeVolume = 1.0,
  ) {
    const now = startTime;

    // 1. Primary Fundamental Oscillator (pure, clean bell core)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);

    // Subtle natural acoustic bell pitch drift
    osc1.frequency.exponentialRampToValueAtTime(freq * 0.998, now + duration);

    // Exponential strike decay envelope
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.6 * relativeVolume, now + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain1);
    gain1.connect(destination);

    // 2. Bell Harmonic Overtone (octave partial) gives brightness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2.0, now);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.22 * relativeVolume, now + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.45);

    osc2.connect(gain2);
    gain2.connect(destination);

    // Trigger oscillator
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  /**
   * Synthesize the ascending 3-tone kitchen order chime (F5 -> A5 -> C6).
   * Spaced harmoniously with an optional repeat pass.
   */
  private playSynthesizedChime(current: AudioSettings): boolean {
    const ctx = this.getContext();
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    const vol = Math.max(0.05, Math.min(1.0, current.volume));
    masterGain.gain.setValueAtTime(vol, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime + 0.02;

    // Frequencies: F5 (698.46 Hz), A5 (880.0 Hz), C6 (1046.5 Hz) - bright F-major triad
    const notes = [698.46, 880.0, 1046.5];
    const noteSpacing = 0.12; // 120ms between notes
    const repeats = current.repeat || 2;

    for (let r = 0; r < repeats; r++) {
      const repeatOffset = r * 0.68; // 680ms between repetitions

      notes.forEach((freq, idx) => {
        const noteTime = now + repeatOffset + idx * noteSpacing;
        const isLast = idx === notes.length - 1;
        const duration = isLast ? 0.75 : 0.45;
        const noteVol = isLast ? 1.0 : 0.8;
        this.playBellNote(ctx, masterGain, freq, noteTime, duration, noteVol);
      });
    }

    return true;
  }

  /**
   * Primary method to trigger the new order chime.
   * If an audio file exists in public/sounds/order-chime.mp3, it attempts to play it first;
   * otherwise it plays the synthesized chime.
   */
  public async playOrderChime(overrideSettings?: Partial<AudioSettings>): Promise<boolean> {
    const current = { ...this.settings, ...overrideSettings };
    if (!current.enabled) return false;

    // 1. Check for custom mp3 file in public directory if available
    try {
      const audio = new Audio("/sounds/order-chime.mp3");
      audio.volume = Math.max(0.05, Math.min(1.0, current.volume));
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        if (current.repeat === 2) {
          setTimeout(() => {
            const second = new Audio("/sounds/order-chime.mp3");
            second.volume = Math.max(0.05, Math.min(1.0, current.volume));
            second.play().catch(() => {});
          }, 700);
        }
        return true;
      }
    } catch {
      // Custom audio file not available or play failed -> fall through to Web Audio synthesizer
    }

    // 2. Synthesized Web Audio chime
    return this.playSynthesizedChime(current);
  }

  /**
   * Preview chime for testing audio volume and checking speaker setup.
   */
  public async testChime(): Promise<boolean> {
    await this.unlock();
    return this.playOrderChime();
  }
}

export const soundManager = new OrderSoundManager();
