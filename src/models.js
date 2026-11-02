// Procedural low-poly models. Everything is built from primitives so the game has no asset files.
import * as THREE from 'three';

const geoCache = new Map();
const matCache = new Map();

function cached(cache, key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export const box = (w, h, d) => cached(geoCache, `box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, seg = 12) => cached(geoCache, `cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sphere = (r, seg = 10) => cached(geoCache, `sph${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)));
const torus = (r, t, arc = Math.PI * 2) => cached(geoCache, `tor${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 8, 20, arc));

export function lambert(color, extra = {}) {
  return cached(matCache, `l${color}${JSON.stringify(extra)}`, () => new THREE.MeshLambertMaterial({ color, ...extra }));
}
export function metal(color, extra = {}) {
  return cached(matCache, `m${color}${JSON.stringify(extra)}`, () =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3, ...extra }));
}
function basic(color, extra = {}) {
  return cached(matCache, `b${color}${JSON.stringify(extra)}`, () => new THREE.MeshBasicMaterial({ color, ...extra }));
}

function part(geo, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------- humans

export const PLAYER_STYLE = { shirt: '#2f7de1', pants: '#39404f', skin: '#e0ac85', hair: '#3b2a1e', shoes: '#f4f4f4' };
export const KILLER_STYLE = { shirt: '#26262c', pants: '#18181b', skin: '#c9b9a6', hood: '#1d1d22', shoes: '#111', mask: true, knife: true };

// Models face -z (the running direction). The root origin sits at the feet.
export function makeHuman(style) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = lambert(style.skin);
  const shirt = lambert(style.shirt);
  const pants = lambert(style.pants);
  const shoe = lambert(style.shoes);

  const torso = part(box(0.56, 0.72, 0.32), shirt, 0, 1.22, 0, body);

  const head = new THREE.Group();
  head.position.set(0, 1.79, 0);
  body.add(head);
  part(box(0.34, 0.38, 0.34), skin, 0, 0, 0, head);
  if (style.hair) {
    part(box(0.36, 0.12, 0.37), lambert(style.hair), 0, 0.2, 0.01, head);
    part(box(0.36, 0.26, 0.08), lambert(style.hair), 0, 0.06, 0.16, head);
  }
  if (style.hood) part(box(0.42, 0.46, 0.4), lambert(style.hood), 0, 0.05, 0.06, head);
  if (style.mask) {
    part(box(0.28, 0.32, 0.03), lambert('#e8e4da'), 0, 0, -0.18, head, false);
    part(box(0.07, 0.035, 0.02), lambert('#111'), -0.07, 0.05, -0.2, head, false);
    part(box(0.07, 0.035, 0.02), lambert('#111'), 0.07, 0.05, -0.2, head, false);
    part(box(0.12, 0.02, 0.02), lambert('#333'), 0, -0.08, -0.2, head, false);
  } else {
    part(box(0.05, 0.05, 0.02), lambert('#222'), -0.08, 0.04, -0.175, head, false);
    part(box(0.05, 0.05, 0.02), lambert('#222'), 0.08, 0.04, -0.175, head, false);
  }

  const makeLeg = (sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.86, 0);
    body.add(pivot);
    part(box(0.21, 0.82, 0.24), pants, 0, -0.41, 0, pivot);
    part(box(0.23, 0.1, 0.32), shoe, 0, -0.83, -0.04, pivot);
    return pivot;
  };
  const makeArm = (sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.52, 0);
    body.add(pivot);
    part(box(0.17, 0.62, 0.19), shirt, 0, -0.3, 0, pivot);
    part(box(0.15, 0.14, 0.15), skin, 0, -0.68, 0, pivot);
    return pivot;
  };

  const rig = {
    root, body, torso, head,
    legL: makeLeg(-0.15), legR: makeLeg(0.15),
    armL: makeArm(-0.37), armR: makeArm(0.37),
  };

  if (style.knife) {
    // Held point-down in the right fist, so the blade continues the arm line.
    part(box(0.07, 0.16, 0.08), lambert('#3a2a1a'), 0, -0.8, 0, rig.armR);
    part(box(0.05, 0.42, 0.11), metal('#dfe4ea'), 0, -1.08, 0, rig.armR);
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return rig;
}

