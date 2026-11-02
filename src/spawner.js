// Procedural track generation: dense obstacle rows, classic Subway Surfers style set pieces,
// big sections (pillar overpass, dual tunnels, rooftops), cash and power-ups, and sky coin runs.
//
// Speed is a function of distance (speedAt), so every pattern is sized for the speed the
// player will actually have when they reach it.
import { LANES, PLAYER, POWERUP, ROOF_HEIGHT, SPAWN, VEHICLE, speedAt, difficultyAt } from './config.js';
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
// Next lane on a shifting open path: always moves one lane over.
const shiftLane = (l) => (l === 1 ? pick([0, 2]) : 1);

const POWER_TYPES = { magnet: 3, skateboard: 2.5, pogo: 2, glider: 2, wings: 2, boots: 2, multiplier: 2 };
// Pattern weights at full difficulty; early on, plain rows dominate (see pickPattern).
const PATTERNS = { vehicleChain: 1.2, riskLine: 1, busTrain: 0.9, stagger: 1, jumpRoll: 0.9 };
const SECTIONS = ['pillars', 'tunnel', 'rooftops'];
const NOTE_Y = 1.0;
const NOTE_STEP = 2.2;
const BUS = VEHICLE.bus;
const TRUCK = VEHICLE.truck;
const TRUCK_TOTAL = TRUCK.rampLength + TRUCK.length;
const JUMP_AIRTIME = (2 * PLAYER.jumpVelocity) / PLAYER.gravity;

export class Spawner {
  constructor(level) {
    this.level = level;
  }

  reset() {
    this.nextS = 40;
    this.nextSection = rand(380, 480);
    this.sectionQueue = [];
    this.nextPower = rand(80, 140);
    this.laneFreeAt = [0, 0, 0]; // each lane is occupied (by a long / moving vehicle) until this s
  }

  // Gap between consecutive rows / patterns. Roomy at the start of a run, tightening as
  // difficulty grows, but always leaving enough time to react at the current speed.
  gap(v, s) {
    return (7 + v * 0.32 + rand(0, 4)) * (1.7 - 0.7 * difficultyAt(s));
  }

  // Early on almost everything is a plain row; set pieces become common as difficulty grows.
  pickPattern(s) {
    const d = difficultyAt(s);
    if (s < 200) return 'row';
    return pickWeighted({ row: 4 * (1.6 - d), ...Object.fromEntries(Object.entries(PATTERNS).map(([k, w]) => [k, w * (0.25 + 0.75 * d)])) });
  }

  update(playerS) {
    const horizon = playerS + SPAWN.ahead;
    while (this.nextS < horizon) {
      const s = this.nextS;
      const v = speedAt(s);
      // Sections need every lane free; until then keep the road busy with rows instead of skipping ahead.
      if (s >= this.nextSection && Math.max(...this.laneFreeAt) <= s + 4) {
        if (!this.sectionQueue.length) this.sectionQueue = shuffle([...SECTIONS]);
        const end = this[this.sectionQueue.pop()](this.clearPoint(s), v);
        this.nextS = end + this.gap(v, s);
        this.nextSection = end + rand(150, 260);
        continue;
      }
      let type = this.pickPattern(s);
      // Full-width patterns wait for free lanes; rather than leave the road empty, do a row instead.
      if (type !== 'row' && type !== 'riskLine' && Math.max(...this.laneFreeAt) > s + 4) type = 'row';
      if (type === 'row') {
        this.spawnRow(s, v);
        this.nextS = s + this.gap(v, s);
      } else {
        const end = this[type](type === 'riskLine' ? s : Math.max(s, ...this.laneFreeAt), v);
        this.nextS = end + this.gap(v, s);
      }
    }
  }

  // First s at which every lane is free.
  clearPoint(s) {
    return Math.max(s, ...this.laneFreeAt) + 4;
  }

  reserve(lane, until) {
    this.laneFreeAt[lane] = Math.max(this.laneFreeAt[lane], until);
  }

  difficulty(s) {
    return difficultyAt(s);
  }

  maybePowerUp(s, lane) {
    if (s < this.nextPower) return false;
    this.level.addPowerUp(s, lane, pickWeighted(POWER_TYPES));
    this.nextPower = s + rand(170, 300);
    return true;
  }

  cashLine(s0, s1, lane, y = NOTE_Y, rider = null) {
    for (let s = s0; s <= s1; s += NOTE_STEP) this.level.addCash(s, LANES[lane], y, rider);
  }

