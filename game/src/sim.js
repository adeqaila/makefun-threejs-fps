// sim.js — one job: the fixed-step simulation (60 Hz), kept apart from rendering.
// main.js runs an accumulator and calls stepSim(dt) with dt = 1/60; render.js then
// draws the state. Everything here is deterministic from st.rng. No `new` in the
// hot loop: ray directions and grenade math use plain numbers and reused slots.
import { PHASE, resetRound, resetMatch, setCenter, emitNoise, addKill } from './state.js';
import { updatePlayer, eyePos, forwardOf } from './player.js';
import { updateBots } from './bots.js';
import { updateBomb } from './bomb.js';
import { buyByKey, awardRound, KILL_REWARD } from './economy.js';
import { weaponOf, spreadFor, damageAt, applyDamage, rayHit } from './weapons.js';
import { segmentBlocked } from './map.js';

const DT = 1 / 60;

export function stepSim(st, input, fx, dt) {
  st.time += dt;
  // Decay purely visual timers in every phase.
  for (let i = st.tracers.length - 1; i >= 0; i--) { st.tracers[i].life -= dt; if (st.tracers[i].life <= 0) st.tracers.splice(i, 1); }
  for (let i = st.flashes.length - 1; i >= 0; i--) { st.flashes[i].life -= dt; if (st.flashes[i].life <= 0) st.flashes.splice(i, 1); }
  for (let i = st.booms.length - 1; i >= 0; i--) { st.booms[i].life -= dt; if (st.booms[i].life <= 0) st.booms.splice(i, 1); }

  if (st.phase === PHASE.MENU || st.phase === PHASE.MATCH_END) return;
  if (st.phase === PHASE.ROUND_END) {
    st.roundEndT -= dt;
    updateBots(st, dt, fx); // bots keep walking to the site while the banner shows
    if (st.roundEndT <= 0) nextRound(st, fx);
    return;
  }
  if (st.phase === PHASE.BUY) {
    st.buyTime -= dt;
    updatePlayer(st, input, dt);
    updateBots(st, dt, fx);
    if (st.buyTime <= 0) {
      st.phase = PHASE.PLAY;
      setCenter(st, `ROUND ${st.round} — GO`, 'Plant the charge at Furnace (A) or Depot (B), or clear the squad.');
      fx.onBuyClose();
    }
    return;
  }
  // PHASE.PLAY
  st.roundTime -= dt;
  const p = st.player;
  updatePlayer(st, input, dt);

  // Weapon switching (1 primary, 2 sidearm, 3 frag, 4 smoke).
  if (input.slot === 1) selectWeapon(st, 'primary', fx);
  if (input.slot === 2) selectWeapon(st, 'p9', fx);
  if (input.slot === 3) selectGrenade(st, 'frag', fx);
  if (input.slot === 4) selectGrenade(st, 'smoke', fx);

  // Reload.
  const def = weaponOf(st);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = def.mag - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take; p.reserve -= take;
    }
  } else if (input.reload && p.mag < def.mag && p.reserve > 0 && !p.grenadeMode) {
    p.reloadT = def.reload;
    fx.reload();
  }

  // Firing / grenade throwing.
  p.fireT -= dt;
  p.throwT -= dt;
  if (input.firing && !st.buyOpen && p.alive) {
    if (p.grenadeMode) {
      if (p.throwT <= 0 && p.grenades[p.grenadeMode] > 0) throwGrenade(st, fx);
    } else if (p.fireT <= 0 && p.reloadT <= 0) {
      if (p.mag <= 0) { fx.dryFire(); p.fireT = 0.25; }
      else fireShot(st, fx);
    }
  }

  updateBots(st, dt, fx);
  const beepBefore = st.bomb.beepT;
  const bombEvent = updateBomb(st, input, dt);
  if (st.bomb.status === 'planted' && st.bomb.beepT > beepBefore) fx.plantBeep();
  updateGrenades(st, fx);

  // Round end checks (order matters: explosion beats the clock, defuse beats death).
  if (bombEvent === 'exploded') { endRound(st, true, 'Charge detonated at the site — the yard is yours.', fx); return; }
  if (bombEvent === 'defused') { endRound(st, false, 'The Wardens defused the charge.', fx); return; }
  const botsAlive = st.bots.some((b) => b.alive);
  if (!botsAlive) { endRound(st, true, 'Squad eliminated — all four Wardens are down.', fx); return; }
  if (!p.alive) { endRound(st, false, 'You were eliminated. The Wardens hold the yard.', fx); return; }
  if (st.roundTime <= 0 && st.bomb.status !== 'planted') {
    endRound(st, false, 'Time expired with no charge planted.', fx);
  }
}

