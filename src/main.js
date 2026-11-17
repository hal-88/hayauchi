import './style.css';
import { unlockAudio, isMuted, setMuted, getVolume, setVolume, setTypeSound, sfx } from './audio/sfx.js';
import { getProfile, getEquip, onSaveChange } from './progress/save.js';
import { applyBackground } from './ui/backgrounds.js';
import { ninjaSvg } from './ui/ninjaSvg.js';
import { esc } from './ui/typing.js';
import { getNinja } from './data/ninjas.js';
import { loadWords } from './data/words.js';
import { showTitle } from './screens/title.js';
import { showNinjaSelect } from './screens/ninjaSelect.js';

const app = document.getElementById('app');

app.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="seal">忍</span>はやうち忍者</div>
    <div class="top-right">
      <div class="me-chip" hidden></div>
      <div class="sound">
        <button class="mute" type="button" aria-label="音のオン・オフ"></button>
        <input class="vol" type="range" min="0" max="100" step="5" aria-label="音量" />
      </div>
    </div>
  </header>
  <main id="screen"></main>
`;

// ---- 音 ----
const muteBtn = app.querySelector('.mute');
const vol = app.querySelector('.vol');
function drawSound() {
  const off = isMuted() || getVolume() === 0;
  muteBtn.textContent = off ? '🔇' : '🔊';
  muteBtn.title = off ? '音なし（クリックで音あり）' : '音あり（クリックで音なし）';
  muteBtn.classList.toggle('off', off);
  vol.value = Math.round(getVolume() * 100);
  vol.disabled = isMuted();
}
muteBtn.addEventListener('click', () => {
  unlockAudio();
  setMuted(!isMuted());
  if (!isMuted() && getVolume() === 0) setVolume(0.5);
  drawSound();
  muteBtn.blur();
});
vol.addEventListener('input', () => {
  unlockAudio();
  setVolume(vol.value / 100);
  drawSound();
});
vol.addEventListener('change', () => {
  sfx.type();
  vol.blur(); // 打つキーが音量バーに取られないように
});
drawSound();

// ブラウザは操作があるまで音を出させないので、最初の操作で準備する
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

// ---- 自分の忍者・背景・タイピング音 ----
const chip = app.querySelector('.me-chip');
function applySave() {
  const eq = getEquip();
  applyBackground(eq.bg);
  setTypeSound(eq.sound);
  const p = getProfile();
  chip.hidden = !p;
  if (p) {
    chip.innerHTML = `${ninjaSvg(p.ninja, { color: eq.color, costume: eq.costume, cls: 'mini' })}<span>${esc(p.name)}<small>${esc(getNinja(p.ninja).name)}</small></span>`;
  }
}
onSaveChange(applySave);
applySave();

// ---- 画面の切りかえ。各画面は「後片づけ関数」を返す ----
const screenEl = document.getElementById('screen');
let cleanup = null;
export function go(screenFn, ...args) {
  if (cleanup) cleanup();
  screenEl.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = screenFn(screenEl, go, ...args) || null;
}

// 出題することば（public/words.json）を読んでからはじめる
loadWords().finally(() => {
  if (getProfile()) go(showTitle);
  else go(showNinjaSelect, { first: true });
});
