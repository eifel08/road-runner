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
- **Cars**: parked and oncoming. A head-on hit gets you caught. You can jump onto the roofs and run across them.
- **Rooftops**: ramps lead up onto a row of building roofs. Jump the alleys between them; if you fall in, you climb back up but lose ground.
- Side-swiping an obstacle while changing lanes bounces you back and lets the killer gain on you.

### Power-ups

| Power-up | Effect |
| --- | --- |
| Magnet | Pulls nearby banknotes to you |
| Pogo Stick | Constant high bounces; lets you land on top of cars instead of crashing |
| Glider | Launches you high, then you glide down over a trail of cash |
| Metal Wings | Steady high-altitude flight over a cash trail |
| Giant Shield | Absorbs one crash of any kind, including a head-on car hit |

**Score** = meters run + 5 × banknotes. The best score is saved in `localStorage`.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/config.js` | All tuning constants (speeds, gaps, power-up durations, scoring) |
| `src/game.js` | State machine (menu → playing → caught), collision rules, scoring, camera |
| `src/player.js` | Lanes, jump/slide physics, power-up movement modes, animation |
| `src/pursuer.js` | Killer chase gap and the catch/stab animation |
| `src/level.js` | Track entities (obstacles, platforms, collectibles) and their updates |
| `src/spawner.js` | Procedural rows, cash patterns, power-ups, rooftop sections, air trails |
| `src/environment.js` | Scrolling road, sidewalks, recycled buildings and lamps |
| `src/models.js` | Procedural low-poly models and textures |
| `src/input.js` / `src/ui.js` | Keyboard/swipe input; minimal DOM menu and HUD |

Entities live in track space: `s` is the distance along the run, and the player always renders at `z = 0`, so an entity renders at `z = playerS - s`.
