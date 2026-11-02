// Keyboard (arrows / WASD / space) and touch swipes, buffered as discrete actions.
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'slide', KeyS: 'slide',
};
const SWIPE_MIN = 30;

export class Input {
  constructor() {
    this.queue = [];
    window.addEventListener('keydown', (e) => {
      const action = KEYS[e.code];
      if (!action) return;
      e.preventDefault();
      if (!e.repeat) this.queue.push(action);
    });

    let start = null;
    window.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      start = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) this.queue.push(dx < 0 ? 'left' : 'right');
      else this.queue.push(dy < 0 ? 'jump' : 'slide');
      start = null; // one action per swipe
    }, { passive: true });
    window.addEventListener('touchend', () => { start = null; });
  }

  consume() {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}
