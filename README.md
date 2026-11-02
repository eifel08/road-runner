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

- **Crashes are fatal.** Running head-on into anything (cone, barrier, sign, bird, bus, truck, pillar, tunnel wall, building wall) ends the run: the killer catches you and stabs you. The only exception is the **motorcycle**: run straight through it and you just slow down.
- **Close calls.** A *scrape* is sliding into the side of something while changing lanes (a bus, a divider, a wall) or running through a motorcycle. You bounce back and the masked killer gets right on your tail. Scrape again while he's close and he catches you. Go 7 seconds without a scrape and he drops back. Every run starts with him on your tail for a few seconds.
- **Speed** rises with distance, from 16 m/s to 42 m/s at about 2,900 m.
- **Traffic cone / low barrier**: jump over it. **Construction sign**: roll under it. **Bird**: jump or roll.
- **Buses**: parked and oncoming. They're too tall to jump onto unless you have the pogo stick.
- **Car-carrier trucks**: parked trucks face away from you, with a ramp at the back. Run up the ramp to get on top. Oncoming trucks show you their cab and work like buses.

### Patterns and sections

- **Vehicle chain**: a truck ramp leads up to a run of parked car carriers in two adjacent lanes. Hop sideways where two roofs overlap, or jump the short gaps. Moving buses, some carrying cash, drive along the third lane underneath.
- **Triple stagger**: every row blocks two lanes, mostly with buses, leaving one open lane that shifts over one lane each row.
- **Jump-roll combo**: low barriers across all three lanes, then construction signs right after. Jump, then roll.
- **Risk/reward line**: a straight line of cash with a vehicle coming the other way that reaches the last note just after you do. There's about half a second of leeway.
- **Multi-bus coin line**: a long cash line with 3–4 buses coming down it in quick succession. Dodge out, come back, repeat.
- **Pillar overpass**: concrete columns stand in the lanes and low dividers partition the tracks. There's one weaving path through. You can only switch lanes where the dividers open up, or by jumping over a divider.
- **Dual tunnels**: a wall down the middle splits two tunnels. One holds cash, and a bus reaches that tunnel's exit shortly after you come out.
- **Rooftops**: a ramp leads up onto building roofs. Jump the alleys between them; falling in means hitting a wall.

Patterns are sized for the speed you'll have when you reach them. Gaps between rows, combo spacing, and roof and truck lengths all scale so a well-timed jump always lands on something.

### Power-ups

| Power-up | Effect |
| --- | --- |
| Magnet | Pulls nearby banknotes to you |
| Pogo Stick | Makes your jump much higher (about 5.5 m): over construction signs and onto buses, trucks and roofs. No automatic bouncing. |
| Glider | A short (5 s) lift to 10 m over three parallel rows of cash. A random power-up waits at the end of one row. |
| Metal Wings | 10 s at 9 m over a structured cash path that weaves between lanes: straight runs, smooth lane shifts, zig-zags and full-width snakes. |
| Skateboard | Absorbs one hit of any kind, even the killer's catch. The board breaks, and a shockwave destroys every obstacle, vehicle and structure within about 90 m and flattens the buildings along the street. |

Nothing can hit you while you fly. **Swipe down** (↓) during the glider or wings to cancel it and drop straight back to the street. You get a couple of seconds of safety on landing.

**Score** = meters run + 5 × banknotes. The best score is saved in `localStorage`.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/config.js` | All tuning constants (speeds, gaps, power-up durations, scoring) |
| `src/game.js` | State machine (menu → playing → caught), collision rules, scoring, camera |
| `src/player.js` | Lanes, jump/slide physics, power-up movement modes, animation |
| `src/pursuer.js` | Killer close-call state and the catch/stab animation |
| `src/level.js` | Track entities (obstacles, platforms, collectibles) and their updates |
| `src/spawner.js` | Dense procedural rows, patterns (vehicle chain, stagger, jump-roll, risk line, bus train), sections (pillars, tunnels, rooftops), cash, power-ups, sky runs |
| `src/environment.js` | Scrolling road, sidewalks, recycled buildings and lamps |
| `src/effects.js` | Debris bursts and the skateboard shockwave |
| `src/models.js` | Procedural low-poly models and textures |
| `src/input.js` / `src/ui.js` | Keyboard/swipe input; minimal DOM menu and HUD |

Moving vehicles are scheduled by where they meet the player: until they're close, each frame re-times them against the player's current speed so set pieces stay accurate as the game speeds up.

Entities live in track space: `s` is the distance along the run, and the player always renders at `z = 0`, so an entity renders at `z = playerS - s`.