export function poseRun(rig, phase, amount = 1) {
  const s = Math.sin(phase);
  rig.body.rotation.set(-0.12 * amount, 0, 0);
  rig.body.position.set(0, Math.abs(Math.cos(phase)) * 0.08 * amount, 0);
  rig.legL.rotation.x = s * 0.95 * amount;
  rig.legR.rotation.x = -s * 0.95 * amount;
  rig.armL.rotation.set(-s * 0.85 * amount, 0, 0);
  rig.armR.rotation.set(s * 0.85 * amount, 0, 0);
}

export function poseJump(rig) {
  rig.body.rotation.set(-0.1, 0, 0);
  rig.body.position.set(0, 0.1, 0);
  rig.legL.rotation.x = 1.0;
  rig.legR.rotation.x = -0.35;
  rig.armL.rotation.set(2.4, 0, -0.3);
  rig.armR.rotation.set(2.4, 0, 0.3);
}

export function poseSlide(rig) {
  rig.body.rotation.set(1.2, 0, 0); // lean back
  rig.body.position.set(0, 0.22, 0);
  rig.legL.rotation.x = 0.25;
  rig.legR.rotation.x = 0.45;
  rig.armL.rotation.set(-0.6, 0, -0.4);
  rig.armR.rotation.set(-0.6, 0, 0.4);
}

export function poseFly(rig, t) {
  rig.body.rotation.set(-0.9, 0, 0); // superman lean
  rig.body.position.set(0, 0.6, 0);
  rig.legL.rotation.x = -0.2 + Math.sin(t * 6) * 0.15;
  rig.legR.rotation.x = -0.2 - Math.sin(t * 6) * 0.15;
  rig.armL.rotation.set(0.3, 0, -1.1);
  rig.armR.rotation.set(0.3, 0, 1.1);
}

export function poseHang(rig, t) {
  rig.body.rotation.set(-0.2, 0, Math.sin(t * 2) * 0.05);
  rig.body.position.set(0, 0, 0);
  rig.legL.rotation.x = 0.3 + Math.sin(t * 3) * 0.2;
  rig.legR.rotation.x = 0.3 - Math.sin(t * 3) * 0.2;
  rig.armL.rotation.set(Math.PI, 0, 0.2);
  rig.armR.rotation.set(Math.PI, 0, -0.2);
}

export function posePogo(rig) {
  rig.body.rotation.set(0, 0, 0);
  rig.body.position.set(0, 0, 0);
  rig.legL.rotation.x = 0.15;
  rig.legR.rotation.x = 0.15;
  rig.armL.rotation.set(0.9, 0, 0.25);
  rig.armR.rotation.set(0.9, 0, -0.25);
}

// Surf stance on the skateboard: body turned sideways, knees bent, arms out for balance.
export function poseSkate(rig, t) {
  rig.body.rotation.set(0, 0.9, Math.sin(t * 2.5) * 0.06);
  rig.body.position.set(0, 0.12 - 0.05 * Math.abs(Math.sin(t * 2.5)), 0);
  rig.legL.rotation.x = 0.35;
  rig.legR.rotation.x = -0.35;
  rig.armL.rotation.set(0.2, 0, -1.2);
  rig.armR.rotation.set(-0.2, 0, 1.2);
}

export function poseIdle(rig, t) {
  rig.body.rotation.set(0, 0, 0);
  rig.body.position.set(0, Math.sin(t * 2) * 0.01, 0);
  rig.legL.rotation.x = 0;
  rig.legR.rotation.x = 0;
  rig.armL.rotation.set(0, 0, -0.08);
  rig.armR.rotation.set(0, 0, 0.08);
}

// ---------------------------------------------------------------- vehicles

const CAR_COLORS = ['#f1c40f', '#e74c3c', '#3498db', '#ecf0f1', '#2c3e50', '#16a085', '#8e44ad'];

