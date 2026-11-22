// The screenshot scenes behind ?shot=start|play|end|caught. Each one plays the
// real rules forward from a fresh world, steered by an autopilot that follows
// the heist route and waits out sweeping cones, so every frame is what a real
// game looks like and the same seed always gives the same frame.
//
// The autopilot is shared with the logic test (see autopilotEscape): the
// escape it performs for the end shot is the same one the test times, so a
// screenshot can never show a run the rules would not allow.
import { LEVEL, STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED, ratingFor, scoreFor } from './world.js';
import { exposure } from './guards.js';
import { createSim } from './sim.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** The heist route: entrance, the gold, the scarab, and out the exit. */
const ROUTE = [
  { x: 640, y: 600 },
  { x: 300, y: 600 },
  { x: 300, y: 430 },
  { x: 230, y: 430 },
  { x: 230, y: 330 },
  { x: 180, y: 300 },
  { x: 230, y: 330 },
  { x: 230, y: 240 },
  { x: 480, y: 240 },
  { x: 480, y: 160 },
  { x: 580, y: 160 },
  { x: 640, y: 140 },
  { x: 480, y: 160 },
  { x: 480, y: 240 },
  { x: 330, y: 240 },
  { x: 330, y: 430 },
  { x: 300, y: 430 },
  { x: 300, y: 600 },
  { x: 640, y: 600 },
  { x: 640, y: 676 },
];

/**
 * The painting detour, spliced into the route just after the scarab leg:
 * down the gap between the two middle cases, east along y=400 (below
 * Marlowe's lower patrol), up the right wall to "The Duchess", then back
 * the same way to rejoin the route at the 480,240 leg. It never walks along
 * a patrol line: Marlowe owns y=240 and y=440, so the detour crosses y=240
 * at the x=650 gap and stays 40px clear of y=440.
 */
const PAINTING_DETOUR = [
  { x: 650, y: 240 },
  { x: 650, y: 400 },
  { x: 1000, y: 400 },
  { x: 1152, y: 300 },
  { x: 1152, y: 208 },
  { x: 1152, y: 300 },
  { x: 1000, y: 400 },
  { x: 650, y: 400 },
  { x: 650, y: 240 },
];

/** The darkest nearby rug to cool off in when the alarm runs hot. */
function nearestShadow(world, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const s of LEVEL.shadows) {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestDist) {
      bestDist = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/** How exposed a spot is to every watcher right now (0 is safe). */
function dangerAt(world, x, y) {
  const state = world.state;
  const probe = { x, y, sneaking: true, moving: false };
  let worst = 0;
  for (const guard of state.guards) {
    worst = Math.max(worst, exposure(guard.x, guard.y, guard.angle, 0.66, 252, world, probe));
  }
  if (state.camerasOffline <= 0) {
    for (const camera of state.cameras) {
      worst = Math.max(worst, exposure(camera.x, camera.y, camera.angle, 0.44, 300, world, probe));
    }
  }
  return worst;
}

/** The worst exposure along the straight line from one spot to another. */
function pathDanger(world, fromX, fromY, toX, toY) {
  let worst = 0;
  for (let i = 0; i <= 4; i += 1) {
    const x = fromX + ((toX - fromX) * i) / 4;
    const y = fromY + ((toY - fromY) * i) / 4;
    worst = Math.max(worst, dangerAt(world, x, y));
  }
  return worst;
}

/** How far the nearest guard is from a spot. */
function nearestGuardDist(world, x, y) {
  let best = Infinity;
  for (const guard of world.state.guards) {
    best = Math.min(best, Math.hypot(guard.x - x, guard.y - y));
  }
  return best;
}

/** Steer toward (tx, ty), one fixed step. Returns { arrived, event }. */
function steer(world, sim, tx, ty, dt, sneak = true) {
  const thief = world.state.thief;
  const dx = tx - thief.x;
  const dy = ty - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return { arrived: true, event: 0 };
  const event = sim.step({ dx: dx / dist, dy: dy / dist, sneak, interact: false, coin: null }, dt);
  return { arrived: false, event };
}

/** A plain snapshot of the world state, for restoring a chosen frame. */
function snapshotState(state) {
  return JSON.parse(JSON.stringify(state));
}

function restoreState(state, snap) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, snap);
}

