// Every sound in the game, synthesized with WebAudio — no audio files, no
// network, nothing to load. The context starts on the first player gesture.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (muted || !ensure()) return;
    try {
      const t0 = context.currentTime + when;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: a failure here never stops the game.
    }
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    coin() {
      tone(1320, 0.09, 'sine', 0.22);
      tone(1760, 0.14, 'sine', 0.18, 0.07);
    },
    grab() {
      tone(520, 0.1, 'triangle', 0.25);
      tone(780, 0.12, 'triangle', 0.22, 0.08);
      tone(1040, 0.16, 'triangle', 0.2, 0.16);
    },
    hack() {
      tone(880, 0.07, 'square', 0.1);
      tone(1108, 0.07, 'square', 0.1, 0.08);
      tone(1318, 0.12, 'square', 0.1, 0.16);
    },
    spotted() {
      tone(196, 0.22, 'sawtooth', 0.2, 0, 330);
    },
    alarm() {
      tone(660, 0.16, 'square', 0.14);
      tone(440, 0.16, 'square', 0.14, 0.18);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.25, 0, 55);
      tone(110, 0.7, 'sawtooth', 0.2, 0.1, 40);
    },
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.22, i * 0.13));
    },
    step() {
      tone(90, 0.05, 'sine', 0.05);
    },
  };
}
