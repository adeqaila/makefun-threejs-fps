// palette.js — one job: every color the game uses, in one place.
// IRONHOLD palette: cold steel + rust + hazard amber. You are amber, Wardens are crimson,
// site A is furnace orange, site B is depot teal. The scene must read at a glance.
export const PALETTE = {
  sky: 0x1a2027,
  fog: 0x1a2027,
  ground: 0x3a3d40,
  groundLine: 0x2c2f32,
  wall: 0x565b60,
  wallDark: 0x3f4347,
  wallTop: 0x6b7075,
  rust: 0x8a5a33,
  rustDark: 0x5f3d22,
  hazard: 0xffd23e,
  hazardDark: 0xb98a1e,
  steel: 0x9aa3ab,
  steelDark: 0x4a5058,
  you: 0xffd23e,
  youDark: 0xc79a1d,
  foe: 0xd43a2a,
  foeDark: 0x7e1f16,
  siteA: 0xff7a1e,
  siteB: 0x2ec4b6,
  crate: 0x7a6a4f,
  crateDark: 0x57492f,
  pillar: 0x2f3336,
  lightWarm: 0xffc37a,
  lightCool: 0x9fc4e8,
  tracer: 0xffe9a8,
  smoke: 0xb8bcc0,
  explosion: 0xff9a3c,
};
// Team names. Original fiction: Vanguard (you, attacker) vs Wardens (bots, defenders).
export const TEAM_YOU = 'Vanguard';
export const TEAM_FOE = 'Wardens';
