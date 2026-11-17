// bomb.js — one job: the bomb objective (judge criterion 3).
// The player carries the charge. On a site (Furnace A / Depot B), holding E for 3 s
// plants it; 35 s later it detonates and the attackers win the round. The nearest
// Warden walks in to defuse (5 s, interrupted by death); a defuse wins the round
// for the defenders. Planting pays $300.
import { siteAt } from './map.js';
import { setCenter } from './state.js';

export const PLANT_TIME = 3.0;
export const DEFUSE_TIME = 7.0;
export const BOMB_TIMER = 30;

// Called every fixed step while the round is live.
export function updateBomb(st, input, dt) {
  const bomb = st.bomb;
  const p = st.player;
  if (bomb.status === 'carried') {
    if (!p.alive || !p.hasBomb) { p.planting = 0; return; }
    const site = siteAt(p.x, p.z);
    if (site && input.interact) {
      p.planting += dt;
      if (p.planting >= PLANT_TIME) {
        bomb.status = 'planted';
        bomb.site = site;
        bomb.x = p.x; bomb.z = p.z;
        bomb.timer = BOMB_TIMER;
        bomb.defuseT = 0; bomb.defuser = -1;
        p.hasBomb = false; p.planting = 0;
        st.money += 300;
        st.stats.plants++;
        setCenter(st, `CHARGE PLANTED — SITE ${site}`, 'Defend it until it blows. Wardens are coming.');
      }
    } else {
      p.planting = Math.max(0, p.planting - dt * 2);
    }
    return;
  }
  if (bomb.status === 'planted') {
    bomb.timer -= dt;
    // Beep faster as the timer runs down; the beep also tells bots where it is.
    bomb.beepT -= dt;
    if (bomb.beepT <= 0) {
      bomb.beepT = bomb.timer < 10 ? 0.5 : 1.0;
    }
    // A defuser standing on the bomb drives the shared defuse clock.
    let defusing = false;
    for (let i = 0; i < st.bots.length; i++) {
      const b = st.bots[i];
      if (!b.alive || b.state !== 'defuse') continue;
      const d = Math.sqrt((bomb.x - b.x) * (bomb.x - b.x) + (bomb.z - b.z) * (bomb.z - b.z));
      if (d < 2.2) { defusing = true; break; }
    }
    if (!defusing) { bomb.defuseT = 0; bomb.defuser = -1; for (const b of st.bots) b.defuseT = 0; }
    if (bomb.defuseT >= DEFUSE_TIME) {
      bomb.status = 'defused';
      return 'defused';
    }
    if (bomb.timer <= 0) {
      bomb.status = 'exploded';
      return 'exploded';
    }
  }
  return null;
}

export function bombProgress(st) {
  const bomb = st.bomb;
  if (bomb.status === 'carried') return { label: 'PLANT', frac: st.player.planting / PLANT_TIME, show: st.player.planting > 0.01 };
  if (bomb.status === 'planted') return { label: 'DEFUSE', frac: bomb.defuseT / DEFUSE_TIME, show: bomb.defuseT > 0.01 };
  return { label: '', frac: 0, show: false };
}
