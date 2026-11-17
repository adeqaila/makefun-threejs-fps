// render.js — one job: everything three.js draws, synced from the state store.
// The sim never touches three.js; this module never mutates game state. Hot-loop
// rule: no `new` per frame — module-level temps and pre-allocated pools (tracers,
// flashes, smokes, explosions) are reused. One material per color, shared meshes.
import * as THREE from 'three';
import { MAP, SOLIDS } from './map.js';
import { PALETTE } from './palette.js';
import { eyeHeight } from './weapons.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _c = new THREE.Color();
const TRACER_MAX = 24;
const SMOKE_MAX = 6;

function canvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

function floorTexture() {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#3a3d40'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2c2f32'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 8 + Math.random() * 20);
    g.fillStyle = '#b98a1e';
    g.fillRect(0, h - 10, w, 10); // hazard strip along one edge
  }, 256, 256);
}

function siteTexture(letter, color) {
  return canvasTexture((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = color; g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, w / 2, h / 2 + 6);
  }, 256, 256);
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 32, 95);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 220);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // Lighting: warm sun + cool fill + site accents.
  const hemi = new THREE.HemisphereLight(0xbfd4e6, 0x2a2118, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.lightWarm, 1.8);
  sun.position.set(28, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(PALETTE.lightCool, 0.35);
  fill.position.set(-20, 25, -30);
  scene.add(fill);

  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95, metalness: 0.05 }),
    wall: new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85, metalness: 0.15 }),
    wallDark: new THREE.MeshStandardMaterial({ color: PALETTE.wallDark, roughness: 0.9, metalness: 0.1 }),
    wallTop: new THREE.MeshStandardMaterial({ color: PALETTE.wallTop, roughness: 0.7, metalness: 0.2 }),
    rust: new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.9, metalness: 0.35 }),
    crate: new THREE.MeshStandardMaterial({ color: PALETTE.crate, roughness: 0.9, metalness: 0.05 }),
    crateDark: new THREE.MeshStandardMaterial({ color: PALETTE.crateDark, roughness: 0.9, metalness: 0.05 }),
    pillar: new THREE.MeshStandardMaterial({ color: PALETTE.pillar, roughness: 0.8, metalness: 0.3 }),
    hazard: new THREE.MeshStandardMaterial({ color: PALETTE.hazard, roughness: 0.6, metalness: 0.2, emissive: PALETTE.hazardDark, emissiveIntensity: 0.35 }),
    siteA: new THREE.MeshStandardMaterial({ color: PALETTE.siteA, roughness: 0.5, metalness: 0.1, emissive: PALETTE.siteA, emissiveIntensity: 0.55 }),
    siteB: new THREE.MeshStandardMaterial({ color: PALETTE.siteB, roughness: 0.5, metalness: 0.1, emissive: PALETTE.siteB, emissiveIntensity: 0.55 }),
    you: new THREE.MeshStandardMaterial({ color: PALETTE.you, roughness: 0.5, metalness: 0.4 }),
    foe: new THREE.MeshStandardMaterial({ color: PALETTE.foe, roughness: 0.55, metalness: 0.35 }),
    foeDark: new THREE.MeshStandardMaterial({ color: PALETTE.foeDark, roughness: 0.6, metalness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.7, metalness: 0.5 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.45, metalness: 0.7 }),
    gunAccent: new THREE.MeshStandardMaterial({ color: PALETTE.hazard, roughness: 0.5, metalness: 0.4 }),
    smoke: new THREE.MeshBasicMaterial({ color: PALETTE.smoke, transparent: true, opacity: 0.55, depthWrite: false }),
    boom: new THREE.MeshBasicMaterial({ color: PALETTE.explosion, transparent: true, opacity: 0.9 }),
    skyline: new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 1, metalness: 0 }),
  };

  // Floor (repeat the concrete texture across the yard).
  const floorTex = mats.floor.map;
  floorTex.repeat.set(8, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Outer shell walls.
  const b = MAP.bounds;
  const shell = [
    { x: 0, z: b.minZ - 0.75, w: 66, d: 1.5, h: 4.5 },
    { x: 0, z: b.maxZ + 0.75, w: 66, d: 1.5, h: 4.5 },
    { x: b.minX - 0.75, z: 0, w: 1.5, d: 46, h: 4.5 },
    { x: b.maxX + 0.75, z: 0, w: 1.5, d: 46, h: 4.5 },
  ];
  for (const s of shell) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mats.wallDark);
    m.position.set(s.x, s.h / 2, s.z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  // Interior walls.
  for (let i = 0; i < MAP.walls.length; i++) {
    const w = MAP.walls[i];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.x1 - w.x0, w.h, w.z1 - w.z0), i % 3 === 0 ? mats.rust : mats.wall);
    m.position.set((w.x0 + w.x1) / 2, w.h / 2, (w.z0 + w.z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w.x1 - w.x0 + 0.15, 0.12, w.z1 - w.z0 + 0.15), mats.wallTop);
    cap.position.set((w.x0 + w.x1) / 2, w.h + 0.06, (w.z0 + w.z1) / 2);
    scene.add(cap);
  }
  // Crates + pillars.
  for (let i = 0; i < MAP.crates.length; i++) {
    const c = MAP.crates[i];
    const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), i % 2 ? mats.crate : mats.crateDark);
    m.position.set(c.x, c.h / 2, c.z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(c.w + 0.1, 0.08, c.d + 0.1), mats.hazard);
    lid.position.set(c.x, c.h + 0.04, c.z);
    scene.add(lid);
  }
  for (const p of MAP.pillars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mats.pillar);
    m.position.set(p.x, p.h / 2, p.z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  // Bomb sites: glowing floor decal + beacon post + point light.
  const sites = {};
  for (const key of ['A', 'B']) {
    const s = MAP.sites[key];
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(s.x1 - s.x0 - 1, s.z1 - s.z0 - 1),
      new THREE.MeshBasicMaterial({ map: siteTexture(key, key === 'A' ? '#ff7a1e' : '#2ec4b6'), transparent: true, opacity: 0.5, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(cx, 0.03, cz);
    scene.add(decal);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), key === 'A' ? mats.siteA : mats.siteB);
    post.position.set(cx, 1.7, s.z0 + 0.6);
    scene.add(post);
    const light = new THREE.PointLight(key === 'A' ? PALETTE.siteA : PALETTE.siteB, 18, 22, 1.6);
    light.position.set(cx, 3.2, cz);
    scene.add(light);
    sites[key] = { decal, light, cx, cz };
  }
  // Hazard stripe across mid + distant skyline silhouettes for depth.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(64, 0.06, 0.5), mats.hazard);
  stripe.position.set(0, 0.03, 0);
  scene.add(stripe);
  const skyline = [];
  for (let i = 0; i < 12; i++) {
    const h = 8 + ((i * 37) % 14);
    const m = new THREE.Mesh(new THREE.BoxGeometry(6 + (i % 3) * 3, h, 6), mats.skyline);
    const ang = (i / 12) * Math.PI * 2;
    m.position.set(Math.cos(ang) * 58, h / 2 - 0.5, Math.sin(ang) * 52);
    scene.add(m); skyline.push(m);
  }

  // Bots: capsule body + head + visor + gun. One group per bot, reused.
  const botMeshes = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), mats.foe);
    body.position.y = 0.95; body.castShadow = true;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.3), mats.foeDark);
    chest.position.set(0, 1.15, 0.1); chest.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mats.foeDark);
    head.position.y = 1.62; head.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.1), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
    visor.position.set(0, 1.64, -0.2);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.85), mats.gun);
    gun.position.set(0.3, 1.15, -0.4); gun.castShadow = true;
    g.add(body, chest, head, visor, gun);
    g.visible = false;
    scene.add(g);
    botMeshes.push({ group: g, visor, gun });
  }

  // Bot name tags: a small floating name + HP bar above each living bot, so an
  // opponent reads at a glance. One canvas + sprite per bot, created once; the
  // canvas is redrawn only when that bot's HP changes (never per frame).
  const botTags = [];
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    sprite.scale.set(2.2, 0.55, 1);
    sprite.visible = false;
    scene.add(sprite);
    botTags.push({ sprite, canvas: c, ctx: c.getContext('2d'), tex, lastHp: -1, lastName: '' });
  }

  // Player viewmodel: a compact rifle attached to the camera.
  const gun = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.55), mats.gun);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), mats.gun);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.42);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), mats.dark);
  mag.position.set(0, -0.15, -0.05);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.12), mats.gunAccent);
  sight.position.set(0, 0.1, -0.1);
  gun.add(receiver, barrel, mag, sight);
  gun.position.set(0.28, -0.24, -0.5);
  camera.add(gun);

  // Muzzle flash: a small glowing plane + point light, reused.
  const flashLight = new THREE.PointLight(0xffc37a, 0, 9, 1.8);
  scene.add(flashLight);
  const flashMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(flashMesh);

  // Tracer pool: 24 lines, each a 2-point buffer updated from st.tracers.
  const tracerPool = [];
  for (let i = 0; i < TRACER_MAX; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: PALETTE.tracer, transparent: true, opacity: 0 }));
    line.frustumCulled = false;
    scene.add(line);
    tracerPool.push(line);
  }
  // Smoke pool + explosion pool.
  const smokePool = [];
  for (let i = 0; i < SMOKE_MAX; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 10), mats.smoke.clone());
    m.visible = false;
    scene.add(m);
    smokePool.push(m);
  }
  const boomPool = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mats.boom.clone());
    m.visible = false;
    scene.add(m);
    const l = new THREE.PointLight(PALETTE.explosion, 0, 30, 1.5);
    scene.add(l);
    boomPool.push({ mesh: m, light: l });
  }
  // The planted bomb: a small blinking charge.
  const bombMesh = new THREE.Group();
  const bombBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), mats.dark);
  const bombLed = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  bombLed.position.set(0.18, 0.18, 0);
  bombMesh.add(bombBox, bombLed);
  bombMesh.visible = false;
  scene.add(bombMesh);
  const bombLight = new THREE.PointLight(0xff2020, 0, 12, 1.8);
  scene.add(bombLight);
  // Beacon beam over the planted charge: a thin red column of light, so the
  // objective reads from across the yard even when the charge box is hidden.
  const bombBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 7, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  bombBeam.visible = false;
  scene.add(bombBeam);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, gun, flashLight, flashMesh, tracerPool, smokePool, boomPool, botMeshes, botTags, bombMesh, bombLight, bombBeam, sites };
}

