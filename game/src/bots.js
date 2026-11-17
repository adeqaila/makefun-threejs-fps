// bots.js — one job: Warden AI.
// Bots follow waypoint routes, hold site angles, react to sight and sound, strafe and
// fire in bursts when they engage, and converge on a planted bomb to defuse it.
// Decisions run at 10 Hz (thinkT); steering runs every fixed step. All randomness
// comes from st.rng, so a match replays the same way from the same seed.
import { MAP, collideCircle, findPath, nearestWaypoint } from './map.js';
import { rayHit, hasLineOfSight, applyDamage, BOT_EYE } from './weapons.js';

const RADIUS = 0.38;
const SIGHT_RANGE = 42;
const SIGHT_FOV = 0.96; // ~55 degrees half-angle
const HEAR_RANGE = 26;
const BOT_SPEED = 3.4;
const BOT_DAMAGE = 11;
const REACT_MIN = 0.35, REACT_MAX = 0.6;

const _out = [0, 0];
const _path = [];

// Can this bot see the player right now? Range + facing cone + line of sight.
function canSee(st, b) {
  const p = st.player;
  if (!p.alive) return false;
  const dx = p.x - b.x, dz = p.z - b.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > SIGHT_RANGE) return false;
  // Facing cone: bot forward is (-sin yaw, -cos yaw).
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
  const dot = (dx * fx + dz * fz) / (d || 1);
  if (dot < Math.cos(SIGHT_FOV)) return false;
  return hasLineOfSight(st, b.x, BOT_EYE, b.z, p.x, p.crouch ? 1.15 : 1.35, p.z);
}

function yawTo(b, tx, tz) {
  return Math.atan2(-(tx - b.x), -(tz - b.z));
}

function setPathTo(b, tx, tz) {
  const from = nearestWaypoint(b.x, b.z);
  const to = nearestWaypoint(tx, tz);
  findPath(from, to, _path);
  b.path.length = 0;
  for (let i = 0; i < _path.length; i++) b.path.push(_path[i]);
  b.pathI = 0;
  // Final leg is the exact target, not the waypoint.
  b.destX = tx; b.destZ = tz;
}

// Steer toward the current path waypoint (or final destination). Returns speed used.
function steer(st, b, dt) {
  let tx, tz;
  if (b.pathI < b.path.length) {
    const w = MAP.waypoints[b.path[b.pathI]];
    tx = w.x; tz = w.z;
  } else if (b.destX !== undefined) {
    tx = b.destX; tz = b.destZ;
  } else return 0;
  const dx = tx - b.x, dz = tz - b.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.6) {
    if (b.pathI < b.path.length) { b.pathI++; return steer(st, b, dt); }
    b.destX = undefined;
    return 0;
  }
  const sp = b.state === 'engage' ? BOT_SPEED * 0.75 : BOT_SPEED;
  const vx = (dx / d) * sp, vz = (dz / d) * sp;
  const nx = b.x + vx * dt, nz = b.z + vz * dt;
  collideCircle(nx, nz, RADIUS, _out);
  b.x = _out[0]; b.z = _out[1];
  // Face where we walk, unless we are engaging (face the player instead).
  if (b.state !== 'engage') b.yaw = yawTo(b, b.x + vx, b.z + vz);
  return sp;
}

