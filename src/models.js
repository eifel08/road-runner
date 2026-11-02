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

// Knocked down on the street after being caught (the body is rotated flat by the caller).
export function poseDead(rig) {
  rig.body.rotation.set(0, 0, 0);
  rig.body.position.set(0, 0, 0);
  rig.legL.rotation.x = 0.2;
  rig.legR.rotation.x = -0.3;
  rig.armL.rotation.set(2.6, 0, -0.5);
  rig.armR.rotation.set(1.2, 0, 0.6);
  rig.head.rotation.set(0, 0.6, 0);
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

const BUS_LIVERIES = [
  { body: '#c0392b', stripe: '#f5f5f5', skirt: '#7f1d1d' },
  { body: '#f1c40f', stripe: '#2c3e50', skirt: '#9a7d0a' },
  { body: '#2471a3', stripe: '#f5f5f5', skirt: '#154360' },
  { body: '#1e8449', stripe: '#f9e79f', skirt: '#0b5345' },
];

// Bus side: window row with pillars, two doors, livery stripe, an ad panel. 11 m x 3 m.
function busSideTexture(liv, route) {
  return canvasTexture(1024, 280, (ctx, w, h) => {
    ctx.fillStyle = liv.body;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = liv.skirt;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = liv.stripe;
    ctx.fillRect(0, h * 0.62, w, h * 0.06);
    // Windows with a reflection streak.
    const top = h * 0.14, wh = h * 0.36;
    for (let x = 20; x < w - 60; x += 92) {
      const g = ctx.createLinearGradient(x, top, x + 80, top + wh);
      g.addColorStop(0, '#5d7a91');
      g.addColorStop(0.45, '#1c2833');
      g.addColorStop(1, '#2e4053');
      ctx.fillStyle = g;
      ctx.fillRect(x, top, 80, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(x + 10, top); ctx.lineTo(x + 30, top); ctx.lineTo(x + 6, top + wh); ctx.lineTo(x, top + wh); ctx.closePath();
      ctx.fill();
    }
    // Doors (front and middle).
    for (const dx of [w * 0.06, w * 0.5]) {
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(dx, h * 0.12, 74, h * 0.76);
      ctx.fillStyle = '#4d6a80';
      ctx.fillRect(dx + 6, h * 0.16, 28, h * 0.6);
      ctx.fillRect(dx + 40, h * 0.16, 28, h * 0.6);
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(dx + 35, h * 0.12, 4, h * 0.76);
    }
    // Ad panel.
    ctx.fillStyle = '#fdfefe';
    ctx.fillRect(w * 0.62, h * 0.7, w * 0.3, h * 0.11);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 26px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('RUN FASTER. EAT PIZZA.', w * 0.63, h * 0.756);
    ctx.fillStyle = liv.stripe;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(route, w * 0.2, h * 0.73);
  });
}

// Bus front: big windshield, destination display, headlights, grille, bumper, plate.
function busFrontTexture(liv, route) {
  return canvasTexture(256, 340, (ctx, w, h) => {
    ctx.fillStyle = liv.body;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111';
    ctx.fillRect(16, 12, w - 32, 36);
    ctx.fillStyle = '#ffb142';
    ctx.font = 'bold 26px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(route, 26, 31);
    const g = ctx.createLinearGradient(0, 55, w, 200);
    g.addColorStop(0, '#6d8aa0');
    g.addColorStop(0.5, '#1b2631');
    g.addColorStop(1, '#34495e');
    ctx.fillStyle = g;
    ctx.fillRect(10, 56, w - 20, 150);
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(w / 2 - 2, 56, 4, 150);
    ctx.fillStyle = liv.stripe;
    ctx.fillRect(0, 214, w, 14);
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(60, 240, w - 120, 46); // grille
    ctx.fillStyle = '#555';
    for (let y = 246; y < 284; y += 8) ctx.fillRect(64, y, w - 128, 3);
    for (const x of [14, w - 54]) {
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(x, 244, 40, 26);
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(x, 274, 40, 10);
    }
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, h - 40, w, 40); // bumper
    ctx.fillStyle = '#f4f6f7';
    ctx.fillRect(w / 2 - 34, h - 32, 68, 22);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('RR 4471', w / 2 - 30, h - 20);
  });
}

function busBackTexture(liv) {
  return canvasTexture(256, 340, (ctx, w, h) => {
    ctx.fillStyle = liv.body;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b2631';
    ctx.fillRect(30, 40, w - 60, 90);
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(40, 170, w - 80, 80); // engine grille
    ctx.fillStyle = '#444';
    for (let y = 176; y < 246; y += 9) ctx.fillRect(46, y, w - 92, 4);
    for (const x of [12, w - 40]) {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x, 180, 28, 60);
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(x, 244, 28, 14);
    }
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, h - 40, w, 40);
  });
}