  movingVehicle(lane, meet, type = Math.random() < 0.75 ? 'bus' : 'truck') {
    const v = type === 'bus' ? this.level.addBus(lane, 0, meet) : this.level.addTruck(lane, 0, meet);
    this.reserve(lane, Level.farEnd(v) + 4);
    return v;
  }

  // ------------------------------------------------------------ regular rows

  // One row of obstacles across the lanes. At least one lane is always left passable.
  spawnRow(s, v) {
    const diff = this.difficulty(s);
    // Lanes still occupied by a long / moving vehicle count as blocked, so put them first.
    const reserved = (lane) => (s < this.laneFreeAt[lane] ? 1 : 0);
    const lanes = shuffle([0, 1, 2]).sort((a, b) => reserved(b) - reserved(a));
    const blockedCount = Math.max(Math.random() < 0.15 + 0.6 * diff ? 2 : 1, reserved(lanes[0]) + reserved(lanes[1]));
    const placed = {};

    for (let i = 0; i < blockedCount; i++) {
      const lane = lanes[i];
      if (reserved(lane)) continue;
      const type = pickWeighted({
        cone: 2, barrier: 2, sign: 2.5, gate: 1 + 1.5 * diff, moto: 1.2,
        bus: 1.6, truck: 1.8, movingBus: 0.4 + 2 * diff, movingTruck: 0.1 + 0.8 * diff,
      });
      placed[lane] = type;
      this.placeObstacle(type, s, lane);
    }

    const freeLane = lanes[2];
    if (reserved(freeLane)) return;
    // Two lanes taken by long / moving vehicles: keep the open lane lively with something to jump or roll under.
    if (reserved(lanes[0]) && reserved(lanes[1]) && Math.random() < 0.6) {
      this.placeObstacle(pick(['cone', 'barrier', 'sign', 'gate']), s, freeLane);
      return;
    }
    if (this.maybePowerUp(s, freeLane)) return;
    this.placeCash(s, freeLane, placed);
  }

  placeObstacle(type, s, lane) {
    const L = this.level;
    switch (type) {
      case 'cone': L.addCone(s, lane); break;
      case 'barrier': L.addBarrier(s, lane); break;
      case 'sign': L.addSign(s, lane); break;
      case 'gate': L.addGate(s, lane); break;
      case 'moto': L.addMotorcycle(s, lane); break;
      case 'bus': {
        // Too tall to jump onto; the cash on the roof is a pogo-stick reward.
        const bus = L.addBus(lane, s);
        if (Math.random() < 0.5) for (let k = -2; k <= 2; k++) L.addCash(bus.s + k * 1.8, LANES[lane], BUS.top + NOTE_Y);
        this.reserve(lane, s + BUS.length + 4);
        break;
      }
      case 'truck':
        L.addTruck(lane, s);
        this.truckCash(s, lane);
        this.reserve(lane, s + TRUCK_TOTAL + 4);
        break;
      case 'movingBus': this.movingVehicle(lane, { s }, 'bus'); break;
      case 'movingTruck': this.movingVehicle(lane, { s }, 'truck'); break;
    }
  }

  // Notes up a truck ramp and along its deck.
  truckCash(s, lane) {
    for (let k = 1; k <= 2; k++) {
      const ds = k * NOTE_STEP;
      this.level.addCash(s + ds, LANES[lane], (TRUCK.top * ds) / TRUCK.rampLength + NOTE_Y);
    }
    this.cashLine(s + TRUCK.rampLength + 1, s + TRUCK_TOTAL - 1, lane, TRUCK.top + NOTE_Y);
  }

  placeCash(s, freeLane, placed) {
    const L = this.level;
    // Sometimes reward the riskier lane: an arc over a cone / barrier / motorcycle.
    const risky = Object.entries(placed).find(([, t]) => t === 'cone' || t === 'barrier' || t === 'moto');
    if (risky && Math.random() < 0.4) {
      const lane = Number(risky[0]);
      for (let k = -3; k <= 3; k++) {
        const f = k / 3.6;
        L.addCash(s + k * 1.7, LANES[lane], NOTE_Y + 1.7 * (1 - f * f));
      }
      return;
    }
    if (Math.random() < 0.9) this.cashLine(s - 6, s + 6, freeLane);
  }

  // ------------------------------------------------------------ patterns

