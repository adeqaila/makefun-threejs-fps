// map.js — one job: the map. Geometry data, AABB collision, ray-vs-wall tests,
// site zones, waypoint graph + BFS. No rendering here, no state: pure functions over
// the MAP constant. "Foundry Yard": an original industrial yard, 64 x 44 m.
// South = Vanguard spawn. North-west = Furnace (site A). North-east = Depot (site B).
// Three lanes (west / mid / east) with corners and sightlines between them.
export const MAP = {
  name: 'Foundry Yard',
  bounds: { minX: -32, maxX: 32, minZ: -22, maxZ: 22 },
  spawn: { x: 0, z: 18, yaw: 0 },
  // Walls: axis-aligned boxes {x0,z0,x1,z1,h}. Outer shell is the bounds themselves.
  walls: [
    { x0: -3, z0: -5, x1: 3, z1: 1, h: 3.2 },     // mid block: splits the mid lane
    { x0: -14, z0: -18, x1: -12, z1: 8, h: 3.2 }, // west lane divider
    { x0: 12, z0: -18, x1: 14, z1: 8, h: 3.2 },   // east lane divider
    { x0: -18, z0: -2, x1: -12, z1: 0, h: 2.6 },  // west cross wall
    { x0: 12, z0: -2, x1: 18, z1: 0, h: 2.6 },    // east cross wall
    { x0: -8, z0: -16, x1: -2, z1: -14, h: 2.6 }, // north-mid cover L
    { x0: 2, z0: -16, x1: 8, z1: -14, h: 2.6 },   // north-mid cover R
    { x0: -30, z0: -4, x1: -26, z1: -2, h: 3.0 }, // west stub
    { x0: 26, z0: -4, x1: 30, z1: -2, h: 3.0 },   // east stub
    { x0: -30, z0: 14, x1: -24, z1: 16, h: 2.8 }, // spawn-side block L
    { x0: 24, z0: 14, x1: 30, z1: 16, h: 2.8 },   // spawn-side block R
  ],
  // Crates: low cover {x,z,w,d,h} — you can shoot over them standing, hide behind them crouched.
  crates: [
    { x: -6, z: 15, w: 2.4, d: 2.4, h: 1.25 },
    { x: 6, z: 15, w: 2.4, d: 2.4, h: 1.25 },
    { x: -24, z: 4, w: 2, d: 2, h: 1.2 },
    { x: 24, z: 4, w: 2, d: 2, h: 1.2 },
    { x: -27, z: -13, w: 2.4, d: 2.4, h: 1.3 },
    { x: 27, z: -13, w: 2.4, d: 2.4, h: 1.3 },
    { x: 0, z: -12, w: 3, d: 1.6, h: 1.15 },
    { x: -8, z: -4, w: 1.8, d: 1.8, h: 1.2 },
    { x: 8, z: -4, w: 1.8, d: 1.8, h: 1.2 },
    { x: -28, z: 8, w: 2, d: 2, h: 1.2 },
    { x: 28, z: 8, w: 2, d: 2, h: 1.2 },
    { x: -28, z: -19, w: 2, d: 2, h: 1.2 },
    { x: 28, z: -19, w: 2, d: 2, h: 1.2 },
  ],
  // Tall pillars (full-height cover, h 4.5).
  pillars: [
    { x: -16, z: -8, w: 1.2, d: 1.2, h: 4.5 },
    { x: 16, z: -8, w: 1.2, d: 1.2, h: 4.5 },
    { x: 0, z: -18, w: 1.4, d: 1.4, h: 5.0 },
  ],
  sites: {
    A: { name: 'Furnace', x0: -30, z0: -20, x1: -16, z1: -10 },
    B: { name: 'Depot', x0: 16, z0: -20, x1: 30, z1: -10 },
  },
  // Waypoint graph. Every edge is a straight walkable segment (checked in tests).
  waypoints: [
    { x: 0, z: 18 },    // 0 spawn
    { x: 0, z: 12 },    // 1 mid south
    { x: 0, z: 4 },     // 2 mid
    { x: -5, z: 2 },    // 3 mid west detour
    { x: 5, z: 2 },     // 4 mid east detour
    { x: -5, z: -7 },   // 5 mid north west
    { x: 5, z: -7 },    // 6 mid north east
    { x: 0, z: -11 },   // 7 mid north
    { x: -20, z: 12 },  // 8 west south
    { x: -20, z: 2 },   // 9 west mid
    { x: -20, z: -8 },  // 10 west north
    { x: -24, z: -15 }, // 11 site A
    { x: 20, z: 12 },   // 12 east south
    { x: 20, z: 2 },    // 13 east mid
    { x: 20, z: -8 },   // 14 east north
    { x: 24, z: -15 },  // 15 site B
    { x: -11, z: -11 }, // 16 A approach
    { x: 11, z: -11 },  // 17 B approach
    { x: -20, z: -16 }, // 18 A hold corner
    { x: 20, z: -16 },  // 19 B hold corner
    { x: -13, z: -19 }, // 20 north gap A (lane divider ends at z=-18)
    { x: 13, z: -19 },  // 21 north gap B
    { x: -10, z: -19 }, // 22 north lane A
    { x: 10, z: -19 },  // 23 north lane B
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7],
    [1, 8], [1, 12], [8, 9], [9, 10], [10, 11], [10, 18],
    [11, 18], [11, 20], [12, 13], [13, 14], [14, 15], [14, 19], [15, 19], [15, 21],
    [5, 16], [6, 17], [7, 16], [7, 17],
    [18, 20], [20, 22], [22, 16], [19, 21], [21, 23], [23, 17],
  ],
};

