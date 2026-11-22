// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 museum floor is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Flat shapes and canvas text: the marble
// floor, the rugs, the glass cases, the vision cones, the thief in her cloak,
// and the alarm meter that tells you how close the night is to going wrong.
import { DETECT, FIELD, FONT, PALETTE, PLAYER } from './config.js';
import { CASES, EXIT_ZONE, RUGS, TERMINAL, WALLS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_CAUGHT = 'caught';

/** The end panel's width; its height grows with its lines. */
const PANEL = { width: 620, top: 150, line: 34, bottom: 76 };
const ALARM = { x: 470, y: 20, w: 340, h: 18 };

function money(value) {
  return `$${value.toLocaleString('en-US')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  /** A museum-floor point from a pointer's client coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * (canvas.width / rect.width) - view.x) / view.scale,
      y: ((clientY - rect.top) * (canvas.height / rect.height) - view.y) / view.scale,
    };
  }

  function drawCone(x, y, angle, range, halfAngle, color, alpha) {
    context.fillStyle = color;
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Marble tiles, faint enough to stay in the background.
    context.strokeStyle = PALETTE.floorTile;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    for (const rug of RUGS) {
      context.fillStyle = PALETTE.rug;
      context.fillRect(rug.x, rug.y, rug.w, rug.h);
      context.strokeStyle = PALETTE.rugBorder;
      context.lineWidth = 4;
      context.strokeRect(rug.x + 6, rug.y + 6, rug.w - 12, rug.h - 12);
      context.strokeStyle = PALETTE.rugPattern;
      context.lineWidth = 2;
      context.strokeRect(rug.x + 18, rug.y + 18, rug.w - 36, rug.h - 36);
    }
    // The exit mat, green and waiting by the doorway.
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT_ZONE.x, EXIT_ZONE.y, EXIT_ZONE.w, EXIT_ZONE.h);
    context.fillStyle = PALETTE.text;
    text('EXIT', EXIT_ZONE.x + EXIT_ZONE.w / 2, EXIT_ZONE.y + EXIT_ZONE.h / 2 + 7, 20, PALETTE.text, 'center');
  }

  function drawWallsAndCases(state) {
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      if (wall.h <= 24 && wall.w > wall.h) context.fillRect(wall.x, wall.y, wall.w, 4);
      else context.fillRect(wall.x, wall.y, 4, wall.h);
    }
    for (const box of CASES) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(box.x, box.y, box.w, box.h);
      context.fillStyle = PALETTE.caseGlass;
      context.globalAlpha = 0.32;
      context.fillRect(box.x + 5, box.y + 5, box.w - 10, box.h - 10);
      context.globalAlpha = 1;
      context.strokeStyle = PALETTE.caseGold;
      context.lineWidth = 3;
      context.strokeRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
    }
    // The Duchess, framed on the duchess wing's wall.
    context.fillStyle = PALETTE.painting;
    context.fillRect(896, 428, 104, 26);
    context.strokeStyle = PALETTE.caseGold;
    context.lineWidth = 3;
    context.strokeRect(896, 428, 104, 26);
    context.fillStyle = '#2c2118';
    context.beginPath();
    context.arc(948, 441, 6, 0, Math.PI * 2);
    context.fill();
    // The camera terminal, a low console against the bottom wall.
    context.fillStyle = PALETTE.terminal;
    context.fillRect(TERMINAL.rect.x, TERMINAL.rect.y, TERMINAL.rect.w, TERMINAL.rect.h);
    context.fillStyle = state.terminal.hacked > 0 ? PALETTE.alarmLow : PALETTE.coneCamera;
    context.beginPath();
    context.arc(TERMINAL.x, TERMINAL.rect.y + 12, 5, 0, Math.PI * 2);
    context.fill();
    text('CAM', TERMINAL.x, TERMINAL.rect.y + 32, 11, PALETTE.text, 'center');
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      if (item.id === 'scarab') {
        // The Jade Scarab: a green gem in its case, catching the light.
        context.fillStyle = PALETTE.scarab;
        context.beginPath();
        context.moveTo(item.x, item.y - 34);
        context.lineTo(item.x + 13, item.y - 21);
        context.lineTo(item.x + 9, item.y - 8);
        context.lineTo(item.x - 9, item.y - 8);
        context.lineTo(item.x - 13, item.y - 21);
        context.closePath();
        context.fill();
        context.fillStyle = '#d9ffe9';
        context.beginPath();
        context.arc(item.x - 4, item.y - 24, 3, 0, Math.PI * 2);
        context.fill();
      } else if (item.id === 'gold') {
        // The Gold Bars: three stacked ingots.
        context.fillStyle = PALETTE.gold;
        for (let bar = 0; bar < 3; bar += 1) {
          const bx = item.x - 24 + bar * 8;
          const by = item.y - 18 - bar * 9;
          context.beginPath();
          context.moveTo(bx, by);
          context.lineTo(bx + 26, by);
          context.lineTo(bx + 22, by + 8);
          context.lineTo(bx + 4, by + 8);
          context.closePath();
          context.fill();
        }
      }
      // A soft ring marks every piece of loot you can still grab.
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.globalAlpha = 0.55 + 0.25 * Math.sin(state.time * 3);
      context.beginPath();
      context.arc(item.x, item.y, 30, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
      text(item.name, item.x, item.y + 46, 14, PALETTE.gold, 'center');
      text(money(item.value), item.x, item.y + 63, 13, PALETTE.muted, 'center');
    }
    // The Duchess's label hangs under her frame.
    const duchess = state.loot.find((item) => item.id === 'duchess');
    if (duchess && !duchess.taken) {
      text('The Duchess', duchess.x, duchess.y + 46, 14, PALETTE.gold, 'center');
      text(money(duchess.value), duchess.x, duchess.y + 63, 13, PALETTE.muted, 'center');
    }
  }

  function drawWatchers(state) {
    for (const camera of state.cameras) {
      const off = camera.disabled > 0;
      drawCone(camera.x, camera.y, camera.angle, DETECT.cameraRange, DETECT.cameraHalfAngle, PALETTE.coneCamera, off ? 0.05 : 0.14);
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 11, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(camera.x, camera.y);
      context.lineTo(camera.x + Math.cos(camera.angle) * 16, camera.y + Math.sin(camera.angle) * 16);
      context.stroke();
      if (off) text('OFFLINE', camera.x, camera.y + 28, 11, PALETTE.alarmLow, 'center');
    }
    for (const guard of state.guards) {
      drawCone(guard.x, guard.y, guard.angle, DETECT.guardRange, DETECT.guardHalfAngle, PALETTE.coneGuard, guard.mode === 'hunt' ? 0.22 : 0.13);
      // A navy uniform, a gold-trimmed cap, and the direction he is facing.
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardTrim;
      context.beginPath();
      context.arc(guard.x, guard.y, 15, guard.angle - 0.9, guard.angle + 0.9);
      context.lineTo(guard.x, guard.y);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.text;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 6, guard.y + Math.sin(guard.angle) * 6, 3.5, 0, Math.PI * 2);
      context.fill();
      text(guard.name, guard.x, guard.y - 24, 13, PALETTE.text, 'center');
      if (guard.mode === 'hunt') text('!', guard.x, guard.y - 40, 18, PALETTE.alarmHigh, 'center');
      if (guard.mode === 'investigate') text('?', guard.x, guard.y - 40, 18, PALETTE.gold, 'center');
    }
  }

  function drawCoins(state) {
    for (const coin of state.coins) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#8a6d2f';
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    // Vesper: a hooded cloak, teal-trimmed, facing where she is headed.
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius - 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.playerTrim;
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius - 2, player.angle - 0.7, player.angle + 0.7);
    context.stroke();
    context.fillStyle = PALETTE.playerTrim;
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 7, player.y + Math.sin(player.angle) * 7, 3, 0, Math.PI * 2);
    context.fill();
    // A faint ring so the thief reads against the dark marble.
    context.strokeStyle = 'rgba(127, 224, 195, 0.45)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius + 4, 0, Math.PI * 2);
    context.stroke();
    if (player.sneak) text('sneaking', player.x, player.y - 28, 12, PALETTE.playerTrim, 'center');
    // A progress ring while a grab or a hack is under way.
    const progress = state.grabId !== null ? state.grabProgress : state.hackProgress;
    if (progress > 0) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius + 9, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, best) {
    // Loot on the left: what is taken, what is still out there.
    text('LOOT', 30, 34, 13, PALETTE.muted);
    state.loot.forEach((item, index) => {
      const y = 56 + index * 22;
      context.fillStyle = item.taken ? PALETTE.scarab : PALETTE.dim;
      context.beginPath();
      context.arc(38, y - 4, 5, 0, Math.PI * 2);
      context.fill();
      text(`${item.name}  ${money(item.value)}`, 52, y, 15, item.taken ? PALETTE.text : PALETTE.muted);
    });
    // The alarm meter, top centre: green while quiet, red when the hunt is on.
    const alarmColor = state.alarm < 30 ? PALETTE.alarmLow : state.alarm < 60 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    text('ALARM', ALARM.x + ALARM.w / 2, ALARM.y - 6, 13, PALETTE.muted, 'center');
    context.fillStyle = PALETTE.panel;
    context.fillRect(ALARM.x, ALARM.y, ALARM.w, ALARM.h);
    context.fillStyle = alarmColor;
    context.fillRect(ALARM.x + 2, ALARM.y + 2, Math.max(0, (ALARM.w - 4) * (state.alarm / 100)), ALARM.h - 4);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(ALARM.x, ALARM.y, ALARM.w, ALARM.h);
    text(`${Math.round(state.alarm)}`, ALARM.x + ALARM.w + 10, ALARM.y + 15, 15, alarmColor);
    if (state.terminal.hacked > 0) {
      text(`CAMERAS OFF ${Math.ceil(state.terminal.hacked)}s`, ALARM.x + ALARM.w / 2, ALARM.y + 38, 13, PALETTE.alarmLow, 'center');
    }
    // Coins, time and the best loot, top right.
    text(`Coins ${'●'.repeat(state.coinsLeft)}${'○'.repeat(3 - state.coinsLeft)}`, FIELD.width - 30, 34, 15, PALETTE.gold, 'right');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width - 30, 58, 15, PALETTE.text, 'right');
    text(`Best loot ${money(best)}`, FIELD.width - 30, 82, 13, PALETTE.muted, 'right');
    // The job, under the loot list; the controls ride a footer strip of their own.
    const next = state.loot.find((item) => !item.taken);
    text(next ? `Next: steal ${next.name}` : 'All loot taken — reach the EXIT', 30, 128, 15, PALETTE.gold);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, FIELD.height - 22, FIELD.width, 22);
    text('WASD move · Shift sneak · E grab / hack · Q coin · P pause · M mute · R restart', FIELD.width / 2, FIELD.height - 7, 13, PALETTE.dim, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 78, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the museum, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawWallsAndCases(state);
    drawLoot(state);
    drawWatchers(state);
    drawCoins(state);
    drawPlayer(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'THE GILDED VAULT',
        [
          'A heist at the Marrow Museum. Steal the Jade Scarab',
          'and slip out the exit — quietly, if you can.',
          `Scarab ${money(50000)}  ·  Gold Bars ${money(12000)}  ·  The Duchess ${money(18000)}`,
          `Best loot so far: ${money(best)}`,
        ],
        'Press Space or click to begin',
      );
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.', 'The alarm will not.'], 'Press P to resume');
    } else if (screen === SCREEN_WON) {
      drawPanel(
        `CLEAN GETAWAY — ${state.rating}`,
        [
          `Loot  ${money(state.lootValue)}`,
          `Time bonus  ${money(state.timeBonus || 0)}`,
          `Ghost bonus  ${money(state.ghostBonus || 0)}`,
          `Score  ${money(state.score)}   ·   Best loot ${money(best)}`,
        ],
        'Press Space to steal again',
        state.rating === 'GHOST' ? PALETTE.scarab : PALETTE.gold,
      );
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel(
        'CAUGHT!',
        [
          `The Marrow Museum keeps its Scarab tonight.`,
          `Loot grabbed  ${money(state.lootValue)}   ·   Alarm peaked at ${Math.round(state.maxAlarm)}`,
        ],
        'Press R or Space to try again',
        PALETTE.alarmHigh,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
