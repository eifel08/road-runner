// The runner: lane changes, jump / slide physics, power-up movement modes and animation.
import { LANES, PLAYER, POWERUP } from './config.js';
import {
  makeHuman, PLAYER_STYLE, makeWingsGear, makeGliderGear, makePogoGear, makeShieldGear,
  poseRun, poseJump, poseSlide, poseFly, poseHang, posePogo, poseIdle,
} from './models.js';

const COYOTE_TIME = 0.1;

export class Player {
  constructor(scene) {
    this.rig = makeHuman(PLAYER_STYLE);
    scene.add(this.rig.root);

    this.gear = {
      wings: makeWingsGear(),
      glider: makeGliderGear(),
      pogo: makePogoGear(),
      shield: makeShieldGear(),
    };
    this.gear.wings.root.position.set(0, 1.45, 0.2);
    this.rig.body.add(this.gear.wings.root);
    this.gear.glider.position.set(0, 2.9, 0);
    this.rig.root.add(this.gear.glider);
    this.gear.pogo.position.set(0, 0.75, -0.28);
    this.rig.root.add(this.gear.pogo);
    this.gear.shield.position.set(0, 1.25, 0.32); // strapped to the back, facing the camera
    this.rig.body.add(this.gear.shield);

    this.reset();
  }

  reset() {
    this.lane = 1;
    this.prevLane = 1;
    this.x = LANES[1];
    this.prevX = this.x;
    this.y = 0;
    this.prevY = 0;
    this.vy = 0;
    this.grounded = true;
    this.airTime = 0;
    this.slideT = 0;
    this.slideQueued = false;
    this.invuln = 0;
    this.stumbleT = 0;
    this.slowT = 0;
    this.power = { magnet: 0, pogo: 0, glider: 0, wings: 0, shield: 0 };
    this.phase = 0;
    this.t = 0;
    this.rig.root.rotation.set(0, 0, 0);
    this.updateGear();
  }

  get height() { return this.slideT > 0 ? PLAYER.slideHeight : PLAYER.height; }
  get flying() { return this.power.wings > 0 || this.power.glider > 0; }

  handle(action) {
    if (action === 'left' || action === 'right') {
      const next = Math.max(0, Math.min(2, this.lane + (action === 'left' ? -1 : 1)));
      if (next !== this.lane) {
        this.prevLane = this.lane;
        this.lane = next;
      }
      return;
    }
    if (this.flying || this.power.pogo > 0) return;
    if (action === 'jump' && (this.grounded || this.airTime < COYOTE_TIME)) {
      this.vy = PLAYER.jumpVelocity;
      this.grounded = false;
      this.airTime = COYOTE_TIME;
      this.slideT = 0;
    }
    if (action === 'slide') {
      if (this.grounded) {
        this.slideT = PLAYER.slideTime;
      } else {
        this.vy = Math.min(this.vy, PLAYER.fastDropVelocity);
        this.slideQueued = true;
      }
    }
  }

  // Bounce back to the lane we came from (after side-swiping something).
  bounceBack() {
    this.lane = this.prevLane;
    this.x = this.prevX;
  }

  activate(type) {
    const cfg = POWERUP[type];
    this.power[type] = cfg.duration;
    if (type === 'wings') this.power.glider = 0;
    if (type === 'glider') { this.power.wings = 0; this.vy = 0; }
    if (type === 'wings' || type === 'glider') this.slideT = 0;
  }

  // `support(x, s, maxY)` returns the walkable height under the player.
  update(dt, s, support) {
    this.t += dt;
    this.prevX = this.x;
    this.prevY = this.y;

    const wasFlying = this.flying;
    for (const k in this.power) this.power[k] = Math.max(0, this.power[k] - dt);
    if (wasFlying && !this.flying) {
      this.invuln = Math.max(this.invuln, 1.5);
      this.vy = 0;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.slideT = Math.max(0, this.slideT - dt);

    const targetX = LANES[this.lane];
    const dx = targetX - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), PLAYER.laneSpeed * dt);

    if (this.flying) {
      const target = this.power.wings > 0
        ? POWERUP.wings.altitude
        : POWERUP.glider.endAltitude + (POWERUP.glider.startAltitude - POWERUP.glider.endAltitude) * (this.power.glider / POWERUP.glider.duration);
      this.y += (target - this.y) * Math.min(1, dt * 3);
      this.vy = 0;
      this.grounded = false;
      this.y = Math.max(this.y, support(this.x, s, this.y));
    } else {
      this.vy -= PLAYER.gravity * dt;
      this.y += this.vy * dt;
      const ground = support(this.x, s, Math.max(this.prevY, this.y));
      if (this.y <= ground) {
        this.y = ground;
        if (this.power.pogo > 0) {
          this.vy = POWERUP.pogo.bounceVelocity;
          this.grounded = false;
        } else {
          this.vy = 0;
          this.grounded = true;
          this.airTime = 0;
          if (this.slideQueued) {
            this.slideT = PLAYER.slideTime;
            this.slideQueued = false;
          }
        }
      } else {
        this.grounded = false;
        this.airTime += dt;
      }
    }
  }

  updateGear() {
    this.gear.wings.root.visible = this.power.wings > 0;
    this.gear.glider.visible = this.power.glider > 0;
    this.gear.pogo.visible = this.power.pogo > 0 && !this.flying;
    this.gear.shield.visible = this.power.shield > 0;
  }

  animate(dt, speed) {
    this.phase += dt * speed * 0.62;
    const r = this.rig;
    r.root.position.set(this.x, this.y, 0);
    r.root.rotation.z = (LANES[this.lane] - this.x) * -0.06; // lean into lane changes

    if (this.power.wings > 0) {
      poseFly(r, this.t);
      const flap = Math.sin(this.t * 8) * 0.25;
      this.gear.wings.l.rotation.z = flap;
      this.gear.wings.r.rotation.z = -flap;
    } else if (this.power.glider > 0) poseHang(r, this.t);
    else if (this.power.pogo > 0) posePogo(r);
    else if (this.slideT > 0) poseSlide(r);
    else if (!this.grounded && this.airTime > 0.05) poseJump(r);
    else poseRun(r, this.phase);

    if (this.stumbleT > 0) r.body.rotation.z = Math.sin(this.stumbleT * 30) * 0.25;
    // Blink while invulnerable.
    r.root.visible = this.invuln <= 0 || this.flying || Math.floor(this.t * 12) % 2 === 0;
    this.updateGear();
  }

  idle(dt) {
    this.t += dt;
    this.rig.root.position.set(this.x, this.y, 0);
    this.rig.root.visible = true;
    poseIdle(this.rig, this.t);
    this.updateGear();
  }
}
