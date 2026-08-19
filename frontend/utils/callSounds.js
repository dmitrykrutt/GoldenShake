class SoundManager {
  constructor() {
    this.ctx = null;
    this.interval = null;
  }

  _init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playRingback() {
    this.stop();
    this._init();
    if (!this.ctx) return;

    const playBeep = () => {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.2);
      } catch (_) {}
    };

    playBeep();
    this.interval = setInterval(playBeep, 4000);
  }

  playRingtone() {
    this.stop();
    this._init();
    if (!this.ctx) return;

    const playTune = () => {
      try {
        const now = this.ctx.currentTime;
        const notes = [
          { f: 587.33, t: 0, d: 0.18 },
          { f: 880.00, t: 0.2, d: 0.18 },
          { f: 659.25, t: 0.4, d: 0.18 },
          { f: 987.77, t: 0.6, d: 0.25 },
        ];

        notes.forEach(({ f, t, d }) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + t);
          gain.gain.setValueAtTime(0.15, now + t);
          gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + d);
        });
      } catch (_) {}
    };

    playTune();
    this.interval = setInterval(playTune, 2500);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const callSounds = new SoundManager();
