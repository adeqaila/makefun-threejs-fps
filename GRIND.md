# IRONHOLD — GRIND LOG (slot 1, threejs-fps-01)

Goal: slot 1 maksimal sebelum submit (aturan 2-slot, 16 Nov 2026). Target kualitas
FASE FINAL (robust, kualitas juri, determinisme), bukan rank dev. Metric = 5 kriteria
juri RULES.txt: 1. completeness, 2. gunplay/movement, 3. tactics, 4. map & look,
5. code. Satu fokus per iterasi; rollback kalau memperburuk.

## Baseline (builder, 16 Nov 2026 ~17:55 WIB)

- Game: IRONHOLD, map "Foundry Yard" 64x44 m, Vanguard (player) 1v4 bot Warden,
  bomb plant/defuse (3 s plant / 5 s defuse / 35 s timer), ekonomi ($800 start,
  win +$3250 / loss +$1900 / kill +$300 / plant +$300), 5 senjata + 2 granat,
  fixed-step 60 Hz, seeded RNG (mulberry32, seed 20261117), 24 waypoint + 32 edge.
- Sim tests 19/19 PASS; browser play-test final run green (0 console error,
  0 external request, 0 failed request); main.ts x2 byte-identik.
- Sizes: source game/ ~93 KiB (cap 160 KiB), dossier 352.282 B (cap 1,5 MiB),
  game/ 21 entries / 2.226.828 B, screenshots 4x JPEG 960x600 (31-57 KiB).
- Screenshot self-judge baseline (dilihat langsung):
  - 1-combat.jpg: HUD lengkap & terbaca (HP 61, ammo 13/75, timer 1:40, skor,
    $800, bomb status), bot merah terlihat di crosshair + tracer. Kelemahan: bot
    kecil & polos (tanpa nama/HP), scene tengah agak kosong, pesan "ROUND 1 — GO"
    menutupi tengah frame.
  - 2-buymenu.jpg: sangat terbaca (harga, afford greyed-out). Kelemahan: pesan
    tengah "ROUND 1 — BUY PHASE" menghantui lewat menu translusen.
  - 3-bombsite.jpg: charge terlihat (kotak hitam + LED merah), killfeed headshot
    terbaca, 2 bot jatuh. Kelemahan: charge kecil; player HP 9 saat plant —
    plant di bawah tembakan hampir mustahil tanpa bunuh 2 bot dulu.
  - 4-roundend.jpg: banner "ROUND WON" jelas, tapi overlay gelap membuat
    background hampir hitam (masih OK).
- Risiko yang dicatat builder: plant di bawah tembakan sulit (1v4, sempat mati
  saat plant). Bot: damage 13/hit (x2 head), burst 3-5 @0,13 s, jeda burst
  0,8-1,4 s, reaksi 0,35-0,6 s, sight 42 m / FOV ~55°.

## Iterasi 1 — Playability/balance (bot damage/reaksi + plant feasibility)
Status: SELESAI — KEEP. Tool: /tmp/grind-balance.mjs (harness node, scripted
player "decent": aim error 0,03 rad + delay akuisisi 0,35 s, burst 0,45/0,5 s,
navigasi waypoint ke site A, hold E plant, defend dari titik ber-LOS ke bomb).
- BASELINE (20 seed, round 1): plant 17/20 (85%), round win 7/20 (35%),
  avg HP saat plant 66, avg kills 2,5, hit% 64. Penyebab kalah dominan: DEFUSE
  8x (plant lalu defuser lolos), mati sebelum plant 3x. Lethality probe
  (player diam, 1 bot): TTK ~5,4-11,2 s @10 m, ~6-15,4 s @20 m.
- PERUBAHAN (satu tema: plant feasible tapi tegang): BOT_DAMAGE 13 -> 11
  (bots.js); DEFUSE_TIME 5,0 -> 7,0 s (bomb.js); BOMB_TIMER 35 -> 30 s
  (bomb.js + placeholder timer 35 -> 30 di state.js 2 tempat).