// Boxy city car. `facing` is +1 when the car drives toward the player (+z).
export function makeCar(color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], facing = -1) {
  const root = new THREE.Group();
  const paint = lambert(color);
  part(box(1.9, 0.7, 4.2), paint, 0, 0.55, 0, root);
  part(box(1.74, 0.6, 3.0), lambert('#1f2a36'), 0, 1.2, 0.1 * facing, root); // glass cabin
  part(box(1.78, 0.1, 3.0), paint, 0, 1.52, 0.1 * facing, root); // roof
  const wheels = [];
  for (const sx of [-0.92, 0.92]) {
    for (const sz of [-1.35, 1.35]) {
      const w = part(cyl(0.36, 0.36, 0.26, 14), lambert('#1a1a1a'), sx, 0.36, sz, root);
      w.rotation.z = Math.PI / 2;
      wheels.push(w);
    }
  }
  const front = 2.11 * facing;
  part(box(0.36, 0.16, 0.04), basic('#fff7cc'), -0.6, 0.65, front, root, false);
  part(box(0.36, 0.16, 0.04), basic('#fff7cc'), 0.6, 0.65, front, root, false);
  part(box(0.36, 0.14, 0.04), basic('#c0392b'), -0.6, 0.65, -front, root, false);
  part(box(0.36, 0.14, 0.04), basic('#c0392b'), 0.6, 0.65, -front, root, false);
  if (color === '#f1c40f') part(box(0.5, 0.18, 0.28), lambert('#222'), 0, 1.66, 0, root); // taxi sign
  return { root, wheels };
}

export function makeMotorcycle() {
  const root = new THREE.Group();
  const red = lambert('#c0392b');
  const black = lambert('#1b1b1b');
  for (const z of [-0.62, 0.62]) {
    const w = part(cyl(0.34, 0.34, 0.14, 16), black, 0, 0.34, z, root);
    w.rotation.z = Math.PI / 2;
    part(cyl(0.12, 0.12, 0.16, 8), metal('#999'), 0, 0.34, z, root).rotation.z = Math.PI / 2;
  }
  part(box(0.3, 0.36, 1.0), red, 0, 0.62, 0, root);
  part(box(0.36, 0.26, 0.5), red, 0, 0.86, -0.18, root); // tank
  part(box(0.3, 0.1, 0.6), black, 0, 0.84, 0.3, root); // seat
  part(box(0.06, 0.6, 0.06), metal('#aaa'), 0, 0.82, -0.58, root).rotation.x = -0.35;
  part(box(0.8, 0.05, 0.05), metal('#aaa'), 0, 1.08, -0.66, root);
  part(box(0.16, 0.14, 0.06), basic('#fff7cc'), 0, 0.92, -0.72, root, false);
  return { root };
}

const BUS_COLORS = ['#e74c3c', '#f39c12', '#2980b9', '#27ae60'];

// City bus, 11 m long and 3.15 m tall. `facing` +1 = front toward the player (+z).
export function makeBus(facing = 1) {
  const root = new THREE.Group();
  const paint = lambert(BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)]);
  const glass = lambert('#22303d');
  part(box(2.3, 2.65, 11), paint, 0, 1.75, 0, root);
  part(box(2.32, 0.18, 11.02), lambert('#ecf0f1'), 0, 0.9, 0, root, false); // stripe
  for (const sx of [-1.16, 1.16]) part(box(0.03, 0.95, 9.6), glass, sx, 2.25, 0, root, false); // side windows
  part(box(2.1, 1.3, 0.04), glass, 0, 2.1, 5.51 * facing, root, false); // windshield
  part(box(1.6, 0.3, 0.05), basic('#111'), 0, 2.88, 5.52 * facing, root, false); // route sign
  part(box(1.5, 0.16, 0.06), basic('#ffb142'), 0, 2.88, 5.55 * facing, root, false);
  for (const x of [-0.8, 0.8]) part(box(0.3, 0.18, 0.05), basic('#fff7cc'), x, 0.85, 5.52 * facing, root, false);
  for (const x of [-0.8, 0.8]) part(box(0.3, 0.18, 0.05), basic('#c0392b'), x, 0.85, -5.52 * facing, root, false);
  part(box(1.4, 0.25, 2.2), lambert('#bdc3c7'), 0, 3.2, 0, root); // roof AC unit
  const wheels = [];
  for (const sx of [-1.05, 1.05]) {
    for (const sz of [-3.6, 3.6]) {
      const w = part(cyl(0.48, 0.48, 0.3, 14), lambert('#1a1a1a'), sx, 0.48, sz, root);
      w.rotation.z = Math.PI / 2;
      wheels.push(w);
    }
  }
  return { root, wheels };
}