// One bot shot at the player: aim with error that grows with range and movement.
function botShoot(st, b, fx) {
  const p = st.player;
  const dx = p.x - b.x, dz = p.z - b.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const aimY = p.crouch ? 1.0 : 1.25;
  const baseYaw = Math.atan2(-dx, -dz);
  const basePitch = Math.atan2(aimY - BOT_EYE, dist);
  const err = 0.02 + dist * 0.0011 + (p.moveMag > 0.3 ? 0.014 : 0) + (b.moving ? 0.012 : 0);
  const yaw = baseYaw + (st.rng() - 0.5) * 2 * err;
  const pitch = basePitch + (st.rng() - 0.5) * 2 * err;
  const c = Math.cos(pitch);
  const dir = { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
  const hit = rayHit(st, b.x, BOT_EYE, b.z, dir.x, dir.y, dir.z, 60, { kind: 'bot', id: b.id });
  st.debug.botShots++;
  if (fx) fx.enemyShot(dist);
  st.tracers.push({ x0: b.x, y0: BOT_EYE, z0: b.z, x1: b.x + dir.x * (hit ? hit.dist : 40), y1: BOT_EYE + dir.y * (hit ? hit.dist : 40), z1: b.z + dir.z * (hit ? hit.dist : 40), life: 0.07 });
  b.flash = 0.06;
  if (hit && hit.kind === 'player') {
    // Wardens press harder as the match goes on: +1 damage per round from
    // round 3, capped at +3 (11 -> 14). Round 1 stays at the tuned 11, so a
    // rifle in round 2+ does not turn the rest of the match into a 5-0 stomp.
    const ramp = Math.min(3, Math.max(0, st.round - 2));
    let dmg = (BOT_DAMAGE + ramp) * (hit.head ? 2 : 1);
    if (dist > 25) dmg *= 0.8;
    const dealt = applyDamage(p, dmg);
    st.debug.botHits++;
    p.lastDamageT = st.time; p.lastDamageFrom = b.name;
    if (p.hp <= 0) {
      p.alive = false;
      st.kills.push({ text: `${b.name} ▸ YOU`, t: st.time });
    }
  }
}

function think(st, b) {
  const p = st.player;
  const bomb = st.bomb;
  // Planted bomb overrides everything: nearest alive bot defuses, others guard.
  if (bomb.status === 'planted') {
    let nearest = null, nd = Infinity;
    for (let i = 0; i < st.bots.length; i++) {
      const o = st.bots[i];
      if (!o.alive) continue;
      const d = (o.x - bomb.x) * (o.x - bomb.x) + (o.z - bomb.z) * (o.z - bomb.z);
      if (d < nd) { nd = d; nearest = o; }
    }
    if (nearest === b) {
      if (b.state !== 'defuse') { b.state = 'defuse'; setPathTo(b, bomb.x, bomb.z); }
    } else if (b.state !== 'guard' && b.state !== 'engage') {
      b.state = 'guard';
      const s = MAP.sites[bomb.site];
      setPathTo(b, s.x0 + 2 + st.rng() * 4, s.z0 + 2 + st.rng() * 3);
    }
  }
  // Sight: seeing the player switches to engage (with a reaction delay).
  if (canSee(st, b)) {
    b.lastSeenX = p.x; b.lastSeenZ = p.z; b.lastSeenT = st.time;
    if (b.state !== 'engage') {
      b.state = 'engage';
      b.react = REACT_MIN + st.rng() * (REACT_MAX - REACT_MIN);
      b.burst = 0; b.shotT = 0;
    }
  } else if (b.state === 'engage' && st.time - b.lastSeenT > 2.5) {
    // Lost the player: go look where they were last seen.
    b.state = 'investigate'; b.invX = b.lastSeenX; b.invZ = b.lastSeenZ; b.invT = st.time;
    setPathTo(b, b.invX, b.invZ);
  }
  // Hearing: a recent gunshot nearby pulls a patrolling/holding bot over.
  if (b.state === 'patrol' || b.state === 'hold') {
    for (let i = 0; i < st.noise.length; i++) {
      const n = st.noise[i];
      if (st.time - n.t > 1.5) continue;
      const d = Math.sqrt((n.x - b.x) * (n.x - b.x) + (n.z - b.z) * (n.z - b.z));
      if (d < HEAR_RANGE) {
        b.state = 'investigate'; b.invX = n.x; b.invZ = n.z; b.invT = st.time;
        setPathTo(b, n.x, n.z);
        break;
      }
    }
  }
  // Arrived at an investigation point: look around, then resume the route.
  if (b.state === 'investigate' && b.pathI >= b.path.length && b.destX === undefined) {
    if (st.time - b.invT > 2.0) {
      b.state = b.holdSite ? 'hold' : 'patrol';
      b.wp = b.route[b.routeI];
      setPathTo(b, MAP.waypoints[b.wp].x, MAP.waypoints[b.wp].z);
    }
  }
  // Patrol / hold: walk the route, pausing at hold corners to watch an angle.
  if ((b.state === 'patrol' || b.state === 'hold') && b.pathI >= b.path.length && b.destX === undefined) {
    if (b.state === 'hold') {
      b.holdT += 0.1;
      // Slow scan: sweep the yaw across the angle the site is watched from.
      b.yaw += 0.12;
      if (b.holdT > 4) {
        b.holdT = 0; b.routeI = (b.routeI + 1) % b.route.length;
        b.wp = b.route[b.routeI];
        setPathTo(b, MAP.waypoints[b.wp].x, MAP.waypoints[b.wp].z);
      }
    } else {
      b.routeI = (b.routeI + 1) % b.route.length;
      b.wp = b.route[b.routeI];
      setPathTo(b, MAP.waypoints[b.wp].x, MAP.waypoints[b.wp].z);
    }
  }
}

export function updateBots(st, dt, fx) {
  for (let i = 0; i < st.bots.length; i++) {
    const b = st.bots[i];
    if (!b.alive) { b.fallT += dt; b.flash = Math.max(0, b.flash - dt); continue; }
    b.flash = Math.max(0, b.flash - dt);
    b.thinkT += dt;
    if (b.thinkT >= 0.1) { b.thinkT = 0; think(st, b); }
    b.moving = 0;
    if (b.state === 'engage') {
      // Face the player, strafe sideways, keep a preferred fighting distance.
      const p = st.player;
      b.yaw = yawTo(b, p.x, p.z);
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafe = (st.rng() - 0.5) * 2; b.strafeT = 0.7 + st.rng() * 0.9; }
      const dx = p.x - b.x, dz = p.z - b.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const px = -dz / d, pz = dx / d; // perpendicular
      let mx = px * b.strafe, mz = pz * b.strafe;
      if (d > 18) { mx += (dx / d) * 0.6; mz += (dz / d) * 0.6; }
      if (d < 7) { mx -= (dx / d) * 0.6; mz -= (dz / d) * 0.6; }
      const ml = Math.sqrt(mx * mx + mz * mz) || 1;
      const sp = BOT_SPEED * 0.7;
      collideCircle(b.x + (mx / ml) * sp * dt, b.z + (mz / ml) * sp * dt, RADIUS, _out);
      b.x = _out[0]; b.z = _out[1];
      b.moving = 1;
      // Fire in bursts after the reaction delay, only with a clear line.
      if (b.react > 0) b.react -= dt;
      else if (canSee(st, b)) {
        if (b.burst > 0) {
          b.burstT -= dt;
          if (b.burstT <= 0) { b.burstT = 0.13; b.burst--; botShoot(st, b, fx); }
        } else {
          b.shotT -= dt;
          if (b.shotT <= 0) { b.burst = 3 + Math.floor(st.rng() * 3); b.burstT = 0; b.shotT = 0.8 + st.rng() * 0.6; }
        }
      }
    } else if (b.state === 'defuse') {
      // Walk to the bomb; defuse when close. Planted bomb beeps give the spot away.
      const d = Math.sqrt((st.bomb.x - b.x) * (st.bomb.x - b.x) + (st.bomb.z - b.z) * (st.bomb.z - b.z));
      if (d < 2.2) {
        b.yaw = yawTo(b, st.bomb.x, st.bomb.z);
        b.defuseT += dt;
        st.bomb.defuseT = b.defuseT;
        st.bomb.defuser = b.id;
      } else {
        b.defuseT = 0;
        b.moving = steer(st, b, dt) > 0 ? 1 : 0;
      }
    } else {
      b.moving = steer(st, b, dt) > 0 ? 1 : 0;
    }
    // Stuck detection: no progress while trying to move → re-path to the next route point.
    if (b.moving) {
      const moved = Math.abs(b.x - b.lastX) + Math.abs(b.z - b.lastZ);
      if (moved < 0.01) {
        b.stuckT += dt;
        if (b.stuckT > 1.5) {
          b.stuckT = 0;
          b.routeI = (b.routeI + 1) % b.route.length;
          b.wp = b.route[b.routeI];
          setPathTo(b, MAP.waypoints[b.wp].x, MAP.waypoints[b.wp].z);
        }
      } else b.stuckT = 0;
    }
    b.lastX = b.x; b.lastZ = b.z;
  }
}
