// The heist itself: one fixed step of the rules, and the scoring that follows
// it. No drawing and no browser in here: step() takes the world's state and
// the player's input and returns what happened as bit flags, so the caller can
// react (and play sounds) without the rules knowing about screens or audio.
import { COINS, DETECT, GUARD, INTERACT, PLAYER, SCORE } from './config.js';
import { createRandom } from './random.js';
import { computeDetection, disableCameras, sendInvestigator, stepWatchers } from './guards.js';
import { createWorld, EXIT_ZONE, moveCircle, pointBlocked } from './world.js';

export const EVENT_LOOT = 1;
export const EVENT_HACK = 2;
export const EVENT_COIN = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_WON = 32;

/** What the player hands the simulation each step. */
export function emptyInput() {
  return { mx: 0, my: 0, sneak: false, interact: false, toss: false, tossX: NaN, tossY: NaN };
}

/** Whether the Scarab — the one piece the job is about — is already taken. */
export function hasScarab(state) {
  const scarab = state.loot.find((item) => item.id === 'scarab');
  return scarab !== undefined && scarab.taken;
}

/** Whether every piece of loot in the museum has been pocketed. */
export function allLootTaken(state) {
  return state.loot.every((item) => item.taken);
}

/**
 * The end screen's rating: GHOST for a silent run with everything taken,
 * SHADOW for staying under a hunt, LOUD for the rest.
 */
export function rateRun(maxAlarm, tookEverything) {
  if (maxAlarm <= 25 && tookEverything) return 'GHOST';
  if (maxAlarm < 60) return 'SHADOW';
  return 'LOUD';
}

function finishScore(state) {
  const timeBonus = Math.max(0, Math.round((SCORE.timeWindow - state.elapsed) * SCORE.timeRate));
  const ghostBonus = state.rating === 'GHOST' ? SCORE.ghostBonus : 0;
  state.score = state.lootValue + timeBonus + ghostBonus;
  state.timeBonus = timeBonus;
  state.ghostBonus = ghostBonus;
}

function throwCoin(state, input) {
  if (state.coinsLeft <= 0) return false;
  const player = state.player;
  let angle = player.angle;
  if (Number.isFinite(input.tossX) && Number.isFinite(input.tossY)) {
    angle = Math.atan2(input.tossY - player.y, input.tossX - player.x);
  }
  // Walk the landing spot back toward the thief until it is out of any wall.
  let distance = COINS.throwDistance;
  let x = player.x + Math.cos(angle) * distance;
  let y = player.y + Math.sin(angle) * distance;
  while (distance > 24 && pointBlocked(x, y, 6)) {
    distance -= 8;
    x = player.x + Math.cos(angle) * distance;
    y = player.y + Math.sin(angle) * distance;
  }
  state.coinsLeft -= 1;
  state.coins.push({ x, y, t: 12 });
  sendInvestigator(state, x, y);
  return true;
}

/** The nearest thing E can work on right now, if the thief is close enough. */
function interactable(state) {
  const player = state.player;
  for (const item of state.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - player.x, item.y - player.y) <= INTERACT.grabRadius) return { kind: 'loot', item };
  }
  if (state.terminal.hacked <= 0 && Math.hypot(state.terminal.x - player.x, state.terminal.y - player.y) <= INTERACT.hackRadius) {
    return { kind: 'terminal', item: null };
  }
  return null;
}

export function createSim(seed) {
  const random = createRandom(seed);
  let state = createWorld(random);

  function reset() {
    state = createWorld(createRandom(seed));
  }

  /**
   * One fixed step. With `attract` set (the title screen's backdrop) the
   * guards patrol and the cameras sweep, but nothing is seen, stolen or lost.
   */
  function step(dt, input, attract) {
    let events = 0;
    state.time += dt;
    stepWatchers(state, dt);
    if (attract || state.outcome !== 'playing') return events;

    state.elapsed += dt;
    const player = state.player;

    // Move, sliding along walls; facing follows the steering direction.
    const speed = input.sneak ? PLAYER.sneak : PLAYER.walk;
    const moved = moveCircle(player.x, player.y, PLAYER.radius, input.mx * speed * dt, input.my * speed * dt);
    player.moving = moved.x !== player.x || moved.y !== player.y;
    player.x = moved.x;
    player.y = moved.y;
    player.sneak = input.sneak;
    if (player.moving) player.angle = Math.atan2(input.my, input.mx);

    // A thrown coin lands, clinks, and pulls the nearest guard over.
    if (input.toss && throwCoin(state, input)) events |= EVENT_COIN;

    // Holding E near loot or the terminal fills its progress ring.
    const target = interactable(state);
    if (input.interact && target !== null) {
      if (target.kind === 'loot') {
        if (state.grabId !== target.item.id) {
          state.grabId = target.item.id;
          state.grabProgress = 0;
        }
        state.grabProgress += dt / INTERACT.grabSeconds;
        if (state.grabProgress >= 1) {
          target.item.taken = true;
          state.lootValue += target.item.value;
          state.grabId = null;
          state.grabProgress = 0;
          events |= EVENT_LOOT;
        }
      } else {
        state.hackProgress += dt / INTERACT.hackSeconds;
        if (state.hackProgress >= 1) {
          disableCameras(state);
          state.hackProgress = 0;
          events |= EVENT_HACK;
        }
      }
    } else {
      state.grabId = null;
      state.grabProgress = 0;
      state.hackProgress = Math.max(0, state.hackProgress - dt);
    }

    // Coins on the floor fade away after a while.
    for (let index = state.coins.length - 1; index >= 0; index -= 1) {
      state.coins[index].t -= dt;
      if (state.coins[index].t <= 0) state.coins.splice(index, 1);
    }

    // Being seen raises the alarm; breaking sight lets it fall again.
    const before = state.alarm;
    const detection = computeDetection(state);
    if (detection.rate > 0) {
      state.alarm = Math.min(100, state.alarm + detection.rate * dt);
    } else {
      state.alarm = Math.max(0, state.alarm - DETECT.decay * dt);
    }
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    if (before < DETECT.huntAt && state.alarm >= DETECT.huntAt) events |= EVENT_SPOTTED;

    // Caught: the alarm hit the top, or a guard laid a hand on the thief.
    let caught = state.alarm >= 100;
    if (!caught) {
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - player.x, guard.y - player.y) < GUARD.touch) {
          caught = true;
          break;
        }
      }
    }
    if (caught) {
      state.outcome = 'caught';
      state.rating = rateRun(state.maxAlarm, allLootTaken(state));
      finishScore(state);
      return events | EVENT_CAUGHT;
    }

    // Clean getaway: the Scarab in hand and both feet on the exit mat.
    if (
      hasScarab(state) &&
      player.x >= EXIT_ZONE.x &&
      player.x <= EXIT_ZONE.x + EXIT_ZONE.w &&
      player.y >= EXIT_ZONE.y &&
      player.y <= EXIT_ZONE.y + EXIT_ZONE.h
    ) {
      state.outcome = 'won';
      state.rating = rateRun(state.maxAlarm, allLootTaken(state));
      finishScore(state);
      return events | EVENT_WON;
    }

    return events;
  }

  return { get state() { return state; }, reset, step };
}