// Car carrier. The deck runs the whole length at 3.4 m; the cab is at the front.
// `facing` -1 = front away from the player, so the back (ramp end) faces the player.
export function makeTruck(facing = -1, length = 15) {
  const root = new THREE.Group();
  const frame = lambert('#57606f');
  const half = length / 2;
  const cabLen = 2.6;
  part(box(2.3, 3.3, cabLen), lambert('#e1b12c'), 0, 1.65, (half - cabLen / 2) * facing, root); // cab
  part(box(2.1, 1.1, 0.04), lambert('#22303d'), 0, 2.4, (half + 0.01) * facing, root, false);
  for (const x of [-0.8, 0.8]) part(box(0.3, 0.2, 0.05), basic('#fff7cc'), x, 0.9, (half + 0.02) * facing, root, false);
  const trailerLen = length - cabLen;
  const trailerZ = -(cabLen / 2) * facing;
  part(box(2.3, 0.18, trailerLen), frame, 0, 0.9, trailerZ, root); // lower deck
  part(box(2.3, 0.2, length), lambert('#747d8c'), 0, 3.3, 0, root); // top deck (walkable)
  for (let z = -trailerLen / 2 + 0.6; z <= trailerLen / 2 - 0.5; z += 2.2) {
    for (const sx of [-1.1, 1.1]) part(box(0.12, 2.3, 0.12), frame, sx, 2.1, trailerZ + z, root);
  }
  // Cars riding on the lower deck (decoration).
  for (let k = 0; k < 2; k++) {
    const car = makeCar(undefined, facing).root;
    car.scale.setScalar(0.85);
    car.position.set(0, 1.0, trailerZ + (k - 0.5) * (trailerLen / 2));
    root.add(car);
  }
  const wheels = [];
  for (const sx of [-1.05, 1.05]) {
    for (const z of [-half + 1.2, -half + 2.4, half - 1.4]) {
      const w = part(cyl(0.45, 0.45, 0.3, 14), lambert('#1a1a1a'), sx, 0.45, z, root);
      w.rotation.z = Math.PI / 2;
      wheels.push(w);
    }
  }
  return { root, wheels };
}

// Ramp slab rising toward -z: one lane wide (truck ramps) or the whole road (rooftop ramps).
export function makeRamp(width, length, height, color = '#b8862b') {
  const root = new THREE.Group();
  const slope = Math.atan2(height, length);
  const slab = part(box(width, 0.25, Math.hypot(length, height)), lambert(color), 0, height / 2 - 0.12, 0, root);
  slab.rotation.x = slope;
  slab.receiveShadow = true;
  const stripes = Math.max(3, Math.round(length / 1.8));
  for (let i = 0; i < stripes; i++) {
    const f = (i + 0.5) / stripes;
    const st = part(box(width + 0.02, 0.26, 0.3), lambert(i % 2 ? '#222' : '#f1c40f'), 0, height * f - 0.12, length / 2 - length * f, root, false);
    st.rotation.x = slope;
  }
  return root;
}

export function makePillar(height) {
  const root = new THREE.Group();
  part(box(0.6, height, 0.9), lambert('#8395a7'), 0, height / 2, 0, root);
  part(box(0.8, 0.4, 1.1), lambert('#576574'), 0, 0.2, 0, root);
  part(box(0.62, 0.5, 0.92), lambert('#f1c40f'), 0, 1.0, 0, root, false);
  return root;
}

const chevronTexture = () => cached(matCache, 'chevTex', () => canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#111';
  for (let i = -h; i < w; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 16 + h, h); ctx.lineTo(i + h, h);
    ctx.fill();
  }
}));
const chevronMat = () => cached(matCache, 'chevMat', () => new THREE.MeshLambertMaterial({ map: chevronTexture() }));