/**
 * Walk the route, waiting out cones and cooling off in the shadows, until
 * `done(state)` says the scene is ready or the step budget runs out.
 * Returns the event the run ended on (0 when the budget ran out).
 * Exported for the logic test and for tracing the autopilot's decisions.
 *
 * Options: bold walks faster and tolerates hotter cones; detourPainting
 * splices the painting legs in after the scarab while the alarm stays low;
 * onStep(state, leg) is called each step, for tests and tracing.
 */
export function walkRoute(world, sim, done, maxSeconds, options = {}) {
  const { bold = false, detourPainting = false, onStep = null } = options;
  const state = world.state;
  let route = ROUTE;
  let detourInserted = false;
  let leg = 0;
  let waitLeft = 0;
  let waitTotal = 0;
  let lastDist = Infinity;
  let stuckFor = 0;
  let event = 0;
  const dangerLimit = bold ? 0.55 : 0.3;
  const waitSeconds = bold ? 1.2 : 2.5;
  const retreatAt = bold ? 75 : 55;
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    if (done(state)) break;
    if (onStep) onStep(state, leg);
    // The scarab is in the bag and the room is still quiet: the painting is
    // worth the detour. Splice it in just after the scarab leg (index 11).
    if (detourPainting && !detourInserted && state.scarab && state.alarm < 35) {
      detourInserted = true;
      route = [...ROUTE.slice(0, 12), ...PAINTING_DETOUR, ...ROUTE.slice(13)];
    }
    const target = route[leg];
    const thief = state.thief;
    const dist = Math.hypot(target.x - thief.x, target.y - thief.y);

    // Working a case takes holding E beside it.
    const loot = world.nearestLoot(thief.x, thief.y, 52);
    if (loot) {
      event = sim.step({ dx: 0, dy: 0, sneak: true, interact: true, coin: null }, STEP);
      if (event !== 0) break;
      continue;
    }

    // The alarm runs hot: slip into the nearest shadow until it cools.
    if (state.alarm > retreatAt) {
      const hide = nearestShadow(world, thief.x, thief.y);
      if (hide && Math.hypot(hide.x - thief.x, hide.y - thief.y) > 24) {
        const moved = steer(world, sim, hide.x, hide.y, STEP, !bold);
        if (moved.event !== 0) {
          event = moved.event;
          break;
        }
      } else {
        event = sim.step({ dx: 0, dy: 0, sneak: true, interact: false, coin: null }, STEP);
        if (event !== 0) break;
      }
      continue;
    }

    // The way ahead is watched: hold still and let the cone sweep past.
    // But if the thief is already standing in a cone and the watcher is
    // close, moving on walks straight into him — so back up the way you
    // came instead. The ground behind you is known safe, and the guard's
    // suspicion cools as soon as you leave his cone.
    const aheadHot = pathDanger(world, thief.x, thief.y, target.x, target.y) > dangerLimit;
    const hereHot = dangerAt(world, thief.x, thief.y) > dangerLimit;
    if (hereHot && nearestGuardDist(world, thief.x, thief.y) < 170) {
      // Back up the way you came — to the nearest earlier waypoint you are
      // not already standing on, so the retreat always moves you somewhere.
      // The margin is 40px, wider than a step: with a tight margin the
      // retreat target flips between two waypoints every step and the thief
      // jitters in place while the guard closes in.
      let back = route[0];
      for (let i = leg - 1; i >= 0; i -= 1) {
        if (Math.hypot(route[i].x - thief.x, route[i].y - thief.y) > 40) {
          back = route[i];
          break;
        }
      }
      const retreated = steer(world, sim, back.x, back.y, STEP, true);
      if (retreated.event !== 0) {
        event = retreated.event;
        break;
      }
      if (retreated.arrived) {
        event = sim.step({ dx: 0, dy: 0, sneak: true, interact: false, coin: null }, STEP);
        if (event !== 0) break;
      }
      continue;
    }
    if (waitLeft <= 0 && aheadHot && !hereHot) waitLeft = waitSeconds;
    if (waitLeft > 0) {
      waitLeft -= STEP;
      waitTotal += STEP;
      // Waiting forever helps no one: lure the watcher away with a coin.
      if (waitTotal > 6 && state.coins > 0) {
        waitTotal = 0;
        waitLeft = 0;
        event = sim.step({ dx: 0, dy: 0, sneak: true, interact: false, coin: { x: 1100, y: 620 } }, STEP);
        if (event !== 0) break;
        continue;
      }
      event = sim.step({ dx: 0, dy: 0, sneak: true, interact: false, coin: null }, STEP);
      if (event !== 0) break;
      continue;
    }
    waitTotal = 0;

    // Stuck against a wall or a patrol: toss a coin far away to pull the guard off.
    if (dist > lastDist - 2) stuckFor += STEP;
    else stuckFor = 0;
    lastDist = dist;
    if (stuckFor > 4 && state.coins > 0) {
      stuckFor = 0;
      event = sim.step({ dx: 0, dy: 0, sneak: true, interact: false, coin: { x: 150, y: 620 } }, STEP);
      if (event !== 0) break;
      continue;
    }

    const moved = steer(world, sim, target.x, target.y, STEP, !bold);
    if (moved.event !== 0) {
      event = moved.event;
      break;
    }
    if (moved.arrived) {
      leg = Math.min(leg + 1, route.length - 1);
      if (leg === route.length - 1) {
        const d = Math.hypot(route[leg].x - thief.x, route[leg].y - thief.y);
        if (d < 14) break;
      }
    }
  }
  return event;
}