- HASIL (20 seed, round 1, defend point yang sama): plant 20/20 (100%),
  round win 11/20 (55%) dengan defend-buta; 14/20 (70%) dengan defend point
  ber-LOS (perbaikan harness, bukan game — manusia pun memilih titik ber-LOS).
  Avg HP saat plant 62 (masih tegang: 3 seed <=23 HP). Simtest 19/19 PASS
  (1 test di-update: defuse 5 s -> 7 s di /tmp/simtest.mjs).
- FULL MATCH (20 seed, mode full, beli vk47 ronde 2+): player menang 18/20
  match, mayoritas 5-0 — ronde 2+ dengan rifle jadi stomp. DICATAT untuk
  iterasi 4 (pacing): pertimbangkan ramp bot ringan per ronde.
- Self-judge kriteria 1/3: plant kini jalur menang yang nyata (bukan jebakan);
  eliminasi tetap jalur utama. Lanjut iterasi 2.

## Iterasi 2 — Keterbacaan juri (screenshot + HUD)
Status: SELESAI — KEEP.
- render.js: name tag + HP bar di atas bot hidup (sprite 2,2x0,55, canvas
  digambar ulang hanya saat HP berubah, tersembunyi saat mati/menu);
  beacon beam vertikal merah di atas charge ter-plant (additive, opacity
  berdenyut ikut blink).
- hud.js: center message disembunyikan saat buy menu terbuka (ghost text hilang).
- playtest.mjs (tooling): combat 2 tembakan saja (bot tetap hidup, tag terbaca),
  re-teleport pemain ke 6 m sebelum tembak (bot sempat jalan saat pesan tengah
  memudar), trigger tetap ditahan saat screenshot (tracer/flash).
- HASIL (playtest browser, 0 console error / 0 external / 0 failed):
  cover 1-combat.jpg: bot "HALE" hidup di crosshair + tag nama & HP bar
  (~48%, amber) terbaca, bot kedua di belakangnya, HUD lengkap (HP 45,
  ammo 13/75, timer 1:37), vignette damage merah di tepi. 2-buymenu.jpg: menu
  bersih tanpa ghost text. 3-bombsite.jpg: beam merah vertikal dari charge +
  timer 0:30 + killfeed headshot + 2 bot jatuh. Plant ronde 1 HP 12 (tegang).
- Self-judge kriteria 1/4: lawan + objektif kini terbaca sekilas. Lanjut iterasi 3.

## Iterasi 3 — Taktik & map
Status: SELESAI — ROLLBACK ke rute baseline (tidak ada perubahan rute).
Pengukuran (full match, 20 seed): semua state AI terpakai (hold 2395, patrol
1636, engage 1463, investigate 679, guard 935, defuse 1134 sampel/detik);
lane barat/timur + mid + kedua site semua aktif (kunjungan waypoint 69-843);
bunching 6,0% (full match) — rendah. Yang "mati": hanya waypoint detour mid
3/5 dan 4/6 (3-21 kunjungan) — itu jalan alternatif memutar mid block, bukan
lane utama.
- PERCOBAAN GAGAL (di-rollback): loop patroli per-lane
  ([8,9,10,16,7,5,3,2,1] / [12,13,14,17,7,6,4,2,1]) — round-1 win melonjak
  70% -> 95% (bot barat masuk koridor rush pemain, jadi 1v1 berurutan yang
  mudah), plant turun 100% -> 70%, dan detour tetap sepi (3:3, 5:5 kunjungan)
  karena ronde berakhir sebelum bot sampai ke ujung rute. Bunching 0,6%.
- PERCOBAAN NETRAL (di-rollback): grand tour + stop detour di ekor rute —
  hasil IDENTIK dengan baseline (stop tak pernah tercapai dalam satu ronde),
  jadi dihapus sebagai dead code (kriteria 5).
- KESIMPULAN: rute baseline (grand tour) dipertahankan; detour 3/5, 4/6 tetap
  sebagai intermediate BFS untuk crossing mid 2<->7 (komentar di state.js).
  Verifikasi revert: round 1 identik iterasi 1 (plant 20/20, win 14/20, HP 62).
  Lanjut iterasi 4.

## Iterasi 4 — Ekonomi/pacing & ramp bot
Status: SELESAI — KEEP.
- economy.js: ROUND_LOSS $1900 -> $2000. Round kalah kini $2800: pilihan
  force-buy nyata (VK47 $2700 + $100 sisa, ATAU Raptor $1500 + frag $300 +
  smoke $300 + armor $650 = $2750). Sebelumnya $2700 = VK47 tepat $0 tanpa
  utility. Simtest baru: loss pays $2000 (assert $2800).