// Concrete divider wall down the middle lane (dual tunnels).
export function makeWall(length, height) {
  const root = new THREE.Group();
  part(box(2.0, height, length), lambert('#95a5a6'), 0, height / 2, 0, root).receiveShadow = true;
  part(box(2.02, height, 0.1), chevronMat(), 0, height / 2, length / 2 + 0.03, root, false); // entrance face
  return root;
}

// Overhead slab + outer walls for a tunnel / overpass section.
export function makeTunnelShell(length, height) {
  const root = new THREE.Group();
  part(box(10.4, 0.6, length), lambert('#7f8c8d'), 0, height + 0.3, 0, root, false);
  for (const sx of [-1, 1]) part(box(0.5, height, length), lambert('#6c7a89'), sx * 5.05, height / 2, 0, root, false);
  part(box(12, 2.6, 0.8), lambert('#636e72'), 0, height + 1.3, length / 2, root, false); // entrance facade
  part(box(10.4, 0.5, 0.05), chevronMat(), 0, height - 0.15, length / 2 + 0.31, root, false);
  for (let z = -length / 2 + 4; z < length / 2; z += 8) {
    for (const x of [-2.4, 2.4]) part(box(0.8, 0.08, 0.3), basic('#fff3c4'), x, height - 0.04, z, root, false);
  }
  return root;
}

// ---------------------------------------------------------------- obstacles

export function makeCone() {
  const root = new THREE.Group();
  part(box(0.7, 0.06, 0.7), lambert('#e8590c'), 0, 0.03, 0, root);
  part(cyl(0.06, 0.32, 0.85, 14), lambert('#ff6b1a'), 0, 0.47, 0, root);
  part(cyl(0.16, 0.22, 0.14, 14), lambert('#ffffff'), 0, 0.5, 0, root);
  return { root };
}

const signTexture = () => cached(matCache, 'signTex', () => canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#ff8c1a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  for (let i = -h; i < w; i += 56) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 28, 0); ctx.lineTo(i + 28 + h, h); ctx.lineTo(i + h, h);
    ctx.fill();
  }
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(28, 78, w - 56, 100);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ROAD', w / 2, 108);
  ctx.fillText('WORK', w / 2, 152);
}));

// Overhead construction sign: board hangs from 1.05 m to 3.35 m, so you must slide under it.
export function makeConstructionSign() {
  const root = new THREE.Group();
  const post = lambert('#555b63');
  part(box(0.09, 3.6, 0.09), post, -1.08, 1.8, 0, root);
  part(box(0.09, 3.6, 0.09), post, 1.08, 1.8, 0, root);
  part(box(2.3, 0.09, 0.09), post, 0, 3.55, 0, root);
  const board = cached(matCache, 'signMat', () => new THREE.MeshLambertMaterial({ map: signTexture() }));
  part(box(2.1, 2.3, 0.1), board, 0, 2.2, 0, root);
  part(box(0.14, 0.14, 0.06), basic('#ffcc00'), -0.85, 3.42, -0.06, root, false);
  part(box(0.14, 0.14, 0.06), basic('#ffcc00'), 0.85, 3.42, -0.06, root, false);
  return { root };
}

// Bird faces +z (it flies toward the player).
export function makeBird() {
  const root = new THREE.Group();
  const dark = lambert('#2a2d34');
  const b = part(sphere(0.26), dark, 0, 0, 0, root);
  b.scale.set(0.85, 0.75, 1.4);
  part(sphere(0.15), dark, 0, 0.1, 0.34, root);
  part(cyl(0, 0.05, 0.16, 6), lambert('#f0a020'), 0, 0.08, 0.5, root).rotation.x = Math.PI / 2;
  part(box(0.24, 0.04, 0.24), dark, 0, 0.02, -0.42, root);
  const makeWing = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.14, 0.06, 0);
    root.add(pivot);
    part(box(0.75, 0.04, 0.4), lambert('#3b3f48'), side * 0.38, 0, 0, pivot);
    return pivot;
  };
  return { root, wingL: makeWing(-1), wingR: makeWing(1) };
}

// ---------------------------------------------------------------- collectibles

