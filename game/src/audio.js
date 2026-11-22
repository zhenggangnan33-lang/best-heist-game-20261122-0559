// Every sound is synthesised with WebAudio: no audio files, no network, and
// nothing to load. The context is created lazily on the first sound (browsers
// want a user gesture first), and M mutes everything.

/** A short envelope: a tone that fades in fast and out over `seconds`. */
function blip(context, frequency, seconds, type, gain, when = 0) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + when);
  envelope.gain.setValueAtTime(0.0001, context.currentTime + when);
  envelope.gain.exponentialRampToValueAtTime(gain, context.currentTime + when + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + when + seconds);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(context.currentTime + when);
  oscillator.stop(context.currentTime + when + seconds + 0.05);
}

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    return context;
  }

  function play(fn) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    try {
      fn(audio);
    } catch {
      // A sound failing must never break the game.
    }
  }

  return {
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    /** A soft two-note chime when a piece of loot is pocketed. */
    loot() {
      play((audio) => {
        blip(audio, 660, 0.14, 'sine', 0.16);
        blip(audio, 990, 0.22, 'sine', 0.14, 0.09);
      });
    },
    /** A rising arpeggio when a hack switches the cameras off. */
    hack() {
      play((audio) => {
        blip(audio, 440, 0.1, 'square', 0.07);
        blip(audio, 587, 0.1, 'square', 0.07, 0.08);
        blip(audio, 880, 0.18, 'square', 0.07, 0.16);
      });
    },
    /** A coin's bright clink as it lands on the marble. */
    coin() {
      play((audio) => {
        blip(audio, 1568, 0.1, 'triangle', 0.14);
        blip(audio, 2093, 0.16, 'triangle', 0.1, 0.06);
      });
    },
    /** A low warning pulse when the alarm crosses into a hunt. */
    spotted() {
      play((audio) => {
        blip(audio, 220, 0.3, 'sawtooth', 0.1);
        blip(audio, 174, 0.35, 'sawtooth', 0.1, 0.16);
      });
    },
    /** A harsh falling sting when the heist is over. */
    caught() {
      play((audio) => {
        blip(audio, 330, 0.4, 'sawtooth', 0.14);
        blip(audio, 247, 0.5, 'sawtooth', 0.14, 0.14);
        blip(audio, 165, 0.8, 'sawtooth', 0.14, 0.3);
      });
    },
    /** A bright little fanfare for a clean getaway. */
    win() {
      play((audio) => {
        blip(audio, 523, 0.16, 'sine', 0.15);
        blip(audio, 659, 0.16, 'sine', 0.15, 0.12);
        blip(audio, 784, 0.16, 'sine', 0.15, 0.24);
        blip(audio, 1047, 0.4, 'sine', 0.15, 0.36);
      });
    },
    /** A quiet click for starting and pausing. */
    click() {
      play((audio) => {
        blip(audio, 880, 0.06, 'sine', 0.08);
      });
    },
  };
}
