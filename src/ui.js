// Minimal DOM UI: Play button + high score on the menu, score / cash / active power-ups in game.
import { HIGH_SCORE_KEY, POWERUP } from './config.js';

const $ = (id) => document.getElementById(id);

const POWER_LABELS = { magnet: 'MAGNET', pogo: 'POGO', glider: 'GLIDER', wings: 'METAL WINGS', shield: 'GIANT SHIELD' };

export class UI {
  constructor(onPlay) {
    this.menu = $('menu');
    this.hud = $('hud');
    this.vignette = $('vignette');
    $('play').addEventListener('click', (e) => {
      e.currentTarget.blur(); // so Space doesn't re-trigger the button mid-run
      onPlay();
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
    }
    $('best-value').textContent = this.highScore;
    this.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showGame() {
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

  // Darkens the screen edges as the killer closes in (0..1).
  setDanger(level) {
    this.vignette.style.opacity = level.toFixed(2);
  }
}