const noteTexture = () => cached(matCache, 'noteTex', () => canvasTexture(256, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#a6e3a1');
  g.addColorStop(1, '#4f9f5f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2b6b38';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = '#e8f6e3';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b6b38';
  ctx.font = 'bold 60px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', w / 2, h / 2 + 3);
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('100', 40, 32);
  ctx.fillText('100', w - 40, h - 30);
}));

export function makeBanknote() {
  const root = new THREE.Group();
  const geo = cached(geoCache, 'note', () => new THREE.PlaneGeometry(0.95, 0.48));
  const mat = cached(matCache, 'noteMat', () => new THREE.MeshBasicMaterial({ map: noteTexture(), side: THREE.DoubleSide }));
  const m = new THREE.Mesh(geo, mat);
  m.rotation.z = 0.25;
  root.add(m);
  return { root };
}

export const POWER_COLORS = { magnet: '#ff4757', pogo: '#ffa502', glider: '#1e90ff', wings: '#dfe4ea', skateboard: '#2ed573' };

function magnetIcon(root) {
  const u = part(torus(0.24, 0.09, Math.PI), lambert('#e74c3c'), 0, 0.05, 0, root);
  u.rotation.z = Math.PI;
  part(box(0.18, 0.16, 0.18), metal('#dfe4ea'), -0.24, 0.12, 0, root);
  part(box(0.18, 0.16, 0.18), metal('#dfe4ea'), 0.24, 0.12, 0, root);
}

export function makePogoGear() {
  const root = new THREE.Group();
  part(cyl(0.04, 0.04, 1.9, 8), metal('#d0d4da'), 0, 0.35, 0, root);
  part(box(0.6, 0.06, 0.06), lambert('#222'), 0, 1.3, 0, root);
  part(box(0.5, 0.05, 0.14), lambert('#ffa502'), 0, -0.2, 0, root);
  for (let i = 0; i < 4; i++) part(torus(0.08, 0.02), metal('#888'), 0, -0.45 - i * 0.07, 0, root).rotation.x = Math.PI / 2;
  part(cyl(0.06, 0.08, 0.12, 8), lambert('#222'), 0, -0.78, 0, root);
  return root;
}

function wingShape(side) {
  const wing = new THREE.Group();
  const steel = metal('#c8ced6');
  for (let i = 0; i < 5; i++) {
    const f = part(box(0.9 - i * 0.12, 0.05, 0.16), steel, side * (0.45 - i * 0.04), -i * 0.11, i * 0.02, wing);
    f.rotation.z = side * (0.15 + i * 0.08);
  }
  return wing;
}

export function makeWingsGear() {
  const root = new THREE.Group();
  const l = wingShape(-1); l.position.x = -0.15; root.add(l);
  const r = wingShape(1); r.position.x = 0.15; root.add(r);
  part(box(0.36, 0.4, 0.12), metal('#7f8c8d'), 0, -0.1, 0, root); // harness plate
  return { root, l, r };
}

