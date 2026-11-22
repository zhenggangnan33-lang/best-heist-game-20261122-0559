// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start, pause, restart, mute, toss a coin) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice.
import { PLAYER } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_TOSS = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const TOSS = new Set(['KeyQ']);

/**
 * `toField` turns a pointer's client coordinates into museum coordinates, so
 * a click can say where to throw a coin. It may be null when the game runs
 * without a pointer.
 */
export function createInput(target, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sneak = false;
  let interact = false;
  let actions = 0;
  let tossX = 0;
  let tossY = 0;

  function queueToss(x, y) {
    tossX = x;
    tossY = y;
    actions |= ACTION_TOSS;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SNEAK.has(event.code)) sneak = true;
    else if (INTERACT.has(event.code)) interact = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (TOSS.has(event.code)) {
      if (!event.repeat) queueToss(NaN, NaN);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SNEAK.has(event.code)) sneak = false;
    else if (INTERACT.has(event.code)) interact = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    sneak = false;
    interact = false;
  });
  target.addEventListener('pointerdown', (event) => {
    if (typeof toField === 'function') {
      const point = toField(event.clientX, event.clientY);
      queueToss(point.x, point.y);
    } else {
      queueToss(NaN, NaN);
    }
  });

  return {
    /** The steering direction, normalised, with its length (0 when still). */
    vector() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      const length = Math.hypot(x, y);
      if (length === 0) return { x: 0, y: 0, length: 0 };
      return { x: x / length, y: y / length, length: 1 };
    },
    sneakHeld() {
      return sneak;
    },
    interactHeld() {
      return interact;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Where the last coin toss was aimed (NaN, NaN means "straight ahead"). */
    tossTarget() {
      return { x: tossX, y: tossY };
    },
  };
}

/** The walk speed for a steering vector: sneaking is slower but quieter. */
export function speedFor(sneaking) {
  return sneaking ? PLAYER.sneak : PLAYER.walk;
}
