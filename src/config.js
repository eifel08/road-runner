// Central tuning values. Distances are in meters (1 world unit = 1 m).

export const LANES = [-2.4, 0, 2.4];
export const ROAD_HALF_WIDTH = 4.8;

export const PLAYER = {
  halfWidth: 0.3,
  halfDepth: 0.3,
  height: 1.8,
  slideHeight: 0.8,
  jumpVelocity: 14.5, // apex ~2.6 m: clears cones, barriers, birds, motorcycles, but not buses
  gravity: 40,
  fastDropVelocity: -26,
  slideTime: 0.7,
  laneSpeed: 16, // m/s sideways
  stepUp: 0.35, // max ledge height the player walks onto without jumping
};

// Speed follows an arctan curve over time: it climbs fast at the start, then flattens out
// and approaches (never exceeds) the maximum.
export const SPEED = { start: 14, max: 44, timeScale: 30 };
export const speedAtTime = (t) => SPEED.start + (SPEED.max - SPEED.start) * (2 / Math.PI) * Math.atan(Math.max(0, t) / SPEED.timeScale);

// The same curve as a function of distance run (tabulated), so the track generator can size
// each pattern for the speed the player will have when they reach it.
const DIST_TABLE = (() => {
  const table = [];
  let s = 0;
  for (let t = 0; t <= 1500; t += 0.25) {
    table.push([s, speedAtTime(t)]);
    s += speedAtTime(t + 0.125) * 0.25;
  }
  return table;
})();
export function speedAt(s) {
  if (s <= 0) return SPEED.start;
  let lo = 0, hi = DIST_TABLE.length - 1;
  if (s >= DIST_TABLE[hi][0]) return DIST_TABLE[hi][1];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (DIST_TABLE[mid][0] <= s) lo = mid; else hi = mid;
  }
  const [s0, v0] = DIST_TABLE[lo], [s1, v1] = DIST_TABLE[hi];
  return v0 + ((v1 - v0) * (s - s0)) / (s1 - s0);
}

// 0 at the start of a run, approaching 1 the further you get: more obstacles, tighter gaps.
export const difficultyAt = (s) => 1 - Math.exp(-Math.max(0, s) / 1800);

// "Close call": a scrape brings the killer right onto your tail; a second scrape while he's close is fatal.
export const PURSUIT = {
  closeDuration: 7, // seconds without another scrape before he drops back
  introDuration: 3.5, // he starts each run on your tail
  closeZ: 2.4, // distance behind the player while close
  farZ: 13, // distance while dropped back (off screen)
  motorcycleSlow: 1.0, // seconds of reduced speed after running through a motorcycle
};

// Vehicles. Heights are the walkable roof height.
export const VEHICLE = {
  bus: { width: 2.3, length: 11, top: 3.15 }, // too tall to jump onto without the pogo stick
  truck: { width: 2.3, length: 15, top: 3.4, rampLength: 6 }, // car carrier, ramp at the back
  movingSpeed: [7, 11], // m/s toward the player
};

export const POWERUP = {
  magnet: { duration: 10, radius: 14 },
  pogo: { duration: 12, jumpVelocity: 21 }, // apex ~5.5 m: over signs, onto buses / trucks / roofs
  glider: { duration: 5, altitude: 10, descent: 1.0 }, // short lift, glides down in the last second
  wings: { duration: 10, altitude: 9 },
  skateboard: { duration: 30, blastRadius: 90 },
  boots: { duration: 15, doubleJumpVelocity: 13.5 }, // Super Boots: one extra jump in mid-air
  multiplier: { duration: 15, factor: 2 }, // 2x distance score
};

export const ROOF_HEIGHT = 4.5;
export const TUNNEL_HEIGHT = 7.6;

export const SPAWN = { ahead: 170, behind: 25 };

export const SCORE = { perMeter: 1, perNote: 5 };

export const HIGH_SCORE_KEY = 'roadrunner.highScore';
