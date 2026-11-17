# IRONHOLD — PROGRESS

Game: IRONHOLD, map "Foundry Yard" (original). Slot 1 build, threejs-fps-01.
Built fresh in-session after the competition opened (17 Nov 2026 00:00 WIB).

## Status

- [x] Skills + RULES.txt + competition.yaml + vendor API read
- [x] Game written fresh (all counted files via write tool, no starter copies)
- [x] main.ts / serve.ts / README / LICENSE / .makefun/owner.json
- [x] Headless play-test + screenshots (3 runs, all green on final run)
- [x] main.ts run twice, byte-identical check
- [x] Gate limits check (sizes, screenshots, source total)
- [ ] GRIND SLOT 1 (parent: spawn grinder next) — JANGAN submit sebelum grind
- [ ] Repo + push + kirim isi ke user + submit (parent, setelah user OK)

## Verification log

### Headless sim tests (node, no DOM) — /tmp/simtest.mjs — 19/19 PASS
Buy frag $300 / vk47 denied at $500 / bought at $3000; plant at site A (+$300);
defuse in 5 s on the bomb; explosion at timer 0; elimination → round won
(+$3250, 800→4050); round 2 buy phase; match end at 5th round win; frag
thrown + exploded; smoke deployed; deterministic replay (same seed, identical
state); player death loses the round (scoreFoe 1, round 2).

### Browser play-test (Playwright, Chromium 1255 + SwiftShader, 960×600)
Final run: BUY FRAG money 500/frag 1; COMBAT 5 shots 4 hits, bot killed;
PLANT 1 succeeded (hp 9); BOMB planted site A timer 35 round 1; ROUND END
winner you "Squad eliminated", score [1,0]; NEXT ROUND buy round 2.
CONSOLE ERRORS: [] · EXTERNAL REQUESTS: [] · FAILED REQUESTS: [].
Bots verified moving (7–14 m), shooting (botShotsDelta 2, botHits 1),
states engage/hold/investigate/guard/defuse seen across runs. Map check
(/tmp/mapcheck.mjs): all 24 waypoints clear, all 32 edges walkable, spawn clear.

### main.ts determinism
`MAKEFUN_OUTPUT_DIR=out node main.ts` ×2 → diff -r identical.
dossier.json 352,282 bytes (≤1.5 MiB). Dossier text 94,371 bytes, NO CUT —
full source in dossier (15 source files, 93,121 bytes, 2,174 lines).
game/: 21 entries, 2,226,828 bytes (≤993 / ≤48 MiB). index.html 10,024 bytes.
three.js hashes match kit.json byte-for-byte (module ef510bae…, core 613e370f…).
Own source: zero URLs / zero network references. Screenshots: 4 JPEG 960×600,
31,065–56,638 bytes each (≤256 KiB).

### Screenshots (all real renders, unedited)
- 1-combat.jpg (cover, 47,652 B): live bot at crosshair + tracer, HUD complete
- 2-buymenu.jpg (56,638 B): buy menu with prices/afford states
- 3-bombsite.jpg (55,766 B): "CHARGE PLANTED — SITE A", timer 0:35, killfeed
  with headshot, two fallen bots
- 4-roundend.jpg (31,065 B): "ROUND WON / Squad eliminated", score 1–0

## Notes / risks
- Pointer lock does NOT engage in headless Chromium (click hits the buy-menu
  overlay); the game runs unpaused when lock never engaged (everLocked guard
  in input.js/main.js). Real desktop Chrome locks fine; finalist review plays
  in desktop Chrome.
- Sim runs ~15–30% real-time under SwiftShader (software rendering); on a
  real GPU it runs at full speed. Not a game bug.
- Player is 1 vs 4 bots and can die while planting — planting under fire is
  hard by design; suppression fire + smoke help. Grinder may tune bot damage.
- The kit folder threejs-fps-01-kit/ sits inside ~/workspace/makefun-threejs-fps/
  (unpack location) — it must NOT be pushed to the repo.

## GRIND SLOT 1 (selesai 18:32 WIB, 4 iterasi — detail di GRIND.md)
- I1 balance KEEP: BOT_DAMAGE 13→11, DEFUSE_TIME 5→7 s, BOMB_TIMER 35→30 s.
  Round 1 (scripted player, 20 seed): plant 85%→100%, win 35%→70% (55% dgn
  defend-buta, 70% dgn defend ber-LOS), avg HP saat plant 62.
- I2 keterbacaan KEEP: name tag + HP bar bot, beacon beam merah di charge,
  center message hilang saat buy menu. Cover kini: 2 bot hidup bertag
  (ROOK + HALE) di crosshair; bombsite: beam + timer 0:30.
- I3 taktik/map ROLLBACK: loop patroli per-lane bikin round-1 win 70%→95%
  (1v1 berurutan) — dikembalikan ke grand tour baseline; detour 3/5, 4/6
  tetap intermediate BFS. Semua state AI + semua lane aktif, bunching 6%.
- I4 ekonomi/pacing KEEP: ROUND_LOSS $1900→$2000 (force-buy $2800 nyata);
  ramp damage bot +1/ronde dari ronde 3, cap +3 (ronde 1 identik).
  Full match: player menang 17/20 (sebelumnya 18/20).
- Verifikasi akhir: main.ts x2 identik; dossier 346.464 B, teks 97.532 B
  tanpa potongan; simtest 20/20 PASS; play-test browser final hijau
  (0 console error / 0 external / 0 failed); screenshot 4x 960×600.
  File diubah in-place (bots, bomb, state, economy, render, hud).
  TIDAK di-submit, TIDAK dibuat repo — parent yang urus setelah user OK.
