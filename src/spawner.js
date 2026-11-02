// Procedural track generation: obstacle rows, set-piece patterns, big sections, cash and power-ups.
import { LANES, POWERUP, ROOF_HEIGHT, SPAWN, VEHICLE } from './config.js';
import { Level } from './level.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
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

const POWER_TYPES = { magnet: 3, skateboard: 2.5, pogo: 2, glider: 2, wings: 2 };
const SECTIONS = ['pillars', 'tunnel', 'rooftops'];
const NOTE_Y = 1.0;
const BUS = VEHICLE.bus;
const TRUCK = VEHICLE.truck;
const TRUCK_TOTAL = TRUCK.rampLength + TRUCK.length;

export class Spawner {
  constructor(level) {
    this.level = level;
  }

  reset() {
    this.nextS = 45;
    this.nextSection = rand(280, 420);
    this.sectionQueue = [];
    this.nextPower = rand(90, 160);
    this.laneFreeAt = [0, 0, 0]; // each lane is occupied (by a long / moving vehicle) until this s
  }

  update(playerS, speed) {
    const horizon = playerS + SPAWN.ahead;
    while (this.nextS < horizon) {
      const s = this.nextS;
      if (s >= this.nextSection) {
        if (!this.sectionQueue.length) this.sectionQueue = shuffle([...SECTIONS]);
        const start = this.clearPoint(s);
        const end = this[this.sectionQueue.pop()](start);
        this.nextS = end + 22;
        this.nextSection = end + rand(300, 480);
        continue;
      }
      const r = Math.random();
      const spacing = 14 + speed * 0.45 + rand(0, 8);
      if (r < 0.1) {
        this.nextS = this.rampWeave(this.clearPoint(s)) + spacing;
      } else if (r < 0.2) {
        this.nextS = this.riskLine(s) + spacing;
      } else {
        this.spawnRow(s);
        this.nextS = s + spacing;
      }
    }
  }

  // First s at which every lane is free.
  clearPoint(s) {
    return Math.max(s, ...this.laneFreeAt) + 6;
  }

  reserve(lane, until) {
    this.laneFreeAt[lane] = Math.max(this.laneFreeAt[lane], until);
  }

  difficulty(s) {
    return Math.min(1, s / 3000);
  }

  maybePowerUp(s, lane) {
    if (s < this.nextPower) return false;
    this.level.addPowerUp(s, lane, pickWeighted(POWER_TYPES));
    this.nextPower = s + rand(180, 320);
    return true;
  }

  // ------------------------------------------------------------ regular rows

  // One row of obstacles across the lanes. At least one lane is always left passable.
  spawnRow(s) {
    const diff = this.difficulty(s);
    // Lanes still occupied by a long / moving vehicle count as blocked, so put them first.
    const reserved = (lane) => (s < this.laneFreeAt[lane] ? 1 : 0);
    const lanes = shuffle([0, 1, 2]).sort((a, b) => reserved(b) - reserved(a));
    const blockedCount = Math.max(Math.random() < 0.35 + 0.35 * diff ? 2 : 1, reserved(lanes[0]) + reserved(lanes[1]));
    const placed = {};

    for (let i = 0; i < blockedCount; i++) {
      const lane = lanes[i];
      if (reserved(lane)) continue;
      const type = pickWeighted({
        cone: 3, sign: 2.5, bird: 1 + 2 * diff, moto: 1.5,
        bus: 1.5, truck: 2, movingBus: 0.6 + 1.6 * diff, movingTruck: 0.3 + 0.8 * diff,
      });
      placed[lane] = type;
      this.placeObstacle(type, s, lane);
    }

    const freeLane = lanes[2];
    if (reserved(freeLane)) return;
    if (this.maybePowerUp(s, freeLane)) return;
    this.placeCash(s, freeLane, placed);
  }

  placeObstacle(type, s, lane) {
    const L = this.level;
    switch (type) {
      case 'cone': L.addCone(s, lane); break;
      case 'sign': L.addSign(s, lane); break;
      case 'bird': L.addBird(s, lane); break;
      case 'moto': L.addMotorcycle(s, lane); break;
      case 'bus': {
        // Too tall to jump onto; the cash on the roof is a pogo-stick reward.
        const bus = L.addBus(lane, s);
        if (Math.random() < 0.5) for (let k = -2; k <= 2; k++) L.addCash(bus.s + k * 1.8, LANES[lane], BUS.top + NOTE_Y);
        this.reserve(lane, s + BUS.length + 4);
        break;
      }
      case 'truck': {
        L.addTruck(lane, s);
        this.truckCash(s, lane);
        this.reserve(lane, s + TRUCK_TOTAL + 4);
        break;
      }
      case 'movingBus':
      case 'movingTruck': {
        const meet = { s };
        const v = type === 'movingBus' ? L.addBus(lane, 0, meet) : L.addTruck(lane, 0, meet);
        this.reserve(lane, Level.farEnd(v) + 4);
        break;
      }
    }
  }

  // Notes up a truck ramp and along its deck.
  truckCash(s, lane) {
    for (let k = 1; k <= 2; k++) {
      const ds = k * 2.2;
      this.level.addCash(s + ds, LANES[lane], (TRUCK.top * ds) / TRUCK.rampLength + NOTE_Y);
    }
    for (let ds = TRUCK.rampLength + 1; ds < TRUCK_TOTAL - 1; ds += 2.2) this.level.addCash(s + ds, LANES[lane], TRUCK.top + NOTE_Y);
  }