// All solid boxes (walls + crates + pillars) as AABBs, built once.
function buildSolids() {
  const out = [];
  for (const w of MAP.walls) out.push({ x0: w.x0, z0: w.z0, x1: w.x1, z1: w.z1, h: w.h });
  for (const c of MAP.crates) out.push({ x0: c.x - c.w / 2, z0: c.z - c.d / 2, x1: c.x + c.w / 2, z1: c.z + c.d / 2, h: c.h });
  for (const p of MAP.pillars) out.push({ x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2, h: p.h });
  return out;
}
export const SOLIDS = buildSolids();

// Adjacency list for the waypoint graph.
export const ADJ = MAP.waypoints.map(() => []);
for (const [a, b] of MAP.edges) { ADJ[a].push(b); ADJ[b].push(a); }

// Circle (x,z,r) vs every solid AABB: push the circle out. Returns corrected [x, z].
// No allocation: writes into the out array the caller reuses.
export function collideCircle(x, z, r, out) {
  const b = MAP.bounds;
  if (x < b.minX + r) x = b.minX + r;
  if (x > b.maxX - r) x = b.maxX - r;
  if (z < b.minZ + r) z = b.minZ + r;
  if (z > b.maxZ - r) z = b.maxZ - r;
  for (let i = 0; i < SOLIDS.length; i++) {
    const s = SOLIDS[i];
    const cx = x < s.x0 ? s.x0 : (x > s.x1 ? s.x1 : x);
    const cz = z < s.z0 ? s.z0 : (z > s.z1 ? s.z1 : z);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // Center inside the box: push out along the smallest penetration axis.
      const pl = x - s.x0 + r, pr = s.x1 - x + r, pt = z - s.z0 + r, pb = s.z1 - z + r;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = s.x0 - r; else if (m === pr) x = s.x1 + r;
      else if (m === pt) z = s.z0 - r; else z = s.z1 + r;
    }
  }
  out[0] = x; out[1] = z;
  return out;
}

