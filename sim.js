// One fixed step of the heist, shared by the live game and the screenshot
// autopilot: move the thief, work the loot and the terminal, then let the
// guards and cameras have their turn. Returns what happened, as event bits.

import { ALARM, HACK, LEVEL, LOOT, THIEF } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { lureGuards, stepWatchers } from './guards.js';

const NO_SFX = {
  spotted() {}, alarm() {}, grab() {}, hack() {}, coin() {}, caught() {}, win() {}, step() {},
};

export function createSim(world, sfx = NO_SFX) {
  const state = world.state;
  let lastSpotted = false;
  let stepTimer = 0;

  /**
   * controls: { dx, dy, sneak, interact, coin } — coin is { x, y } in room
   * coordinates when the player tosses one this step, else null.
   */
  function step(controls, dt) {
    const thief = state.thief;
    state.time += dt;
    if (state.camerasOffline > 0) state.camerasOffline = Math.max(0, state.camerasOffline - dt);

    thief.sneaking = !!controls.sneak;
    thief.moving = controls.dx !== 0 || controls.dy !== 0;
    if (thief.moving) {
      thief.facing = Math.atan2(controls.dy, controls.dx);
      const speed = thief.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
      world.moveCircle(thief, controls.dx * speed * dt, controls.dy * speed * dt, THIEF.radius);
      stepTimer += dt;
      if (stepTimer > 0.34) {
        stepTimer = 0;
        sfx.step();
      }
    }

    if (controls.coin) {
      state.coins -= 1;
      state.coin = { x: controls.coin.x, y: controls.coin.y };
      state.stats.coinsThrown += 1;
      sfx.coin();
      lureGuards(world, controls.coin.x, controls.coin.y);
    }

    // Working on loot or on the terminal takes holding E beside it.
    const loot = world.nearestLoot(thief.x, thief.y, LOOT.reach);
    const nearTerminal = Math.hypot(thief.x - LEVEL.terminal.x, thief.y - LEVEL.terminal.y) < HACK.reach;
    if (controls.interact && loot) {
      state.lootTarget = loot;
      state.hackProgress = 0;
      state.lootProgress += dt;
      const need = loot.main ? LOOT.scarabChannelSeconds : LOOT.channelSeconds;
      if (state.lootProgress >= need) {
        loot.taken = true;
        state.lootValue += loot.value;
        state.lootTaken += 1;
        if (loot.main) state.scarab = true;
        state.lootProgress = 0;
        state.lootTarget = null;
        // A flourish the renderer draws: the value floats up from the case.
        state.lastGrab = { value: loot.value, x: loot.x, y: loot.y, at: state.time };
        sfx.grab();
      }
    } else if (controls.interact && nearTerminal && state.camerasOffline <= 0) {
      state.lootTarget = null;
      state.lootProgress = 0;
      state.hackProgress += dt;
      // The hack runs in three visible stages — probing, cracking, spoofing —
      // so the player can feel how close the cameras are to going dark.
      state.hackStage = Math.min(3, Math.floor((state.hackProgress / HACK.channelSeconds) * 3) + 1);
      if (state.hackProgress >= HACK.channelSeconds) {
        state.camerasOffline = 20;
        state.hackProgress = 0;
        state.hackStage = 0;
        state.stats.hacks += 1;
        // A clean hack cuts the feed before the alarm registers: the meter
        // drops 10 points, as if the last few seconds never happened.
        state.alarm = Math.max(0, state.alarm - 10);
        sfx.hack();
      }
    } else {
      state.lootTarget = null;
      state.lootProgress = 0;
      state.hackProgress = 0;
      state.hackStage = 0;
    }

    const watch = stepWatchers(world, dt);
    if (watch.anyoneSees && !lastSpotted) sfx.spotted();
    if (state.alarm >= ALARM.huntAt && Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) sfx.alarm();
    lastSpotted = watch.anyoneSees;

    if (watch.caughtBy) {
      state.caught = true;
      state.caughtBy = watch.caughtBy;
      return EVENT_CAUGHT;
    }
    if (state.alarm >= ALARM.max) {
      state.caught = true;
      state.caughtBy = '';
      return EVENT_CAUGHT;
    }
    if (world.atExit(thief.x, thief.y) && state.scarab) {
      state.escaped = true;
      return EVENT_ESCAPED;
    }
    return 0;
  }

  return { step };
}