  placeCash(s, freeLane, placed) {
    const L = this.level;
    // Sometimes reward the riskier lane: an arc over a cone / motorcycle.
    const risky = Object.entries(placed).find(([, t]) => t === 'cone' || t === 'moto');
    if (risky && Math.random() < 0.4) {
      const lane = Number(risky[0]);
      for (let k = -3; k <= 3; k++) {
        const f = k / 3.6;
        L.addCash(s + k * 1.7, LANES[lane], NOTE_Y + 1.7 * (1 - f * f));
      }
      return;
    }
    if (Math.random() < 0.75) {
      for (let k = -3; k <= 3; k++) L.addCash(s + k * 2, LANES[freeLane], NOTE_Y);
    }
  }

  // ------------------------------------------------------------ patterns

  // Ramp weave: a truck ramp on the right, one vehicle length later a truck ramp on the left,
  // and a moving bus with cash on its roof driving between them in the middle lane.
  rampWeave(s) {
    const L = this.level;
    const [first, second] = Math.random() < 0.5 ? [2, 0] : [0, 2];
    L.addTruck(first, s);
    this.truckCash(s, first);
    const s2 = s + TRUCK.length;
    L.addTruck(second, s2);
    this.truckCash(s2, second);

    const bus = L.addBus(1, 0, { s: s + TRUCK_TOTAL * 0.75 });
    for (let k = -2; k <= 2; k++) L.addCash(bus.s + k * 2, LANES[1], BUS.top + NOTE_Y, bus);
    this.reserve(1, Level.farEnd(bus) + 4);
    this.reserve(first, s + TRUCK_TOTAL + 4);
    this.reserve(second, s2 + TRUCK_TOTAL + 4);
    return s2 + TRUCK_TOTAL;
  }

  // Risk/reward line: a straight line of notes with a vehicle coming the other way that
  // reaches the furthest note a fraction of a second after the player grabs it.
  riskLine(s) {
    const L = this.level;
    const free = [0, 1, 2].filter((lane) => this.laneFreeAt[lane] <= s);
    if (!free.length) return s;
    const lane = pick(free);
    const len = rand(24, 36);
    for (let ds = 0; ds <= len; ds += 2) L.addCash(s + ds, LANES[lane], NOTE_Y);
    const meet = { s: s + len, lead: rand(0.15, 0.3) };
    const v = Math.random() < 0.7 ? L.addBus(lane, 0, meet) : L.addTruck(lane, 0, meet);
    this.reserve(lane, Level.farEnd(v) + 4);
    return s + len;
  }

  // ------------------------------------------------------------ sections

  // Overpass on pillars between the lanes. Buses come down the left or right lane, alternating,
  // never both sides in the same gap. Cash sits between the pillars on the safe side.
  pillars(s0) {
    const L = this.level;
    const segments = randInt(3, 5);
    const segLen = 32;
    const s1 = s0 + 20 + segments * segLen;
    L.addTunnelShell(s0, s1);
    for (let s = s0 + 2; s < s1; s += 12) {
      L.addPillar(s, -1.2);
      L.addPillar(s, 1.2);
    }
    let side = Math.random() < 0.5 ? 0 : 2;
    for (let k = 0; k < segments; k++) {
      const m = s0 + 26 + k * segLen;
      const bus = L.addBus(side, 0, { s: m });
      this.reserve(side, Level.farEnd(bus) + 4);
      const safe = 2 - side;
      for (let ds = -8; ds <= 8; ds += 2) L.addCash(m + ds, LANES[safe], NOTE_Y);
      // The middle lane is not always a free ride.
      if (Math.random() < 0.6) (Math.random() < 0.5 ? L.addSign(m - 4, 1) : L.addCone(m - 4, 1));
      side = safe;
    }
    return s1;
  }

  // Dual tunnels split by a centre wall. One side holds cash; a bus reaches that tunnel's
  // exit just after the player comes out of it.
  tunnel(s0) {
    const L = this.level;
    const len = rand(60, 85);
    const s1 = s0 + len;
    L.addWall(s0, s1);
    L.addTunnelShell(s0, s1);
    const cashLane = Math.random() < 0.5 ? 0 : 2;
    for (let s = s0 + 4; s < s1 - 2; s += 2.2) L.addCash(s, LANES[cashLane], NOTE_Y);
    if (Math.random() < 0.4) {
      for (let s = s0 + 10; s < s0 + 30; s += 2.2) L.addCash(s, LANES[2 - cashLane], NOTE_Y);
    }
    const bus = L.addBus(cashLane, 0, { s: s1 + 6, lead: 0.15 });
    this.reserve(cashLane, Level.farEnd(bus) + 4);
    return s1 + 10;
  }

  // A run across building rooftops: a ramp up, several roofs separated by alleys, then a drop back down.
  rooftops(s0) {
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
      const kind = pick(['cone', 'sign', 'bird']);
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

  // ------------------------------------------------------------ flight

  // High-altitude cash run while flying with metal wings or a glider. Follows the flight altitude.
  airTrail(type, playerS, speed) {
    const cfg = POWERUP[type];
    const start = playerS + 20;
    const end = playerS + speed * cfg.duration - 8;
    let lane = randInt(0, 2);
    let nextSwitch = start + rand(25, 40);
    for (let s = start; s < end; s += 2.6) {
      if (s > nextSwitch) {
        lane = Math.max(0, Math.min(2, lane + (Math.random() < 0.5 ? -1 : 1)));
        nextSwitch = s + rand(25, 40);
      }
      const t = (s - playerS) / speed;
      const y = type === 'wings'
        ? cfg.altitude + 0.8
        : cfg.startAltitude + (cfg.endAltitude - cfg.startAltitude) * Math.min(1, t / cfg.duration) + 0.8;
      this.level.addCash(s, LANES[lane], y);
    }
  }
}
