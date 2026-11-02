import * as THREE from 'three';
import { Game } from './game.js';
import { Input } from './input.js';
import { UI } from './ui.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const input = new Input();
let game;
const ui = new UI(() => game.start());
game = new Game(renderer, input, ui);
window.addEventListener('resize', () => game.resize());
if (new URLSearchParams(location.search).has('debug')) window.game = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