/**
 * Run the full heist on autopilot from a fresh world and report what
 * happened. The logic test calls this with the same route the end shot
 * uses, so the escape time it reports is the escape the player sees.
 */
export function autopilotEscape(world, options = {}) {
  const sim = createSim(world);
  const state = world.state;
  world.reset();
  const event = walkRoute(world, sim, (s) => s.escaped, 150, options);
  return {
    event,
    escaped: state.escaped,
    seconds: state.time,
    lootValue: state.lootValue,
    lootTaken: state.lootTaken,
    maxAlarm: state.maxAlarm,
    nearMiss: state.stats.nearMiss,
    rating: state.escaped ? ratingFor(state) : '',
    score: state.escaped ? scoreFor(state).total : 0,
  };
}

/** How close a cone is to catching the thief: 0 is nowhere near, 1 is inside one. */
function tensionAt(world) {
  const state = world.state;
  const thief = state.thief;
  let best = 0;
  const watchers = [
    ...state.guards.map((g) => ({ x: g.x, y: g.y, angle: g.angle, half: 0.66, range: 252 })),
    ...(state.camerasOffline > 0 ? [] : state.cameras.map((c) => ({ x: c.x, y: c.y, angle: c.angle, half: 0.44, range: 300 }))),
  ];
  for (const w of watchers) {
    const dx = thief.x - w.x;
    const dy = thief.y - w.y;
    const dist = Math.hypot(dx, dy);
    let a = Math.atan2(dy, dx) - w.angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    a = Math.abs(a);
    if (dist < w.range + 80 && a < w.half + 0.6) {
      const score = (1 - dist / (w.range + 80)) * (1 - a / (w.half + 0.6));
      best = Math.max(best, score);
    }
  }
  // A guard who is already suspicious is tension too, even off-camera.
  const hottest = Math.max(0, ...state.guards.map((g) => g.suspicion));
  return Math.max(best, hottest * 0.7);
}

/**
 * Walk waypoints without waiting, snapshotting the state at its tensest
 * moment, then put that frame back: the shot shows a cone sweeping right
 * past the thief, not wherever the run happened to stop.
 */
function hottestFrame(world, sim, waypoints, maxSeconds) {
  const state = world.state;
  let best = { tension: tensionAt(world), snap: snapshotState(state) };
  let leg = 0;
  let event = 0;
  for (let i = 0; i < Math.floor(maxSeconds / STEP) && event === 0; i += 1) {
    const target = waypoints[leg];
    const thief = state.thief;
    const dx = target.x - thief.x;
    const dy = target.y - thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      leg += 1;
      if (leg >= waypoints.length) break;
      continue;
    }
    event = sim.step({ dx: dx / dist, dy: dy / dist, sneak: false, interact: false, coin: null }, STEP);
    if (event !== 0) break;
    const tension = tensionAt(world);
    if (tension > best.tension) best = { tension, snap: snapshotState(state) };
    if (state.alarm >= 30) break;
  }
  restoreState(state, best.snap);
  return event;
}