  // Vehicle chain: a truck ramp up, then a run of parked car carriers in two adjacent lanes that you
  // cross by hopping sideways (where two roofs overlap; jump + switch) or jumping forward (over
  // short gaps). Moving buses drive along the third lane underneath the chain.
  vehicleChain(s, v) {
    const L = this.level;
    const pair = pick([[0, 1], [1, 2]]);
    const third = pair[0] === 0 ? 2 : 0;
    const other = (l) => (l === pair[0] ? pair[1] : pair[0]);
    let lane = pick(pair);

    L.addTruck(lane, s);
    this.truckCash(s, lane);
    let start = s + TRUCK.rampLength;
    let end = start + TRUCK.length;
    const laneEnd = { [lane]: end, [other(lane)]: s };
    const chain = [[lane, start, end]];

    const links = randInt(4, 6);
    const overlap = Math.min(7, Math.max(5, v * 0.22));
    for (let i = 0; i < links; i++) {
      let nextLane, nextStart;
      if (Math.random() < 0.6) {
        nextLane = other(lane); // hop sideways onto the neighbouring roof
        nextStart = Math.max(end - overlap, laneEnd[nextLane] + 2);
        // Cash shows the hop: switch lanes inside the overlap.
        this.cashLine(nextStart + 1, end - 0.5, nextLane, TRUCK.top + NOTE_Y);
      } else {
        nextLane = lane; // jump the gap to the next roof
        nextStart = end + rand(3, 4.5);
        for (let k = 0; k <= 2; k++) L.addCash(end + ((nextStart - end) * k) / 2, LANES[lane], TRUCK.top + NOTE_Y + 1.2);
        // A jump carries you ~0.73 s * speed; park trucks back to back so the landing is always on a roof.
        const landing = nextStart + JUMP_AIRTIME * v + 4;
        while (nextStart + TRUCK.length < landing) {
          L.addTruck(lane, nextStart, null, false);
          this.cashLine(nextStart + 1, nextStart + TRUCK.length - 1, lane, TRUCK.top + NOTE_Y);
          chain.push([lane, nextStart, nextStart + TRUCK.length]);
          nextStart += TRUCK.length + 0.4;
        }
      }
      if (i > 0) this.cashLine(start + 1, Math.min(end, nextStart) - 1, lane, TRUCK.top + NOTE_Y); // the first truck has its own
      lane = nextLane;
      start = nextStart;
      end = start + TRUCK.length;
      laneEnd[lane] = end;
      L.addTruck(lane, start, null, false);
      chain.push([lane, start, end]);
    }
    this.cashLine(start + 1, end - 1, lane, TRUCK.top + NOTE_Y);

    // Moving buses, some carrying cash, meet the player in the third lane only where a single chain lane
    // is taken, and are past before the next overlap, so a ground route always stays open.
    const taken = (q) => chain.filter(([, a, b]) => q >= a && q <= b).length;
    let runStart = null;
    let busCount = 0;
    for (let q = s; q <= end + 1; q += 1) {
      if (taken(q) <= 1 && q <= end) {
        runStart ??= q;
        continue;
      }
      if (runStart !== null && q - runStart >= 16 && busCount++ % 2 === 0) {
        const bus = this.movingVehicle(third, { s: runStart + 3 }, 'bus');
        if (Math.random() < 0.6) for (let k = -2; k <= 2; k++) L.addCash(bus.s + k * 2, LANES[third], BUS.top + NOTE_Y, bus);
      }
      runStart = null;
    }

    for (const l of pair) this.reserve(l, end + 4);
    return end;
  }

  // Risk/reward line: a straight line of notes with a vehicle coming the other way that reaches the
  // furthest note a moment after the player grabs it.
  riskLine(s, v) {
    const len = rand(20, 32);
    const options = [0, 1, 2].filter((lane) =>
      this.laneFreeAt[lane] <= s && [lane - 1, lane + 1].some((n) => n >= 0 && n <= 2 && this.laneFreeAt[n] <= s + len - 15));
    if (!options.length) {
      this.spawnRow(s, v);
      return s;
    }
    const lane = pick(options);
    this.cashLine(s, s + len, lane);
    this.movingVehicle(lane, { s: s + len, lead: rand(0.45, 0.6) });
    return s + len;
  }

