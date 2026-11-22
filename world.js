// The gallery: walls, cases, loot, the hack terminal and the exit, plus the two
// questions every stealth game keeps asking — can this thing move here, and can
// this thing see that thing. Nothing here knows about screens or drawing.

import { FIELD, LEVEL } from './config.js';

export const EVENT_CAUGHT = 1;
export const EVENT_ESCAPED = 2;
export const EVENT_LOOT = 4;
export const EVENT_HACKED = 8;

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function circleHitsRect(cx, cy, r, rect) {
  const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

/** True when the segment from (x1,y1) to (x2,y2) crosses the rectangle. */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height) return false;
  if (rectsOverlap({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, rect)) {
    // The segment's own box overlaps; check the two diagonals' worth of edges.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const edges = [
      [rect.x, rect.y, rect.x + rect.width, rect.y],
      [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
      [rect.x, rect.y + rect.height, rect.x, rect.y],
    ];
    for (const [ax, ay, bx, by] of edges) {
      const d = (bx - ax) * dy - (by - ay) * dx;
      if (Math.abs(d) < 1e-9) continue;
      const t = ((ax - x1) * dy - (ay - y1) * dx) / -d;
      const u = ((ax - x1) * (by - ay) - (ay - y1) * (bx - ax)) / -d;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
    }
    // Both ends inside the rectangle.
    return x1 > rect.x && x1 < rect.x + rect.width && y1 > rect.y && y1 < rect.y + rect.height;
  }
  return false;
}

export function createWorld(random) {
  const state = {
    time: 0,
    thief: { x: LEVEL.start.x, y: LEVEL.start.y, facing: -Math.PI / 2, moving: false, sneaking: false },
    guards: [],
    cameras: [],
    loot: [],
    alarm: 0,
    maxAlarm: 0,
    coins: 3,
    coin: null,
    hackProgress: 0,
    /** Hack stage 0–3 (probing, cracking, spoofing) while working the terminal. */
    hackStage: 0,
    /** The last loot grabbed, for the floating "+$…" flourish: { value, x, y, at }. */
    lastGrab: null,
    camerasOffline: 0,
    lootProgress: 0,
    lootTarget: null,
    scarab: false,
    lootValue: 0,
    lootTaken: 0,
    caught: false,
    escaped: false,
    caughtBy: '',
    stats: { spotted: 0, hacks: 0, coinsThrown: 0, nearMiss: 0 },
  };

  function reset() {
    state.time = 0;
    state.thief.x = LEVEL.start.x;
    state.thief.y = LEVEL.start.y;
    state.thief.facing = -Math.PI / 2;
    state.thief.moving = false;
    state.thief.sneaking = false;
    state.guards = LEVEL.guards.map((g, i) => {
      const start = g.waypoints[0];
      return {
        name: g.name,
        x: start.x,
        y: start.y,
        angle: Math.PI / 2,
        waypoint: 1,
        state: 'patrol',
        suspicion: 0,
        lastSeenX: 0,
        lastSeenY: 0,
        studyLeft: 0,
        waitLeft: random.range(0, 1.2),
        seedPhase: random.range(0, Math.PI * 2),
        /** Highest suspicion since the last chase or near miss — see guards.js. */
        peak: 0,
        /** Direction the guard arrived from at the current waypoint. */
        arrivalAngle: Math.PI / 2,
      };
    });
    state.cameras = LEVEL.cameras.map((c) => ({
      x: c.x, y: c.y, base: c.base, sweep: c.sweep, phase: c.phase, angle: c.base,
    }));
    state.loot = LEVEL.loot.map((l) => ({ ...l, taken: false }));
    state.alarm = 0;
    state.maxAlarm = 0;
    state.coins = 3;
    state.coin = null;
    state.hackProgress = 0;
    state.hackStage = 0;
    state.lastGrab = null;
    state.camerasOffline = 0;
    state.lootProgress = 0;
    state.lootTarget = null;
    state.scarab = false;
    state.lootValue = 0;
    state.lootTaken = 0;
    state.caught = false;
    state.escaped = false;
    state.caughtBy = '';
    state.stats = { spotted: 0, hacks: 0, coinsThrown: 0, nearMiss: 0 };
    state.solids = SOLIDS;
  }

  /** The room's walls plus every solid, as rectangles. */
  function solids() {
    const w = LEVEL.wall;
    return [
      { x: 0, y: 0, width: FIELD.width, height: w },
      { x: 0, y: FIELD.height - w, width: FIELD.width, height: w },
      { x: 0, y: 0, width: w, height: FIELD.height },
      { x: FIELD.width - w, y: 0, width: w, height: FIELD.height },
      ...LEVEL.solids,
    ];
  }

  const SOLIDS = solids();

  function blocked(x, y, r) {
    for (const s of SOLIDS) if (circleHitsRect(x, y, r, s)) return true;
    return false;
  }

  /** Move a circle by (dx, dy), sliding along walls instead of sticking. */
  function moveCircle(body, dx, dy, r) {
    if (dx !== 0 && !blocked(body.x + dx, body.y, r)) body.x += dx;
    if (dy !== 0 && !blocked(body.x, body.y + dy, r)) body.y += dy;
  }

  function lineOfSight(x1, y1, x2, y2) {
    for (const s of SOLIDS) if (segmentHitsRect(x1, y1, x2, y2, s)) return false;
    return true;
  }

  function inShadow(x, y) {
    return LEVEL.shadows.some((s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height);
  }

  function nearestLoot(x, y, reach) {
    let best = null;
    let bestDist = reach;
    for (const l of state.loot) {
      if (l.taken) continue;
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  function atExit(x, y) {
    const e = LEVEL.exit;
    return x > e.x - 10 && x < e.x + e.width + 10 && y > e.y - 30 && y < FIELD.height;
  }

  /** Loot still in the room, most valuable first — for the autopilot and the HUD. */
  function lootRemaining() {
    return state.loot.filter((l) => !l.taken).sort((a, b) => b.value - a.value);
  }

  /** True once every optional piece is in the bag alongside the Scarab. */
  function allLootTaken() {
    return state.loot.every((l) => l.taken);
  }

  // Populate the room at once, so the title screen can draw it before the
  // first reset; reset() re-randomizes the patrols for each new run.
  reset();

  return { state, reset, blocked, moveCircle, lineOfSight, inShadow, nearestLoot, atExit, lootRemaining, allLootTaken, SOLIDS };
}

/** The rating on the getaway screen: how quietly the vault was emptied. */
export function ratingFor(state) {
  if (state.maxAlarm <= 25 && state.lootTaken === 3) return 'GHOST';
  if (state.maxAlarm < 60) return 'SHADOW';
  return 'LOUD';
}

/**
 * The getaway score, in one place so the win screen, the screenshots and the
 * tests all agree: loot, a bonus for a fast escape, a ghost bonus for staying
 * quiet, and $500 for every near miss — a guard who almost had you.
 */
export function scoreFor(state) {
  const loot = state.lootValue;
  const timeBonus = Math.max(0, Math.round((120 - state.time) * 100));
  const ghostBonus = state.maxAlarm <= 25 ? 5000 : 0;
  const nearMissBonus = (state.stats.nearMiss || 0) * 500;
  return { loot, timeBonus, ghostBonus, nearMissBonus, total: loot + timeBonus + ghostBonus + nearMissBonus };
}