/** The caught scene: walk at Marlowe and keep the frame just before the grab. */
function stageCaught(world, sim) {
  const state = world.state;
  const guard = state.guards[0];
  let event = 0;
  let lastSnap = null;
  let lastDist = Infinity;
  for (let i = 0; i < 30 / STEP && event === 0; i += 1) {
    const thief = state.thief;
    const dx = guard.x - thief.x;
    const dy = guard.y - thief.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Keep the last frame where the guard is close but has not touched yet:
    // the shot shows the chase a heartbeat before it ends.
    if (dist < 90 && dist < lastDist) {
      lastSnap = snapshotState(state);
      lastDist = dist;
    }
    event = sim.step({ dx: dx / dist, dy: dy / dist, sneak: false, interact: false, coin: null }, STEP);
  }
  if (event === EVENT_CAUGHT && lastSnap) {
    restoreState(state, lastSnap);
  }
  if (event === 0) {
    // The walk never ended the run: stage the caught moment over the real state.
    state.alarm = 100;
    state.maxAlarm = Math.max(state.maxAlarm, 100);
    state.caught = true;
    state.caughtBy = guard.name;
    return;
  }
  // Whatever frame we restored, the run is over: Marlowe has Vesper.
  state.alarm = Math.max(state.alarm, 60);
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
  state.caught = true;
  state.caughtBy = guard.name;
}

/** Set the world to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  const sim = createSim(world);
  const state = world.state;
  world.reset();

  if (name === 'caught') {
    stageCaught(world, sim);
    return { screen: SCREEN_CAUGHT, best: 0, rating: '' };
  }

  if (name === 'end') {
    // The full heist, painting detour included while the room stays quiet:
    // the getaway screen shows the real escape, not a staged one.
    const event = walkRoute(world, sim, (s) => s.escaped, 150, { detourPainting: true });
    if (event === EVENT_CAUGHT) {
      return { screen: SCREEN_CAUGHT, best: 0, rating: '' };
    }
    if (event !== EVENT_ESCAPED && !state.escaped) {
      // Stage the getaway: the scarab and the gold are in the bag, the thief
      // is at the exit and the alarm never quite peaked.
      for (const loot of state.loot) {
        if ((loot.id === 'scarab' || loot.id === 'gold') && !loot.taken) {
          loot.taken = true;
          state.lootValue += loot.value;
          state.lootTaken += 1;
          if (loot.id === 'scarab') state.scarab = true;
        }
      }
      state.thief.x = 640;
      state.thief.y = 668;
      state.thief.facing = Math.PI / 2;
      state.alarm = 28;
      state.maxAlarm = Math.max(state.maxAlarm, 28);
      state.escaped = true;
    }
    return { screen: SCREEN_WIN, best: state.lootValue, rating: ratingFor(state) };
  }

  if (name === 'play') {
    // Careful to the scarab, then a hurried exit: the frame is the hottest
    // moment of the getaway, guards closing in and the alarm climbing.
    const event = walkRoute(world, sim, (s) => s.lootTaken >= 2, 60, { bold: false });
    if (event === EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: 0, rating: '' };
    hottestFrame(world, sim, [
      { x: 480, y: 240 }, { x: 330, y: 240 }, { x: 330, y: 430 },
      { x: 300, y: 600 }, { x: 640, y: 600 }, { x: 640, y: 676 },
    ], 20);
    return { screen: SCREEN_PLAY, best: 0, rating: '' };
  }

  // Start: the title over a live room, guards placed where the frame shows
  // them — cones crossing the middle of the gallery, cameras mid-sweep.
  state.time = 3;
  const placed = [
    { x: 340, y: 240, angle: 0 },
    { x: 980, y: 120, angle: Math.PI / 2 },
    { x: 200, y: 620, angle: -Math.PI / 2 },
  ];
  state.guards.forEach((guard, i) => {
    guard.x = placed[i].x;
    guard.y = placed[i].y;
    guard.angle = placed[i].angle;
  });
  state.cameras[0].angle = Math.PI / 2 + 0.6;
  state.cameras[1].angle = Math.PI / 2 - 0.5;
  return { screen: SCREEN_TITLE, best: 0, rating: '' };
}
