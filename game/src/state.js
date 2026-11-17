// state.js — one job: the single state store + the deterministic RNG.
// Every mutable fact of a match lives in the object createState returns. sim.js is the
// only module that mutates it; render.js and hud.js only read it. No other module keeps
// game state of its own. Seeded RNG (mulberry32) makes bot decisions reproducible.
import { MAP } from './map.js';

export const PHASE = { MENU: 'menu', BUY: 'buy', PLAY: 'play', ROUND_END: 'roundEnd', MATCH_END: 'matchEnd' };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOT_NAMES = ['Rook', 'Vex', 'Hale', 'Moss'];
// Two bots hold the sites, two patrol the lanes. holdSite null = patrol bot.
const BOT_ROLES = [
  { holdSite: 'A', route: [18, 20, 22, 16, 11] },
  { holdSite: 'B', route: [19, 21, 23, 17, 15] },
  // Grand-tour patrols: each bot works both lanes and both sites, so the
  // defence is spread and the player meets 2 bots near a site instead of
  // 1v1s in a corridor. (Grind it.3: a lane-only loop was tried and rolled
  // back — round-1 win rate jumped 70% -> 95%. Detour waypoints 3/5 and 4/6
  // stay as BFS pathing intermediates for the 2<->7 mid crossing.)
  { holdSite: null, route: [8, 9, 10, 18, 20, 22, 16, 7, 6, 14, 13, 12, 1] },
  { holdSite: null, route: [12, 13, 14, 19, 21, 23, 17, 7, 5, 10, 9, 8, 1] },
];

export function createState(seed) {
  const st = {
    seed,
    rng: mulberry32(seed),
    phase: PHASE.MENU,
    time: 0,
    round: 1,
    scoreYou: 0,
    scoreFoe: 0,
    winRounds: 5,
    maxRounds: 9,
    money: 800,
    roundTime: 100,
    buyTime: 15,
    roundWinner: null,
    roundReason: '',
    roundEndT: 0,
    matchWinner: null,
    // The player. x/z on the ground plane, y is eye height (1.62 standing, 1.15 crouched).
    player: {
      x: MAP.spawn.x, z: MAP.spawn.z, yaw: MAP.spawn.yaw, pitch: 0,
      vx: 0, vz: 0, hp: 100, armor: 0, alive: true, crouch: false, slowWalk: false,
      weapon: 'p9', owned: ['p9'], mag: 15, reserve: 75,
      grenades: { frag: 0, smoke: 0 }, selectedGrenade: 'frag',
      hasBomb: true, planting: 0, fireT: 0, reloadT: 0, recoil: 0, bloom: 0,
      bob: 0, moveMag: 0, throwT: 0, lastDamageT: -99, lastDamageFrom: '',
    },
    bots: [],
    bomb: { status: 'carried', site: null, x: 0, z: 0, plantT: 0, timer: 30, defuseT: 0, defuser: -1, beepT: 0 },
    tracers: [],   // {x0,y0,z0,x1,y1,z1,life} pooled in render.js
    flashes: [],   // {x,y,z,life}
    grenadesLive: [], // {kind,x,y,z,vx,vy,vz,fuse,rest}
    smokes: [],    // {x,y,z,life}
    booms: [],     // {x,y,z,life}
    noise: [],     // {x,z,r,t} gunshots bots can hear
    kills: [],     // {text, t} killfeed
    centerMsg: '', centerSub: '', centerT: 0,
    stats: { shots: 0, hits: 0, kills: 0, damage: 0, plants: 0 },
    debug: { botShots: 0, botHits: 0 },
  };
  for (let i = 0; i < 4; i++) {
    st.bots.push({
      id: i, name: BOT_NAMES[i], x: 0, z: 0, yaw: 0, hp: 100, alive: true,
      state: 'patrol', route: BOT_ROLES[i].route, routeI: i % BOT_ROLES[i].route.length,
      holdSite: BOT_ROLES[i].holdSite, holdT: 0, wp: 0, path: [], pathI: 0,
      react: 0, thinkT: 0, burst: 0, shotT: 0, burstT: 0, aimErr: 0,
      lastSeenX: 0, lastSeenZ: 0, lastSeenT: -99, invX: 0, invZ: 0, invT: -99,
      strafe: 0, strafeT: 0, speed: 3.4, defuseT: 0, stuckT: 0, lastX: 0, lastZ: 0,
      flash: 0, fallT: 0,
    });
  }
  return st;
}

// Reset positions, health, bomb and timers for a fresh round. Money and score carry over.
export function resetRound(st) {
  st.player.x = MAP.spawn.x; st.player.z = MAP.spawn.z;
  st.player.yaw = MAP.spawn.yaw; st.player.pitch = 0;
  st.player.vx = 0; st.player.vz = 0; st.player.hp = 100; st.player.alive = true;
  st.player.crouch = false; st.player.fireT = 0; st.player.reloadT = 0;
  st.player.recoil = 0; st.player.bloom = 0; st.player.planting = 0;
  st.player.hasBomb = true; st.player.throwT = 0;
  // Re-arm between rounds: top the current mag up from the reserve.
  const magSize = { p9: 15, vk47: 30, raptor: 32, longbow: 5, breacher: 6 }[st.player.weapon];
  const take = Math.min(magSize - st.player.mag, st.player.reserve);
  st.player.mag += take; st.player.reserve -= take;
  st.bomb = { status: 'carried', site: null, x: 0, z: 0, plantT: 0, timer: 30, defuseT: 0, defuser: -1, beepT: 0 };
  st.tracers.length = 0; st.flashes.length = 0; st.grenadesLive.length = 0;
  st.smokes.length = 0; st.booms.length = 0; st.noise.length = 0;
  st.roundTime = 100; st.buyTime = 15; st.roundWinner = null; st.roundReason = '';
  // Bots start at their sites / lanes: A holder on site A, B holder on site B.
  const starts = [MAP.waypoints[11], MAP.waypoints[15], MAP.waypoints[9], MAP.waypoints[13]];
  for (let i = 0; i < st.bots.length; i++) {
    const b = st.bots[i];
    b.x = starts[i].x; b.z = starts[i].z; b.yaw = Math.PI;
    b.hp = 100; b.alive = true; b.state = b.holdSite ? 'hold' : 'patrol';
    b.routeI = i % b.route.length; b.wp = b.route[b.routeI];
    b.path.length = 0; b.pathI = 0; b.react = 0; b.burst = 0; b.shotT = 0;
    b.lastSeenT = -99; b.invT = -99; b.defuseT = 0; b.stuckT = 0; b.flash = 0; b.fallT = 0;
  }
}

// Fresh match: scores, money and stats reset, then round 1.
export function resetMatch(st) {
  st.scoreYou = 0; st.scoreFoe = 0; st.round = 1; st.money = 800;
  st.stats = { shots: 0, hits: 0, kills: 0, damage: 0, plants: 0 };
  st.kills.length = 0;
  st.player.owned = ['p9']; st.player.weapon = 'p9';
  st.player.mag = 15; st.player.reserve = 75; st.player.armor = 0;
  st.player.grenades = { frag: 0, smoke: 0 };
  st.matchWinner = null;
  resetRound(st);
}

export function addKill(st, text) {
  st.kills.push({ text, t: st.time });
  if (st.kills.length > 6) st.kills.shift();
}

export function setCenter(st, msg, sub) {
  st.centerMsg = msg; st.centerSub = sub || ''; st.centerT = st.time;
}

export function emitNoise(st, x, z, r) {
  st.noise.push({ x, z, r, t: st.time });
  if (st.noise.length > 12) st.noise.shift();
}
