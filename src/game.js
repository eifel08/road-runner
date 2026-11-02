// Game state machine (menu -> playing -> caught -> menu), collision rules and scoring.
import * as THREE from 'three';
import { PLAYER, PURSUIT, SPEED, SCORE, POWERUP, speedAtTime } from './config.js';
import { poseDead } from './models.js';
import { Environment } from './environment.js';
import { Level } from './level.js';
import { Spawner } from './spawner.js';
import { Player } from './player.js';
import { Pursuer } from './pursuer.js';
import { Effects } from './effects.js';

const CAUGHT_DURATION = 2.6;
// Low obstacles you can come down on from above (a stumble instead of a crash).
const LANDABLE = new Set(['cone', 'barrier', 'sign', 'gate']);
const SKY = '#9fc6ee';

export class Game {
  constructor(renderer, input, ui) {
    this.renderer = renderer;
    this.input = input;
    this.ui = ui;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 70, 175);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.camera.position.set(0, 4.3, 7.6);

    this.scene.add(new THREE.HemisphereLight('#dcecff', '#5a5a66', 1.6));
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.2);
    this.sun.position.set(8, 20, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -20, near: 1, far: 60 });
    this.sun.target.position.set(0, 0, -8);
    this.scene.add(this.sun, this.sun.target);

    this.env = new Environment(this.scene);
    this.level = new Level(this.scene);
    this.spawner = new Spawner(this.level);
    this.player = new Player(this.scene);
    this.pursuer = new Pursuer(this.scene);
    this.effects = new Effects(this.scene);

    this.state = 'menu';
    this.s = 0;
    this.shake = 0;
    this.camLook = new THREE.Vector3(0, 1, -8);
    this.resize();
    ui.showMenu();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep all three lanes visible on narrow portrait screens.
    this.camera.fov = w / h < 0.8 ? 78 : 62;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.level.clear();
    this.effects.clear();
    this.env.reset();
    this.player.reset();
    this.pursuer.reset();
    this.s = 0;
    this.prevS = 0;
    this.time = 0;
    this.cash = 0;
    this.distScore = 0;
    this.baseSpeed = SPEED.start;
    this.level.setPlayer(0, SPEED.start);
    this.spawner.reset();
    this.input.consume();
    this.state = 'playing';
    this.ui.showGame();
  }

  get score() {
    return Math.floor(this.distScore) + this.cash * SCORE.perNote;
  }

  get speed() {
    let v = this.baseSpeed;
    if (this.player.slowT > 0) v *= 0.6;
    return v;
  }

  tick(dt) {
    if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'caught') this.updateCaught(dt);
    else this.player.idle(dt);
    this.effects.update(dt, this.state === 'playing' ? this.speed * dt : 0);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updatePlaying(dt) {
    const p = this.player;
    this.time += dt;
    this.baseSpeed = speedAtTime(this.time);
    for (const a of this.input.consume()) p.handle(a);

    this.prevS = this.s;
    this.s += this.speed * dt;
    // Distance score; the 2x multiplier doubles the rate while it's active.
    this.distScore += (this.s - this.prevS) * SCORE.perMeter * (p.power.multiplier > 0 ? POWERUP.multiplier.factor : 1);

    this.level.setPlayer(this.s, this.speed);
    this.spawner.update(this.s, this.speed);
    this.level.update(dt);
    p.update(dt, this.s, (x, s, maxY) => this.level.supportAt(x, s, maxY, PLAYER.stepUp, this.prevS));
    this.collide(dt);
    if (this.state !== 'playing') return;

    this.pursuer.update(dt, p, this.speed);
    this.env.update(this.s, dt);
    this.level.sync(this.s);
    p.animate(dt, this.speed);

    this.ui.setHud(this.score, this.cash, p.power);
    this.ui.setDanger(this.pursuer.close ? 0.55 : 0);
  }

  // ------------------------------------------------------------ collisions

  collide(dt) {
    const p = this.player;
    const pTop = p.y + p.height;
    const wings = p.power.wings > 0;

    for (const e of this.level.entities) {
      if (e.collected || e.hit || e.dead) continue;
      // Swept overlap along the track (covers both player and entity movement this frame).
      // Banknotes get a bigger hitbox while flying with the metal wings.
      const pad = wings && e.kind === 'cash' ? 0.6 : 0;
      const eMin = Math.min(e.s, e.prevS) - e.d / 2;
      const eMax = Math.max(e.s, e.prevS) + e.d / 2;
      if (this.s + PLAYER.halfDepth + pad < eMin || this.prevS - PLAYER.halfDepth - pad > eMax) continue;

      if (e.collect) {
        if (e.magnet) continue; // being pulled in by the magnet / pogo stick
        const y = e.baseY + e.yOff;
        const rx = e.w / 2 + (pad ? 0.95 : 0.35);
        const ry = pad ? 1.0 : 0.4;
        if (Math.abs(p.x - e.x) < rx && y > p.y - ry && y < pTop + ry) this.pickUp(e);
        continue;
      }
      if (p.flying) continue; // wings / glider fly safely over everything

      const reachX = e.w / 2 + PLAYER.halfWidth;
      if (Math.abs(p.x - e.x) >= reachX) continue;
      const wasBeside = Math.abs(p.prevX - e.x) >= reachX; // we slid into its side while changing lanes

      if (e.platform) {
        const top = Level.topAt(e, this.s);
        if (p.y >= top - PLAYER.stepUp || pTop <= e.baseY) continue;
        this.hitPlatform(e, top, wasBeside);
      } else if (e.hazard) {
        if (p.y >= e.baseY + e.y1 || pTop <= e.baseY + e.y0) continue;
        this.hitHazard(e, wasBeside, this.entryHeight(e));
      }
      if (this.state !== 'playing') return;
    }

    this.attract(dt);
  }

  // Crash rules: running into anything head-on is fatal (motorcycles only slow you down).
  // Sliding into the side of something while changing lanes is a scrape: you bounce back
  // and the killer gets close; a second scrape while he's close gets you caught.

  hitPlatform(e, top, wasBeside) {
    const p = this.player;
    if (p.invuln > 0) {
      // Just after a flight or a blast: never punish, pop up on top instead.
      if (wasBeside) p.bounceBack();
      else { p.y = top; p.vy = 0; }
      return;
    }
    if (this.skateAbsorb()) return;
    if (wasBeside) return this.scrape();
    if (e.solid === 'ramp') {
      // The space under a ramp is filled in: you bump into it and end up on the ramp, never under it.
      p.y = top;
      p.vy = 0;
      return this.scrape(false);
    }
    this.caught();
  }

  // Player height at the moment, within this frame, that their front crossed into the obstacle.
  // Tells landing on top of something apart from running into its face.
  entryHeight(e) {
    const p = this.player;
    const face = Math.min(e.s, e.prevS) - e.d / 2;
    const moved = this.s - this.prevS;
    const f = moved > 0 ? Math.min(1, Math.max(0, (face - (this.prevS + PLAYER.halfDepth)) / moved)) : 0;
    return p.prevY + (p.y - p.prevY) * f;
  }

  hitHazard(e, wasBeside, entryY) {
    const p = this.player;
    if (p.invuln > 0) return;
    if (this.skateAbsorb()) return;
    if (e.hazard === 'slow') {
      // Motorcycle: run right through it. It costs speed and counts as a scrape.
      e.hit = true;
      this.level.knock(e, Math.sign(e.x - p.x) || 1);
      p.slowT = PURSUIT.motorcycleSlow;
      if (this.pursuer.scrape()) this.caught();
      return;
    }
    if (LANDABLE.has(e.kind) && entryY >= e.baseY + e.y1 - 0.1) {
      // Came down on top of a low obstacle rather than running into it: a stumble, not a crash.
      e.hit = true;
      this.level.knock(e, Math.sign(e.x - p.x) || 1);
      p.vy = Math.max(p.vy, 5);
      return this.scrape(false);
    }
    if (wasBeside) return this.scrape();
    this.caught();
  }

  scrape(bounce = true) {
    const p = this.player;
    if (p.invuln > 0) return;
    if (bounce) p.bounceBack();
    p.stumbleT = 0.4;
    p.invuln = 0.35;
    this.shake = 0.2;
    if (this.pursuer.scrape()) this.caught();
  }

  // ------------------------------------------------------------ skateboard blast

  // Any hit while riding the skateboard is absorbed: the board breaks and everything around is destroyed.
  skateAbsorb() {
    if (this.player.power.skateboard <= 0) return false;
    this.skateBlast();
    return true;
  }

  skateBlast() {
    const p = this.player;
    p.power.skateboard = 0;
    p.invuln = 2;
    p.stumbleT = 0;
    this.shake = 0.6;
    this.ui.flash();

    const from = this.s - 15;
    const to = this.s + POWERUP.skateboard.blastRadius;
    for (const e of this.level.blast(from, to)) {
      const z = this.s - e.s;
      const size = Math.min(6, Math.max(1, (e.d + (e.platform?.top ?? 1)) / 4));
      this.effects.burst(e.x, e.baseY + 1, z, size, e.blastDelay);
    }
    for (const b of this.env.collapse(from, to, this.s)) {
      this.effects.burst(b.x - Math.sign(b.x) * 4, 2, b.z, b.size, b.delay);
    }
    this.effects.shockwave(p.x, p.y + 0.3, 0);
    // The shockwave knocks the killer back too.
    this.pursuer.closeT = 0;
  }

  // ------------------------------------------------------------ pickups

  pickUp(e) {
    e.collected = true;
    if (e.kind === 'cash') {
      this.cash++;
      return;
    }
    this.player.activate(e.collect);
    if (e.collect === 'wings') this.spawner.wingsRun(this.s);
    if (e.collect === 'glider') this.spawner.gliderRun(this.s);
  }

  // Banknotes flying to the player: the magnet grabs everything nearby, and the pogo stick
  // pulls up any notes directly underneath you while you're in the air.
  attract(dt) {
    const p = this.player;
    const magnet = p.power.magnet > 0;
    const pogo = p.power.pogo > 0 && !p.grounded;
    const target = new THREE.Vector3(p.x, p.y + 1, this.s);
    const pos = new THREE.Vector3();
    const step = (30 + this.speed) * dt;
    for (const e of this.level.entities) {
      if (e.kind !== 'cash' || e.collected) continue;
      if (!e.magnet) {
        const ds = e.s - this.s;
        const byMagnet = magnet && ds <= POWERUP.magnet.radius && ds >= -2;
        const byPogo = pogo && Math.abs(e.x - p.x) < 1.0 && Math.abs(ds) < 3 && e.baseY < p.y + 0.5;
        if (!byMagnet && !byPogo) continue;
        e.magnet = true;
      }
      pos.set(e.x, e.baseY, e.s);
      const dist = pos.distanceTo(target);
      if (dist < 0.8) { this.pickUp(e); continue; }
      pos.lerp(target, Math.min(1, step / dist));
      e.x = pos.x;
      e.baseY = pos.y;
      e.s = pos.z;
    }
  }

  // ------------------------------------------------------------ death

  caught() {
    if (this.skateAbsorb()) return; // the board saves you, even from the killer
    this.state = 'caught';
    this.caughtT = 0;
    this.stabbed = 0;
    this.pooled = false;
    this.finalScore = this.score;
    this.player.rig.root.visible = true;
    this.ui.setDanger(0.9);
  }

  updateCaught(dt) {
    this.caughtT += dt;
    const t = this.caughtT;
    const p = this.player;
    this.pursuer.catchAnimation(t, p);

    while (this.stabbed < Pursuer.STAB_TIMES.length && t >= Pursuer.STAB_TIMES[this.stabbed]) {
      this.stabbed++;
      this.shake = 0.3;
      this.effects.blood(p.x, p.y + 1.2, 0.2, 1 + this.stabbed);
      this.ui.bloodSplat(this.stabbed === 1 ? 5 : 9);
    }
    if (t > 1.1 && !this.pooled) {
      this.pooled = true;
      this.effects.bloodPool(p.x, p.y + 0.02, -0.6);
    }
    // Player freezes on the first stab, then collapses forward.
    if (t > 0.65) {
      const fall = Math.min(1, (t - 0.65) / 0.45);
      p.rig.root.rotation.x = -(Math.PI / 2) * fall * fall;
      poseDead(p.rig);
      p.rig.root.position.y = Math.max(0, p.y);
    } else {
      p.rig.body.rotation.set(0.15, 0, 0);
      p.rig.armL.rotation.set(1.6, 0, -0.3);
      p.rig.armR.rotation.set(1.6, 0, 0.3);
    }

    if (t >= CAUGHT_DURATION) {
      this.state = 'menu';
      this.ui.showMenu(this.finalScore);
    }
  }

  // ------------------------------------------------------------ camera

  updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const k = Math.min(1, dt * 5);
    let pos, look;
    if (this.state === 'caught') {
      // Swing around to the side to show the catch.
      const f = Math.min(1, this.caughtT / 0.8);
      pos = new THREE.Vector3(p.x + 4.5 * f, p.y + 3.2 - f, 6.5 - 2 * f);
      look = new THREE.Vector3(p.x, p.y + 1, 0);
    } else {
      pos = new THREE.Vector3(p.x * 0.7, 4.3 + p.y * 0.85, 7.6);
      look = new THREE.Vector3(p.x * 0.85, 0.8 + p.y * 0.85, -10);
    }
    cam.position.lerp(pos, k);
    this.camLook.lerp(look, k);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
    }
    cam.lookAt(this.camLook);

    this.sun.position.set(p.x + 8, p.y + 20, 6);
    this.sun.target.position.set(p.x, p.y, -8);
  }
}