- bots.js: damage bot naik +1/ronde mulai ronde 3, cap +3 (11 -> 14).
  Ronde 1 TIDAK tersentuh (terbukti: round-1 summary identik iterasi 1 —
  plant 20/20, win 14/20, HP 62, hit% 66; lethality probe identik).
- HASIL full match (20 seed): player menang 17/20 (sebelumnya 18/20);
  distribusi skor 10x 5-0, 5x 5-1, 2x 5-2, 3 kalah — sedikit lebih kompetitif,
  stomp berkurang tanpa membuat ronde akhir brutal. Ramp disengaja moderat:
  harness ini jauh di atas pemain manusia; menaikkan lebih jauh berisiko
  menghukum pemain biasa di ronde akhir. Simtest 20/20 PASS.
- Self-judge kriteria 3: ekonomi kini memberi pilihan nyata tiap ronde;
  kurva kesulitan terdokumentasi di kode (botShoot).

## Verifikasi akhir (18:30 WIB, kode final pasca-grind)
- main.ts x2 (out/ + out2/): diff -r IDENTIK. dossier.json 346.464 B
  (cap 1,5 MiB); teks dossier 97.532 B (cap 160 KiB), TANPA potongan (semua
  source file ada, termasuk perubahan grind: BOT_DAMAGE 11, DEFUSE_TIME 7,
  ROUND_LOSS 2000, komentar ramp). Source game/ 96.282 B (cap 160 KiB);
  game/ 21 entries / 2.229.989 B (cap 993 / 48 MiB); index.html 10.024 B.
- Sim test /tmp/simtest.mjs: 20/20 PASS (termasuk 2 test baru: defuse 7 s,
  loss pays $2000). Balance harness /tmp/grind-balance.mjs (20 seed):
  round 1 plant 20/20, win 14/20, HP plant 62; match 17/20.
- Browser play-test final (playtest.mjs, kode final): BUY frag $500/1;
  COMBAT 2 shots 2 hits, bot hidup HP 48; PLANT 1 HP 23; BOMB timer 30;
  ROUND END win "Squad eliminated", skor [1,0]; NEXT ROUND buy ronde 2.
  CONSOLE ERRORS [] / EXTERNAL [] / FAILED [].
- Screenshot final: 4x JPEG 960x600, 30-56 KiB (cap 256 KiB), render asli.
- out/ + out2/ sudah dihapus (artefak build, bukan bagian entry).
- Tidak ada perubahan di luar ~/workspace/makefun-threejs-fps/ kecuali
  tooling screenshot di ~/workspace/makefun-threejs-fps-shots/ (playtest.mjs
  staging cover, cover.mjs staging bot ke-2) dan harness di /tmp.
- Sesi grind ini: semua perubahan in-place di path file yang sama dengan
  builder (edit tool), tanpa cp ke direktori varian. File yang diubah:
  game/src/bots.js (damage 11 + ramp), game/src/bomb.js (defuse 7 s,
  timer 30 s), game/src/state.js (timer placeholder 30 + komentar rute),
  game/src/economy.js (loss 2000), game/src/render.js (tag bot + beam),
  game/src/hud.js (center msg saat buy). thinking_revised: tiap file diubah
  >=2x oleh sesi ini (tuning + revisi staging), main.ts tidak diubah.

## Risiko gate yang tersisa (untuk parent)
- Transcript gate: grind ini menambah revisi di sesi yang sama dengan build;
  bundle tetap harus mencakup sesi builder + sesi grind ini (parent urus).
- Finalist review (top 5, dimainkan manusia di desktop Chrome): pointer lock
  tidak engage di headless (sudah ada guard everLocked); game jalan full
  speed di GPU asli (SwiftShader ~15-30% real-time, bukan bug game).
- Plant di bawah tembakan tetap tegang (HP plant 23-62) — sesuai desain;
  defuse 7 s + timer 30 s memberi ruang bertahan yang adil.
- Tidak ada network, determinisme terjaga (seeded RNG; main.ts x2 identik).