function selectWeapon(st, which, fx) {
  const p = st.player;
  if (p.grenadeMode) p.grenadeMode = null;
  const target = which === 'p9' ? 'p9' : (p.owned.find((w) => w !== 'p9') || 'p9');
  if (target !== p.weapon) {
    p.weapon = target;
    p.reloadT = 0; p.fireT = 0.15;
    fx.click();
  }
}

function selectGrenade(st, kind, fx) {
  const p = st.player;
  if (p.grenades[kind] <= 0) { fx.denied(); return; }
  if (p.grenadeMode !== kind) { p.grenadeMode = kind; p.reloadT = 0; fx.click(); }
}

function fireShot(st, fx) {
  const p = st.player;
  const def = weaponOf(st);
  p.mag--;
  p.fireT = def.interval;
  p.recoil = Math.min(0.09, p.recoil + def.recoil);
  p.bloom = Math.min(0.05, p.bloom + 0.004);
  // Recoil kicks the view through p.recoil (rendered + aimed with) and decays in
  // updatePlayer; pitch itself is never permanently moved by firing.
  st.stats.shots++;
  const eye = eyePos(st);
  const spread = spreadFor(def, p.moveMag, p.crouch, p.bloom);
  fx.shot(def.id);
  emitNoise(st, p.x, p.z, 30);
  // Muzzle flash position: just in front of the camera.
  const fwd = forwardOf(p.yaw);
  st.flashes.push({ x: p.x + fwd.x * 0.7, y: eye.y - 0.12, z: p.z + fwd.z * 0.7, life: 0.05 });
  for (let pellet = 0; pellet < def.pellets; pellet++) {
    const yaw = p.yaw + (st.rng() - 0.5) * 2 * spread;
    const pitch = p.pitch + p.recoil + (st.rng() - 0.5) * 2 * spread;
    const c = Math.cos(pitch);
    const dx = -Math.sin(yaw) * c, dy = Math.sin(pitch), dz = -Math.cos(yaw) * c;
    const hit = rayHit(st, eye.x, eye.y, eye.z, dx, dy, dz, def.range, { kind: 'player' });
    const endDist = hit ? hit.dist : def.range;
    st.tracers.push({ x0: eye.x, y0: eye.y, z0: eye.z, x1: eye.x + dx * endDist, y1: eye.y + dy * endDist, z1: eye.z + dz * endDist, life: 0.07 });
    if (hit && hit.kind === 'bot') {
      const b = hit.bot;
      const dmg = damageAt(def, hit.dist, hit.head);
      const dealt = applyDamage(b, dmg);
      st.stats.hits++;
      st.stats.damage += dealt;
      fx.showHit(false);
      fx.hit();
      if (b.hp <= 0) {
        b.alive = false;
        b.fallT = 0;
        st.money += KILL_REWARD;
        st.stats.kills++;
        addKill(st, `YOU ▸ ${b.name}${hit.head ? ' (HEADSHOT)' : ''}`);
        fx.showHit(true);
        fx.kill();
      }
    }
  }
  if (p.mag === 0) { /* auto-reload on next trigger pull is handled by dryFire */ }
}

function throwGrenade(st, fx) {
  const p = st.player;
  const kind = p.grenadeMode;
  p.grenades[kind]--;
  p.throwT = 0.6;
  const eye = eyePos(st);
  const fwd = forwardOf(p.yaw);
  const c = Math.cos(p.pitch);
  st.grenadesLive.push({
    kind, x: eye.x, y: eye.y, z: eye.z,
    vx: -Math.sin(p.yaw) * c * 14, vy: Math.sin(p.pitch) * 14 + 4.5, vz: -Math.cos(p.yaw) * c * 14,
    fuse: kind === 'frag' ? 1.8 : 1.2, rest: false,
  });
  fx.throwPin();
  emitNoise(st, p.x, p.z, 18);
}