  // Multi-bus coin line: a long line of cash with several buses coming down it in quick succession.
  // Dodge out, come back for more, dodge again.
  busTrain(s, v) {
    const lane = pick([0, 1, 2]);
    const count = randInt(3, 4);
    const spacing = Math.max(26, v * 1.15);
    const len = spacing * (count - 0.25); // the line ends where the last bus arrives
    this.cashLine(s, s + len, lane);
    for (let k = 0; k < count; k++) this.movingVehicle(lane, { s: s + spacing * (k + 0.75), lead: 0.45 }, 'bus');
    // Keep the escape lanes clear.
    for (const n of [lane - 1, lane + 1]) if (n >= 0 && n <= 2) this.reserve(n, s + len + 4);
    return s + len;
  }

  // Triple obstacle stagger: every row blocks two lanes (mostly buses), leaving one open lane
  // that shifts over one lane each row.
  stagger(s, v) {
    const L = this.level;
    const rows = randInt(3, 5);
    const spacing = BUS.length + 6 + v * 0.3;
    let open = randInt(0, 2);
    let rowS = s;
    for (let r = 0; r < rows; r++) {
      for (const lane of [0, 1, 2]) {
        if (lane === open) continue;
        const roll = Math.random();
        if (roll < 0.7) L.addBus(lane, rowS);
        else if (roll < 0.85) L.addBarrier(rowS + BUS.length / 2, lane);
        else L.addSign(rowS + BUS.length / 2, lane);
      }
      this.cashLine(rowS, rowS + BUS.length, open);
      if (r < rows - 1) open = shiftLane(open);
      rowS += spacing;
    }
    const end = rowS - spacing + BUS.length;
    for (const lane of [0, 1, 2]) this.reserve(lane, end + 3);
    return end;
  }

  // Jump-over-barrier straight into a roll-under-barrier, across all three lanes.
  jumpRoll(s, v) {
    const L = this.level;
    const signS = s + v * 0.95; // lands with ~0.5 s to start the slide
    for (const lane of [0, 1, 2]) {
      L.addBarrier(s, lane);
      L.addSign(signS, lane);
    }
    const lane = randInt(0, 2);
    for (let k = -2; k <= 2; k++) {
      const f = k / 2.6;
      L.addCash(s + k * 1.8, LANES[lane], NOTE_Y + 1.6 * (1 - f * f));
    }
    for (let k = -1; k <= 1; k++) L.addCash(signS + k * 1.5, LANES[lane], 0.5); // collect while rolling
    return signS + 2;
  }

  // ------------------------------------------------------------ sections

  // Overpass on pillars. Columns stand in the lanes and low dividers partition the tracks,
  // so there's one weaving path through; switch lanes where the dividers open up.
  pillars(s0, v) {
    const L = this.level;
    const rows = randInt(6, 9);
    const spacing = 11 + v * 0.42;
    const s1 = s0 + 8 + (rows - 1) * spacing + 6;
    L.addTunnelShell(s0, s1);

    let path = randInt(0, 2);
    let rowS = s0 + 8;
    for (let r = 0; r < rows; r++) {
      const next = Math.random() < 0.65 ? shiftLane(path) : path;
      // Columns in every lane except the path (and sometimes one extra open lane).
      const extra = Math.random() < 0.35 ? pick([0, 1, 2].filter((l) => l !== path)) : -1;
      for (const lane of [0, 1, 2]) if (lane !== path && lane !== extra) L.addPillar(rowS, lane);

      // Dividers between this row and the next, never across the lane switch the path needs
      // (and none after a row with an extra open lane, so that lane is never a dead end).
      if (r < rows - 1 && extra < 0) {
        for (const [x, a, b] of [[-1.2, 0, 1], [1.2, 1, 2]]) {
          const crossing = (path === a && next === b) || (path === b && next === a);
          if (!crossing && Math.random() < 0.7) L.addDivider(rowS + 1.5, rowS + spacing - 1.5, x);
        }
        // Something to jump or roll under along the path now and then.
        if (Math.random() < 0.3) {
          const mid = rowS + spacing / 2;
          if (next === path) (Math.random() < 0.5 ? L.addBarrier(mid, path) : L.addSign(mid, path));
        }
      }
      this.cashLine(rowS - 2, rowS + 2, path);
      this.cashLine(rowS + spacing / 2, rowS + spacing - 3, next);
      path = next;
      rowS += spacing;
    }
    return s1;
  }

  // Dual tunnels split by a centre wall. One side holds cash; a bus reaches that tunnel's exit
  // shortly after the player comes out, leaving time to react.
  tunnel(s0) {
    const L = this.level;
    const len = rand(60, 85);
    const s1 = s0 + len;
    L.addWall(s0, s1);
    L.addTunnelShell(s0, s1);
    const cashLane = Math.random() < 0.5 ? 0 : 2;
    this.cashLine(s0 + 4, s1 - 2, cashLane);
    if (Math.random() < 0.4) this.cashLine(s0 + 10, s0 + 30, 2 - cashLane);
    this.movingVehicle(cashLane, { s: s1 + 16, lead: 0.6 }, 'bus');
    return s1 + 18;
  }

