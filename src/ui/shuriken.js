// タイトル画面の手裏剣：看板に刺さる2枚と、ときどき背景を横切る手裏剣
import { sfx } from '../audio/sfx.js';

/** 手裏剣の絵（オリジナル。4枚の刃・まん中に穴） */
export const SHURIKEN_SVG = `
  <svg class="shuriken-svg" viewBox="-50 -50 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="shk-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e4e8ef"/>
        <stop offset="0.45" stop-color="#8a93a3"/>
        <stop offset="1" stop-color="#454b57"/>
      </linearGradient>
    </defs>
    <path d="M0 -46 L10 -10 L46 0 L10 10 L0 46 L-10 10 L-46 0 L-10 -10 Z" fill="url(#shk-metal)" stroke="#2c3038" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M0 -46 L10 -10 L0 0 Z M46 0 L10 10 L0 0 Z M0 46 L-10 10 L0 0 Z M-46 0 L-10 -10 L0 0 Z" fill="#fff" opacity="0.18"/>
    <circle r="9" fill="#2c3038"/>
    <circle r="5" fill="#1b1f3c"/>
  </svg>`;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * タイトル画面の手裏剣をはじめる。もどり値で止める
 * @param {HTMLElement} board 手裏剣が刺さる看板（.logo）
 */
export function startTitleShuriken(board) {
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  // 看板に刺さる2枚
  const stick = (cls, delay) =>
    later(() => {
      const el = document.createElement('div');
      el.className = `shuriken-stuck ${cls}`;
      el.innerHTML = SHURIKEN_SVG;
      board.appendChild(el);
      later(() => sfx.thunk(), reduceMotion() ? 0 : 420);
    }, delay);
  stick('a', 250);
  stick('b', 650);

  // 背景を横切る手裏剣（看板やボタンの奥）
  let layer = null;
  if (!reduceMotion()) {
    layer = document.createElement('div');
    layer.id = 'title-sky';
    document.body.appendChild(layer);
    const fly = () => {
      const el = document.createElement('div');
      const fromLeft = Math.random() < 0.5;
      el.className = `shuriken-fly ${fromLeft ? 'ltr' : 'rtl'}`;
      el.style.top = `${10 + Math.random() * 75}%`;
      el.style.setProperty('--size', `${28 + Math.random() * 30}px`);
      el.style.setProperty('--dy', `${(Math.random() - 0.5) * 30}vh`);
      el.style.setProperty('--dur', `${1.4 + Math.random() * 1.2}s`);
      el.innerHTML = SHURIKEN_SVG;
      layer.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
      later(fly, 2500 + Math.random() * 3500);
    };
    later(fly, 1500);
  }

  return () => {
    timers.forEach(clearTimeout);
    timers.clear();
    layer?.remove();
  };
}
