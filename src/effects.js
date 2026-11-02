// Short-lived visual effects in render space: debris bursts and the skateboard shockwave.
// The world scrolls toward +z, so effects are shifted by the player's movement each frame.
import * as THREE from 'three';
import { box, lambert } from './models.js';

const DEBRIS_COLORS = ['#95a5a6', '#7f8c8d', '#f1c40f', '#e67e22', '#bdc3c7', '#d35400'];

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.waves = [];
    this.debrisGeo = box(1, 1, 1);
    this.debrisMats = DEBRIS_COLORS.map((c) => lambert(c));
    this.bloodMats = ['#7a0000', '#9b0000', '#5c0000'].map((c) => lambert(c));
    this.bloodGeo = new THREE.SphereGeometry(1, 6, 4);
  }

  clear() {
    for (const p of [...this.particles, ...this.waves]) this.scene.remove(p.mesh);
    this.particles = [];
    this.waves = [];
  }

  // Chunks flying out of a destroyed object. `size` scales chunk count and spread.
  burst(x, y, z, size = 1, delay = 0) {
    const count = Math.min(26, Math.round(6 + size * 4));
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.debrisGeo, this.debrisMats[i % this.debrisMats.length]);
      mesh.scale.setScalar(0.15 + Math.random() * 0.35 * Math.min(2, size));
      mesh.position.set(x + (Math.random() - 0.5) * size, y + Math.random() * size, z + (Math.random() - 0.5) * size * 2);
      mesh.visible = delay <= 0;
      this.scene.add(mesh);
      this.particles.push({
        mesh, delay,
        vel: new THREE.Vector3((Math.random() - 0.5) * 14, 6 + Math.random() * 12, (Math.random() - 0.5) * 10),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 1.1 + Math.random() * 0.5,
      });
    }
  }

  // Blood spray from a stab. Drops fall, splat and stay on the ground as stains.
  blood(x, y, z, amount = 1) {
    const count = 30 * amount;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.bloodGeo, this.bloodMats[i % this.bloodMats.length]);
      mesh.scale.setScalar(0.025 + Math.random() * 0.05);
      mesh.position.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh, delay: 0, blood: true,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 5, -1 - Math.random() * 4),
        spin: new THREE.Vector3(),
        life: 99,
      });
    }
  }

  // Dark pool spreading out under the body.
  bloodPool(x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshLambertMaterial({ color: '#5a0000', transparent: true, opacity: 0.92, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.015, z);
    mesh.scale.setScalar(0.05);
    this.scene.add(mesh);
    this.waves.push({ mesh, t: 0, pool: true });
  }

  shockwave(x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 48),
      new THREE.MeshBasicMaterial({ color: '#7bed9f', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.waves.push({ mesh, t: 0 });
  }

  updateBlood(p, dt, worldShift) {
    p.mesh.position.z += worldShift;
    if (p.landed) return true;
    p.vel.y -= 20 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.mesh.position.y <= 0.02) {
      // Splat: flatten into a stain on the street.
      p.landed = true;
      p.mesh.position.y = 0.02;
      const r = p.mesh.scale.x * (2 + Math.random() * 2);
      p.mesh.scale.set(r, 0.004, r * (1 + Math.random()));
    }
    return true;
  }

  update(dt, worldShift) {
    this.particles = this.particles.filter((p) => {
      if (p.delay > 0) {
        p.delay -= dt;
        p.mesh.position.z += worldShift;
        p.mesh.visible = p.delay <= 0;
        return true;
      }
      if (p.blood) return this.updateBlood(p, dt, worldShift);
      p.life -= dt;
      p.vel.y -= 30 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.z += worldShift;
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vel.multiplyScalar(0.5);
        p.vel.y = Math.abs(p.vel.y) * 0.3;
      }
      if (p.life <= 0) this.scene.remove(p.mesh);
      return p.life > 0;
    });
    this.waves = this.waves.filter((w) => {
      w.t += dt;
      if (w.pool) {
        w.mesh.scale.setScalar(Math.min(1.3, 0.05 + w.t * 0.9)); // keeps spreading, then stays
        w.mesh.position.z += worldShift;
        return true;
      }
      const f = w.t / 0.7;
      w.mesh.scale.setScalar(1 + f * 70);
      w.mesh.material.opacity = Math.max(0, 0.9 * (1 - f));
      if (f >= 1) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
      }
      return f < 1;
    });
  }
}