const ROUTES = ['42 DOWNTOWN', '7 HARBOR', '13 MIDTOWN', '88 AIRPORT'];

function busMaterials(facing) {
  const i = Math.floor(Math.random() * BUS_LIVERIES.length);
  return cached(matCache, `busMats${facing}${i}`, () => {
    const liv = BUS_LIVERIES[i];
    const route = ROUTES[i];
    const side = new THREE.MeshLambertMaterial({ map: busSideTexture(liv, route) });
    const sideTex = side.map.clone();
    sideTex.wrapS = THREE.RepeatWrapping;
    sideTex.repeat.x = -1; // mirrored copy, so the doors sit at the front on both sides
    const sideMirror = new THREE.MeshLambertMaterial({ map: sideTex });
    const front = new THREE.MeshLambertMaterial({ map: busFrontTexture(liv, route) });
    const back = new THREE.MeshLambertMaterial({ map: busBackTexture(liv) });
    const roof = lambert('#d5d8dc');
    // Box faces: +x, -x, +y, -y, +z, -z. The +x face's texture starts at +z, the -x face's at -z.
    return facing > 0
      ? [side, sideMirror, roof, roof, front, back]
      : [sideMirror, side, roof, roof, back, front];
  });
}

// City bus, 11 m long and 3.15 m tall. `facing` +1 = front toward the player (+z).
export function makeBus(facing = 1) {
  const root = new THREE.Group();
  const shell = new THREE.Mesh(box(2.3, 2.75, 11), busMaterials(facing));
  shell.position.y = 1.72;
  shell.castShadow = true;
  root.add(shell);
  // Rounded roof edge, roof AC pod, mirrors, wheel arches, wheels with hubcaps.
  part(box(2.2, 0.12, 10.8), lambert('#d5d8dc'), 0, 3.12, 0, root);
  part(box(1.5, 0.28, 2.6), lambert('#bdc3c7'), 0, 3.3, -1.5 * facing, root);
  part(box(1.2, 0.2, 1.2), lambert('#aab0b5'), 0, 3.25, 2.6 * facing, root);
  for (const sx of [-1, 1]) {
    const arm = part(box(0.35, 0.04, 0.04), lambert('#1b1b1b'), sx * 1.3, 2.45, 5.35 * facing, root, false);
    arm.rotation.y = sx * 0.3;
    part(box(0.08, 0.32, 0.18), lambert('#1b1b1b'), sx * 1.45, 2.3, 5.4 * facing, root);
  }
  const wheels = [];
  for (const sx of [-1.06, 1.06]) {
    for (const sz of [-3.7, 3.4]) {
      part(box(0.06, 0.62, 1.25), lambert('#1b1b1b'), sx * 1.03, 0.62, sz * facing, root, false); // arch
      const w = part(cyl(0.5, 0.5, 0.32, 18), lambert('#161616'), sx, 0.5, sz * facing, root);
      w.rotation.z = Math.PI / 2;
      const hub = part(cyl(0.26, 0.26, 0.34, 12), metal('#b2babb'), sx, 0.5, sz * facing, root);
      hub.rotation.z = Math.PI / 2;
      wheels.push(w, hub);
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

// Ramp rising toward -z: a sloped deck over a solid wedge, so nothing can get underneath it.
// One lane wide (truck ramps) or the whole road (rooftop ramps).
export function makeRamp(width, length, height, color = '#b8862b') {
  const root = new THREE.Group();
  const w = width / 2, l = length / 2;
  // Wedge: bottom rectangle, back face at the high end, sloped top, triangular sides.
  const v = [
    [-w, 0, l], [w, 0, l], [w, 0, -l], [-w, 0, -l], // bottom (near, near, far, far)
    [-w, height, -l], [w, height, -l], // top edge at the far end
  ];
  const tri = (a, b, c) => [...v[a], ...v[b], ...v[c]];
  const positions = [
    ...tri(0, 1, 5), ...tri(0, 5, 4), // slope
    ...tri(3, 4, 5), ...tri(3, 5, 2), // back
    ...tri(0, 3, 2), ...tri(0, 2, 1), // bottom
    ...tri(0, 4, 3), // left side
    ...tri(1, 2, 5), // right side
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const wedge = new THREE.Mesh(geo, lambert('#6b5a3c', { side: THREE.DoubleSide }));
  wedge.castShadow = true;
  wedge.receiveShadow = true;
  root.add(wedge);

  const slope = Math.atan2(height, length);
  const deck = part(box(width + 0.04, 0.08, Math.hypot(length, height)), lambert(color), 0, height / 2 + 0.03, 0, root);
  deck.rotation.x = slope;
  deck.receiveShadow = true;
  const stripes = Math.max(3, Math.round(length / 1.8));
  for (let i = 0; i < stripes; i++) {
    const f = (i + 0.5) / stripes;
    const st = part(box(width + 0.06, 0.09, 0.3), lambert(i % 2 ? '#222' : '#f1c40f'), 0, height * f + 0.04, l - length * f, root, false);
    st.rotation.x = slope;
  }
  return root;
}

// Concrete column holding up the overpass; stands in a lane and blocks it.
export function makePillar(height, width = 1.4) {
  const root = new THREE.Group();
  part(box(width, height, width), lambert('#8395a7'), 0, height / 2, 0, root);
  part(box(width + 0.2, 0.4, width + 0.2), lambert('#576574'), 0, 0.2, 0, root);
  part(box(width + 0.02, 0.6, width + 0.02), lambert('#f1c40f'), 0, 1.0, 0, root, false);
  part(box(width + 0.02, 0.2, width + 0.02), lambert('#222'), 0, 1.0, 0, root, false);
  return root;
}

// Low jersey barrier between two lanes. Low enough to jump over sideways.
export function makeDivider(length, height) {
  const root = new THREE.Group();
  part(box(0.45, height, length), lambert('#bdc3c7'), 0, height / 2, 0, root).receiveShadow = true;
  part(box(0.47, 0.12, length), lambert('#e74c3c'), 0, height - 0.2, 0, root, false);
  return root;
}

// Low road barrier across a lane: jump over it.
export function makeLowBarrier() {
  const root = new THREE.Group();
  const leg = lambert('#555b63');
  for (const x of [-0.9, 0.9]) {
    part(box(0.08, 0.9, 0.08), leg, x, 0.45, 0, root);
    part(box(0.5, 0.06, 0.4), leg, x, 0.03, 0, root);
  }
  const board = cached(matCache, 'barrierMat', () => new THREE.MeshLambertMaterial({ map: canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e74c3c';
    for (let i = -h; i < w; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i + 24, 0); ctx.lineTo(i + 24 + h, h); ctx.lineTo(i + h, h);
      ctx.fill();
    }
  }) }));
  part(box(2.0, 0.4, 0.1), board, 0, 0.7, 0, root);
  part(box(0.12, 0.12, 0.06), basic('#ffcc00'), -0.9, 0.98, 0, root, false);
  part(box(0.12, 0.12, 0.06), basic('#ffcc00'), 0.9, 0.98, 0, root, false);
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

// Roadwork gate: a striped beam at chest height between two posts.
// The gap under it and the space over it mean you can either jump it or roll under it.
export function makeGate() {
  const root = new THREE.Group();
  const post = lambert('#3d3d3d');
  for (const x of [-1.05, 1.05]) {
    part(box(0.1, 2.0, 0.1), post, x, 1.0, 0, root);
    part(box(0.45, 0.08, 0.45), lambert('#e67e22'), x, 0.04, 0, root);
  }
  const beamMat = cached(matCache, 'gateMat', () => new THREE.MeshLambertMaterial({ map: canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e67e22';
    for (let i = -h; i < w; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i + 24, 0); ctx.lineTo(i + 24 + h, h); ctx.lineTo(i + h, h);
      ctx.fill();
    }
  }) }));
  part(box(2.2, 0.55, 0.12), beamMat, 0, 1.62, 0, root);
  part(box(0.16, 0.16, 0.08), basic('#ffcc00'), -1.05, 2.05, 0, root, false);
  part(box(0.16, 0.16, 0.08), basic('#ffcc00'), 1.05, 2.05, 0, root, false);
  return { root };
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

