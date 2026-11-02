// Everything that lives on the track: obstacles, platforms (cars, ramps, rooftops) and collectibles.
//
// Positions are kept in track space: `s` is distance along the run (meters), `x` is sideways.
// The player always renders at z = 0, so an entity renders at z = playerS - s.
import * as THREE from 'three';
import { LANES, SPAWN, ROAD_HALF_WIDTH } from './config.js';
import {
  box, lambert, facadeMaterials,
  makeCar, makeMotorcycle, makeCone, makeConstructionSign, makeBird, makeBanknote, makePowerUp,
} from './models.js';

const CAR = { w: 1.9, d: 4.2, top: 1.57 };

export class Level {
  constructor(scene) {
    this.scene = scene;
    this.entities = [];
  }

  clear() {
    for (const e of this.entities) this.scene.remove(e.mesh);
    this.entities = [];
  }

  add(e) {
    e.prevS = e.s;
    e.baseY ??= 0;
    e.yOff ??= 0;
    e.t = Math.random() * 10;
    this.scene.add(e.mesh);
    this.entities.push(e);
    return e;
  }

  // --- platforms ---------------------------------------------------------
  // `solid` decides what a frontal hit does: 'caught' (cars) or 'climb' (building walls).

  addCar(s, lane, { moving = false, speed = 9 } = {}) {
    const model = makeCar(undefined, moving ? 1 : (Math.random() < 0.5 ? 1 : -1));
    return this.add({
      kind: 'car', s, lane, x: LANES[lane], w: CAR.w, d: CAR.d,
      mesh: model.root, wheels: model.wheels,
      platform: { top: CAR.top }, solid: 'caught',
      vel: moving ? -speed : 0, active: false, trigger: moving ? SPAWN.carTrigger : 0,
    });
  }

