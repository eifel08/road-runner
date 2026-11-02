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

// Speed grows with distance run, so it ramps up quickly.
export const SPEED = { start: 16, perMeter: 0.009, max: 42 };
export const speedAt = (s) => Math.min(SPEED.max, SPEED.start + SPEED.perMeter * Math.max(0, s));

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
};

export const ROOF_HEIGHT = 4.5;
export const TUNNEL_HEIGHT = 7.6;

export const SPAWN = { ahead: 170, behind: 25 };

export const SCORE = { perMeter: 1, perNote: 5 };

export const HIGH_SCORE_KEY = 'roadrunner.highScore';
