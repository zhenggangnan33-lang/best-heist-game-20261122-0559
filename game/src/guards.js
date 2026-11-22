// The guards and the cameras: how they move, how they look, and how fast
// being seen turns into alarm. Nothing here draws or touches the browser.
import { CAMERA_OFF_SECONDS, COINS, DETECT, GUARD } from './config.js';
import { canSee, moveCircle, rugAt } from './world.js';

/** Turn `angle` toward `target` by at most `rate * dt` radians. */
function turnToward(angle, target, rate, dt) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = rate * dt;
  if (Math.abs(diff) <= step) return target;
  return angle + Math.sign(diff) * step;
}

/**
 * One guard's step. Patrolling guards walk their loop and pause at each
 * corner to look around; hunting guards run at the thief; an investigating
 * guard walks to where a coin landed and looks it over before going back.
 */
function stepGuard(guard, state, dt) {
  const player = state.player;
  if (state.alarm >= DETECT.huntAt && guard.mode !== 'hunt') {
    guard.mode = 'hunt';
  } else if (state.alarm < DETECT.calmAt && guard.mode === 'hunt') {
    guard.mode = 'patrol';
  }

  if (guard.mode === 'hunt') {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) {
      const speed = GUARD.hunt * dt;
      const moved = moveCircle(guard.x, guard.y, GUARD.radius, (dx / distance) * speed, (dy / distance) * speed);
      guard.x = moved.x;
      guard.y = moved.y;
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 7, dt);
    }
    return;
  }

  if (guard.mode === 'investigate') {
    const dx = guard.investigateX - guard.x;
    const dy = guard.investigateY - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 8) {
      const speed = GUARD.investigate * dt;
      const moved = moveCircle(guard.x, guard.y, GUARD.radius, (dx / distance) * speed, (dy / distance) * speed);
      guard.x = moved.x;
      guard.y = moved.y;
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 7, dt);
      return;
    }
    guard.investigateWait -= dt;
    guard.angle += Math.sin(state.time * 1.7 + guard.x) * 0.9 * dt;
    if (guard.investigateWait <= 0) guard.mode = 'patrol';
    return;
  }

  // Patrol.
  if (guard.waiting > 0) {
    guard.waiting -= dt;
    guard.scan += dt;
    guard.angle += Math.sin(guard.scan * 2.2) * 1.1 * dt;
    return;
  }
  const target = guard.points[guard.leg];
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) {
    guard.leg = (guard.leg + 1) % guard.points.length;
    guard.waiting = GUARD.waitAtWaypoint;
    guard.scan = 0;
    return;
  }
  const speed = guard.speed * dt;
  const moved = moveCircle(guard.x, guard.y, GUARD.radius, (dx / distance) * speed, (dy / distance) * speed);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 7, dt);
}

/** The cameras sweep back and forth until a hack switches them off. */
function stepCameras(state, dt) {
  for (const camera of state.cameras) {
    if (camera.disabled > 0) camera.disabled = Math.max(0, camera.disabled - dt);
    camera.angle = camera.base + Math.sin((state.time * Math.PI * 2) / camera.period + camera.phase) * camera.sweep;
  }
  if (state.terminal.hacked > 0) state.terminal.hacked = Math.max(0, state.terminal.hacked - dt);
}

/** Move every guard and camera one step. */
export function stepWatchers(state, dt) {
  for (const guard of state.guards) stepGuard(guard, state, dt);
  stepCameras(state, dt);
}

/**
 * How fast the alarm is rising right now, and which watchers can see the
 * thief. Sneaking and shadow rugs both slow it down; closeness speeds it up.
 */
export function computeDetection(state) {
  const player = state.player;
  const sneak = player.sneak ? DETECT.sneakFactor : 1;
  const rug = rugAt(player.x, player.y) ? DETECT.rugFactor : 1;
  let rate = 0;
  const observers = [];
  for (const guard of state.guards) {
    if (!canSee(guard.x, guard.y, guard.angle, DETECT.guardRange, DETECT.guardHalfAngle, player.x, player.y)) continue;
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    const proximity = Math.max(0.3, Math.min(1, 1.15 - distance / DETECT.guardRange));
    rate += DETECT.guardRate * proximity * sneak * rug;
    observers.push({ x: guard.x, y: guard.y, kind: 'guard' });
  }
  for (const camera of state.cameras) {
    if (camera.disabled > 0) continue;
    if (!canSee(camera.x, camera.y, camera.angle, DETECT.cameraRange, DETECT.cameraHalfAngle, player.x, player.y)) continue;
    const distance = Math.hypot(player.x - camera.x, player.y - camera.y);
    const proximity = Math.max(0.3, Math.min(1, 1.15 - distance / DETECT.cameraRange));
    rate += DETECT.cameraRate * proximity * sneak * rug;
    observers.push({ x: camera.x, y: camera.y, kind: 'camera' });
  }
  return { rate, observers };
}

/** Send the nearest patrolling guard to look at a coin that just landed. */
export function sendInvestigator(state, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const guard of state.guards) {
    if (guard.mode !== 'patrol') continue;
    const d = Math.hypot(guard.x - x, guard.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = guard;
    }
  }
  if (best === null || bestDistance > COINS.hearRadius) return false;
  best.mode = 'investigate';
  best.investigateX = x;
  best.investigateY = y;
  best.investigateWait = 2.5;
  return true;
}

/** Switch the cameras off for a while after a successful hack. */
export function disableCameras(state) {
  for (const camera of state.cameras) camera.disabled = CAMERA_OFF_SECONDS;
  state.terminal.hacked = CAMERA_OFF_SECONDS;
}
