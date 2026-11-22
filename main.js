// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps through the shared simulation, and the renderer paints what is
// there. The game moves between five screens: title, play, paused, caught and win.
//
// ?seed=N fixes the patrol offsets. ?shot=start|play|end|caught (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_ESCAPED, ratingFor } from './world.js';
import { stepWatchers } from './guards.js';
import { ACTION_COIN, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSim } from './sim.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.rating);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const sim = createSim(world, audio);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingCoin = null;
  let announcedNearMiss = 0;
  let hintShown = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    pendingCoin = null;
    announcedNearMiss = 0;
    hintShown = false;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Jade Scarab, then reach the exit.');
  }

  function endRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_CAUGHT;
    if (world.state.lootValue > best) {
      best = world.state.lootValue;
      saveBest(best);
    }
    if (won) {
      audio.win();
      const near = world.state.stats.nearMiss;
      announce(`Clean getaway. Loot $${world.state.lootValue}. Rating ${ratingFor(world.state)}${near > 0 ? `. ${near} near miss${near === 1 ? '' : 'es'}: +$${near * 500}.` : '.'}`);
    } else {
      audio.caught();
      announce(`Caught. Loot $${world.state.lootValue}. Press R to try again.`);
    }
  }

  function armCoin() {
    if (world.state.coins <= 0) {
      announce('No coins left.');
      return;
    }
    const room = renderer.toRoom(input.mouse().x, input.mouse().y);
    pendingCoin = {
      x: Math.max(40, Math.min(FIELD.width - 40, room.x)),
      y: Math.max(40, Math.min(FIELD.height - 40, room.y)),
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_COIN | ACTION_CONFIRM)) {
      armCoin();
    } else if (actions & ACTION_RESTART) {
      startGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The room stays alive behind the title: guards walk their rounds.
      while (accumulator >= STEP) {
        world.state.time += STEP;
        stepWatchers(world, STEP);
        accumulator -= STEP;
      }
      renderer.draw(world.state, screen, best, '');
      return;
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const dir = input.direction();
        const controls = {
          dx: dir.x,
          dy: dir.y,
          sneak: input.sneaking(),
          interact: input.interacting(),
          coin: pendingCoin,
        };
        pendingCoin = null;
        const events = sim.step(controls, STEP);
        accumulator -= STEP;
        // A near miss is worth announcing the moment it happens.
        if (world.state.stats.nearMiss > announcedNearMiss) {
          announcedNearMiss = world.state.stats.nearMiss;
          announce(`Close one — that guard almost had you. Near-miss bonus +$500.`);
        }
        // A first-timer who has not reached any loot after 25 seconds gets a nudge.
        if (!hintShown && world.state.time > 25 && world.state.lootTaken === 0) {
          hintShown = true;
          announce('Hint: hold Shift to sneak, and the dark rugs hide you. The Gold Bars are on the left.');
        }
        if (events === EVENT_CAUGHT) {
          endRun(false);
          accumulator = 0;
          break;
        }
        if (events === EVENT_ESCAPED) {
          endRun(true);
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, ratingFor(world.state));
  }

  // Leaving the tab pauses a running game rather than letting cones sweep unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
