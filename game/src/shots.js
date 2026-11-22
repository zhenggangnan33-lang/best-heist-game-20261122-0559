// The screenshot scenes behind ?shot=start|play|end|caught. Each one plays the
// real rules forward from a fresh world, steered by a small autopilot that
// follows a route through the museum — pausing when a guard is watching the
// next stop, running when it is seen, sneaking when a guard is near — so the
// frame is what a real game looks like and the same seed always gives the
// same frame.
import { DETECT, STEP } from './config.js';
import { computeDetection } from './guards.js';
import { canSee } from './world.js';
import { emptyInput } from './sim.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 11;
const END_LIMIT_SECONDS = 120;
const CAUGHT_LIMIT_SECONDS = 40;

/** The heist, stop by stop: loot, the terminal, the Scarab, and out the door. */
const ROUTE = [
  { x: 198, y: 424, grab: 'gold' },
  { x: 420, y: 440 },
  { x: 640, y: 632, hack: true },
  { x: 1150, y: 640 },
  { x: 1090, y: 280 },
  { x: 1112, y: 200, grab: 'scarab' },
  { x: 1090, y: 560 },
  { x: 948, y: 528, grab: 'duchess' },
  { x: 948, y: 640 },
  { x: 400, y: 640 },
  { x: 400, y: 440 },
  { x: 260, y: 440 },
  { x: 132, y: 668, exit: true },
];

/** Whether any watcher could see the point right now. */
function pointWatched(state, x, y) {
  for (const guard of state.guards) {
    if (canSee(guard.x, guard.y, guard.angle, DETECT.guardRange, DETECT.guardHalfAngle, x, y)) return true;
  }
  for (const camera of state.cameras) {
    if (camera.disabled > 0) continue;
    if (canSee(camera.x, camera.y, camera.angle, DETECT.cameraRange, DETECT.cameraHalfAngle, x, y)) return true;
  }
  return false;
}

/** The nearest watcher and how far away it is, so the pilot knows when to sneak and where to run from. */
function nearestWatcher(state) {
  const player = state.player;
  let best = { distance: Infinity, x: player.x, y: player.y };
  for (const guard of state.guards) {
    const distance = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (distance < best.distance) best = { distance, x: guard.x, y: guard.y };
  }
  for (const camera of state.cameras) {
    if (camera.disabled > 0) continue;
    const distance = Math.hypot(camera.x - player.x, camera.y - player.y);
    if (distance < best.distance) best = { distance, x: camera.x, y: camera.y };
  }
  return best;
}

/** The pilot's memory: which stop it is on, and how long it has waited there. */
export function createPilot() {
  return { leg: 0, wait: 0 };
}

/**
 * One step of the heist route. Returns the input for this step: run from a
 * watcher when the alarm is climbing, wait while the next stop is watched,
 * sneak past anyone near, and hold E on the loot and the terminal.
 */
export function pilotInput(state, pilot) {
  const input = emptyInput();
  const player = state.player;
  const stop = ROUTE[pilot.leg];
  if (stop === undefined || state.outcome !== 'playing') return input;

  const detection = computeDetection(state);

  // Seen and the alarm is climbing, or a watcher is close enough to touch:
  // run straight away from whoever sees you, or from the nearest watcher.
  const nearest = nearestWatcher(state);
  if ((detection.rate > 0 && state.alarm > 40) || nearest.distance < 58) {
    let awayX = 0;
    let awayY = 0;
    for (const watcher of detection.observers) {
      const dx = player.x - watcher.x;
      const dy = player.y - watcher.y;
      const distance = Math.hypot(dx, dy) || 1;
      awayX += dx / distance;
      awayY += dy / distance;
    }
    if (detection.observers.length === 0) {
      awayX = player.x - nearest.x;
      awayY = player.y - nearest.y;
    }
    const length = Math.hypot(awayX, awayY) || 1;
    input.mx = awayX / length;
    input.my = awayY / length;
    input.sneak = false;
    return input;
  }

  const dx = stop.x - player.x;
  const dy = stop.y - player.y;
  const distance = Math.hypot(dx, dy);

  // On the stop: hold E until the grab or the hack is done, then move on.
  if (distance < 10) {
    if (stop.grab !== undefined) {
      const item = state.loot.find((loot) => loot.id === stop.grab);
      if (item !== undefined && !item.taken) {
        input.interact = true;
        input.sneak = true;
        return input;
      }
    } else if (stop.hack) {
      if (state.terminal.hacked <= 0) {
        input.interact = true;
        input.sneak = true;
        return input;
      }
    }
    pilot.leg += 1;
    pilot.wait = 0;
    return input;
  }

  // The next stop is watched: wait where you are (sneaking) until the patrol moves on.
  if (pointWatched(state, stop.x, stop.y) && pilot.wait < 7) {
    pilot.wait += STEP;
    input.sneak = true;
    return input;
  }
  pilot.wait = 0;

  input.mx = dx / distance;
  input.my = dy / distance;
  input.sneak = nearest.distance < 200;
  return input;
}

/**
 * Drive the route to the end (or until `maxSeconds` runs out) and say how it
 * went: whether Vesper escaped, how long it took, and how loud it got.
 */
export function runAutopilot(sim, maxSeconds) {
  const pilot = createPilot();
  const limit = Math.floor(maxSeconds / STEP);
  for (let index = 0; index < limit; index += 1) {
    if (sim.state.outcome !== 'playing') break;
    sim.step(STEP, pilotInput(sim.state, pilot), false);
  }
  const state = sim.state;
  return {
    escaped: state.outcome === 'won',
    seconds: state.elapsed,
    maxAlarm: state.maxAlarm,
    lootValue: state.lootValue,
    rating: state.rating,
    score: state.score,
  };
}

/**
 * Set `sim` to the named scene (start, play, end or caught) and return the
 * screen to draw over it and the best loot total to show.
 */
export function stageShot(name, sim) {
  sim.reset();
  if (name === 'play') {
    runAutopilot(sim, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    const result = runAutopilot(sim, END_LIMIT_SECONDS);
    return { screen: result.escaped ? SCREEN_WON : SCREEN_PLAY, best: result.lootValue };
  }
  if (name === 'caught') {
    // Walk straight at Marlowe, unguarded, until she lays a hand on the thief.
    const limit = Math.floor(CAUGHT_LIMIT_SECONDS / STEP);
    for (let index = 0; index < limit; index += 1) {
      if (sim.state.outcome !== 'playing') break;
      const marlowe = sim.state.guards[0];
      const input = emptyInput();
      const dx = marlowe.x - sim.state.player.x;
      const dy = marlowe.y - sim.state.player.y;
      const distance = Math.hypot(dx, dy) || 1;
      input.mx = dx / distance;
      input.my = dy / distance;
      sim.step(STEP, input, false);
    }
    return { screen: SCREEN_CAUGHT, best: 0 };
  }
  // Anything else is the title: the museum goes about its night behind it.
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    sim.step(STEP, emptyInput(), true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
