// Central tuning values. Distances are in meters (1 world unit = 1 m).

export const LANES = [-2.4, 0, 2.4];
export const ROAD_HALF_WIDTH = 4.8;

export const PLAYER = {
  halfWidth: 0.3,
  halfDepth: 0.3,
  height: 1.8,
  slideHeight: 0.8,
  jumpVelocity: 14.5, // apex ~2.6 m: clears cones, birds, motorcycles, but not buses
  gravity: 40,
  fastDropVelocity: -26,
  slideTime: 0.7,
  laneSpeed: 16, // m/s sideways
  stepUp: 0.35, // max ledge height the player walks onto without jumping
};

export const SPEED = { start: 15, max: 34, accel: 0.12 };

// Pursuit gap is normalized: 1 = killer far behind, 0 = caught.
export const PURSUIT = {
  startGap: 0.7,
  regen: 0.04, // per second
  stumble: 0.65, // hitting a cone / sign / bird / pillar, climbing a wall
  bump: 0.3, // side-swiping something while changing lanes
  motorcycle: 0.3, // running through a motorcycle
  nearZ: 1.3, // killer distance behind player at gap 0
  farZ: 9, // killer distance behind player at gap 1
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
  glider: { duration: 9, startAltitude: 12, endAltitude: 4 },
  wings: { duration: 10, altitude: 9 },
  skateboard: { duration: 30, blastRadius: 90 },
};

export const ROOF_HEIGHT = 4.5;
export const TUNNEL_HEIGHT = 7.6;

export const SPAWN = { ahead: 170, behind: 25 };

export const SCORE = { perMeter: 1, perNote: 5 };

export const HIGH_SCORE_KEY = 'roadrunner.highScore';
