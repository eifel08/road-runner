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

  update(dt, worldShift) {
    this.particles = this.particles.filter((p) => {
      if (p.delay > 0) {
        p.delay -= dt;
        p.mesh.position.z += worldShift;
        p.mesh.visible = p.delay <= 0;
        return true;
      }
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
