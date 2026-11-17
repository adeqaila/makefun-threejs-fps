// main.js — one job: bootstrap + the frame loop.
// Fixed-step accumulator (60 Hz): stepSim runs the game, renderFrame draws it,
// updateHud writes the DOM. Pointer lock pauses the sim while unlocked (except
// when the buy menu is open, which needs the mouse). No game logic lives here.
import { createState, PHASE } from './state.js';
import { createInput } from './input.js';
import { createRenderer, renderFrame } from './render.js';
import { bindHud, updateHud, showHit } from './hud.js';
import { stepSim, startMatch, handleBuyKey } from './sim.js';
import { ensureAudio, sfx } from './audio.js';

const STEP = 1 / 60;
const LOOK_SENS = 0.0023;

const app = document.getElementById('app');
const canvas = document.createElement('canvas');
app.prepend(canvas);

const st = createState(20261117);
const R = createRenderer(canvas);
const input = createInput(canvas);
let buyOpen = false;
let started = false;

const hud = bindHud({
  onStart() {
    ensureAudio();
    started = true;
    startMatch(st, fx);
    hud.hideMenu();
    input.lock();
  },
  onAgain() {
    hud.hideMatchEnd();
    startMatch(st, fx);
    input.lock();
  },
  onDeploy() {
    closeBuy();
    input.lock();
  },
  onBuy(key) {
    if (st.phase === PHASE.BUY) {
      handleBuyKey(st, key, fx);
      hud.refreshBuy(st);
    }
  },
});

const fx = {
  shot: (kind) => sfx.shot(kind),
  enemyShot: (dist) => sfx.enemyShot(dist),
  hit: () => sfx.hit(),
  kill: () => sfx.kill(),
  hurt: () => sfx.hurt(),
  reload: () => sfx.reload(),
  dryFire: () => sfx.dryFire(),
  plantBeep: () => sfx.plantBeep(),
  plantDone: () => sfx.plantDone(),
  explosion: () => sfx.explosion(),
  throwPin: () => sfx.throwPin(),
  buy: (msg) => { sfx.buy(); },
  denied: () => sfx.denied(),
  roundWin: () => sfx.roundWin(),
  roundLose: () => sfx.roundLose(),
  click: () => sfx.click(),
  showHit: (kill) => showHit(kill),
  onRoundEnd: (won, reason) => hud.showRoundEnd(won, reason, st.scoreYou, st.scoreFoe),
  onRoundEndClose: () => hud.hideRoundEnd(),
  onMatchEnd: (won) => { hud.showMatchEnd(won, st.scoreYou, st.scoreFoe); input.unlock(); },
  onBuyOpen: () => openBuy(),
  onBuyClose: () => closeBuy(),
};

function openBuy() {
  buyOpen = true;
  st.buyOpen = true;
  hud.setBuyVisible(true);
  hud.refreshBuy(st);
  input.unlock();
}

function closeBuy() {
  buyOpen = false;
  st.buyOpen = false;
  hud.setBuyVisible(false);
}

input.onLockChange = (locked) => {
  // Clicking the canvas while playing re-locks the pointer (resume).
  if (!locked && started && input.everLocked && st.phase === PHASE.PLAY && !buyOpen) hud.setPaused(true);
  else hud.setPaused(false);
};
input.onCanvasClick = () => {
  ensureAudio();
  if (started && (st.phase === PHASE.PLAY || st.phase === PHASE.BUY) && !buyOpen && !input.locked) input.lock();
};
canvas.addEventListener('click', () => { if (input.onCanvasClick) input.onCanvasClick(); });

// Test hook for automated play-testing (screenshots, headless checks). Harmless in
// play: it only exposes the state store and a few staging helpers.
window.__IRONHOLD__ = {
  state: st,
  api: {
    teleport(x, z) { st.player.x = x; st.player.z = z; },
    setYaw(yaw, pitch) { st.player.yaw = yaw; if (pitch !== undefined) st.player.pitch = pitch; },
    giveMoney(n) { st.money += n; },
    killBots() { for (const b of st.bots) { b.alive = false; b.fallT = 0; } },
    skipBuy() { st.buyTime = 0.01; },
    start() { if (!started) { started = true; startMatch(st, fx); hud.hideMenu(); } },
    state: st,
  },
};

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // Mouse look (only while locked; lookDX accumulates only then).
  if (input.locked) {
    st.player.yaw -= input.lookDX * LOOK_SENS;
    const np = st.player.pitch - input.lookDY * LOOK_SENS;
    st.player.pitch = np < -1.5 ? -1.5 : (np > 1.5 ? 1.5 : np);
  }
  // Buy menu toggle (B) during the buy phase.
  if (input.buyToggle && st.phase === PHASE.BUY) {
    if (buyOpen) { closeBuy(); input.lock(); } else openBuy();
  }
  // Number keys buy while the menu is open.
  if (buyOpen && input.slot) {
    handleBuyKey(st, String(input.slot), fx);
    hud.refreshBuy(st);
  }

  const paused = started && input.everLocked && (st.phase === PHASE.PLAY || st.phase === PHASE.BUY) && !input.locked && !buyOpen;
  hud.setPaused(paused);
  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) { stepSim(st, input, fx, STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0; // drop backlog rather than spiral
  }
  input.consumeFrame();
  updateHud(st, now / 1000);
  renderFrame(R, st, dt);
}
requestAnimationFrame(frame);
