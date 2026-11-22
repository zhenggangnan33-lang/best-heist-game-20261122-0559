// Everything the eye sees: the marble gallery, the cones, the thief, the loot,
// the alarm meter and the four screens. The game logic never draws, and this
// module never decides a rule — it only paints the state it is handed.
//
// The look this pass aims for: a museum at midnight. Warm pools of lamplight
// fall on a dark checkerboard floor, the scarab glows on its dais, every
// watcher sweeps a cone with a soft edge and a bright core, and the whole room
// darkens toward the edges — redder the louder the alarm gets. Loot sparkles,
// guards wear their suspicion as a ring, and the exit beckons once the
// Scarab is in the bag.

import { ALARM, CAMERA, FIELD, FONT, GUARD, LEVEL, PALETTE, THIEF } from './config.js';
import { ratingFor, scoreFor } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

/** Deterministic pseudo-random in [0, 1) from a seed — for sparkles and dust. */
function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function conePath(ctx, x, y, angle, halfAngle, range) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A soft radial pool of light centred on (x, y). */
function lightPool(ctx, x, y, radius, color, strength) {
  const glow = ctx.createRadialGradient(x, y, 4, x, y, radius);
  glow.addColorStop(0, color.replace('A', String(strength)));
  glow.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function scale() {
    const rect = canvas.getBoundingClientRect();
    return { x: FIELD.width / rect.width, y: FIELD.height / rect.height };
  }

  /** Map a mouse position in canvas CSS pixels into room coordinates. */
  function toRoom(mx, my) {
    const s = scale();
    return { x: mx * s.x, y: my * s.y };
  }

  function drawFloor() {
    const tile = 64;
    for (let ty = 0; ty < FIELD.height / tile; ty += 1) {
      for (let tx = 0; tx < FIELD.width / tile; tx += 1) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorLight : PALETTE.floorDark;
        ctx.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    // A crimson carpet runner runs from the entrance up to the scarab's dais.
    ctx.fillStyle = '#3a1420';
    ctx.fillRect(600, 124, 80, 548);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(606, 128);
    ctx.lineTo(606, 668);
    ctx.moveTo(674, 128);
    ctx.lineTo(674, 668);
    ctx.stroke();
    // Gold inlay border around the whole room.
    ctx.strokeStyle = PALETTE.floorGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, FIELD.width - 72, FIELD.height - 72);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, FIELD.width - 88, FIELD.height - 88);
    // Wall paintings: little framed canvases along the top wall.
    const paintings = [
      { x: 120, y: 30, w: 74, h: 52, c: '#7a4a3a' },
      { x: 300, y: 30, w: 60, h: 44, c: '#3a5a4a' },
      { x: 950, y: 30, w: 60, h: 44, c: '#4a3a6a' },
      { x: 1090, y: 30, w: 74, h: 52, c: '#6a5a2a' },
    ];
    for (const p of paintings) {
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(240, 220, 160, 0.25)';
      ctx.fillRect(p.x + 6, p.y + 6, p.w - 22, 8);
      // A tiny gilt frame.
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
    }
    // Warm lamplight pools along the walls, so the room is never flat black.
    lightPool(ctx, 200, 90, 150, 'rgba(255, 196, 110, A)', 0.10);
    lightPool(ctx, 1080, 90, 150, 'rgba(255, 196, 110, A)', 0.10);
    lightPool(ctx, 200, 640, 130, 'rgba(255, 196, 110, A)', 0.08);
    lightPool(ctx, 1080, 640, 130, 'rgba(255, 196, 110, A)', 0.08);
  }

  function drawShadows() {
    for (const s of LEVEL.shadows) {
      ctx.fillStyle = PALETTE.rug;
      ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 6, s.y + 6, s.width - 12, s.height - 12);
      // Woven border: a second, fainter inner line.
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x + 12, s.y + 12, s.width - 24, s.height - 24);
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(s.x, s.y, s.width, s.height);
    }
  }

  function drawSolids(state) {
    for (const s of state.solids) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.strokeStyle = PALETTE.wallTrim;
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 1, s.y + 1, s.width - 2, s.height - 2);
      // A soft drop shadow on the floor below each solid.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(s.x + 3, s.y + s.height - 2, s.width - 6, 5);
    }
    // The great display cases: glass tops with a glint and a gilt base.
    for (const c of [LEVEL.solids[4], LEVEL.solids[5], LEVEL.solids[6]]) {
      ctx.fillStyle = PALETTE.caseGlass;
      ctx.fillRect(c.x + 4, c.y + 4, c.width - 8, c.height - 8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x + 14, c.y + c.height - 10);
      ctx.lineTo(c.x + c.width - 30, c.y + 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c.x + 30, c.y + c.height - 8);
      ctx.lineTo(c.x + c.width - 14, c.y + 22);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x + 4, c.y + 4, c.width - 8, c.height - 8);
    }
  }

  function drawDais(state) {
    const d = LEVEL.solids[7];
    // The spotlight pool over the scarab, breathing gently.
    const breathe = 0.18 + Math.sin(state.time * 1.6) * 0.05;
    const glow = ctx.createRadialGradient(640, 96, 8, 640, 96, 150);
    glow.addColorStop(0, `rgba(242, 201, 76, ${breathe})`);
    glow.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(640, 96, 150, 0, Math.PI * 2);
    ctx.fill();
    // A visible cone of light falling from the ceiling onto the dais.
    ctx.fillStyle = 'rgba(242, 201, 76, 0.05)';
    ctx.beginPath();
    ctx.moveTo(600, 24);
    ctx.lineTo(680, 24);
    ctx.lineTo(700, 124);
    ctx.lineTo(580, 124);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.ellipse(d.x + d.width / 2, d.y + d.height / 2 + 8, 62, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#3a3048';
    ctx.beginPath();
    ctx.ellipse(d.x + d.width / 2, d.y + d.height / 2 + 2, 48, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Five little sparkles orbiting a piece of loot, twinkling on a fixed beat. */
  function drawSparkles(loot, time) {
    for (let i = 0; i < 5; i += 1) {
      const seed = loot.x * 7 + loot.y * 13 + i * 91;
      const orbit = 20 + hash01(seed) * 26;
      const speed = 0.7 + hash01(seed + 1) * 0.9;
      const a = time * speed + hash01(seed + 2) * Math.PI * 2;
      const x = loot.x + Math.cos(a) * orbit;
      const y = loot.y + Math.sin(a) * orbit * 0.7;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 3.2 + i * 1.7 + hash01(seed + 3) * 6));
      const r = 1 + twinkle * 2.2;
      ctx.fillStyle = `rgba(255, 236, 160, ${0.25 + twinkle * 0.65})`;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 2);
      ctx.lineTo(x + r * 0.6, y - r * 0.6);
      ctx.lineTo(x + r * 2, y);
      ctx.lineTo(x + r * 0.6, y + r * 0.6);
      ctx.lineTo(x, y + r * 2);
      ctx.lineTo(x - r * 0.6, y + r * 0.6);
      ctx.lineTo(x - r * 2, y);
      ctx.lineTo(x - r * 0.6, y - r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawLoot(state) {
    for (const loot of state.loot) {
      if (loot.taken) continue;
      const pulse = 1 + Math.sin(state.time * 3 + loot.x) * 0.08;
      const glow = ctx.createRadialGradient(loot.x, loot.y, 4, loot.x, loot.y, 44 * pulse);
      glow.addColorStop(0, PALETTE.lootGlow);
      glow.addColorStop(1, 'rgba(242, 201, 76, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, 44 * pulse, 0, Math.PI * 2);
      ctx.fill();
      drawSparkles(loot, state.time);
      ctx.fillStyle = PALETTE.loot;
      if (loot.id === 'scarab') {
        ctx.beginPath();
        ctx.ellipse(loot.x, loot.y, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7a5c00';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(loot.x - 10, loot.y + i * 5);
          ctx.lineTo(loot.x - 18, loot.y + i * 8);
          ctx.moveTo(loot.x + 10, loot.y + i * 5);
          ctx.lineTo(loot.x + 18, loot.y + i * 8);
          ctx.stroke();
        }
        ctx.fillStyle = '#2fbf71';
        ctx.beginPath();
        ctx.arc(loot.x, loot.y - 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // The scarab's emerald glint.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(loot.x - 1, loot.y - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (loot.id === 'gold') {
        for (let i = 0; i < 3; i += 1) {
          ctx.fillRect(loot.x - 16 + i * 11, loot.y - 6 + (i % 2) * 7, 14, 8);
        }
        ctx.strokeStyle = '#7a5c00';
        ctx.lineWidth = 1;
        ctx.strokeRect(loot.x - 16, loot.y - 6, 36, 15);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(loot.x - 14, loot.y - 4, 30, 2);
      } else {
        ctx.fillStyle = '#0a0c12';
        ctx.fillRect(loot.x - 20, loot.y - 26, 40, 52);
        ctx.fillStyle = '#5a3a6a';
        ctx.fillRect(loot.x - 16, loot.y - 22, 32, 44);
        ctx.fillStyle = '#e8c8a0';
        ctx.beginPath();
        ctx.arc(loot.x, loot.y - 8, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a4a3a';
        ctx.fillRect(loot.x - 12, loot.y + 4, 24, 16);
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(loot.x - 20, loot.y - 26, 40, 52);
      }
      // The label sits on a dark pill, so it stays readable when a guard
      // walks past the case and the two names would otherwise collide.
      ctx.font = `600 12px ${FONT}`;
      const nameW = ctx.measureText(loot.name.toUpperCase()).width;
      ctx.font = `600 11px ${FONT}`;
      const valueText = `$${loot.value.toLocaleString('en-US')}`;
      const valueW = ctx.measureText(valueText).width;
      const pillW = Math.max(nameW, valueW) + 16;
      ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
      roundRect(ctx, loot.x - pillW / 2, loot.y + 28, pillW, 32, 6);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(loot.name.toUpperCase(), loot.x, loot.y + 40);
      ctx.fillStyle = 'rgba(242, 201, 76, 0.85)';
      ctx.font = `600 11px ${FONT}`;
      ctx.fillText(valueText, loot.x, loot.y + 55);
    }
  }

  function drawTerminal(state) {
    const t = LEVEL.terminal;
    const offline = state.camerasOffline > 0;
    const hacking = state.hackProgress > 0;
    // A faint green glow while the terminal is being worked on.
    if (hacking) lightPool(ctx, t.x, t.y, 60, 'rgba(55, 201, 120, A)', 0.16);
    ctx.fillStyle = '#101623';
    ctx.fillRect(t.x - 16, t.y - 26, 32, 52);
    ctx.strokeStyle = offline ? '#5a6a7a' : '#37c978';
    ctx.lineWidth = 2;
    ctx.strokeRect(t.x - 16, t.y - 26, 32, 52);
    // Screen lines, like a tiny monitor.
    ctx.fillStyle = offline ? '#3a4356' : '#1d5c38';
    ctx.fillRect(t.x - 11, t.y - 20, 22, 3);
    ctx.fillRect(t.x - 11, t.y - 13, 16, 3);
    ctx.fillRect(t.x - 11, t.y - 6, 22, 3);
    if (hacking) {
      // Blinking cursor while the hack runs.
      const blink = Math.floor(state.time * 6) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#9df0c0';
        ctx.fillRect(t.x + 6, t.y + 2, 5, 8);
      }
      // Hack progress bar under the terminal.
      const frac = Math.min(1, state.hackProgress / 2.5);
      ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
      ctx.fillRect(t.x - 20, t.y + 32, 40, 6);
      ctx.fillStyle = '#37c978';
      ctx.fillRect(t.x - 20, t.y + 32, 40 * frac, 6);
    }
    ctx.fillStyle = offline ? '#5a6a7a' : '#37c978';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(offline ? 'OFF' : 'CAM', t.x, t.y - 32);
    ctx.fillStyle = offline ? '#8b93a3' : '#9df0c0';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(offline ? `${Math.ceil(state.camerasOffline)}s` : 'HOLD E', t.x, t.y + 46);
  }

  function drawExit(state) {
    const e = LEVEL.exit;
    const open = state.scarab;
    // The exit glows and beckons once the Scarab is in the bag.
    if (open) {
      const pulse = 0.5 + Math.sin(state.time * 4) * 0.3;
      const glow = ctx.createRadialGradient(
        e.x + e.width / 2, e.y + e.height / 2, 4,
        e.x + e.width / 2, e.y + e.height / 2, 90,
      );
      glow.addColorStop(0, `rgba(55, 201, 120, ${pulse * 0.45})`);
      glow.addColorStop(1, 'rgba(55, 201, 120, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(e.x + e.width / 2, e.y + e.height / 2, 90, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#0c2a1a';
    ctx.fillRect(e.x, e.y, e.width, e.height);
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x, e.y, e.width, e.height);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x + e.width / 2, e.y + 17);
    if (!state.scarab) {
      ctx.fillStyle = 'rgba(238, 241, 245, 0.75)';
      ctx.font = `12px ${FONT}`;
      ctx.fillText('needs the Scarab', e.x + e.width / 2, e.y - 8);
    } else {
      // Animated chevrons pointing down into the exit, one step at a time.
      const step = Math.floor(state.time * 3) % 3;
      ctx.fillStyle = 'rgba(55, 201, 120, 0.9)';
      for (let i = 0; i < 3; i += 1) {
        const alpha = i === step ? 1 : 0.35;
        ctx.globalAlpha = alpha;
        const y = e.y - 34 + i * 10;
        ctx.beginPath();
        ctx.moveTo(e.x + e.width / 2 - 12, y);
        ctx.lineTo(e.x + e.width / 2, y + 8);
        ctx.lineTo(e.x + e.width / 2 + 12, y);
        ctx.lineTo(e.x + e.width / 2 + 12, y + 5);
        ctx.lineTo(e.x + e.width / 2, y + 13);
        ctx.lineTo(e.x + e.width / 2 - 12, y + 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      const off = state.camerasOffline > 0;
      // A camera cone has two layers: a wide faint wash and a brighter core,
      // so the eye reads both the sweep and its dangerous middle.
      conePath(ctx, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range);
      ctx.fillStyle = off ? PALETTE.coneOff : 'rgba(255, 170, 60, 0.16)';
      ctx.fill();
      if (!off) {
        conePath(ctx, camera.x, camera.y, camera.angle, CAMERA.halfAngle * 0.55, CAMERA.range);
        ctx.fillStyle = 'rgba(255, 170, 60, 0.22)';
        ctx.fill();
        // The scan line: a bright arc riding the cone's leading edge.
        ctx.strokeStyle = 'rgba(255, 200, 110, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(camera.x, camera.y, CAMERA.range * 0.92, camera.angle - 0.06, camera.angle + 0.06);
        ctx.stroke();
      }
      conePath(ctx, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range);
      ctx.strokeStyle = off ? 'rgba(120,130,145,0.25)' : PALETTE.coneCameraEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
      // The wall mount: a bracket and a lens that points along the sweep.
      ctx.fillStyle = off ? '#5a6a7a' : '#ffb13c';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d0f16';
      ctx.beginPath();
      ctx.arc(camera.x + Math.cos(camera.angle) * 5, camera.y + Math.sin(camera.angle) * 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = off ? '#5a6a7a' : '#ffb13c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(camera.x - 8, camera.y);
      ctx.lineTo(camera.x + 8, camera.y);
      ctx.stroke();
    }
    for (const guard of state.guards) {
      const hot = guard.suspicion;
      // Guard cones fade with distance and heat up with suspicion.
      conePath(ctx, guard.x, guard.y, guard.angle, GUARD.viewHalfAngle, GUARD.viewRange);
      const grad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, GUARD.viewRange);
      grad.addColorStop(0, `rgba(229, 83, 75, ${0.34 + hot * 0.2})`);
      grad.addColorStop(0.7, `rgba(229, 83, 75, ${0.12 + hot * 0.1})`);
      grad.addColorStop(1, 'rgba(229, 83, 75, 0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = hot > 0.68 ? 'rgba(255, 107, 97, 0.9)' : PALETTE.coneEdge;
      ctx.lineWidth = hot > 0.68 ? 2 : 1;
      ctx.stroke();
      // A hot guard's cone gets a bright leading edge.
      if (hot > 0.25) {
        ctx.strokeStyle = `rgba(255, 107, 97, ${0.25 + hot * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, GUARD.viewRange * 0.96, guard.angle - GUARD.viewHalfAngle, guard.angle + GUARD.viewHalfAngle);
        ctx.stroke();
      }
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const hot = guard.suspicion;
      // Alertness ring: a pulsing halo that grows as the guard gets suspicious.
      if (hot > 0.05) {
        const pulse = 1 + Math.sin(state.time * 5) * 0.06;
        const ringR = (GUARD.radius + 10) * pulse + hot * 10;
        ctx.strokeStyle = hot > 0.68
          ? `rgba(229, 83, 75, ${0.55 + Math.sin(state.time * 8) * 0.25})`
          : `rgba(255, 209, 102, ${0.35 + hot * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        // The ring fills like a clock as suspicion climbs.
        ctx.strokeStyle = hot > 0.68 ? '#e5534b' : '#ffd166';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, ringR, -Math.PI / 2, -Math.PI / 2 + hot * Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.guardTrim;
      ctx.lineWidth = 2;
      ctx.stroke();
      // A chasing guard leans forward: his nose points further out.
      const nose = guard.state === 'chase' ? GUARD.radius + 10 : GUARD.radius + 6;
      ctx.strokeStyle = '#eef1f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * nose, guard.y + Math.sin(guard.angle) * nose);
      ctx.stroke();
      ctx.fillStyle = '#dfe6f2';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y - GUARD.radius - 8);
      if (guard.suspicion > 0.68) {
        ctx.fillStyle = '#ff6b61';
        ctx.font = `900 22px ${FONT}`;
        ctx.fillText('!', guard.x, guard.y - GUARD.radius - 24);
      } else if (guard.suspicion > 0.25) {
        ctx.fillStyle = '#ffd166';
        ctx.font = `900 20px ${FONT}`;
        ctx.fillText('?', guard.x, guard.y - GUARD.radius - 24);
      }
      // A small "Zzz" drift when the guard is paused at a waypoint, looking around.
      if (guard.state === 'patrol' && guard.waitLeft > 0) {
        ctx.fillStyle = 'rgba(157, 180, 212, 0.8)';
        ctx.font = `700 10px ${FONT}`;
        ctx.fillText('…', guard.x + GUARD.radius + 8, guard.y - GUARD.radius - 2);
      }
      if (guard.suspicion > 0.05) {
        ctx.fillStyle = 'rgba(10, 12, 18, 0.8)';
        ctx.fillRect(guard.x - 16, guard.y + GUARD.radius + 4, 32, 5);
        ctx.fillStyle = guard.suspicion > 0.68 ? '#e5534b' : '#ffd166';
        ctx.fillRect(guard.x - 16, guard.y + GUARD.radius + 4, 32 * guard.suspicion, 5);
      }
    }
  }

  function drawThief(state) {
    const t = state.thief;
    // Footstep dust: faint puffs behind a moving thief, on a fixed beat.
    if (t.moving) {
      for (let i = 0; i < 3; i += 1) {
        const age = ((state.time * 2.4 + i * 0.33) % 1);
        const back = 10 + age * 22;
        const x = t.x - Math.cos(t.facing) * back + Math.sin(i * 17 + state.time) * 3;
        const y = t.y - Math.sin(t.facing) * back + Math.cos(i * 13 + state.time) * 3;
        ctx.fillStyle = `rgba(232, 228, 216, ${0.14 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + age * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const crouch = t.sneaking ? 0.85 : 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 5, THIEF.radius, THIEF.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // A hooded cloak: a triangle of dark cloth pointing where Vesper faces.
    ctx.fillStyle = '#232838';
    ctx.beginPath();
    ctx.moveTo(t.x + Math.cos(t.facing) * THIEF.radius * crouch, t.y + Math.sin(t.facing) * THIEF.radius * crouch);
    ctx.arc(t.x, t.y, THIEF.radius * crouch, t.facing + 2.1, t.facing - 2.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.thiefTrim;
    ctx.lineWidth = 2;
    if (t.sneaking) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // The hood: pale, with a gold clasp at the throat.
    ctx.fillStyle = PALETTE.thief;
    ctx.beginPath();
    ctx.arc(t.x + Math.cos(t.facing) * 5, t.y + Math.sin(t.facing) * 5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.thiefTrim;
    ctx.beginPath();
    ctx.arc(t.x + Math.cos(t.facing) * 8, t.y + Math.sin(t.facing) * 8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // A faint gold ring marks Vesper at a glance, even in a crowd of cones.
    const ringPulse = 0.3 + Math.sin(state.time * 2.5) * 0.12;
    ctx.strokeStyle = `rgba(242, 201, 76, ${ringPulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, THIEF.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    // The grab flourish: the loot's value floats up from the case for a second.
    if (state.lastGrab && state.time - state.lastGrab.at < 1.2) {
      const age = (state.time - state.lastGrab.at) / 1.2;
      ctx.fillStyle = `rgba(242, 201, 76, ${1 - age})`;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`+$${state.lastGrab.value.toLocaleString('en-US')}`, state.lastGrab.x, state.lastGrab.y - 24 - age * 26);
    }
    if (state.coin) {
      // A tossed coin spins as it glints.
      const spin = Math.abs(Math.sin(state.time * 6));
      ctx.strokeStyle = PALETTE.loot;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.coin.x, state.coin.y, 10 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.ellipse(state.coin.x, state.coin.y, 2 + spin * 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.lootTarget || state.hackProgress > 0) {
      const total = state.lootTarget ? (state.lootTarget.main ? 1.3 : 0.7) : 2.5;
      const done = state.lootTarget ? state.lootProgress : state.hackProgress;
      ctx.strokeStyle = 'rgba(238, 241, 245, 0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, THIEF.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(t.x, t.y, THIEF.radius + 9, -Math.PI / 2, -Math.PI / 2 + (done / total) * Math.PI * 2);
      ctx.stroke();
      // A ticking label over the channel, so the wait reads as progress.
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.lootTarget ? 'CRACKING…' : 'HACKING…', t.x, t.y - THIEF.radius - 14);
    }
  }

  function drawHud(state, screen) {
    const hot = state.alarm >= ALARM.huntAt;
    const critical = state.alarm >= 90;
    // The panel border flashes red while the alarm is critical.
    const borderAlpha = critical ? 0.55 + Math.sin(state.time * 10) * 0.4 : 0;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 10, FIELD.width - 24, 46, 8);
    ctx.fill();
    if (borderAlpha > 0) {
      ctx.strokeStyle = `rgba(229, 83, 75, ${borderAlpha})`;
      ctx.lineWidth = 2;
      roundRect(ctx, 12, 10, FIELD.width - 24, 46, 8);
      ctx.stroke();
    }
    // Alarm meter.
    ctx.fillStyle = hot ? '#ff8a80' : PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(hot ? 'ALARM!' : 'ALARM', 26, 29);
    const ax = 92;
    const aw = 230;
    ctx.fillStyle = '#1a1e2a';
    roundRect(ctx, ax, 18, aw, 18, 4);
    ctx.fill();
    const frac = state.alarm / ALARM.max;
    const alarmGrad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
    alarmGrad.addColorStop(0, '#37c978');
    alarmGrad.addColorStop(0.55, '#f2c94c');
    alarmGrad.addColorStop(1, '#e5534b');
    ctx.fillStyle = alarmGrad;
    if (frac > 0.01) {
      // A hot meter glows; a critical one pulses.
      if (hot) {
        ctx.save();
        ctx.shadowColor = '#e5534b';
        ctx.shadowBlur = critical ? 14 + Math.sin(state.time * 10) * 6 : 8;
      }
      roundRect(ctx, ax, 18, Math.max(8, aw * frac), 18, 4);
      ctx.fill();
      if (hot) ctx.restore();
    }
    ctx.strokeStyle = 'rgba(238, 241, 245, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax + aw * 0.6, 16);
    ctx.lineTo(ax + aw * 0.6, 38);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${Math.round(state.alarm)}`, ax + aw + 10, 31);
    // Objective.
    ctx.textAlign = 'center';
    ctx.fillStyle = state.scarab ? PALETTE.exit : PALETTE.gold;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(state.scarab ? 'SCARAB SECURED — GET TO THE EXIT' : 'STEAL THE JADE SCARAB, THEN ESCAPE', FIELD.width / 2 + 60, 30);
    // Loot, coins, time.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 14px ${FONT}`;
    const lootText = `$${state.lootValue.toLocaleString('en-US')}`;
    ctx.fillText(`LOOT ${lootText}`, FIELD.width - 210, 30);
    ctx.fillStyle = PALETTE.loot;
    ctx.fillText('●'.repeat(state.coins) + '○'.repeat(3 - state.coins), FIELD.width - 96, 30);
    ctx.fillStyle = PALETTE.muted;
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width - 26, 30);
    if (state.camerasOffline > 0) {
      ctx.fillStyle = '#37c978';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`CAMERAS OFFLINE ${Math.ceil(state.camerasOffline)}s`, 26, 76);
    }
    if (state.stats.nearMiss > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`NEAR MISS ×${state.stats.nearMiss}`, 26, state.camerasOffline > 0 ? 96 : 76);
    }
    if (screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(238, 241, 245, 0.55)';
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('WASD move · SHIFT sneak · E grab / hack · Q or click toss a coin · P pause · M mute', 26, FIELD.height - 16);
    }
  }

  /** The vignette: the room darkens toward the edges, redder as the alarm climbs. */
  function drawVignette(state) {
    const heat = state.alarm / ALARM.max;
    const edge = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(1, `rgba(${Math.round(20 + heat * 60)}, 4, 10, ${0.42 + heat * 0.25})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(title, lines, accent, dim = 0.72) {
    ctx.fillStyle = `rgba(8, 10, 16, ${dim})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const h = 210 + lines.length * 30;
    const y0 = (FIELD.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, FIELD.width / 2 - 330, y0, 660, h, 12);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    roundRect(ctx, FIELD.width / 2 - 330, y0, 660, h, 12);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = `900 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, y0 + 82);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, y0 + 138 + i * 30);
    });
  }

  function drawTitle(state, best) {
    panel('THE GILDED VAULT', [
      'A midnight heist in the Marrow Museum.',
      'Lift the Jade Scarab past Marlowe, Iris and Bram,',
      'dodge the sweeping cameras, and slip out the exit.',
      '',
      'WASD / arrows — move      SHIFT — sneak',
      'E — grab loot / hack the camera terminal',
      'Q or click — toss a coin to lure a guard',
      '',
      best > 0 ? `Best loot yet: $${best.toLocaleString('en-US')}` : 'No loot yet. The vault is waiting.',
      '',
      'Press SPACE or click to begin',
    ], PALETTE.gold, 0.45);
  }

  function drawPaused() {
    panel('PAUSED', ['Take a breath. The guards keep their rounds.', '', 'Press P or SPACE to carry on'], PALETTE.muted);
  }

  function drawCaught(state) {
    panel('CAUGHT!', [
      `${state.caughtBy ? `${state.caughtBy} caught you` : 'The alarm hit lockdown'} — the vault keeps its gold.`,
      '',
      `Loot kept: $${state.lootValue.toLocaleString('en-US')}   ·   Time: ${Math.floor(state.time)}s`,
      `Peak alarm: ${Math.round(state.maxAlarm)}` + (state.stats.nearMiss > 0 ? `   ·   Near misses: ${state.stats.nearMiss}` : ''),
      '',
      'Press R to run it again',
    ], PALETTE.danger);
  }

  function drawWin(state, best) {
    const score = scoreFor(state);
    const lines = [
      'You slipped out with the Jade Scarab.',
      '',
      `Loot: $${score.loot.toLocaleString('en-US')}   ·   Time bonus: $${score.timeBonus.toLocaleString('en-US')}`,
    ];
    if (score.ghostBonus > 0) lines.push(`Ghost bonus: $${score.ghostBonus.toLocaleString('en-US')}   ·   Peak alarm: ${Math.round(state.maxAlarm)}`);
    if (score.nearMissBonus > 0) lines.push(`Near-miss bonus: $${score.nearMissBonus.toLocaleString('en-US')} (${state.stats.nearMiss} close call${state.stats.nearMiss === 1 ? '' : 's'})`);
    lines.push(`Total score: $${score.total.toLocaleString('en-US')}   ·   Time: ${Math.floor(state.time)}s   ·   Peak alarm: ${Math.round(state.maxAlarm)}`);
    lines.push(`Rating: ${ratingFor(state)}   ·   Best loot yet: $${Math.max(best, state.lootValue).toLocaleString('en-US')}`);
    lines.push('');
    lines.push('Press R to run it again');
    panel('CLEAN GETAWAY', lines, PALETTE.gold);
  }

  function draw(state, screen, best, rating) {
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawFloor();
    drawShadows();
    drawDais(state);
    drawSolids(state);
    drawLoot(state);
    drawTerminal(state);
    drawExit(state);
    drawCones(state);
    drawGuards(state);
    drawThief(state);
    drawVignette(state);
    if (screen !== SCREEN_TITLE) drawHud(state, screen);
    if (screen === SCREEN_TITLE) {
      drawHud(state, screen);
      drawTitle(state, best);
    } else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_CAUGHT) drawCaught(state);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw, toRoom };
}
