// Minimal DOM UI: Play button + high score on the menu, score / cash / active power-ups in game.
import { HIGH_SCORE_KEY, POWERUP } from './config.js';

const $ = (id) => document.getElementById(id);

const POWER_LABELS = {
  magnet: 'MAGNET', pogo: 'POGO STICK', glider: 'GLIDER', wings: 'METAL WINGS',
  skateboard: 'SKATEBOARD', boots: 'SUPER BOOTS', multiplier: '2X SCORE',
};

export class UI {
  constructor(onPlay) {
    this.menu = $('menu');
    this.hud = $('hud');
    this.vignette = $('vignette');
    this.flashEl = $('flash');
    this.flashEl.addEventListener('animationend', () => this.flashEl.classList.remove('on'));
    this.bloodEl = $('blood');
    $('play').addEventListener('click', (e) => {
      e.currentTarget.blur(); // so Space doesn't re-trigger the button mid-run
      onPlay();
    });
    // The "revive" ad is a joke: it says no and starts a fresh run.
    $('revive').addEventListener('click', (e) => {
      e.currentTarget.blur();
      const toast = $('lolno');
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
        onPlay();
      }, 1100);
    });
    this.highScore = UI.loadHighScore();
    $('best-value').textContent = this.highScore;
    this.lastHud = '';
  }

  static loadHighScore() {
    try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0; } catch { return 0; }
  }

  showMenu(lastScore) {
    if (lastScore !== undefined) {
      if (lastScore > this.highScore) {
        this.highScore = lastScore;
        try { localStorage.setItem(HIGH_SCORE_KEY, String(lastScore)); } catch { /* storage unavailable */ }
      }
      $('last-value').textContent = lastScore;
      $('last').classList.remove('hidden');
      $('revive').classList.remove('hidden');
    }
    $('best-value').textContent = this.highScore;
    this.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showGame() {
    this.bloodEl.innerHTML = '';
    $('revive').classList.add('hidden');
    this.menu.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.setDanger(0);
  }

  setHud(score, cash, power) {
    $('score').textContent = score;
    $('cash-count').textContent = cash;
    const active = Object.entries(power).filter(([, t]) => t > 0);
    const html = active.map(([k, t]) =>
      `<div class="power">${POWER_LABELS[k]}<span class="bar"><i style="width:${(100 * t) / POWERUP[k].duration}%"></i></span></div>`,
    ).join('');
    if (html !== this.lastHud) {
      $('powers').innerHTML = html;
      this.lastHud = html;
    }
  }

  // Blood spattered on the "camera" when the killer strikes.
  bloodSplat(count) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const size = 40 + Math.random() * 160;
      const x = Math.random() * w, y = Math.random() * h * 0.85;
      const splat = document.createElement('div');
      splat.className = 'splat';
      Object.assign(splat.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size * (0.7 + Math.random() * 0.5)}px` });
      this.bloodEl.appendChild(splat);
      // Satellite droplets and a drip running down.
      for (let k = 0; k < 4; k++) {
        const d = document.createElement('div');
        d.className = 'splat';
        const ds = 6 + Math.random() * 22;
        const a = Math.random() * Math.PI * 2, r = size * (0.5 + Math.random() * 0.5);
        Object.assign(d.style, { left: `${x + Math.cos(a) * r}px`, top: `${y + Math.sin(a) * r}px`, width: `${ds}px`, height: `${ds}px` });
        this.bloodEl.appendChild(d);
      }
      if (Math.random() < 0.7) {
        const drip = document.createElement('div');
        drip.className = 'drip';
        drip.style.left = `${x - 5 + (Math.random() - 0.5) * size * 0.4}px`;
        drip.style.top = `${y}px`;
        drip.style.setProperty('--len', `${60 + Math.random() * 160}px`);
        this.bloodEl.appendChild(drip);
      }
    }
  }

  // Bright flash for the skateboard blast.
  flash() {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth; // restart the CSS animation
    this.flashEl.classList.add('on');
  }

  // Darkens the screen edges as the killer closes in (0..1).
  setDanger(level) {
    this.vignette.style.opacity = level.toFixed(2);
  }
}
