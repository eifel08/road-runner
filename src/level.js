// Everything that lives on the track: obstacles, platforms (vehicles, ramps, rooftops), structures and collectibles.
//
// Positions are kept in track space: `s` is distance along the run (meters), `x` is sideways.
// The player always renders at z = 0, so an entity renders at z = playerS - s.
import * as THREE from 'three';
import { LANES, SPAWN, ROAD_HALF_WIDTH, VEHICLE, TUNNEL_HEIGHT, speedAt } from './config.js';
import {
  box, facadeMaterials, lambert,
  makeBus, makeTruck, makeRamp, makePillar, makeWall, makeTunnelShell, makeDivider, makeLowBarrier,
  makeCone, makeConstructionSign, makeGate, makeBanknote, makePowerUp,
} from './models.js';

// Moving vehicles re-time themselves against the player's current speed until this close.
const SYNC_DISTANCE = 55;

export class Level {
  constructor(scene) {
    this.scene = scene;
    this.entities = [];
    this.playerS = 0;
    this.playerSpeed = 15;
  }

  clear() {
    for (const e of this.entities) this.scene.remove(e.mesh);
    this.entities = [];
  }

  setPlayer(s, speed) {
    this.playerS = s;
    this.playerSpeed = speed;
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

  // --- vehicles -------------------------------------------------------------
  // Stationary: `nearS` is the end facing the player.
  // Moving (`meet` given): drives toward the player so its front reaches meet.s
  // `meet.lead` seconds after the player does (0 = they meet exactly there).

  addBus(lane, nearS, meet = null) {
    const { width, length, top } = VEHICLE.bus;
    const model = makeBus(1);
    return this.addVehicle({ kind: 'bus', lane, w: width, d: length, top, model }, nearS, meet);
  }

  // Stationary trucks park facing away, so their back ramp faces the player and can be climbed.
  addTruck(lane, nearS, meet = null, withRamp = true) {
    const { width, length, top, rampLength } = VEHICLE.truck;
    const model = makeTruck(meet ? 1 : -1, length);
    if (!meet && withRamp) {
      this.addRamp(nearS, nearS + rampLength, top, LANES[lane], width);
      nearS += rampLength;
    }
    return this.addVehicle({ kind: 'truck', lane, w: width, d: length, top, model }, nearS, meet);
  }

  addVehicle({ kind, lane, w, d, top, model }, nearS, meet) {
    const e = {
      kind, lane, x: LANES[lane], w, d, mesh: model.root, wheels: model.wheels,
      platform: { top }, solid: 'caught',
    };
    if (meet) {
      e.moving = { speed: meet.speed ?? randRange(VEHICLE.movingSpeed), meetS: meet.s, lead: meet.lead ?? 0 };
      e.s = this.plannedS(e);
    } else {
      e.s = nearS + d / 2;
    }
    return this.add(e);
  }

  // Where a moving vehicle must be now so its front hits meetS `lead` seconds after the player.
  plannedS(e) {
    const { speed, meetS, lead } = e.moving;
    // Speed rises with distance, so use the average of now and at the meeting point.
    const avgSpeed = (this.playerSpeed + speedAt(meetS)) / 2;
    const tPlayer = (meetS - this.playerS) / avgSpeed;
    return meetS + e.d / 2 + speed * (tPlayer + lead);
  }

  // Track position past which a lane is no longer occupied by this entity (for spawn reservations).
  static farEnd(e) {
    return e.s + e.d / 2;
  }

  // --- platforms ---------------------------------------------------------
  // `solid` platforms kill on a head-on hit ('caught'); ramps are walked up, and running into
  // their solid underside ('ramp') is only a scrape.

  addRamp(s0, s1, height, x = 0, width = ROAD_HALF_WIDTH * 2) {
    const len = s1 - s0;
    const mesh = new THREE.Group();
    mesh.add(makeRamp(width, len, height));
    if (width > 4) {
      for (const sx of [-1, 1]) {
        for (let i = 1; i <= 3; i++) {
          const h = (height * i) / 4;
          const post = new THREE.Mesh(box(0.15, h, 0.15), lambert('#555'));
          post.position.set(sx * (width / 2 - 0.2), h / 2, len / 2 - (len * i) / 4);
          mesh.add(post);
        }
      }
    }
    return this.add({
      kind: 'ramp', s: s0 + len / 2, x, w: width, d: len, mesh,
      platform: { ramp: { s0, s1, height } }, solid: 'ramp', // filled underneath: hitting it is a scrape
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
      platform: { top: height }, solid: 'caught',
    });
  }

  // --- structures ------------------------------------------------------------

  // Overpass column standing in a lane: blocks it completely.
  addPillar(s, lane) {
    return this.add({ kind: 'pillar', s, lane, x: LANES[lane], w: 1.4, d: 1.4, y0: 0, y1: TUNNEL_HEIGHT, hazard: 'crash', mesh: makePillar(TUNNEL_HEIGHT) });
  }

  // Low barrier on a lane boundary (x = ±1.2). Blocks lane changes unless you jump over it.
  addDivider(s0, s1, x) {
    const len = s1 - s0;
    return this.add({ kind: 'divider', s: s0 + len / 2, x, w: 0.45, d: len, y0: 0, y1: 1.1, hazard: 'crash', mesh: makeDivider(len, 1.1) });
  }

  // Divider wall in the middle lane. Running into its end is a crash.
  addWall(s0, s1) {
    const len = s1 - s0;
    return this.add({ kind: 'wall', s: s0 + len / 2, x: 0, w: 2.0, d: len, y0: 0, y1: TUNNEL_HEIGHT, hazard: 'crash', mesh: makeWall(len, TUNNEL_HEIGHT) });
  }

  // Tunnel / overpass ceiling and outer walls (visual only).
  addTunnelShell(s0, s1) {
    const len = s1 - s0;
    return this.add({ kind: 'deco', s: s0 + len / 2, x: 0, w: 0, d: len, mesh: makeTunnelShell(len, TUNNEL_HEIGHT) });
  }

  // --- hazards -------------------------------------------------------------
  // y0..y1 is the vertical collision band above baseY.

  addCone(s, lane, baseY = 0) {
    // Cones don't stop you: running through one slows you down (and counts as a scrape).
    return this.add({ kind: 'cone', s, lane, x: LANES[lane], baseY, w: 0.7, d: 0.7, y0: 0, y1: 0.9, hazard: 'slow', mesh: makeCone().root });
  }

  addBarrier(s, lane, baseY = 0) {
    return this.add({ kind: 'barrier', s, lane, x: LANES[lane], baseY, w: 2.0, d: 0.3, y0: 0, y1: 0.95, hazard: 'crash', mesh: makeLowBarrier() });
  }

  addSign(s, lane, baseY = 0) {
    return this.add({ kind: 'sign', s, lane, x: LANES[lane], baseY, w: 2.1, d: 0.3, y0: 1.05, y1: 3.4, hazard: 'crash', mesh: makeConstructionSign().root });
  }

  // Roadwork gate: a beam at 1.3–1.9 m. Jump over it or roll under it.
  addGate(s, lane, baseY = 0) {
    return this.add({ kind: 'gate', s, lane, x: LANES[lane], baseY, w: 2.2, d: 0.3, y0: 1.3, y1: 1.9, hazard: 'crash', mesh: makeGate().root });
  }

  // --- collectibles -----------------------------------------------------------

  // `rider` makes the note travel on top of a moving vehicle.
  addCash(s, x, y, rider = null) {
    const e = this.add({ kind: 'cash', s, x, baseY: y, w: 0.9, d: 0.6, collect: 'cash', mesh: makeBanknote().root });
    if (rider) e.rider = { vehicle: rider, ds: s - rider.s };
    return e;
  }

  addPowerUp(s, lane, type, baseY = 0) {
    const model = makePowerUp(type);
    return this.add({ kind: 'power', s, lane, x: LANES[lane], baseY, yOff: 1.1, w: 1.2, d: 1.2, collect: type, mesh: model.root, rig: model });
  }

  // --- per-frame -----------------------------------------------------------

  update(dt) {
    const playerS = this.playerS;
    for (const e of this.entities) {
      e.prevS = e.s;
      e.t += dt;

      if (e.moving && !e.dead) {
        const far = e.s - e.d / 2 - playerS > SYNC_DISTANCE;
        // Never drift backward when the player slows down; just wait.
        e.s = far ? Math.min(e.s, this.plannedS(e)) : e.s - e.moving.speed * dt;
        for (const w of e.wheels) w.rotation.x -= dt * 10;
      }
      if (e.vel) e.s += e.vel * dt;

      if (e.kind === 'cash') e.mesh.rotation.y += dt * 3;
      if (e.kind === 'power') {
        e.rig.icon.rotation.y += dt * 2;
        e.mesh.position.y = e.baseY + e.yOff + Math.sin(e.t * 3) * 0.15;
      }
      if (e.knocked !== undefined) this.animateKnocked(e, dt);
      if (e.blasted !== undefined) this.animateBlasted(e, dt);
    }
    for (const e of this.entities) {
      if (e.rider && !e.magnet) e.s = e.rider.vehicle.s + e.rider.ds;
    }

    const keep = [];
    for (const e of this.entities) {
      const gone = e.collected || e.removeMe || e.s + e.d / 2 < playerS - SPAWN.behind;
      if (gone) this.scene.remove(e.mesh);
      else keep.push(e);
    }
    this.entities = keep;
  }

  // Obstacles the player smashes through tumble away instead of vanishing.
  knock(e, dir = 1) {
    e.dead = true;
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

  // Skateboard blast: every structure / obstacle within range disintegrates. Returns the blasted entities.
  blast(fromS, toS) {
    const hit = [];
    for (const e of this.entities) {
      if (e.collect || e.dead) continue;
      if (e.s + e.d / 2 < fromS || e.s - e.d / 2 > toS) continue;
      e.dead = true;
      e.blasted = 0;
      e.blastDelay = Math.max(0, (e.s - e.d / 2 - this.playerS) / 160); // ripple outward
      e.spin = new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
      hit.push(e);
    }
    return hit;
  }

  animateBlasted(e, dt) {
    e.blasted += dt;
    const t = e.blasted - e.blastDelay;
    if (t < 0) return;
    const f = Math.min(1, t / 0.45);
    e.mesh.scale.setScalar(Math.max(0.001, 1 - f * f));
    e.yOff += dt * 6;
    e.mesh.rotation.x += e.spin.x * dt;
    e.mesh.rotation.y += e.spin.y * dt;
    if (f >= 1) e.removeMe = true;
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
  // Ramps are judged by their height at the previous position, so steep ramps still work at
  // top speed, where one frame climbs more than stepUp.
  supportAt(x, s, maxY, stepUp, prevS = s) {
    let best = 0;
    for (const e of this.entities) {
      if (!e.platform || e.dead) continue;
      if (Math.abs(x - e.x) > e.w / 2 + 0.1) continue;
      if (Math.abs(s - e.s) > e.d / 2 + 0.3) continue;
      const top = Level.topAt(e, s);
      const reach = e.platform.ramp ? Level.topAt(e, prevS) : top;
      if (reach <= maxY + stepUp && top > best) best = top;
    }
    return best;
  }
}

function randRange([a, b]) {
  return a + Math.random() * (b - a);
}