function updateGrenades(st, fx) {
  for (let i = st.grenadesLive.length - 1; i >= 0; i--) {
    const g = st.grenadesLive[i];
    g.fuse -= DT;
    if (!g.rest) {
      g.vy -= 12 * DT;
      const nx = g.x + g.vx * DT, ny = g.y + g.vy * DT, nz = g.z + g.vz * DT;
      // Cheap bounce: ground + solids, damped.
      if (ny < 0.12) { g.y = 0.12; g.vy = Math.abs(g.vy) > 1 ? -g.vy * 0.35 : 0; g.vx *= 0.6; g.vz *= 0.6; if (Math.abs(g.vy) < 0.5) g.rest = true; }
      else { g.x = nx; g.y = ny; g.z = nz; }
      if (g.x < -31.5 || g.x > 31.5) g.vx *= -0.4;
      if (g.z < -21.5 || g.z > 21.5) g.vz *= -0.4;
    }
    if (g.fuse <= 0) {
      st.grenadesLive.splice(i, 1);
      if (g.kind === 'frag') explodeFrag(st, g, fx);
      else {
        st.smokes.push({ x: g.x, y: 1.2, z: g.z, life: 14 });
        if (st.smokes.length > 6) st.smokes.shift();
      }
    }
  }
  for (let i = st.smokes.length - 1; i >= 0; i--) {
    st.smokes[i].life -= DT;
    if (st.smokes[i].life <= 0) st.smokes.splice(i, 1);
  }
}

function explodeFrag(st, g, fx) {
  st.booms.push({ x: g.x, y: g.y, z: g.z, life: 0.5 });
  fx.explosion();
  emitNoise(st, g.x, g.z, 40);
  const victims = [st.player, ...st.bots];
  for (const v of victims) {
    if (!v.alive) continue;
    const dx = v.x - g.x, dz = v.z - g.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 9) continue;
    let dmg = 110 - (d / 9) * 90;
    // A wall between the blast and the victim cuts the damage to a third.
    if (segmentBlocked(g.x, g.y, g.z, v.x, 1.1, v.z)) dmg *= 0.35;
    if (dmg <= 0) continue;
    const dealt = applyDamage(v, dmg);
    if (v === st.player) {
      st.player.lastDamageT = st.time;
      st.player.lastDamageFrom = 'frag';
      fx.hurt();
      if (st.player.hp <= 0) { st.player.alive = false; addKill(st, 'FRAG ▸ YOU'); }
    } else if (v.hp <= 0) {
      v.alive = false; v.fallT = 0;
      st.money += KILL_REWARD;
      st.stats.kills++;
      addKill(st, `FRAG ▸ ${v.name}`);
      fx.kill();
    }
  }
}

function endRound(st, won, reason, fx) {
  st.roundWinner = won ? 'you' : 'foe';
  st.roundReason = reason;
  if (won) st.scoreYou++; else st.scoreFoe++;
  awardRound(st, won);
  st.phase = PHASE.ROUND_END;
  st.roundEndT = 4;
  if (won) fx.roundWin(); else fx.roundLose();
  // No center message here: the round-end overlay carries the result (a second
  // "ROUND WON" behind it would read as a bug).
  fx.onRoundEnd(won, reason);
}

function nextRound(st, fx) {
  fx.onRoundEndClose();
  const matchOver =
    st.scoreYou >= st.winRounds || st.scoreFoe >= st.winRounds || st.round >= st.maxRounds;
  if (matchOver) {
    const won = st.scoreYou > st.scoreFoe;
    st.matchWinner = won ? 'you' : 'foe';
    st.phase = PHASE.MATCH_END;
    fx.onMatchEnd(won);
    return;
  }
  st.round++;
  resetRound(st);
  st.phase = PHASE.BUY;
  setCenter(st, `ROUND ${st.round} — BUY PHASE`, 'Press B for the buy menu. $' + st.money + ' in the bank.');
  fx.onBuyOpen();
}

export function startMatch(st, fx) {
  resetMatch(st);
  st.phase = PHASE.BUY;
  setCenter(st, 'ROUND 1 — BUY PHASE', 'Press B for the buy menu. $800 in the bank.');
  fx.onBuyOpen();
}

export function handleBuyKey(st, key, fx) {
  const msg = buyByKey(st, key);
  if (msg) fx.buy(msg);
  else fx.denied();
}
