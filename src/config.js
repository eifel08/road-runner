// Central tuning values. Distances are in meters (1 world unit = 1 m).

export const LANES = [-2.4, 0, 2.4];
export const ROAD_HALF_WIDTH = 4.8;

export const PLAYER = {
  halfWidth: 0.3,
  halfDepth: 0.3,
  height: 1.8,
  slideHeight: 0.8,
  jumpVelocity: 14.5, // apex ~2.6 m
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
  stumble: 0.65, // hitting a cone / sign / bird, climbing a wall
  bump: 0.3, // side-swiping something while changing lanes
  motorcycle: 0.3, // running through a motorcycle
  nearZ: 1.3, // killer distance behind player at gap 0
  farZ: 9, // killer distance behind player at gap 1
};

export const POWERUP = {
  magnet: { duration: 10, radius: 14 },
  pogo: { duration: 9, bounceVelocity: 20 }, // apex ~5 m
  glider: { duration: 8, startAltitude: 11, endAltitude: 1.8 },
  wings: { duration: 9, altitude: 8.5 },
  shield: { duration: 25 },
};

export const ROOF_HEIGHT = 4.5;

export const SPAWN = { ahead: 170, behind: 25, carTrigger: 70 };

export const SCORE = { perMeter: 1, perNote: 5 };

export const HIGH_SCORE_KEY = 'roadrunner.highScore';
