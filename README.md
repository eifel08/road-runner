# Road Runner

A 3-lane 3D endless runner on a city street, built with [Three.js](https://threejs.org/) and plain ES modules. There's no build step and no asset files; every model is built from primitives at runtime.

## Run

The browser needs a static server to load ES modules:

```bash
python -m http.server 5173
```

Then open http://localhost:5173. Add `?debug` to the URL to expose `window.game` in the console.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Change lane | ← → / A D | swipe left / right |
| Jump | ↑ / W / Space | swipe up |
| Slide (or fast-drop in the air) | ↓ / S | swipe down |

## Rules

- **Killer**: a masked killer chases you. Each mistake lets him close in. If he catches you, he stabs you and the run ends.
- **Traffic cone**: jump over it.
- **Construction sign**: slide under it.
- **Bird**: jump over it or slide under it.
- **Motorcycle**: jump over it, or run through it and lose speed.
- **Buses**: parked and oncoming. They're too tall to jump onto (unless you have the pogo stick). A head-on hit gets you caught.
- **Car-carrier trucks**: parked trucks face away from you, with a ramp at the back. Run up the ramp to get on top. Oncoming trucks show you their cab and work like buses.
- **Rooftops**: ramps lead up onto a row of building roofs. Jump the alleys between them; if you fall in, you climb back up but lose ground.
- Side-swiping an obstacle while changing lanes bounces you back and lets the killer gain on you.

### Set pieces

- **Pillar overpass**: pillars stand between the lanes, so you can only change lanes in the gaps. Buses come down the left or right lane, alternating sides and never both in the same gap. Cash sits on the safe side.
- **Dual tunnels**: a wall down the middle splits two tunnels. Hitting the wall's end gets you caught. One tunnel has cash, and a bus reaches that tunnel's exit just after you come out.
- **Ramp weave**: a truck ramp on one side, a second truck ramp on the other side one vehicle length later, and a moving bus with cash on its roof driving between them.
- **Risk/reward line**: a straight line of cash with a vehicle coming the other way. It reaches the last note a fraction of a second after you could grab it.

### Power-ups

| Power-up | Effect |
| --- | --- |
| Magnet | Pulls nearby banknotes to you |
| Pogo Stick | Makes your jump much higher (about 5.5 m): over construction signs and onto buses, trucks and roofs. No automatic bouncing. |
| Glider | Launches you to about 12 m, then you glide down over a trail of high-altitude cash. Nothing can hit you while you fly. |
| Metal Wings | Lifts you to 9 m for a cash run in the sky. Nothing can hit you while you fly. |
| Skateboard | Absorbs one hit of any kind (even the killer's catch). The board breaks, and a shockwave destroys every obstacle, vehicle and structure within about 90 m and flattens the buildings along the street. |

**Score** = meters run + 5 × banknotes. The best score is saved in `localStorage`.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/config.js` | All tuning constants (speeds, gaps, power-up durations, scoring) |
| `src/game.js` | State machine (menu → playing → caught), collision rules, scoring, camera |
| `src/player.js` | Lanes, jump/slide physics, power-up movement modes, animation |
| `src/pursuer.js` | Killer chase gap and the catch/stab animation |
| `src/level.js` | Track entities (obstacles, platforms, collectibles) and their updates |
| `src/spawner.js` | Procedural rows, set pieces (pillars, tunnels, rooftops, ramp weave, risk lines), cash, power-ups, air trails |
| `src/environment.js` | Scrolling road, sidewalks, recycled buildings and lamps |
| `src/effects.js` | Debris bursts and the skateboard shockwave |
| `src/models.js` | Procedural low-poly models and textures |
| `src/input.js` / `src/ui.js` | Keyboard/swipe input; minimal DOM menu and HUD |

Moving vehicles are scheduled by where they meet the player: until they're close, each frame re-times them against the player's current speed so set pieces stay accurate as the game speeds up.

Entities live in track space: `s` is the distance along the run, and the player always renders at `z = 0`, so an entity renders at `z = playerS - s`.