  // A run across building rooftops: a ramp up, several roofs separated by alleys, then a drop back down.
  rooftops(s0, v) {
    const L = this.level;
    const H = ROOF_HEIGHT;
    const rampLen = 16;
    L.addRamp(s0, s0 + rampLen, H);
    for (let k = 1; k < 7; k++) L.addCash(s0 + k * NOTE_STEP, LANES[1], (H * k * NOTE_STEP) / rampLen + NOTE_Y);

    let cur = s0 + rampLen;
    const count = randInt(3, 5);
    for (let i = 0; i < count; i++) {
      // At least one jump long, so clearing an alley never lands you in the next one.
      const len = Math.max(rand(22, 36), JUMP_AIRTIME * v + 6);
      L.addRooftop(cur, cur + len, H);

      // A row of rooftop obstacles in the middle of each roof.
      const mid = cur + len * 0.55;
      const lanes = shuffle([0, 1, 2]);
      const kind = pick(['cone', 'barrier', 'sign', 'gate']);
      if (kind === 'cone') L.addCone(mid, lanes[0], H);
      if (kind === 'barrier') L.addBarrier(mid, lanes[0], H);
      if (kind === 'sign') L.addSign(mid, lanes[0], H);
      if (kind === 'gate') L.addGate(mid, lanes[0], H);
      if (Math.random() < 0.5) L.addCone(mid, lanes[1], H);
      this.cashLine(mid - 6, mid + 6, lanes[2], H + NOTE_Y);

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

  // ------------------------------------------------------------ sky runs

  // Track position the player will reach after `t` seconds, starting at s.
  static distanceAfter(s, t) {
    for (let k = 0; k < t; k += 0.05) s += speedAt(s) * 0.05;
    return s;
  }

  // Player altitude `t` seconds into a flight (matches the player's eased climb).
  static climbAltitude(target, t) {
    return target * (1 - Math.exp(-2.5 * t));
  }

  // Metal wings: a structured coin path high above the street made only of straight lines:
  // runs along a lane, straight diagonals to the next lane, and zig-zags of diagonals.
  // It starts once you've reached flying height, so the whole path is level.
  wingsRun(playerS) {
    const y = POWERUP.wings.altitude + 0.8;
    const v0 = speedAt(playerS);
    const s1 = Spawner.distanceAfter(playerS, POWERUP.wings.duration) - 10;
    let s = playerS + v0 * 1.4;
    let lane = 1;
    const diagonal = (to, len) => {
      for (let d = 0; d < len && s < s1; d += NOTE_STEP, s += NOTE_STEP) {
        this.level.addCash(s, LANES[lane] + ((LANES[to] - LANES[lane]) * d) / len, y);
      }
      lane = to;
    };
    while (s < s1) {
      const shape = pickWeighted({ straight: 3, diagonal: 2, zigzag: 1.2 });
      if (shape === 'straight') {
        const end = s + rand(14, 26);
        for (; s < end && s < s1; s += NOTE_STEP) this.level.addCash(s, LANES[lane], y);
      } else if (shape === 'diagonal') {
        diagonal(shiftLane(lane), 11);
      } else {
        for (let i = randInt(3, 4); i > 0; i--) diagonal(lane === 1 ? pick([0, 2]) : 1, 8.8);
      }
    }
  }

  // Glider: a short lift into the air over three parallel rows of cash. A random power-up
  // waits at the end of one of the rows.
  gliderRun(playerS) {
    const g = POWERUP.glider;
    const s0 = playerS + 12;
    const s1 = Spawner.distanceAfter(playerS, g.duration - g.descent - 0.2);
    const v0 = speedAt(playerS);
    for (let s = s0; s < s1; s += NOTE_STEP) {
      const y = Spawner.climbAltitude(g.altitude, (s - playerS) / v0) + 0.8;
      for (const lane of [0, 1, 2]) this.level.addCash(s, LANES[lane], y);
    }
    const types = Object.keys(POWER_TYPES).filter((t) => t !== 'glider');
    this.level.addPowerUp(s1 + 3, randInt(0, 2), pick(types), g.altitude - 0.3);
  }
}