// Ray (origin + t*dir, dir normalized) vs all solid boxes. Returns nearest t or Infinity.
// Slab test in 3D; boxes stand on y=0 with height h.
export function rayHitWall(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = Infinity;
  for (let i = 0; i < SOLIDS.length; i++) {
    const s = SOLIDS[i];
    let t0 = 0, t1 = maxDist;
    // X slab
    if (Math.abs(dx) < 1e-9) { if (ox < s.x0 || ox > s.x1) continue; }
    else {
      let a = (s.x0 - ox) / dx, b2 = (s.x1 - ox) / dx;
      if (a > b2) { const t = a; a = b2; b2 = t; }
      if (a > t0) t0 = a; if (b2 < t1) t1 = b2; if (t0 > t1) continue;
    }
    // Z slab
    if (Math.abs(dz) < 1e-9) { if (oz < s.z0 || oz > s.z1) continue; }
    else {
      let a = (s.z0 - oz) / dz, b2 = (s.z1 - oz) / dz;
      if (a > b2) { const t = a; a = b2; b2 = t; }
      if (a > t0) t0 = a; if (b2 < t1) t1 = b2; if (t0 > t1) continue;
    }
    // Y slab (box from y=0 to y=h)
    if (Math.abs(dy) < 1e-9) { if (oy < 0 || oy > s.h) continue; }
    else {
      let a = (0 - oy) / dy, b2 = (s.h - oy) / dy;
      if (a > b2) { const t = a; a = b2; b2 = t; }
      if (a > t0) t0 = a; if (b2 < t1) t1 = b2; if (t0 > t1) continue;
    }
    if (t0 < best && t0 >= 0) best = t0;
  }
  // Outer bounds: treat the yard walls as boxes too (height 4).
  const b = MAP.bounds;
  if (dx < -1e-9) { const t = (b.minX - ox) / dx; if (t >= 0 && t < best) best = t; }
  if (dx > 1e-9) { const t = (b.maxX - ox) / dx; if (t >= 0 && t < best) best = t; }
  if (dz < -1e-9) { const t = (b.minZ - oz) / dz; if (t >= 0 && t < best) best = t; }
  if (dz > 1e-9) { const t = (b.maxZ - oz) / dz; if (t >= 0 && t < best) best = t; }
  return best;
}

// True when the segment between two points is blocked by a wall (eye-height sight).
export function segmentBlocked(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-6) return false;
  const t = rayHitWall(ax, ay, az, dx / len, dy / len, dz / len, len);
  return t < len - 0.05;
}

export function siteAt(x, z) {
  const A = MAP.sites.A, B = MAP.sites.B;
  if (x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1) return 'A';
  if (x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1) return 'B';
  return null;
}

export function nearestWaypoint(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < MAP.waypoints.length; i++) {
    const w = MAP.waypoints[i];
    const d = (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// BFS over the waypoint graph. Writes the path (list of waypoint indices, excluding
// the start) into `out` and returns it. Small graph, no allocation beyond `out`.
const _prev = new Int16Array(64);
const _queue = new Int16Array(64);
export function findPath(from, to, out) {
  out.length = 0;
  if (from === to) return out;
  _prev.fill(-1);
  let qh = 0, qt = 0;
  _queue[qt++] = from; _prev[from] = from;
  while (qh < qt) {
    const cur = _queue[qh++];
    if (cur === to) break;
    const nb = ADJ[cur];
    for (let i = 0; i < nb.length; i++) {
      const n = nb[i];
      if (_prev[n] === -1) { _prev[n] = cur; _queue[qt++] = n; }
    }
  }
  if (_prev[to] === -1) { out.push(to); return out; }
  const rev = [];
  let c = to;
  while (c !== from) { rev.push(c); c = _prev[c]; }
  for (let i = rev.length - 1; i >= 0; i--) out.push(rev[i]);
  return out;
}

// Is a point inside any solid (used by grenade bounce + spawn sanity)?
export function insideSolid(x, z, y) {
  for (let i = 0; i < SOLIDS.length; i++) {
    const s = SOLIDS[i];
    if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && y >= 0 && y <= s.h) return true;
  }
  return false;
}
