// Boot and the one loop: input is read every frame, the museum advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, a clean getaway, and caught.
//
// ?seed=N fixes the museum. ?shot=start|play|end|caught (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createSim, EVENT_CAUGHT, EVENT_COIN, EVENT_HACK, EVENT_LOOT, EVENT_SPOTTED, EVENT_WON, emptyInput } from './sim.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_TOSS, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sim = createSim(seed);
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
    // Storage can be off (private windows): the best loot then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, sim);
  let painted = 0;
  function paint() {
    renderer.draw(sim.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (clientX, clientY) => renderer.toField(clientX, clientY));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // A tiny probe for automated play tests: where the thief is and what screen is up.
  window.__playerPos = () => ({ x: sim.state.player.x, y: sim.state.player.y, screen, alarm: sim.state.alarm });

  // Screen readers (and anyone watching the page's text) hear the screen changes and each haul.
  function announce(message) {
    status.textContent = message;
  }

  function bankBest() {
    if (sim.state.lootValue > best) {
      best = sim.state.lootValue;
      saveBest(best);
    }
  }

  function startGame() {
    sim.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.click();
    announce('Playing. Steal the Jade Scarab and reach the exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WON : SCREEN_CAUGHT;
    bankBest();
    if (won) {
      audio.win();
      announce(`Clean getaway. Rating ${sim.state.rating}. Score ${sim.state.score}. Best loot ${best}.`);
    } else {
      audio.caught();
      announce(`Caught. Loot grabbed ${sim.state.lootValue}. Best loot ${best}.`);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WON || screen === SCREEN_CAUGHT)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.click();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      audio.click();
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      sim.step(STEP, emptyInput(), true);
      return;
    }
    const vector = input.vector();
    const simInput = {
      mx: vector.x,
      my: vector.y,
      sneak: input.sneakHeld(),
      interact: input.interactHeld(),
      toss: Boolean(actions & ACTION_TOSS),
      tossX: input.tossTarget().x,
      tossY: input.tossTarget().y,
    };
    const events = sim.step(STEP, simInput, false);
    if (events & EVENT_LOOT) {
      audio.loot();
      announce(`Loot taken. ${sim.state.lootValue} dollars so far.`);
    }
    if (events & EVENT_HACK) {
      audio.hack();
      announce('Cameras offline for twenty seconds.');
    }
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted. The guards are hunting you.');
    }
    if (events & EVENT_WON) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // A one-shot press counts once, on the first sub-step of the frame.
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(sim.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
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
