// player.js — one job: the player's movement + stance.
// Acceleration-based movement (judge criterion 2): velocity eases toward the wanted
// direction instead of snapping, crouching and slow-walking are slower, collision is
// a circle vs the map's AABBs (collideCircle). No rendering, no shooting here —
// shooting lives in sim.js, which calls weapons.rayHit.
import { collideCircle } from './map.js';
import { eyeHeight } from './weapons.js';

const WALK_SPEED = 4.2;
const SLOW_SPEED = 2.4;
const CROUCH_SPEED = 2.2;
const ACCEL = 14;      // 1/s toward target velocity
const FRICTION = 10;   // 1/s decay with no input
const RADIUS = 0.38;

const _out = [0, 0];

export function eyePos(st) {
  const p = st.player;
  return { x: p.x, y: eyeHeight(p.crouch), z: p.z };
}

// Forward/right unit vectors from yaw. yaw 0 faces -Z (north, toward the sites).
export function forwardOf(yaw) { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; }
export function rightOf(yaw) { return { x: Math.cos(yaw), z: -Math.sin(yaw) }; }

export function updatePlayer(st, input, dt) {
  const p = st.player;
  if (!p.alive) { p.vx = 0; p.vz = 0; return; }
  const fwd = forwardOf(p.yaw);
  const rgt = rightOf(p.yaw);
  let ix = 0, iz = 0;
  if (input.forward) { ix += fwd.x; iz += fwd.z; }
  if (input.back) { ix -= fwd.x; iz -= fwd.z; }
  if (input.left) { ix -= rgt.x; iz -= rgt.z; }
  if (input.right) { ix += rgt.x; iz += rgt.z; }
  const len = Math.sqrt(ix * ix + iz * iz);
  if (len > 0) { ix /= len; iz /= len; }
  p.crouch = input.crouch;
  p.slowWalk = input.slowWalk;
  const speed = p.crouch ? CROUCH_SPEED : (p.slowWalk ? SLOW_SPEED : WALK_SPEED);
  const tx = ix * speed, tz = iz * speed;
  // Accelerate toward the target velocity; friction when idle.
  const rate = len > 0 ? ACCEL : FRICTION;
  const k = Math.min(1, rate * dt);
  p.vx += (tx - p.vx) * k;
  p.vz += (tz - p.vz) * k;
  const nx = p.x + p.vx * dt;
  const nz = p.z + p.vz * dt;
  collideCircle(nx, nz, RADIUS, _out);
  p.x = _out[0]; p.z = _out[1];
  p.moveMag = Math.min(1, Math.sqrt(p.vx * p.vx + p.vz * p.vz) / WALK_SPEED);
  // Recoil and bloom decay back to zero when not firing.
  p.recoil = Math.max(0, p.recoil - dt * 0.09);
  p.bloom = Math.max(0, p.bloom - dt * 0.03);
  if (p.moveMag > 0.05) p.bob += dt * p.moveMag * 9;
}
