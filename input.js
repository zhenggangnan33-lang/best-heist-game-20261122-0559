// Keyboard and mouse, read fresh every frame. The game asks this module three
// questions: which way is the thief walking, what was just pressed, and where
// is the mouse pointing inside the room.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_COIN = 16;

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let clicked = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(codeOf(event));
    held.add(codeOf(event));
  });
  window.addEventListener('keyup', (event) => held.delete(codeOf(event)));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    clicked = true;
  });

  function direction() {
    let x = 0;
    let y = 0;
    if (KEYS.left.some((k) => held.has(k))) x -= 1;
    if (KEYS.right.some((k) => held.has(k))) x += 1;
    if (KEYS.up.some((k) => held.has(k))) y -= 1;
    if (KEYS.down.some((k) => held.has(k))) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function takeActions() {
    let actions = 0;
    if (pressed.has('Space') || pressed.has('Enter') || clicked) actions |= ACTION_CONFIRM;
    if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
    if (pressed.has('KeyM')) actions |= ACTION_MUTE;
    if (pressed.has('KeyR')) actions |= ACTION_RESTART;
    if (pressed.has('KeyQ')) actions |= ACTION_COIN;
    pressed.clear();
    clicked = false;
    return actions;
  }

  return {
    direction,
    takeActions,
    sneaking() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    interacting() {
      return held.has('KeyE');
    },
    /** Mouse position in canvas pixels (the renderer maps it into the room). */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
  };
}
