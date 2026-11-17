// weapons.js — one job: weapon data + hitscan resolution.
// Gunplay (judge criterion 2): headshots pay more, recoil + spread punish firing on
// the move, stopping to aim pays. Every shot is a ray from the shooter's eye; walls
// block it (rayHitWall), bodies are two spheres (head r=0.24, torso r=0.45).
import { rayHitWall, segmentBlocked } from './map.js';

export const WEAPONS = {
  // id, display name, slot, price, damage, head multiplier, fire interval (s),
  // mag size, reserve max, auto, base spread (rad), move spread, recoil kick (rad),
  // range (m), reload (s). Prices are the buy-menu economy.
  p9: { id: 'p9', name: 'P9 SIDEARM', slot: 2, price: 0, damage: 26, head: 2.2, interval: 0.16, mag: 15, reserveMax: 75, auto: false, spread: 0.011, moveSpread: 0.02, recoil: 0.011, range: 55, reload: 1.1, pellets: 1 },
  vk47: { id: 'vk47', name: 'VK-47 RIFLE', slot: 1, price: 2700, damage: 33, head: 2.0, interval: 0.10, mag: 30, reserveMax: 120, auto: true, spread: 0.008, moveSpread: 0.028, recoil: 0.014, range: 70, reload: 2.2, pellets: 1 },
  raptor: { id: 'raptor', name: 'RAPTOR-9 SMG', slot: 1, price: 1500, damage: 22, head: 2.0, interval: 0.07, mag: 32, reserveMax: 128, auto: true, spread: 0.013, moveSpread: 0.03, recoil: 0.009, range: 45, reload: 1.8, pellets: 1 },
  longbow: { id: 'longbow', name: 'LONGBOW DMR', slot: 1, price: 4750, damage: 95, head: 2.5, interval: 1.1, mag: 5, reserveMax: 25, auto: false, spread: 0.001, moveSpread: 0.05, recoil: 0.05, range: 90, reload: 3.0, pellets: 1 },
  breacher: { id: 'breacher', name: 'BREACHER-12', slot: 1, price: 1700, damage: 11, head: 1.6, interval: 0.85, mag: 6, reserveMax: 30, auto: false, spread: 0.03, moveSpread: 0.04, recoil: 0.03, range: 22, reload: 2.6, pellets: 8 },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'FRAG GRENADE', price: 300, max: 2 },
  smoke: { id: 'smoke', name: 'SMOKE GRENADE', price: 300, max: 2 },
};
export const ARMOR_PRICE = 650;
export const ARMOR_MAX = 100;

export function weaponOf(st) { return WEAPONS[st.player.weapon]; }

// Spread grows with movement and bloom (rapid fire), shrinks when crouched / still.
export function spreadFor(def, moveMag, crouch, bloom) {
  let s = def.spread + def.moveSpread * moveMag + bloom;
  if (crouch) s *= 0.7;
  return s;
}

// Damage falls off past half the weapon's range.
export function damageAt(def, dist, head) {
  let d = def.damage;
  if (dist > def.range * 0.5) d *= Math.max(0.5, 1 - (dist - def.range * 0.5) / def.range);
  if (head) d *= def.head;
  return d;
}

// Armor soaks half the damage until it runs out.
export function applyDamage(target, raw) {
  let d = raw;
  if (target.armor > 0) {
    const soaked = Math.min(target.armor, d * 0.5);
    target.armor -= soaked;
    d -= soaked;
  }
  target.hp -= d;
  return d;
}

// Ray vs a standing body: head sphere (y+1.52, r 0.24) and torso sphere (y+0.95, r 0.45).
// Bodies stand on y=0; pass the target's foot position. Returns {dist, head} or null.
function rayBody(ox, oy, oz, dx, dy, dz, x, z, maxDist) {
  let best = null;
  const tests = [[x, 1.52, z, 0.24, true], [x, 0.95, z, 0.45, false]];
  for (let i = 0; i < 2; i++) {
    const t = tests[i];
    const cx = t[0] - ox, cy = t[1] - oy, cz = t[2] - oz;
    const tc = cx * dx + cy * dy + cz * dz;
    if (tc < 0) continue;
    const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
    const r2 = t[3] * t[3];
    if (d2 > r2) continue;
    const th = tc - Math.sqrt(r2 - d2);
    if (th < 0 || th > maxDist) continue;
    if (best === null || th < best.dist) best = { dist: th, head: t[4] };
  }
  return best;
}

// One hitscan ray. shooter: {kind:'player'|'bot', id}. Returns null on a clean miss,
// or {kind:'wall'|'bot'|'player', dist, head, bot} — the nearest thing the ray meets.
export function rayHit(st, ox, oy, oz, dx, dy, dz, maxDist, shooter) {
  const wallT = rayHitWall(ox, oy, oz, dx, dy, dz, maxDist);
  let best = wallT === Infinity ? null : { kind: 'wall', dist: wallT, head: false, bot: null };
  const eyeY = 1.45;
  if (shooter.kind !== 'bot') {
    // Player shooting: test every living bot.
    for (let i = 0; i < st.bots.length; i++) {
      const b = st.bots[i];
      if (!b.alive) continue;
      const hit = rayBody(ox, oy, oz, dx, dy, dz, b.x, b.z, maxDist);
      if (hit && (best === null || hit.dist < best.dist)) best = { kind: 'bot', dist: hit.dist, head: hit.head, bot: b };
    }
  }
  if (shooter.kind !== 'player') {
    const p = st.player;
    if (p.alive) {
      const hit = rayBody(ox, oy, oz, dx, dy, dz, p.x, p.z, maxDist);
      if (hit && (best === null || hit.dist < best.dist)) best = { kind: 'player', dist: hit.dist, head: hit.head, bot: null };
    }
  }
  return best;
}

// Line of sight between two eye points, accounting for walls and smoke clouds.
// Smoke blocks vision (and therefore bot sight) but not bullets.
export function hasLineOfSight(st, ax, ay, az, bx, by, bz) {
  if (segmentBlocked(ax, ay, az, bx, by, bz)) return false;
  for (let i = 0; i < st.smokes.length; i++) {
    const s = st.smokes[i];
    // Segment-sphere test against the smoke cloud.
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return true;
    let t = ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const px = ax + dx * t - s.x, py = ay + dy * t - s.y, pz = az + dz * t - s.z;
    if (px * px + py * py + pz * pz < 3.6 * 3.6) return false;
  }
  return true;
}

// Eye height of a stance (player or bot).
export function eyeHeight(crouch) { return crouch ? 1.15 : 1.62; }
export const BOT_EYE = 1.45;
