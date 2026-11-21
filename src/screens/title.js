import { showSolo } from './solo.js';
import { showSixty } from './sixty.js';
import { showJugemu } from './jugemu.js';
import { showCpuSetup } from './cpuSetup.js';
import { showNinjaSelect } from './ninjaSelect.js';
import { showNinjutsuSelect } from './ninjutsuSelect.js';
import { showLearn } from './learn.js';
import { showKura } from './kura.js';
import { showOnlineMenu } from './online.js';
import { getProfile, getEquip, collectionCount, getMyNinjutsu, getScrolls } from '../progress/save.js';
import { getNinja } from '../data/ninjas.js';
import { getNinjutsu, SCROLL_RULES } from '../data/ninjutsu.js';
import { wordsStatus } from '../data/words.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { ninjutsuSealHtml, SCROLL_ICON } from '../ui/scrollUi.js';
import { esc } from '../ui/typing.js';
import { startTitleShuriken } from '../ui/shuriken.js';

export function showTitle(el, go) {
  const p = getProfile();
  const eq = getEquip();
  const n = getNinja(p.ninja);
  const nj = getNinjutsu(getMyNinjutsu());
  const cc = collectionCount();
  const scrolls = getScrolls();

  // words.json を読めなかった・読めない行があったら、先生向けにお知らせ
  const wordsNote =
    wordsStatus.source === 'fallback'
      ? `<p class="words-note">words.json を読めなかったので、予備のことば（${wordsStatus.count}個）を使っています（${esc(wordsStatus.error || '')}）</p>`
      : wordsStatus.skipped.length
        ? `<p class="words-note">words.json の ${wordsStatus.skipped.length}行は、よみがひらがなでないので使っていません：${esc(wordsStatus.skipped.slice(0, 3).join('、'))}${wordsStatus.skipped.length > 3 ? ' など' : ''}</p>`
        : '';

  el.innerHTML = `
    <section class="title-screen">
      <div class="logo">
        <div class="logo-sub">ローマ字で早打ち！ 忍者タイピング</div>
        <h1>はやうち<span>忍者</span></h1>
      </div>
      <div class="title-body">
        <div class="hero panel">
          ${ninjaSvg(p.ninja, { color: eq.color, costume: eq.costume, cls: 'hero-ninja' })}
          <div class="hero-name">${esc(p.name)}</div>
          <div class="hero-sub">${esc(n.name)}・${esc(n.jutsuInfo.name)}</div>
          <div class="hero-nj">${ninjutsuSealHtml(nj)}<span>${esc(nj.name)}</span></div>
        </div>
        <div class="menu">
          <button class="btn primary big" type="button" data-go="cpu"><kbd>1</kbd> CPUとたいせん</button>
          <button class="btn" type="button" data-go="online"><kbd>2</kbd> みんなでたいせん <small>2〜4人</small></button>
          <div class="menu-row three">
            <button class="btn" type="button" data-go="solo"><kbd>3</kbd> ひとりでしゅぎょう <small>10問</small></button>
            <button class="btn" type="button" data-go="sixty"><kbd>4</kbd> 🏆 60秒チャレンジ</button>
            <button class="btn" type="button" data-go="jugemu"><kbd>5</kbd> 📜 じゅげむチャレンジ</button>
          </div>
          <div class="menu-row">
            <button class="btn" type="button" data-go="ninja"><kbd>6</kbd> 忍者をえらぶ</button>
            <button class="btn" type="button" data-go="ninjutsu"><kbd>7</kbd> 忍術をえらぶ</button>
            <button class="btn ${scrolls >= SCROLL_RULES.learnCost ? 'glow' : ''}" type="button" data-go="learn"><kbd>8</kbd> 忍術を覚える <small>${SCROLL_ICON}${scrolls}</small></button>
            <button class="btn" type="button" data-go="kura"><kbd>9</kbd> ごほうびの蔵 <small>${cc.have}/${cc.total}</small></button>
          </div>
        </div>
      </div>
      ${wordsNote}
      <p class="hint">数字キー、または <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> でえらんで <kbd>Enter</kbd></p>
    </section>
  `;
  const routes = {
    cpu: () => go(showCpuSetup),
    online: () => go(showOnlineMenu),
    solo: () => go(showSolo),
    sixty: () => go(showSixty),
    jugemu: () => go(showJugemu),
    ninja: () => go(showNinjaSelect),
    ninjutsu: () => go(showNinjutsuSelect),
    learn: () => go(showLearn),
    kura: () => go(showKura),
  };
  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', routes[b.dataset.go]));
  const keys = { Enter: 'cpu', 1: 'cpu', 2: 'online', 3: 'solo', 4: 'sixty', 5: 'jugemu', 6: 'ninja', 7: 'ninjutsu', 8: 'learn', 9: 'kura' };
  const onKey = (e) => {
    const r = keys[e.key];
    if (!r) return;
    e.preventDefault();
    routes[r]();
  };
  window.addEventListener('keydown', onKey);
  // 手裏剣：看板に2枚刺さって、ときどき背景を横切る
  const stopShuriken = startTitleShuriken(el.querySelector('.logo'));
  return () => {
    window.removeEventListener('keydown', onKey);
    stopShuriken();
  };
}