export const POWER_COLORS = { magnet: '#ff4757', pogo: '#ffa502', glider: '#1e90ff', wings: '#dfe4ea', skateboard: '#2ed573', boots: '#9b59b6', multiplier: '#f1c40f' };

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

// Super Boots: glowing boots worn over the shoes.
export function makeBootGear() {
  const boot = () => {
    const g = new THREE.Group();
    part(box(0.15, 0.2, 0.31), lambert('#8e44ad'), 0, 0.06, -0.05, g);
    part(box(0.16, 0.05, 0.32), basic('#f1c40f'), 0, -0.04, -0.05, g, false);
    part(box(0.17, 0.06, 0.06), basic('#f1c40f'), 0, 0.16, 0.08, g, false);
    return g;
  };
  return { left: boot(), right: boot() };
}

const multiplierTexture = () => cached(matCache, 'multTex', () => canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2X', w / 2, h / 2 + 4);
}));

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
  if (type === 'boots') { const b = makeBootGear(); b.left.position.set(-0.12, -0.1, 0); b.right.position.set(0.12, -0.1, 0); icon.add(b.left, b.right); icon.scale.setScalar(1.6); }
  if (type === 'multiplier') {
    const disk = new THREE.Mesh(cyl(0.42, 0.42, 0.08, 24), [metal('#f1c40f'), new THREE.MeshBasicMaterial({ map: multiplierTexture() }), new THREE.MeshBasicMaterial({ map: multiplierTexture() })]);
    disk.rotation.x = Math.PI / 2;
    icon.add(disk);
  }
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
