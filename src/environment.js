// The endless city street: scrolling road, sidewalks and recycled buildings / lamps on both sides.
import * as THREE from 'three';
import { ROAD_HALF_WIDTH } from './config.js';
import { box, lambert, facadeMaterials, streetTexture, makeStreetLamp } from './models.js';

const STRIP_LENGTH = 420;
const STRIP_BACK = 40; // how far the strip extends behind the player
const SIDEWALK_WIDTH = 3.2;
const ROAD_TILE = 8;
const WALK_TILE = 3;
const LAMP_SPACING = 32;

const rand = (a, b) => a + Math.random() * (b - a);

export class Environment {
  constructor(scene) {
    this.scene = scene;

    this.roadTex = streetTexture((ctx, w, h) => {
      ctx.fillStyle = '#3a3d42';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // Lane dividers at x = ±1.2 m on a 9.6 m wide road.
      ctx.fillStyle = '#e8e8e8';
      for (const u of [0.375, 0.625]) ctx.fillRect(u * w - 3, 0, 6, h * 0.5);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(4, 0, 5, h);
      ctx.fillRect(w - 9, 0, 5, h);
    }, STRIP_LENGTH / ROAD_TILE);

    this.walkTex = streetTexture((ctx, w, h) => {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#7d7d7d';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
    }, STRIP_LENGTH / WALK_TILE);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, STRIP_LENGTH), new THREE.MeshLambertMaterial({ map: this.roadTex }));
    road.rotation.x = -Math.PI / 2;
    road.position.z = STRIP_BACK - STRIP_LENGTH / 2;
    road.receiveShadow = true;
    scene.add(road);

    const walkMat = new THREE.MeshLambertMaterial({ map: this.walkTex });
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK_WIDTH, 0.2, STRIP_LENGTH), walkMat);
      walk.position.set(side * (ROAD_HALF_WIDTH + SIDEWALK_WIDTH / 2), 0.1, STRIP_BACK - STRIP_LENGTH / 2);
      walk.receiveShadow = true;
      scene.add(walk);
      const curb = new THREE.Mesh(box(0.2, 0.24, STRIP_LENGTH), lambert('#c8c8c8'));
      curb.position.set(side * (ROAD_HALF_WIDTH + 0.1), 0.12, STRIP_BACK - STRIP_LENGTH / 2);
      scene.add(curb);
    }

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, STRIP_LENGTH), lambert('#3b3f45'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, STRIP_BACK - STRIP_LENGTH / 2);
    scene.add(ground);

    // Buildings: unit cubes scaled per building, recycled from behind the player to the far end.
    this.buildings = [];
    const unit = box(1, 1, 1);
    const mats = facadeMaterials();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const mesh = new THREE.Mesh(unit, mats[i % mats.length]);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        scene.add(mesh);
        this.buildings.push({ mesh, side, s: 0, len: 10 });
      }
    }

    this.lamps = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < Math.ceil(STRIP_LENGTH / LAMP_SPACING); i++) {
        const mesh = makeStreetLamp(side);
        mesh.position.x = side * (ROAD_HALF_WIDTH + 0.6);
        scene.add(mesh);
        this.lamps.push({ mesh, s: 0 });
      }
    }

    this.reset();
  }

  reset() {
    const front = { '-1': -STRIP_BACK, '1': -STRIP_BACK };
    for (const b of this.buildings) {
      this.placeBuilding(b, front[b.side]);
      front[b.side] = b.s + b.len + rand(0, 3);
    }
    this.lamps.forEach((l, i) => { l.s = -STRIP_BACK + (i % (this.lamps.length / 2)) * LAMP_SPACING; });
    this.update(0);
  }

  placeBuilding(b, s) {
    const len = rand(9, 20);
    const height = rand(9, 30);
    const depth = rand(8, 14);
    b.s = s;
    b.len = len;
    b.height = height;
    b.collapse = undefined;
    b.mesh.scale.set(depth, height, len);
    b.mesh.position.set(b.side * (ROAD_HALF_WIDTH + SIDEWALK_WIDTH + depth / 2), height / 2, 0);
    b.mesh.material = facadeMaterials()[Math.floor(Math.random() * facadeMaterials().length)];
  }

  // Skateboard blast: buildings along [fromS, toS] crumble into the ground.
  // Returns the render-space centers of the collapsing buildings (for debris).
  collapse(fromS, toS, playerS) {
    const hit = [];
    for (const b of this.buildings) {
      if (b.collapse !== undefined || b.s + b.len < fromS || b.s > toS) continue;
      b.collapse = -Math.max(0, b.s - playerS) / 160; // ripple outward with the shockwave
      hit.push({ x: b.mesh.position.x, z: playerS - (b.s + b.len / 2), size: b.len / 4, delay: -b.collapse });
    }
    return hit;
  }

  update(playerS, dt = 0) {
    // Scroll the road textures. Increasing the offset moves features toward the camera (+z).
    this.roadTex.offset.y = (playerS / ROAD_TILE) % 1;
    this.walkTex.offset.y = (playerS / WALK_TILE) % 1;

    for (const side of [-1, 1]) {
      const row = this.buildings.filter((b) => b.side === side);
      let front = Math.max(...row.map((b) => b.s + b.len));
      for (const b of row) {
        if (b.s + b.len < playerS - STRIP_BACK) {
          this.placeBuilding(b, front + rand(0, 3));
          front = b.s + b.len;
        }
      }
    }
    for (const b of this.buildings) {
      b.mesh.position.z = playerS - (b.s + b.len / 2);
      if (b.collapse !== undefined && b.collapse < 1) {
        b.collapse = Math.min(1, b.collapse + dt / 0.8);
        const f = Math.max(0, b.collapse);
        const h = Math.max(0.3, b.height * (1 - f * f));
        b.mesh.scale.y = h;
        b.mesh.position.y = h / 2;
      }
    }

    const lampSpan = (this.lamps.length / 2) * LAMP_SPACING;
    for (const l of this.lamps) {
      if (l.s < playerS - STRIP_BACK) l.s += lampSpan;
      l.mesh.position.z = playerS - l.s;
    }
  }
}
