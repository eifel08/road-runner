// Procedural track generation: obstacle rows, cash lines, power-ups and rooftop sections.
import { LANES, POWERUP, ROOF_HEIGHT, SPAWN } from './config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
function pickWeighted(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, w] of Object.entries(weights)) {
    if ((r -= w) <= 0) return key;
  }
  return Object.keys(weights)[0];
}

const POWER_TYPES = { magnet: 3, shield: 2, pogo: 2, glider: 1.5, wings: 1.5 };
const NOTE_Y = 1.0;

export class Spawner {
  constructor(level) {
    this.level = level;
  }

  reset() {
    this.nextS = 45;
    this.nextRoof = rand(450, 700);
    this.nextPower = rand(120, 220);
    this.laneFreeAt = [0, 0, 0]; // lane is reserved (by car trains / moving cars) until this s
  }

  update(playerS, speed) {
    const horizon = playerS + SPAWN.ahead;
    while (this.nextS < horizon) {
      if (this.nextS >= this.nextRoof) {
        const end = this.buildRooftops(this.nextS);
        this.nextS = end + 25;
        this.nextRoof = end + rand(550, 900);
        this.laneFreeAt = [0, 0, 0];
        continue;
      }
      this.spawnRow(this.nextS, speed, playerS);
      this.nextS += 14 + speed * 0.45 + rand(0, 8);
    }
  }

  difficulty(s) {
    return Math.min(1, s / 3000);
  }

  // One row of obstacles across the lanes. At least one lane is always left clear.
  spawnRow(s, speed, playerS) {
    const diff = this.difficulty(s);
    // Lanes still reserved by a car train / moving car count as blocked, so put them first.
    const reserved = (lane) => (s < this.laneFreeAt[lane] ? 1 : 0);
    const lanes = shuffle([0, 1, 2]).sort((a, b) => reserved(b) - reserved(a));
    const blockedCount = Math.max(Math.random() < 0.35 + 0.35 * diff ? 2 : 1, reserved(lanes[0]) + reserved(lanes[1]));
    const placed = {};

    for (let i = 0; i < blockedCount; i++) {
      const lane = lanes[i];
      if (s < this.laneFreeAt[lane]) continue;
      const type = pickWeighted({
        cone: 3, sign: 2.5, bird: 1 + 2 * diff, moto: 1.5,
        car: 2.5, carTrain: 1, movingCar: 0.4 + 1.6 * diff,
      });
      placed[lane] = type;
      this.placeObstacle(type, s, lane, speed);
    }

    const freeLane = lanes[2];
    if (reserved(freeLane)) return;
    if (s >= this.nextPower) {
      this.level.addPowerUp(s, freeLane, pickWeighted(POWER_TYPES));
      this.nextPower = s + rand(250, 500);
      return;
    }
    this.placeCash(s, freeLane, placed);
  }

  placeObstacle(type, s, lane, speed) {
    const L = this.level;
    switch (type) {
      case 'cone': L.addCone(s, lane); break;
      case 'sign': L.addSign(s, lane); break;
      case 'bird': L.addBird(s, lane); break;
      case 'moto': L.addMotorcycle(s, lane); break;
      case 'car': L.addCar(s, lane); break;
      case 'carTrain': {
        const n = randInt(2, 3);
        for (let k = 0; k < n; k++) L.addCar(s + k * 4.6, lane);
        for (let k = 0; k < n * 3; k++) L.addCash(s - 1.5 + k * 1.5, LANES[lane], 1.57 + NOTE_Y);
        this.laneFreeAt[lane] = s + n * 4.6 + 4;
        break;
      }
      case 'movingCar': {
        // Place it so that, once triggered, it meets the player around row position s.
        const carSpeed = rand(7, 11);
        const startS = s + (carSpeed * SPAWN.carTrigger) / (speed + carSpeed);
        L.addCar(startS, lane, { moving: true, speed: carSpeed });
        this.laneFreeAt[lane] = startS + 6;
        break;
      }
    }
  }

  placeCash(s, freeLane, placed) {
    const L = this.level;
    // Sometimes reward the risky lane: arc over a cone / motorcycle, or a line on a car roof.
    const risky = Object.entries(placed).find(([, t]) => t === 'cone' || t === 'moto' || t === 'car');
    if (risky && Math.random() < 0.45) {
      const lane = Number(risky[0]);
      if (risky[1] === 'car') {
        for (let k = -1; k <= 1; k++) L.addCash(s + k * 1.4, LANES[lane], 1.57 + NOTE_Y);
      } else {
        for (let k = -3; k <= 3; k++) {
          const f = k / 3.6;
          L.addCash(s + k * 1.7, LANES[lane], NOTE_Y + 1.7 * (1 - f * f));
        }
      }
      return;
    }
    if (Math.random() < 0.75) {
      for (let k = -3; k <= 3; k++) L.addCash(s + k * 2, LANES[freeLane], NOTE_Y);
    }
  }

  // A run across building rooftops: a ramp up, several roofs separated by alleys, then a drop back down.
  buildRooftops(s0) {
    const L = this.level;
    const H = ROOF_HEIGHT;
    const rampLen = 16;
    L.addRamp(s0, s0 + rampLen, H);
    for (let k = 1; k < 7; k++) L.addCash(s0 + k * 2.2, LANES[1], (H * k * 2.2) / rampLen + NOTE_Y);

    let cur = s0 + rampLen;
    const count = randInt(3, 5);
    for (let i = 0; i < count; i++) {
      const len = rand(22, 36);
      L.addRooftop(cur, cur + len, H);

      // A row of rooftop obstacles in the middle of each roof.
      const mid = cur + len * 0.55;
      const lanes = shuffle([0, 1, 2]);
      const kind = ['cone', 'sign', 'bird'][randInt(0, 2)];
      if (kind === 'cone') L.addCone(mid, lanes[0], H);
      if (kind === 'sign') L.addSign(mid, lanes[0], H);
      if (kind === 'bird') L.addBird(mid + 6, lanes[0], H);
      if (Math.random() < 0.5) L.addCone(mid, lanes[1], H);
      for (let k = -3; k <= 3; k++) L.addCash(mid + k * 2, LANES[lanes[2]], H + NOTE_Y);

      cur += len;
      if (i < count - 1) {
        const gap = rand(4.5, 7);
        const lane = randInt(0, 2);
        for (let k = 0; k <= 4; k++) {
          const f = (k - 2) / 2.4;
          L.addCash(cur - 1 + (k * (gap + 2)) / 4, LANES[lane], H + NOTE_Y + 1.8 * (1 - f * f));
        }
        cur += gap;
      }
    }
    return cur;
  }

  // Cash trail in the sky while flying with wings or a glider.
  airTrail(type, playerS, speed) {
    const cfg = POWERUP[type];
    const start = playerS + 25;
    const end = playerS + speed * cfg.duration - 10;
    let lane = randInt(0, 2);
    let nextSwitch = start + rand(25, 45);
    for (let s = start; s < end; s += 3) {
      if (s > nextSwitch) {
        lane = Math.max(0, Math.min(2, lane + (Math.random() < 0.5 ? -1 : 1)));
        nextSwitch = s + rand(25, 45);
      }
      const t = (s - playerS) / speed;
      const y = type === 'wings'
        ? cfg.altitude + 0.6
        : cfg.startAltitude + (cfg.endAltitude - cfg.startAltitude) * Math.min(1, t / cfg.duration) + 0.6;
      this.level.addCash(s, LANES[lane], y);
    }
  }
}
