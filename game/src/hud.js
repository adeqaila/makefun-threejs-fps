// hud.js — one job: the DOM HUD + overlays + buy menu.
// Reads the state store every frame and writes textContent / styles. No game logic:
// buying goes through economy.buyByKey via the callbacks main.js wires in.
import { buyRows } from './economy.js';
import { weaponOf, spreadFor } from './weapons.js';
import { bombProgress, PLANT_TIME, DEFUSE_TIME } from './bomb.js';

const $ = (id) => document.getElementById(id);
let hitT = -99;
let hitKill = false;
let lastFeedSig = '';
let lastBuySig = '';

export function showHit(kill) { hitT = performance.now() / 1000; hitKill = !!kill; }

function fmtTime(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function bindHud(cb) {
  $('startbtn').addEventListener('click', () => cb.onStart());
  $('againbtn').addEventListener('click', () => cb.onAgain());
  $('deploybtn').addEventListener('click', () => cb.onDeploy());
  $('buyitems').addEventListener('click', (e) => {
    const row = e.target.closest('.item');
    if (row) cb.onBuy(row.dataset.key);
  });
  return {
    setHudVisible(v) { $('hud').classList.toggle('hidden', !v); },
    setBuyVisible(v) { $('buy').classList.toggle('hidden', !v); },
    setPaused(v) { $('pausemsg').classList.toggle('hidden', !v); },
    showMenu() {
      $('menu').classList.remove('hidden');
      $('roundend').classList.add('hidden');
      $('matchend').classList.add('hidden');
      this.setHudVisible(false);
    },
    hideMenu() { $('menu').classList.add('hidden'); this.setHudVisible(true); },
    showRoundEnd(won, reason, scoreYou, scoreFoe) {
      const t = $('roundtitle');
      t.textContent = won ? 'ROUND WON' : 'ROUND LOST';
      t.className = won ? 'win' : 'lose';
      $('roundreason').textContent = reason;
      $('roundscore').textContent = `Vanguard ${scoreYou} — ${scoreFoe} Wardens`;
      $('roundend').classList.remove('hidden');
    },
    hideRoundEnd() { $('roundend').classList.add('hidden'); },
    showMatchEnd(won, scoreYou, scoreFoe) {
      const t = $('matchtitle');
      t.textContent = won ? 'VICTORY — FOUNDRY YARD IS YOURS' : 'DEFEAT — THE WARDENS HOLD THE YARD';
      t.className = won ? 'win' : 'lose';
      $('matchscore').textContent = `Final score: Vanguard ${scoreYou} — ${scoreFoe} Wardens`;
      $('matchend').classList.remove('hidden');
    },
    hideMatchEnd() { $('matchend').classList.add('hidden'); },
    refreshBuy(st) {
      const rows = buyRows(st);
      const sig = rows.map((r) => `${r.key}:${r.owned}:${r.afford}`).join('|') + st.money;
      if (sig === lastBuySig) return;
      lastBuySig = sig;
      $('buybal').textContent = `$${st.money}`;
      $('buyitems').innerHTML = rows.map((r) =>
        `<div class="item${r.owned ? ' owned' : ''}${!r.owned && !r.afford ? ' cant' : ''}" data-key="${r.key}"><span><span class="key">${r.key}</span>${r.name}</span><span class="price">${r.owned ? 'OWNED' : '$' + r.price}</span></div>`
      ).join('');
    },
  };
}

export function updateHud(st, now) {
  const p = st.player;
  $('hpnum').textContent = Math.max(0, Math.ceil(p.hp));
  $('hpfill').style.width = `${Math.max(0, p.hp)}%`;
  $('hpfill').style.background = p.hp < 30 ? '#ff5340' : '#e8b93c';
  $('armorline').textContent = `ARMOR ${Math.ceil(p.armor)}`;
  const w = weaponOf(st);
  $('mag').textContent = p.reloadT > 0 ? '--' : p.mag;
  $('reserve').textContent = `/ ${p.reserve}`;
  $('wname').textContent = w.name + (p.reloadT > 0 ? ' — RELOADING' : '');
  const t = st.phase === 'buy' ? st.buyTime : st.roundTime;
  $('timer').textContent = fmtTime(t);
  $('timer').classList.toggle('low', t <= 10 && st.phase === 'play');
  $('roundlabel').textContent = `ROUND ${st.round} · FIRST TO 5`;
  $('score').innerHTML = `<span class="you">VANGUARD ${st.scoreYou}</span> — <span class="foe">${st.scoreFoe} WARDENS</span>`;
  $('money').firstChild.textContent = `$${st.money}`;
  // Bomb status line.
  const bs = $('bombstatus');
  if (st.bomb.status === 'planted') {
    const def = st.bomb.defuser >= 0 ? ' — DEFUSE IN PROGRESS!' : '';
    bs.innerHTML = `<span class="planted">CHARGE PLANTED ${fmtTime(st.bomb.timer)}</span>${def}`;
  } else if (st.bomb.status === 'carried') {
    bs.textContent = p.hasBomb ? 'CHARGE READY — HOLD E ON SITE A / B' : 'CHARGE PLANTED';
  } else bs.textContent = '';
  // Killfeed (rebuild only when it changes).
  const feed = st.kills.filter((k) => st.time - k.t < 5);
  const sig = feed.map((k) => k.text).join('|');
  if (sig !== lastFeedSig) {
    lastFeedSig = sig;
    $('killfeed').innerHTML = feed.map((k) => {
      const you = k.text.includes('YOU');
      return `<div class="${you ? 'you' : 'foe'}">${k.text}</div>`;
    }).join('');
  }
  // Center message + plant/defuse progress bar. Hidden while the buy menu is
  // open: the message ghosting through the menu reads as a layout bug.
  const showMsg = st.time - st.centerT < 3.5 && !st.buyOpen;
  $('centermsg').textContent = showMsg ? st.centerMsg : '';
  $('centersub').textContent = showMsg ? st.centerSub : '';
  const prog = bombProgress(st);
  $('progress').style.display = prog.show ? 'block' : 'none';
  if (prog.show) {
    $('progressfill').style.width = `${Math.round(prog.frac * 100)}%`;
    $('progresstext').textContent = prog.label === 'PLANT' ? 'PLANTING CHARGE…' : 'DEFUSE IN PROGRESS…';
  } else $('progresstext').textContent = '';
  // Crosshair spread follows the weapon's live spread (bloom + movement).
  const sp = spreadFor(w, p.moveMag, p.crouch, p.bloom);
  $('crosshair').style.setProperty('--sp', `${Math.min(24, Math.round(sp * 900))}px`);
  // Hitmarker fades 0.25 s after a hit.
  const hm = $('hitmarker');
  const dt = now - hitT;
  hm.classList.toggle('show', dt < 0.25);
  hm.classList.toggle('kill', hitKill);
  // Damage vignette flashes on a fresh hit.
  const dmg = Math.max(0, 1 - (st.time - p.lastDamageT) / 0.5);
  $('damage').style.opacity = p.alive ? String(dmg * 0.9) : '0.9';
}
