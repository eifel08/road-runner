// The runner: lane changes, jump / slide physics, power-up movement modes and animation.
import { LANES, PLAYER, POWERUP } from './config.js';
import {
  makeHuman, PLAYER_STYLE, makeWingsGear, makeGliderGear, makePogoGear, makeSkateboard,
  poseRun, poseJump, poseSlide, poseFly, poseHang, posePogo, poseSkate, poseIdle,
} from './models.js';

const COYOTE_TIME = 0.1;
const BOARD_HEIGHT = 0.22; // the skateboard lifts the rider this much

export class Player {
  constructor(scene) {
    this.rig = makeHuman(PLAYER_STYLE);
    scene.add(this.rig.root);

    this.gear = {
      wings: makeWingsGear(),
      glider: makeGliderGear(),
      pogo: makePogoGear(),
      skateboard: makeSkateboard(),
    };
    this.gear.wings.root.position.set(0, 1.45, 0.2);
    this.rig.body.add(this.gear.wings.root);
    this.gear.glider.position.set(0, 2.9, 0);
    this.rig.root.add(this.gear.glider);
    this.rig.root.add(this.gear.pogo);
    this.gear.skateboard.position.y = -BOARD_HEIGHT;
    this.rig.root.add(this.gear.skateboard);

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
    this.pogoJump = false;
    this.slideT = 0;
    this.slideQueued = false;
    this.invuln = 0;
    this.stumbleT = 0;
    this.slowT = 0;
    this.power = { magnet: 0, pogo: 0, glider: 0, wings: 0, skateboard: 0 };
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
    if (this.flying) {
      // Swipe down cancels the glider / wings and drops you straight back to the street.
      if (action === 'slide') {
        this.power.wings = 0;
        this.power.glider = 0;
        this.vy = PLAYER.fastDropVelocity;
        this.invuln = Math.max(this.invuln, 2);
      }
      return;
    }
    if (action === 'jump' && (this.grounded || this.airTime < COYOTE_TIME)) {
      // The pogo stick only acts when you jump: a much higher jump, over signs and onto buses / roofs.
      this.pogoJump = this.power.pogo > 0;
      this.vy = this.pogoJump ? POWERUP.pogo.jumpVelocity : PLAYER.jumpVelocity;
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
    this.power[type] = POWERUP[type].duration;
    if (type === 'wings') this.power.glider = 0;
    if (type === 'glider') this.power.wings = 0;
    if (type === 'wings' || type === 'glider') {
      this.slideT = 0;
      this.slideQueued = false;
      this.pogoJump = false;
      this.vy = 0;
    }
  }

  // `support(x, s, maxY)` returns the walkable height under the player.
  update(dt, s, support) {
    this.t += dt;
    this.prevX = this.x;
    this.prevY = this.y;

    const wasFlying = this.flying;
    for (const k in this.power) this.power[k] = Math.max(0, this.power[k] - dt);
    if (wasFlying && !this.flying) {
      // Safe landing: a moment of invulnerability while dropping back into traffic.
      this.invuln = Math.max(this.invuln, 2);
      this.vy = Math.min(this.vy, 0);
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.slideT = Math.max(0, this.slideT - dt);

    const targetX = LANES[this.lane];
    const dx = targetX - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), PLAYER.laneSpeed * dt);

    if (this.flying) {
      this.y += (this.flightAltitude() - this.y) * Math.min(1, dt * 2.5);
      this.vy = 0;
      this.grounded = false;
      this.airTime = 1;
      this.y = Math.max(this.y, support(this.x, s, this.y));
      return;
    }

    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    const ground = support(this.x, s, Math.max(this.prevY, this.y));
    if (this.y <= ground) {
      this.y = ground;
      this.vy = 0;
      this.grounded = true;
      this.airTime = 0;
      this.pogoJump = false;
      if (this.slideQueued) {
        this.slideT = PLAYER.slideTime;
        this.slideQueued = false;
      }
    } else {
      this.grounded = false;
      this.airTime += dt;
    }
  }

  // Wings hold a steady altitude; the glider lifts you up, then glides down in its last second.
  flightAltitude() {
    if (this.power.wings > 0) return POWERUP.wings.altitude;
    return this.power.glider > POWERUP.glider.descent ? POWERUP.glider.altitude : 1.5;
  }

  updateGear() {
    const pogo = this.gear.pogo;
    this.gear.wings.root.visible = this.power.wings > 0;
    this.gear.glider.visible = this.power.glider > 0;
    pogo.visible = this.power.pogo > 0 && !this.flying;
    // Carried on the back while running, under the feet during a pogo jump.
    if (this.pogoJump) {
      pogo.position.set(0, 0.75, -0.28);
      pogo.rotation.set(0, 0, 0);
    } else {
      pogo.position.set(0.25, 1.2, 0.3);
      pogo.rotation.set(0.25, 0, -0.5);
    }
    this.gear.skateboard.visible = this.power.skateboard > 0 && !this.flying;
  }

  animate(dt, speed) {
    this.phase += dt * speed * 0.62;
    const r = this.rig;
    const onBoard = this.power.skateboard > 0 && !this.flying;
    r.root.position.set(this.x, this.y + (onBoard ? BOARD_HEIGHT : 0), 0);
    r.root.rotation.z = (LANES[this.lane] - this.x) * -0.06; // lean into lane changes

    if (this.power.wings > 0) {
      poseFly(r, this.t);
      const flap = Math.sin(this.t * 8) * 0.25;
      this.gear.wings.l.rotation.z = flap;
      this.gear.wings.r.rotation.z = -flap;
    } else if (this.power.glider > 0) poseHang(r, this.t);
    else if (this.slideT > 0) poseSlide(r);
    else if (this.pogoJump) posePogo(r);
    else if (onBoard) poseSkate(r, this.t);
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
