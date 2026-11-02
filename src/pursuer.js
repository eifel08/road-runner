// The killer chasing the player. `gap` (0..1) is how far behind he is; reaching 0 means caught.
import { PURSUIT } from './config.js';
import { makeHuman, KILLER_STYLE, poseRun } from './models.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export class Pursuer {
  constructor(scene) {
    this.rig = makeHuman(KILLER_STYLE);
    scene.add(this.rig.root);
    this.reset();
  }

  reset() {
    this.gap = PURSUIT.startGap;
    this.x = 0;
    this.y = 0;
    this.z = this.distance;
    this.phase = 0;
    this.rig.root.rotation.set(0, 0, 0);
    this.rig.root.visible = false;
  }

  get distance() {
    return lerp(PURSUIT.nearZ, PURSUIT.farZ, this.gap);
  }

  // Returns true when the hit closes the gap completely.
  loseGround(amount) {
    this.gap -= amount;
    return this.gap <= 0;
  }

  update(dt, player, speed) {
    this.gap = Math.min(1, this.gap + PURSUIT.regen * dt);
    // Chases slightly off to one side so the player stays visible.
    this.x = lerp(this.x, player.x + (player.x > 0 ? -0.8 : 0.8), Math.min(1, dt * 4));
    // He climbs after you onto cars and roofs, but stays on the ground while you fly.
    const targetY = player.flying ? 0 : player.y;
    this.y = lerp(this.y, targetY, Math.min(1, dt * 5));
    this.z = lerp(this.z, this.distance, Math.min(1, dt * 3));
    this.phase += dt * speed * 0.62;

    const r = this.rig;
    r.root.position.set(this.x, this.y, this.z);
    r.root.visible = this.z < PURSUIT.farZ - 1.5;
    poseRun(r, this.phase, 1.15);
    r.armR.rotation.x = 0.6 + Math.sin(this.phase) * 0.3; // knife arm forward, menacing
  }

  // Catch animation: lunge, raise the knife, two stabs. t is seconds since the catch.
  catchAnimation(t, player) {
    const r = this.rig;
    r.root.visible = true;
    const lungeT = Math.min(1, t / 0.35);
    this.x = lerp(this.x, player.x, lungeT);
    this.y = lerp(this.y, player.y, lungeT);
    this.z = lerp(this.z, 0.8, ease(lungeT));
    r.root.position.set(this.x, this.y, this.z);

    if (t < 0.35) {
      poseRun(r, (this.phase += 0.25), 1.2);
      return;
    }
    r.body.rotation.set(-0.15, 0, 0);
    r.body.position.set(0, 0, 0);
    r.legL.rotation.x = 0.4;
    r.legR.rotation.x = -0.3;
    r.armL.rotation.set(0.9, 0, 0.3);

    // Knife arm: raised overhead = 2.9 rad, striking forward-down = 1.1 rad.
    const RAISED = 2.9, STRIKE = 1.1;
    const k = t - 0.35;
    let a;
    if (k < 0.2) a = lerp(0.6, RAISED, ease(k / 0.2));
    else if (k < 0.3) a = lerp(RAISED, STRIKE, (k - 0.2) / 0.1);
    else if (k < 0.5) a = lerp(STRIKE, RAISED, ease((k - 0.3) / 0.2));
    else if (k < 0.6) a = lerp(RAISED, STRIKE, (k - 0.5) / 0.1);
    else a = STRIKE;
    r.armR.rotation.set(a, 0, 0);
  }

  // Seconds (since the catch) at which each stab lands, used for camera shake.
  static STAB_TIMES = [0.65, 0.95];
}
