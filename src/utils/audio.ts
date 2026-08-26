// Procedural sound effects synthesizer using Web Audio API

class SoundFX {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private bgAudioSource: MediaElementAudioSourceNode | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser autoplay policy
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.analyser && this.ctx) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  private bgAudio: HTMLAudioElement | null = null;
  private currentTrackTitle: string | null = null;

  public playBackgroundMusic(audioUrl: string, title?: string) {
    this.initCtx();
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio = null;
    }

    this.bgAudio = new Audio();
    this.bgAudio.crossOrigin = 'anonymous';
    this.bgAudio.src = audioUrl;
    this.bgAudio.loop = true;
    this.bgAudio.volume = this.isMuted ? 0 : 0.55;
    this.currentTrackTitle = title || 'Custom AI Soundtrack';

    if (this.ctx && this.analyser) {
      try {
        if (this.bgAudioSource) {
          this.bgAudioSource.disconnect();
        }
        this.bgAudioSource = this.ctx.createMediaElementSource(this.bgAudio);
        this.bgAudioSource.connect(this.analyser);
      } catch (e) {
        console.warn('MediaElementSource already connected or fallback:', e);
      }
    }

    this.bgAudio.play().catch(e => console.log('Audio autoplay prevented:', e));
  }

  public stopBackgroundMusic() {
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio = null;
      this.currentTrackTitle = null;
    }
  }

  public isBackgroundMusicPlaying(): boolean {
    return !!this.bgAudio && !this.bgAudio.paused;
  }

  public getBackgroundMusicTitle(): string | null {
    return this.currentTrackTitle;
  }

  public setBackgroundMusicVolume(volume: number) {
    if (this.bgAudio) {
      this.bgAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgAudio) {
      this.bgAudio.volume = this.isMuted ? 0 : 0.45;
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getAudioFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.dataArray) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  public getAudioEnergy(): { bass: number; mid: number; treble: number; overall: number } {
    const data = this.getAudioFrequencyData();
    if (!data) return { bass: 0, mid: 0, treble: 0, overall: 0 };

    const len = data.length;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    const bassEnd = Math.floor(len * 0.2);
    const midEnd = Math.floor(len * 0.6);

    for (let i = 0; i < bassEnd; i++) bassSum += data[i];
    for (let i = bassEnd; i < midEnd; i++) midSum += data[i];
    for (let i = midEnd; i < len; i++) trebleSum += data[i];

    const bass = bassSum / (bassEnd * 255);
    const mid = midSum / ((midEnd - bassEnd) * 255);
    const treble = trebleSum / ((len - midEnd) * 255);
    const overall = (bass * 0.5 + mid * 0.3 + treble * 0.2);

    return { bass, mid, treble, overall };
  }

  private connectToAudioGraph(node: AudioNode) {
    if (this.analyser) {
      node.connect(this.analyser);
    } else if (this.ctx) {
      node.connect(this.ctx.destination);
    }
  }

  // Tic-Tac-Toe placement sound
  public playPlacementSound(type: 'X' | 'O') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'X') {
      // Crisp neon snap
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    } else {
      // Glossy deep resonance
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    }

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Neon Laser beam sound
  public playLaserSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.45);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Victory fanfare
  public playWinSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const now = this.ctx!.currentTime + i * 0.1;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      this.connectToAudioGraph(gain);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // Matrix note sound (musical scale based on index 0-15)
  public playMatrixNote(index: number, isError: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isError) {
      // Glitch / error buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    } else {
      // Pentatonic / futuristic synth chime
      const baseFreq = 261.63; // C4
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
      const semitone = scale[index % scale.length];
      const freq = baseFreq * Math.pow(2, semitone / 12);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Sub harmonic for rich synth feel
      const sub = this.ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(freq * 0.5, now);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.08, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      sub.connect(subGain);
      this.connectToAudioGraph(subGain);
      sub.start(now);
      sub.stop(now + 0.3);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    }

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Cascading Rain Droplet Ripple Sound
  public playRainDropletHarmonic(index: number, delaySec: number = 0, intensity: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + Math.max(0, delaySec);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const pentatonic = [0, 4, 7, 11, 14, 16, 19, 23, 26, 28, 31, 35, 38, 40, 43, 47];
    const semitone = pentatonic[index % pentatonic.length];
    const baseFreq = 523.25; // C5 high crystalline harmonic
    const freq = baseFreq * Math.pow(2, semitone / 12);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.95, now + 0.16);

    const vol = Math.min(0.18, 0.12 * intensity);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Dice rolling rattle
  public playDiceRollSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Series of quick wooden clicks
    for (let i = 0; i < 7; i++) {
      const delay = i * 0.07 + Math.random() * 0.03;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(300 + Math.random() * 400, now);
      gain.gain.setValueAtTime(0.12 - i * 0.012, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      this.connectToAudioGraph(gain);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  // Pawn parabolic hop sound with melodic pitch progression
  public playPawnHopSound(stepInSequence: number = 0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Pentatonic scale pitch increase with each hop in a turn
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const semitone = scale[Math.min(stepInSequence, scale.length - 1)];
    const baseFreq = 360 * Math.pow(2, semitone / 12);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.14);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    // Subtle wooden tap on landing
    const tapOsc = this.ctx.createOscillator();
    const tapGain = this.ctx.createGain();
    tapOsc.type = 'triangle';
    tapOsc.frequency.setValueAtTime(180, now + 0.08);
    tapGain.gain.setValueAtTime(0.12, now + 0.08);
    tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    tapOsc.connect(tapGain);
    this.connectToAudioGraph(tapGain);
    tapOsc.start(now + 0.08);
    tapOsc.stop(now + 0.15);

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // Pawn base spawn sound
  public playPawnSpawnSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.22);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Pawn home victory sound
  public playPawnHomeSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
    chords.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.07;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);

      osc.connect(gain);
      this.connectToAudioGraph(gain);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  // Pawn capture / strike sound
  public playCaptureSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // General UI click
  public playClickSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    this.connectToAudioGraph(gain);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const sound = new SoundFX();