function drawBotTag(tag, name, hp) {
  const g = tag.ctx;
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(10,12,14,0.72)';
  g.fillRect(28, 2, 200, 60);
  g.fillStyle = '#ffd23e';
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), 128, 20);
  // HP bar: green > 50, amber > 25, red below.
  g.fillStyle = '#22262a';
  g.fillRect(48, 40, 160, 12);
  g.fillStyle = hp > 50 ? '#7ddc5a' : (hp > 25 ? '#e8b93c' : '#ff5340');
  g.fillRect(48, 40, Math.max(0, 160 * hp / 100), 12);
  tag.tex.needsUpdate = true;
}

export function renderFrame(R, st, dt) {
  const p = st.player;
  // Camera follows the player; in the menu it slowly pans across the yard.
  if (st.phase === 'menu') {
    R.camera.position.set(Math.sin(st.time * 0.08) * 14, 7.5, 6 + Math.cos(st.time * 0.05) * 6);
    R.camera.lookAt(0, 1.2, -8);
  } else {
    R.camera.position.set(p.x, eyeHeight(p.crouch), p.z);
    R.camera.rotation.y = p.yaw;
    R.camera.rotation.x = p.pitch + p.recoil;
  }
  // Viewmodel bob + recoil kick.
  const bobY = Math.sin(p.bob * 2) * 0.012 * p.moveMag;
  const bobX = Math.cos(p.bob) * 0.008 * p.moveMag;
  R.gun.position.set(0.28 + bobX, -0.24 + bobY, -0.5 + p.recoil * 1.6);
  R.gun.rotation.x = p.recoil * 2.2;

  // Bots.
  for (let i = 0; i < st.bots.length; i++) {
    const b = st.bots[i];
    const m = R.botMeshes[i];
    const tag = R.botTags[i];
    if (st.phase === 'menu') { m.group.visible = false; tag.sprite.visible = false; continue; }
    m.group.visible = true;
    // Name tag + HP bar above living bots; hidden once they fall.
    if (b.alive) {
      tag.sprite.visible = true;
      tag.sprite.position.set(b.x, 2.1, b.z);
      if (b.hp !== tag.lastHp || b.name !== tag.lastName) {
        tag.lastHp = b.hp; tag.lastName = b.name;
        drawBotTag(tag, b.name, b.hp);
      }
    } else tag.sprite.visible = false;
    m.group.position.set(b.x, b.alive ? 0 : 0.15, b.z);
    if (b.alive) {
      m.group.rotation.set(0, b.yaw, 0);
      // Aim the gun slightly toward the player when engaging.
      m.gun.rotation.x = b.state === 'engage' ? -0.12 : 0;
    } else {
      // Fallen: lying on the ground, sinking after a while.
      const fall = Math.min(1, b.fallT * 4);
      m.group.rotation.set(-Math.PI / 2 * fall, b.yaw, 0);
      m.group.position.y = 0.15 - Math.max(0, b.fallT - 4) * 0.15;
    }
    // Muzzle flash glow on the visor when the bot just fired.
    m.visor.material.color.setHex(b.flash > 0 ? 0xffd23e : 0xff5040);
  }

  // Tracers: draw the first N live ones, hide the rest.
  for (let i = 0; i < TRACER_MAX; i++) {
    const line = R.tracerPool[i];
    const t = st.tracers[i];
    if (t && t.life > 0) {
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, t.x0, t.y0, t.z0);
      pos.setXYZ(1, t.x1, t.y1, t.z1);
      pos.needsUpdate = true;
      line.material.opacity = Math.min(1, t.life / 0.05);
    } else {
      line.material.opacity = 0;
    }
  }
  // Player muzzle flash (the newest flash near the camera).
  let flashOn = false;
  for (let i = 0; i < st.flashes.length; i++) {
    const f = st.flashes[i];
    if (f.life <= 0) continue;
    const d = Math.sqrt((f.x - p.x) ** 2 + (f.z - p.z) ** 2);
    if (d < 3) {
      flashOn = true;
      R.flashMesh.position.set(f.x, f.y, f.z);
      R.flashMesh.lookAt(R.camera.position);
      R.flashMesh.material.opacity = Math.min(1, f.life / 0.04);
      R.flashLight.position.set(f.x, f.y, f.z);
      R.flashLight.intensity = 14 * (f.life / 0.05);
      break;
    }
  }
  if (!flashOn) {
    R.flashMesh.material.opacity = 0;
    R.flashLight.intensity = 0;
  }
  // Smoke clouds grow, then fade.
  for (let i = 0; i < SMOKE_MAX; i++) {
    const m = R.smokePool[i];
    const s = st.smokes[i];
    if (s && s.life > 0) {
      m.visible = true;
      m.position.set(s.x, s.y, s.z);
      const grow = Math.min(1, (14 - s.life) * 0.5 + 0.3);
      m.scale.setScalar(grow);
      m.material.opacity = s.life < 3 ? 0.55 * (s.life / 3) : 0.55;
    } else m.visible = false;
  }
  // Explosions.
  for (let i = 0; i < 2; i++) {
    const bp = R.boomPool[i];
    const b = st.booms[i];
    if (b && b.life > 0) {
      bp.mesh.visible = true;
      bp.mesh.position.set(b.x, 1, b.z);
      const r = (0.5 - b.life) * 22 + 1;
      bp.mesh.scale.setScalar(Math.max(0.1, r));
      bp.mesh.material.opacity = Math.max(0, b.life / 0.5);
      bp.light.position.set(b.x, 2, b.z);
      bp.light.intensity = 60 * Math.max(0, b.life / 0.5);
    } else {
      bp.mesh.visible = false;
      bp.light.intensity = 0;
    }
  }
  // Planted bomb blinks faster as the timer runs down.
  const bomb = st.bomb;
  if (bomb.status === 'planted') {
    R.bombMesh.visible = true;
    R.bombMesh.position.set(bomb.x, 0.18, bomb.z);
    const blink = (Math.sin(st.time * (bomb.timer < 10 ? 14 : 6)) + 1) / 2;
    R.bombLight.position.set(bomb.x, 1.2, bomb.z);
    R.bombLight.intensity = 2 + blink * 8;
    R.bombBeam.visible = true;
    R.bombBeam.position.set(bomb.x, 3.5, bomb.z);
    R.bombBeam.material.opacity = 0.14 + blink * 0.16;
  } else {
    R.bombMesh.visible = false;
    R.bombLight.intensity = 0;
    R.bombBeam.visible = false;
  }
  // Site beacons pulse gently.
  for (const key of ['A', 'B']) {
    const s = R.sites[key];
    s.light.intensity = 14 + Math.sin(st.time * 2 + (key === 'A' ? 0 : 2)) * 4;
  }
  R.renderer.render(R.scene, R.camera);
}
