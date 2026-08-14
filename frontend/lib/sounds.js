let audioContext = null;
const active = new Set();

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioContext = Ctx ? new Ctx() : null;
  }
  if (audioContext?.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function createTone({ frequencies, duration, gain = 0.04, type = 'sine' }) {
  const context = getContext();
  if (!context) return null;
  const output = context.createGain();
  output.gain.value = gain;
  output.connect(context.destination);
  const oscillators = frequencies.map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(output);
    return oscillator;
  });
  return {
    start(at = context.currentTime) {
      oscillators.forEach((oscillator) => oscillator.start(at));
      if (duration) {
        const stopAt = at + duration;
        output.gain.setValueAtTime(gain, at);
        output.gain.exponentialRampToValueAtTime(0.0001, stopAt);
        oscillators.forEach((oscillator) => oscillator.stop(stopAt));
      }
    },
    stop() {
      try {
        oscillators.forEach((oscillator) => oscillator.stop());
      } catch {}
      try {
        output.disconnect();
      } catch {}
    },
    context,
  };
}

function register(stop) {
  const entry = { stop };
  active.add(entry);
  return () => {
    active.delete(entry);
    stop();
  };
}

export function stopAllSounds() {
  [...active].forEach((entry) => {
    try {
      entry.stop();
    } finally {
      active.delete(entry);
    }
  });
}

export function playRingtone() {
  stopAllSounds();
  const context = getContext();
  if (!context) return () => {};
  let cancelled = false;

  const loop = () => {
    if (cancelled) return;
    const first = createTone({ frequencies: [440, 480], duration: 0.45, gain: 0.05 });
    const second = createTone({ frequencies: [440, 480], duration: 0.45, gain: 0.05 });
    first?.start();
    second?.start(context.currentTime + 0.7);
    window.setTimeout(loop, 2000);
  };

  loop();
  return register(() => {
    cancelled = true;
  });
}

export function playRingback() {
  stopAllSounds();
  let cancelled = false;
  const loop = () => {
    if (cancelled) return;
    const tone = createTone({ frequencies: [440], duration: 1.2, gain: 0.03 });
    tone?.start();
    window.setTimeout(loop, 3000);
  };
  loop();
  return register(() => {
    cancelled = true;
  });
}

export function playCallEnd() {
  stopAllSounds();
  const tone1 = createTone({ frequencies: [660], duration: 0.16, gain: 0.04 });
  const tone2 = createTone({ frequencies: [520], duration: 0.2, gain: 0.04 });
  const context = getContext();
  tone1?.start();
  tone2?.start((context?.currentTime || 0) + 0.18);
  return register(() => {});
}
