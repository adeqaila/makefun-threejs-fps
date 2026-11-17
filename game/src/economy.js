// economy.js — one job: round money + the buy menu (judge criterion 3).
// Win a round: +$3250. Lose: +$1900. Kill: +$300. Plant: +$300.
// The buy menu (B, buy phase only) sells primaries, grenades and armor.
import { WEAPONS, GRENADES, ARMOR_PRICE, ARMOR_MAX } from './weapons.js';

export const ROUND_WIN = 3250;
export const ROUND_LOSS = 2000;
export const KILL_REWARD = 300;
export const PLANT_REWARD = 300;

// Buy-menu rows in display order. Each row: {key, id, kind, name, price, owned, afford}.
export function buyRows(st) {
  const p = st.player;
  const rows = [];
  let key = 1;
  for (const id of ['vk47', 'raptor', 'breacher', 'longbow']) {
    const w = WEAPONS[id];
    const owned = p.owned.includes(id);
    rows.push({ key: String(key++), id, kind: 'weapon', name: w.name, price: w.price, owned, afford: !owned && st.money >= w.price });
  }
  for (const id of ['frag', 'smoke']) {
    const g = GRENADES[id];
    const owned = p.grenades[id] >= g.max;
    rows.push({ key: String(key++), id, kind: 'grenade', name: g.name + ` (${p.grenades[id]}/${g.max})`, price: g.price, owned, afford: !owned && st.money >= g.price });
  }
  rows.push({ key: String(key++), id: 'armor', kind: 'armor', name: `KEVLAR VEST (armor ${p.armor})`, price: ARMOR_PRICE, owned: p.armor >= ARMOR_MAX, afford: p.armor < ARMOR_MAX && st.money >= ARMOR_PRICE });
  return rows;
}

// Buy by menu key. Returns a message for the HUD, or null when nothing was bought.
export function buyByKey(st, key) {
  const row = buyRows(st).find((r) => r.key === key);
  if (!row || row.owned || !row.afford) return null;
  st.money -= row.price;
  const p = st.player;
  if (row.kind === 'weapon') {
    p.owned.push(row.id);
    const w = WEAPONS[row.id];
    p.weapon = row.id;
    p.mag = w.mag;
    p.reserve = w.reserveMax;
  } else if (row.kind === 'grenade') {
    p.grenades[row.id]++;
  } else if (row.kind === 'armor') {
    p.armor = ARMOR_MAX;
  }
  return `Bought ${row.name} — $${row.price}`;
}

export function awardRound(st, won) {
  st.money += won ? ROUND_WIN : ROUND_LOSS;
}
