// The guards and the cameras: how they walk their rounds, what their cones
// catch, and how suspicion turns into a chase. Nothing here draws anything.

import { ALARM, CAMERA, COIN, GUARD, LEVEL, THIEF } from './config.js';

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Smoothstep easing: 0 at the ends of a sweep, 1 in the middle. */
function smoothstep(u) {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

/**
 * A camera's sweep eased through smoothstep: it lingers at each end of its
 * arc and glides through the middle, so a careful thief can read the rhythm.
 * A pure function of time, so the game stays deterministic.
 */
function cameraAngle(camera, time) {
  const u = (Math.sin(time * 0.55 + camera.phase) + 1) / 2;
  return camera.base + (smoothstep(u) * 2 - 1) * camera.sweep;
}

/** How exposed the thief is to one watcher: 0 is unseen, 1 is point blank. */
export function exposure(watcherX, watcherY, watcherAngle, halfAngle, range, world, thief) {
  const dx = thief.x - watcherX;
  const dy = thief.y - watcherY;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), watcherAngle)) > halfAngle) return 0;
  if (!world.lineOfSight(watcherX, watcherY, thief.x, thief.y)) return 0;
  let seen = 1 - dist / range;
  if (thief.sneaking) seen *= THIEF.sneakVisibility;
  if (world.inShadow(thief.x, thief.y)) seen *= THIEF.shadowVisibility;
  if (thief.moving) seen *= 1.12;
  return Math.min(1, seen);
}

/**
 * Advance every guard and camera one step. Returns a bundle of what happened:
 * whether anyone can see the thief right now, and whether a guard caught him.
 */
export function stepWatchers(world, dt) {
  const state = world.state;
  const thief = state.thief;
  let anyoneSees = false;
  let caughtBy = '';

  for (const guard of state.guards) {
    const seen = exposure(guard.x, guard.y, guard.angle, GUARD.viewHalfAngle, GUARD.viewRange, world, thief);
    if (seen > 0) {
      anyoneSees = true;
      guard.suspicion = Math.min(1, guard.suspicion + seen * GUARD.spotRate * dt);
      guard.lastSeenX = thief.x;
      guard.lastSeenY = thief.y;
      if (guard.suspicion > 0.25 && state.stats.spotted === 0) state.stats.spotted = 1;
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.calmRate * dt);
    }
    // A near miss: the guard was nearly sure (suspicion over 0.55) and the
    // thief slipped away before a chase began. Counted once per scare.
    guard.peak = Math.max(guard.peak || 0, guard.suspicion);
    if (guard.state !== 'chase' && guard.peak > 0.55 && guard.suspicion < 0.2) {
      state.stats.nearMiss += 1;
      guard.peak = 0;
    }
    if (guard.state === 'chase') guard.peak = 0;

    if (guard.state === 'patrol' && guard.suspicion >= GUARD.chaseAt) guard.state = 'chase';
    if (guard.state === 'chase' && guard.suspicion <= GUARD.giveUpAt) guard.state = 'patrol';
    if (guard.state === 'investigate') {
      guard.studyLeft -= dt;
      if (guard.studyLeft <= 0) guard.state = 'patrol';
    }

    const speed = guard.state === 'chase'
      ? GUARD.chaseSpeed
      : guard.state === 'investigate' ? GUARD.investigateSpeed : GUARD.patrolSpeed;

    let targetX;
    let targetY;
    if (guard.state === 'chase' || (guard.state === 'investigate' && guard.suspicion > 0.4)) {
      targetX = guard.lastSeenX;
      targetY = guard.lastSeenY;
    } else if (guard.state === 'investigate' && state.coin) {
      targetX = state.coin.x;
      targetY = state.coin.y;
    } else {
      const wp = LEVEL.guards[state.guards.indexOf(guard)].waypoints[guard.waypoint];
      targetX = wp.x;
      targetY = wp.y;
    }

    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const dist = Math.hypot(dx, dy);
    if (guard.state === 'patrol' && guard.waitLeft > 0) {
      // Paused at a waypoint, the guard scans the room: a slow sweep across
      // a 100-degree arc around the direction he arrived from, so standing
      // still in front of a resting guard is never quite safe.
      guard.waitLeft -= dt;
      guard.arrivalAngle = guard.arrivalAngle ?? guard.angle;
      guard.angle = guard.arrivalAngle + Math.sin(state.time * 1.4 + guard.seedPhase) * 0.55;
    } else if (dist > 4) {
      const step = Math.min(dist, speed * dt);
      const nx = guard.x + (dx / dist) * step;
      const ny = guard.y + (dy / dist) * step;
      world.moveCircle(guard, nx - guard.x, ny - guard.y, GUARD.radius);
      guard.angle = angleTo(guard.x, guard.y, targetX, targetY);
      if (guard.state === 'patrol' && dist <= 6) {
        guard.waypoint = (guard.waypoint + 1) % LEVEL.guards[state.guards.indexOf(guard)].waypoints.length;
        // Corner waypoints get a longer look around than straight legs.
        guard.waitLeft = 1.0 + (guard.waypoint % 2) * 0.8;
        guard.arrivalAngle = guard.angle;
      }
    } else if (guard.state === 'investigate') {
      guard.angle += 1.5 * dt;
    }

    const touch = Math.hypot(thief.x - guard.x, thief.y - guard.y);
    if (touch < GUARD.radius + THIEF.radius - 2) caughtBy = guard.name;
  }

  // The cameras sweep back and forth — eased, so they linger at each end of
  // the arc — and a live one that holds the thief feeds the alarm.
  for (const camera of state.cameras) {
    camera.angle = cameraAngle(camera, state.time);
    if (state.camerasOffline > 0) continue;
    const seen = exposure(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, world, thief);
    if (seen > 0) {
      anyoneSees = true;
      state.alarm = Math.min(ALARM.max, state.alarm + seen * CAMERA.alarmRate * dt);
    }
  }

  // The alarm also climbs while any guard is sure of what he saw.
  const hottest = Math.max(0, ...state.guards.map((g) => g.suspicion));
  if (hottest > 0.55) {
    state.alarm = Math.min(ALARM.max, state.alarm + (hottest - 0.55) * 46 * dt);
  }
  if (!anyoneSees && hottest <= 0.55) {
    // The alarm cools on a curve: it sheds fast when it is only warm, and
    // lingers when the whole museum is on edge — a loud run stays loud.
    const decay = ALARM.decayPerSecond * (1.45 - 0.9 * (state.alarm / ALARM.max));
    state.alarm = Math.max(0, state.alarm - decay * dt);
  }
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

  return { anyoneSees, caughtBy, hottest };
}

/** A coin toss pulls the nearest guards over to have a look. */
export function lureGuards(world, x, y) {
  const state = world.state;
  let lured = 0;
  for (const guard of state.guards) {
    const d = Math.hypot(guard.x - x, guard.y - y);
    if (d < COIN.lureRadius && guard.state !== 'chase') {
      guard.state = 'investigate';
      guard.studyLeft = COIN.studySeconds;
      guard.lastSeenX = x;
      guard.lastSeenY = y;
      lured += 1;
    }
  }
  return lured;
}