export function makeGliderGear() {
  const root = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.9);
  shape.lineTo(2.4, 0.7);
  shape.lineTo(-2.4, 0.7);
  shape.closePath();
  const sail = new THREE.Mesh(
    cached(geoCache, 'sail', () => new THREE.ShapeGeometry(shape)),
    lambert('#1e90ff', { side: THREE.DoubleSide }),
  );
  sail.rotation.x = -Math.PI / 2;
  sail.castShadow = true;
  root.add(sail);
  const stripe = new THREE.Mesh(
    cached(geoCache, 'sailStripe', () => new THREE.ShapeGeometry(new THREE.Shape([
      new THREE.Vector2(0, -0.9), new THREE.Vector2(0.35, 0.7), new THREE.Vector2(-0.35, 0.7)]))),
    lambert('#ffffff', { side: THREE.DoubleSide }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 0.01;
  root.add(stripe);
  part(cyl(0.025, 0.025, 1.1, 6), metal('#888'), 0, -0.55, 0, root);
  part(box(1.0, 0.04, 0.04), metal('#888'), 0, -1.1, 0, root);
  return root;
}

// Hoverboard-style skateboard; deck along z so the rider surfs forward.
export function makeSkateboard() {
  const root = new THREE.Group();
  part(box(0.62, 0.07, 1.5), lambert('#2ed573'), 0, 0.16, 0, root);
  part(box(0.5, 0.075, 1.2), lambert('#1e272e'), 0, 0.165, 0, root, false); // grip tape
  part(box(0.12, 0.08, 0.5), lambert('#ffd23f'), 0, 0.2, 0, root, false); // stripe
  for (const z of [-0.5, 0.5]) {
    part(box(0.5, 0.05, 0.08), metal('#aaa'), 0, 0.1, z, root);
    for (const x of [-0.24, 0.24]) {
      const w = part(cyl(0.07, 0.07, 0.07, 10), lambert('#ff6b81'), x, 0.07, z, root);
      w.rotation.z = Math.PI / 2;
    }
  }
  // Glow strip underneath so it reads as a power-up board.
  part(box(0.5, 0.02, 1.3), basic('#7bed9f'), 0, 0.11, 0, root, false);
  return root;
}

export function makePowerUp(type) {
  const root = new THREE.Group();
  const icon = new THREE.Group();
  root.add(icon);
  const bubble = new THREE.Mesh(sphere(0.7, 16), basic(POWER_COLORS[type], { transparent: true, opacity: 0.3, depthWrite: false }));
  root.add(bubble);
  if (type === 'magnet') magnetIcon(icon);
  if (type === 'pogo') { const p = makePogoGear(); p.scale.setScalar(0.42); p.position.y = -0.1; icon.add(p); }
  if (type === 'glider') { const g = makeGliderGear(); g.scale.setScalar(0.24); g.rotation.x = 1.0; g.position.y = 0.15; icon.add(g); }
  if (type === 'wings') { const w = makeWingsGear().root; w.scale.setScalar(0.5); w.position.y = 0.08; icon.add(w); }
  if (type === 'skateboard') { const b = makeSkateboard(); b.scale.setScalar(0.62); b.rotation.set(0.5, 0, 0.6); b.position.y = -0.1; icon.add(b); }
  return { root, icon };
}

// ---------------------------------------------------------------- buildings & street

function facadeTexture(base, windowLit, windowDark, cols, rows) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = Math.random() < 0.25 ? windowLit : windowDark;
        ctx.fillRect(c * cw + cw * 0.2, r * rh + rh * 0.25, cw * 0.6, rh * 0.55);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, h - rh * 0.6, w, rh * 0.6);
  });
}

let facadeMats = null;
export function facadeMaterials() {
  if (facadeMats) return facadeMats;
  const roof = lambert('#6b6f75');
  const specs = [
    ['#b5651d', '#ffe29a', '#3c4a5c', 4, 12],
    ['#8d99ae', '#fff3c4', '#2b3445', 5, 14],
    ['#c9b79c', '#ffe7a8', '#47515f', 4, 10],
    ['#5d6d7e', '#ffeaa7', '#1f2833', 6, 16],
    ['#a0522d', '#ffdf91', '#3a3a48', 3, 9],
    ['#d8d3c8', '#fff5cf', '#56606e', 5, 12],
  ];
  facadeMats = specs.map(([b, l, d, c, r]) => {
    const side = new THREE.MeshLambertMaterial({ map: facadeTexture(b, l, d, c, r) });
    return [side, side, roof, roof, side, side];
  });
  return facadeMats;
}

export function streetTexture(draw, repeatY) {
  const tex = canvasTexture(256, 256, draw);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeatY);
  return tex;
}

export function makeStreetLamp(side) {
  const root = new THREE.Group();
  const pole = lambert('#3d4450');
  part(cyl(0.08, 0.11, 5.2, 8), pole, 0, 2.6, 0, root);
  part(box(1.3, 0.08, 0.08), pole, -side * 0.6, 5.15, 0, root);
  part(box(0.45, 0.14, 0.3), lambert('#2d3436'), -side * 1.2, 5.08, 0, root);
  part(box(0.36, 0.04, 0.22), basic('#fff6d5'), -side * 1.2, 5.0, 0, root, false);
  return root;
}