  addRamp(s0, s1, height) {
    const len = s1 - s0;
    const mesh = new THREE.Group();
    const slope = Math.atan2(height, len);
    const slab = new THREE.Mesh(box(ROAD_HALF_WIDTH * 2, 0.3, Math.hypot(len, height)), lambert('#b8862b'));
    slab.rotation.x = slope;
    slab.position.y = height / 2 - 0.15;
    slab.receiveShadow = true;
    mesh.add(slab);
    for (let i = 0; i < 9; i++) {
      // Hazard stripes across the ramp.
      const stripe = new THREE.Mesh(box(ROAD_HALF_WIDTH * 2 + 0.02, 0.31, 0.35), lambert(i % 2 ? '#222' : '#f1c40f'));
      const f = (i + 0.5) / 9;
      stripe.position.set(0, height * f - 0.15, len / 2 - len * f);
      stripe.rotation.x = slope;
      mesh.add(stripe);
    }
    for (const sx of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        const h = (height * i) / 4;
        const post = new THREE.Mesh(box(0.15, h, 0.15), lambert('#555'));
        post.position.set(sx * (ROAD_HALF_WIDTH - 0.2), h / 2, len / 2 - (len * i) / 4);
        mesh.add(post);
      }
    }
    return this.add({
      kind: 'ramp', s: s0 + len / 2, x: 0, w: ROAD_HALF_WIDTH * 2, d: len, mesh,
      platform: { ramp: { s0, s1, height } }, solid: null,
    });
  }

  addRooftop(s0, s1, height) {
    const len = s1 - s0;
    const mesh = new THREE.Group();
    const mats = facadeMaterials();
    const block = new THREE.Mesh(box(1, 1, 1), mats[Math.floor(Math.random() * mats.length)]);
    block.scale.set(ROAD_HALF_WIDTH * 2 + 0.2, height, len);
    block.position.y = height / 2;
    block.receiveShadow = true;
    mesh.add(block);
    const trim = lambert('#4d5359');
    for (const sx of [-1, 1]) {
      const parapet = new THREE.Mesh(box(0.25, 0.45, len), trim);
      parapet.position.set(sx * (ROAD_HALF_WIDTH - 0.05), height + 0.22, 0);
      mesh.add(parapet);
      // Rooftop clutter outside the lanes.
      for (let z = -len / 2 + 3; z < len / 2 - 2; z += 7) {
        const ac = new THREE.Mesh(box(0.9, 0.7, 1.2), lambert('#a4abb3'));
        ac.position.set(sx * 3.9, height + 0.35, z + Math.random() * 2);
        ac.castShadow = true;
        mesh.add(ac);
      }
    }
    return this.add({
      kind: 'roof', s: s0 + len / 2, x: 0, w: ROAD_HALF_WIDTH * 2, d: len, mesh,
      platform: { top: height }, solid: 'climb',
    });
  }

  // --- hazards -------------------------------------------------------------
  // y0..y1 is the vertical collision band above baseY.

  addCone(s, lane, baseY = 0) {
    return this.add({ kind: 'cone', s, lane, x: LANES[lane], baseY, w: 0.7, d: 0.7, y0: 0, y1: 0.9, hazard: 'stumble', mesh: makeCone().root });
  }

  addSign(s, lane, baseY = 0) {
    return this.add({ kind: 'sign', s, lane, x: LANES[lane], baseY, w: 2.1, d: 0.3, y0: 1.05, y1: 3.4, hazard: 'stumble', mesh: makeConstructionSign().root });
  }

  addBird(s, lane, baseY = 0) {
    const model = makeBird();
    return this.add({
      kind: 'bird', s, lane, x: LANES[lane], baseY, yOff: 1.6, w: 0.9, d: 0.6, y0: 1.3, y1: 1.95,
      hazard: 'stumble', mesh: model.root, rig: model, vel: -2.5, active: true,
    });
  }

  addMotorcycle(s, lane, baseY = 0) {
    const mesh = makeMotorcycle().root;
    mesh.rotation.y = (Math.random() - 0.5) * 0.3;
    return this.add({ kind: 'moto', s, lane, x: LANES[lane], baseY, w: 0.8, d: 1.7, y0: 0, y1: 1.1, hazard: 'slow', mesh });
  }

  // --- collectibles -----------------------------------------------------------

  addCash(s, x, y) {
    return this.add({ kind: 'cash', s, x, baseY: y, w: 0.9, d: 0.6, collect: 'cash', mesh: makeBanknote().root });
  }

  addPowerUp(s, lane, type, baseY = 0) {
    const model = makePowerUp(type);
    return this.add({ kind: 'power', s, lane, x: LANES[lane], baseY, yOff: 1.1, w: 1.2, d: 1.2, collect: type, mesh: model.root, rig: model });
  }

  // --- per-frame -----------------------------------------------------------

  update(dt, playerS) {
    const keep = [];
    for (const e of this.entities) {
      e.prevS = e.s;
      e.t += dt;

      if (e.trigger && !e.active && e.s - playerS < e.trigger) e.active = true;
      if (e.vel && e.active) e.s += e.vel * dt;
      if (e.wheels && e.active) for (const w of e.wheels) w.rotation.x -= dt * 12;

      if (e.kind === 'cash') e.mesh.rotation.y += dt * 3;
      if (e.kind === 'power') {
        e.rig.icon.rotation.y += dt * 2;
        e.mesh.position.y = e.baseY + e.yOff + Math.sin(e.t * 3) * 0.15;
      }
      if (e.kind === 'bird') {
        const flap = Math.sin(e.t * 14) * 0.7;
        e.rig.wingL.rotation.z = flap;
        e.rig.wingR.rotation.z = -flap;
        e.yOff = 1.6 + Math.sin(e.t * 3) * 0.08;
      }
      if (e.knocked !== undefined) this.animateKnocked(e, dt);

      const gone = e.collected || e.removeMe || e.s + e.d / 2 < playerS - SPAWN.behind;
      if (gone) this.scene.remove(e.mesh);
      else keep.push(e);
    }
    this.entities = keep;
  }

  // Obstacles the player smashes through tumble away instead of vanishing.
  knock(e, dir = 1) {
    e.knocked = 0;
    e.spin = new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
    e.fly = new THREE.Vector3(dir * (2 + Math.random() * 3), 7, -6);
  }

  animateKnocked(e, dt) {
    e.knocked += dt;
    e.fly.y -= 25 * dt;
    e.x += e.fly.x * dt;
    e.yOff += e.fly.y * dt;
    e.s -= e.fly.z * dt;
    e.mesh.rotation.x += e.spin.x * dt;
    e.mesh.rotation.z += e.spin.z * dt;
    if (e.knocked > 1.2) e.removeMe = true;
  }

  sync(playerS) {
    for (const e of this.entities) {
      if (e.kind === 'power') {
        e.mesh.position.x = e.x;
        e.mesh.position.z = playerS - e.s;
      } else {
        e.mesh.position.set(e.x, e.baseY + e.yOff, playerS - e.s);
      }
    }
  }

  // Height of a platform's walkable surface at track position s.
  static topAt(e, s) {
    const p = e.platform;
    if (p.ramp) {
      const f = THREE.MathUtils.clamp((s - p.ramp.s0) / (p.ramp.s1 - p.ramp.s0), 0, 1);
      return e.baseY + p.ramp.height * f;
    }
    return e.baseY + p.top;
  }

  // Highest walkable surface under (x, s) that is not above maxY + stepUp. 0 = the street.
  supportAt(x, s, maxY, stepUp) {
    let best = 0;
    for (const e of this.entities) {
      if (!e.platform || e.knocked !== undefined) continue;
      if (Math.abs(x - e.x) > e.w / 2 + 0.1) continue;
      if (Math.abs(s - e.s) > e.d / 2 + 0.3) continue;
      const top = Level.topAt(e, s);
      if (top <= maxY + stepUp && top > best) best = top;
    }
    return best;
  }
}
