// CPU戦：同じ言葉を同時に打ち、先に打ち切ったほうに1点。target 点先取で勝ち。
// 忍者の術：カウントダウン中にスペースで1試合1回。CPUも自分の忍者の術をときどき使う。
// 忍術：カウントダウン中にエンター（発動型）。CPUは忍術を持たない。1問に使える術は1つまで（忍び足の術だけは別）。
// 術どうしがぶつかったら先に押したほうが優先（clash.js）。常時型はセットしておくだけで効く。
import { RomajiMatcher, toRomaji } from '../logic/romaji.js';
import { pickWords } from '../data/words.js';
import { planCpu, typedCountAt, CPU_LEVELS } from '../logic/cpu.js';
import { JUTSU_RULES, jutsuOf, jutsuName, canUseJutsu, shortenKana } from '../logic/jutsu.js';
import { NJ_RULES, PASSIVE_RULES, NJ_PASSIVE, canUseNinjutsu, shoryakuKana, gozaruWord, extendWord, kakushidamaPoints, undameshiPick, ninjaJutsuLimit, kishikaiseiKana, rengekiKana } from '../logic/ninjutsuRules.js';
import { effectiveActs, resolveHits, lastOthersAct, JAMA } from '../logic/clash.js';
import { getNinjutsu } from '../data/ninjutsu.js';
import { getNinja, cpuNinjaFor } from '../data/ninjas.js';
import { getItem, kindLabel } from '../data/rewards.js';
import { getProfile, getEquip, recordCpuMatch, equip, setProfile, getMyNinjutsu } from '../progress/save.js';
import { sfx } from '../audio/sfx.js';
import { spawnAt } from '../ui/effects.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { scrollGainHtml } from '../ui/scrollUi.js';
import { jutsuChipHtml, showJutsuBanner, blurFor, freezeFor, hideKana, jutsuHintHtml, drawJutsuHint, nudgeHint, flashCard, keyHelp, showYokoku, clearYokoku } from '../ui/jutsuUi.js';
import { showTitle } from './title.js';
import { showCpuSetup } from './cpuSetup.js';
import { itemThumb } from './kura.js';
import { BATTLE_COUNTDOWN_MS as COUNTDOWN_MS } from './solo.js';
import {
  esc,
  readTypingKey,
  IME_WARN_HTML,
  SCROLL_HTML,
  closeScroll,
  setCountdown,
  openScroll,
  renderWord,
  drawProgress,
  stampHtml,
  shake,
  setupShake,
  missStop,
  timerBag,
} from '../ui/typing.js';

const ROUND_END_MS = 1500; // 1問おわってから次のカウントダウンまで
const MATCH_END_MS = 1800;

// CPUが相手の術を受けたときにおそくなる時間（画面を見ていないCPU用の置きかえ）
const CPU_HIT_DELAY = { mekuramashi: 600, koorase: JUTSU_RULES.freezeMs, kakuremi: 400 };
const CPU_NJ_DELAY = { kemuridama: 500, yurashi: 400, bunshin: 500, sakasa: 600, makibishi: 250 };

export function showCpuBattle(el, go, { level, target, foe }) {
  const me = getProfile();
  const eq = getEquip();
  const foeNinja = foe ? getNinja(foe) : cpuNinjaFor(level);
  const cpuName = `CPU Lv${level}`;
  const jutsu = { me: jutsuOf(me.ninja), cpu: foeNinja.jutsu };
  const names = { me: me.name, cpu: 'CPU' };
  const myNj = getNinjutsu(getMyNinjutsu());

  el.innerHTML = `
    <section class="play battle" data-nav="off">
      <div class="scoreboard">
        <div class="side me">
          ${ninjaSvg(me.ninja, { color: eq.color, costume: eq.costume, cls: 'avatar' })}
          <div class="who-box">
            <div class="who">${esc(me.name)} <span class="jc"></span></div>
            <div class="dots"></div>
          </div>
          <b class="pts">0</b>
        </div>
        <div class="vs">
          <span class="round-no">第1問</span>
          <small>${target}点先取</small>
        </div>
        <div class="side cpu">
          <b class="pts">0</b>
          <div class="who-box">
            <div class="who"><span class="jc"></span> ${esc(cpuName)} <small>${esc(foeNinja.name)}</small></div>
            <div class="dots"></div>
          </div>
          ${ninjaSvg(foeNinja.id, { cls: 'avatar flip' })}
        </div>
      </div>
      ${SCROLL_HTML}
      <div class="rival">
        ${ninjaSvg(foeNinja.id, { cls: 'rival-ninja flip' })}
        <div class="rival-name">${esc(cpuName)}</div>
        <div class="bar"><i></i></div>
        <div class="rival-typed"></div>
      </div>
      ${IME_WARN_HTML}
      <div class="play-foot">${jutsuHintHtml('スペース', 'jh-ninja')}${jutsuHintHtml('エンター', 'jh-nj')}<button class="btn small" type="button" data-act="quit">やめる</button></div>
    </section>
  `;
  el.querySelector('[data-act="quit"]').addEventListener('click', () => go(showTitle));

  const $ = (s) => el.querySelector(s);
  const stage = $('.stage');
  const card = $('.card');
  const roundNoEl = $('.round-no');
  const meSide = $('.side.me');
  const cpuSide = $('.side.cpu');
  const barEl = $('.bar i');
  const rivalTypedEl = $('.rival-typed');
  const imeWarn = $('.ime-warn');
  const hintEl = $('.jh-ninja');
  const njHintEl = $('.jh-nj');
  setupShake(card);

  const deck = [];
  const nextWord = () => {
    if (!deck.length) deck.push(...pickWords(60));
    return deck.pop();
  };

  const score = { me: 0, cpu: 0 };
  const usedCount = { me: 0, cpu: 0 }; // 忍者の術を使った回数
  const limit = { me: ninjaJutsuLimit(myNj.id), cpu: 1 }; // 二刀流なら2回
  const used = { me: false, cpu: false }; // 使い切った
  let njUsed = false; // 忍術（発動型）を使った
  let roundActs = []; // この問題で使った術 { uid, id, at, target }
  const allActs = []; // これまでに使った術（写し身用）
  let sealed = new Set(); // 封印された人
  // 常時型
  const passive = NJ_PASSIVE.has(myNj.id) ? myNj.id : null;
  let migawariLeft = passive === 'migawari';
  let noMissWins = 0; // 達人
  let lossStreak = 0; // 忍耐
  let winStreak = 0; // 連撃
  let nintaiNext = false;
  let rengekiNext = false;
  let roundMiss = 0;
  const log = []; // { text, kana, winner, ms, pts }
  let round = 0;
  let phase = 'idle'; // countdown | typing | nidan | roundEnd | result
  let word = null; // この問題のことば
  let myWord = null; // 自分が打つことば（短縮・省略・手裏剣で変わる）
  let roundJ = { me: null, cpu: null }; // この問題で使った忍者の術（運試しで出た術もここ）
  let roundNj = null; // この問題で使った忍術
  const extraNext = { me: false, cpu: false }; // 手裏剣の術：次の問題が1文字増える
  let revealAt = 0; // 巻物が開く時刻（performance.now）
  let previewed = false; // 先読みの術で先に開いた
  let matcher = null;
  let plan = null;
  let cpuRomaji = '';
  let t0 = 0;
  let raf = 0;
  let stopUntil = 0; // ミスやこおらせで打てない間
  let myHits = []; // この問題で自分にかかった術
  let totalMiss = 0;
  let totalKeys = 0;
  const timers = timerBag();

  const isNinjaJutsu = (id) => Object.values(jutsu).includes(id) || !getNinjutsu(id);
  const jutsuOrNjName = (id) => getNinjutsu(id)?.name || jutsuName(id);

  function drawScore() {
    for (const [side, who] of [
      [meSide, 'me'],
      [cpuSide, 'cpu'],
    ]) {
      const pts = score[who];
      side.querySelector('.pts').textContent = pts;
      side.querySelector('.dots').innerHTML = Array.from({ length: target }, (_, i) => `<i class="${i < pts ? 'on' : ''}"></i>`).join('');
      side.querySelector('.jc').innerHTML =
        jutsuChipHtml(who === 'me' ? me.ninja : foeNinja.id, used[who]) +
        (limit[who] > 1 && !used[who] ? `<small class="left">×${limit[who] - usedCount[who]}</small>` : '') +
        (sealed.has(who) ? '<small class="sealed">封</small>' : '');
    }
  }

  // 1問に使える術は1つまで（忍び足の術を使った問題だけは、忍者の術も使える）
  const ninjaBlocked = () => roundNj && roundNj !== 'shinobiashi';
  const njBlocked = () => roundJ.me && myNj.id !== 'shinobiashi';

  function drawHint() {
    const name = jutsuName(jutsu.me);
    if (sealed.has('me')) drawJutsuHint(hintEl, name, 'used', '封印された');
    else if (used.me) drawJutsuHint(hintEl, name, 'used');
    else if (phase !== 'countdown') drawJutsuHint(hintEl, name, 'wait');
    else if (ninjaBlocked()) drawJutsuHint(hintEl, name, 'blocked', '1問に1つまで');
    else {
      const c = canUseJutsu(jutsu.me, score.me, score.cpu);
      drawJutsuHint(hintEl, name, c.ok ? 'ready' : 'blocked', c.why);
    }
    const c = canUseNinjutsu(myNj.id);
    if (passive) drawJutsuHint(njHintEl, myNj.name, 'passive', 'ずっと効いている');
    else if (!c.ok) drawJutsuHint(njHintEl, myNj.name, 'blocked', c.why);
    else if (njUsed) drawJutsuHint(njHintEl, myNj.name, 'used');
    else if (phase !== 'countdown') drawJutsuHint(njHintEl, myNj.name, 'wait');
    else if (njBlocked()) drawJutsuHint(njHintEl, myNj.name, 'blocked', '1問に1つまで');
    else drawJutsuHint(njHintEl, myNj.name, 'ready');
  }

  function drawRival(count) {
    const n = cpuRomaji.length || 1;
    barEl.style.width = `${(count / n) * 100}%`;
    rivalTypedEl.textContent = cpuRomaji.slice(0, count);
  }

  // ---------- 忍者の術 ----------
  /** 自分にかかる忍者の術の効果（ふつうに使ったときも、運試しで出たときも） */
  function applyMyJutsu(id) {
    if (id === 'tanshuku') {
      const s = shortenKana(myWord.kana);
      myWord = { ...myWord, kana: s.kana, cut: s.cut };
    }
    if (id === 'sakiyomi') {
      timers.later(preview, Math.max(0, revealAt - JUTSU_RULES.previewMs - performance.now()));
    }
  }

  function activate(who) {
    const id = jutsu[who];
    usedCount[who]++;
    used[who] = usedCount[who] >= limit[who];
    roundJ[who] = id;
    addAct(who, id);
    showJutsuBanner(card, names[who], jutsuName(id), who === 'me');
    flashCard(card);
    sfx.jutsu(who === 'me');
    drawScore();
    drawHint();
    if (who === 'me') applyMyJutsu(id);
  }

  function tooLate() {
    return performance.now() > revealAt - JUTSU_RULES.lastCallMs;
  }

  function addAct(uid, id, extra = {}) {
    const a = { uid, id, at: performance.now(), ...extra };
    roundActs.push(a);
    allActs.push(a);
  }

  function tryMyJutsu() {
    if (sealed.has('me')) return nudgeHint(hintEl, '封印された');
    if (used.me) return nudgeHint(hintEl, 'もう使った');
    if (phase !== 'countdown' || tooLate()) return nudgeHint(hintEl, 'カウントダウン中に');
    if (roundJ.me || ninjaBlocked()) return nudgeHint(hintEl, '1問に1つまで');
    if (!canUseJutsu(jutsu.me, score.me, score.cpu).ok) {
      sfx.miss();
      return;
    }
    activate('me');
  }

  // CPUが術を使うかどうか（この問題で使うなら、カウントダウンのどこかで使う）
  function planCpuJutsu() {
    if (used.cpu || sealed.has('cpu') || !canUseJutsu(jutsu.cpu, score.cpu, score.me).ok) return;
    let p = round === 1 ? 0.05 : 0.2;
    if (score.me >= target - 1) p = 0.7; // あと1点で負けそう
    if (jutsu.cpu === 'gyakuten') p = Math.max(p, 0.4);
    if (Math.random() >= p) return;
    timers.later(() => {
      if (phase === 'countdown' && !used.cpu && !sealed.has('cpu')) activate('cpu');
    }, 400 + Math.random() * (COUNTDOWN_MS - 1200));
  }

  // ---------- 忍術（エンター） ----------
  function tryMyNinjutsu() {
    if (passive) return nudgeHint(njHintEl, 'セットするだけで効く');
    if (sealed.has('me')) return nudgeHint(njHintEl, '封印された');
    if (njUsed) return nudgeHint(njHintEl, 'もう使った');
    if (phase !== 'countdown' || tooLate()) return nudgeHint(njHintEl, 'カウントダウン中に');
    if (roundNj || njBlocked()) return nudgeHint(njHintEl, '1問に1つまで');
    if (!canUseNinjutsu(myNj.id).ok) {
      sfx.miss();
      return;
    }
    // 写し身：相手が最後に使った術をまねる（だれも使っていなければ使えない）
    let copy = null;
    if (myNj.id === 'utsushimi') {
      copy = lastOthersAct(allActs, 'me');
      if (!copy || (copy === 'gyakuten' && !(score.me < score.cpu))) {
        sfx.miss();
        drawJutsuHint(njHintEl, myNj.name, 'blocked', copy ? '負けているときだけまねできる' : 'まねする術がまだない');
        return;
      }
    }
    njUsed = true;
    roundNj = myNj.id;
    let after = '';
    if (myNj.id === 'undameshi') {
      // 運試し：8人の忍者の術のどれかが出る（忍者の術の「使った」にはならない）
      const pick = undameshiPick(score.me, score.cpu);
      roundJ.me = pick;
      addAct('me', pick);
      after = `→【${jutsuName(pick)}】が出た！`;
      applyMyJutsu(pick);
    } else if (copy) {
      after = `→【${jutsuOrNjName(copy)}】をまねした！`;
      roundNj = copy; // まねした術として効く
      if (isNinjaJutsu(copy)) {
        roundJ.me = copy;
        applyMyJutsu(copy);
      }
      addAct('me', copy, copy === 'fuin' ? { target: 'cpu' } : {});
    } else {
      addAct('me', myNj.id, myNj.id === 'fuin' ? { target: 'cpu' } : {});
    }
    if (myNj.id === 'fuin') after = used.cpu ? '（CPUはもう術を使っている）' : '→ CPUの術を封印！';
    if (myNj.id === 'shinobiashi') after = '（相手には見えない）';
    if (roundNj === 'shoryaku') myWord = { ...myWord, kana: shoryakuKana(myWord.kana) };
    if (roundNj === 'yokoku') showYokoku(card, myWord.kana[0]);
    if (roundNj === 'fuin') {
      sealed.add('cpu');
      drawScore();
    }
    showJutsuBanner(card, me.name, myNj.name, true, after);
    flashCard(card);
    sfx.jutsu(true);
    drawHint();
  }

  // ---------- 1問の流れ ----------
  function nextRound() {
    if (score.me >= target || score.cpu >= target) return showResult();
    round++;
    phase = 'countdown';
    roundNoEl.textContent = `第${round}問`;
    word = nextWord();
    myWord = extraNext.me ? extendWord(word) : word; // 手裏剣の術を受けた
    let passiveNote = '';
    // 連撃：3問つづけて取ったら1文字少ない
    if (rengekiNext) {
      const r = rengekiKana(myWord.kana);
      myWord = { ...myWord, kana: r.kana, cut: r.cut };
      rengekiNext = false;
      passiveNote = '連撃の術で1文字へる！';
    }
    // 起死回生：相手があと1点で勝ちなら少し短く
    if (passive === 'kishikaisei' && score.cpu === target - 1) {
      const r = kishikaiseiKana(myWord.kana);
      myWord = { ...myWord, kana: r.kana, cut: (r.cut || '') + (myWord.cut || '') };
      passiveNote = '起死回生の術で短くなる！';
    }
    roundJ = { me: null, cpu: null };
    roundNj = null;
    roundActs = [];
    roundMiss = 0;
    previewed = false;
    card.classList.remove('peek');
    hideKana(card, false);
    clearYokoku(card);
    cpuRomaji = '';
    drawRival(0);
    revealAt = performance.now() + COUNTDOWN_MS;
    const reach = [];
    if (score.me === target - 1) reach.push(me.name);
    if (score.cpu === target - 1) reach.push('CPU');
    const label = passiveNote || (extraNext.me ? '手裏剣で1文字ふえる！' : reach.length ? `${reach.join('も')} あと1点！` : 'つぎの巻物');
    const steps = Math.round(COUNTDOWN_MS / 1000); // 5・4・3・2・1
    for (let i = 0; i < steps; i++) {
      timers.later(() => {
        if (previewed) setCountdown(card, steps - i, label);
        else closeScroll(card, steps - i, label);
        sfx.count();
      }, (i * COUNTDOWN_MS) / steps);
    }
    timers.later(showWord, COUNTDOWN_MS);
    // 忍耐：3問つづけて取られたら、この問題が2秒早く見える
    if (nintaiNext) {
      nintaiNext = false;
      timers.later(preview, COUNTDOWN_MS - JUTSU_RULES.previewMs);
    }
    drawHint();
    planCpuJutsu();
  }

  /** 先読みの術：自分だけ先に巻物が開く（打てるのはみんなと同じ時刻） */
  function preview() {
    if (phase !== 'countdown' || previewed) return;
    previewed = true;
    clearYokoku(card);
    matcher = new RomajiMatcher(myWord.kana);
    renderWord(stage, myWord);
    drawProgress(stage, myWord, matcher);
    card.classList.add('peek');
    openScroll(card, true);
    sfx.scroll();
  }

  function showWord() {
    if (!previewed) matcher = new RomajiMatcher(myWord.kana);
    clearYokoku(card);
    // 術のぶつかり：先に押したほうが優先（刀狩り・封印・結界・鏡・心眼・身代わり）
    const { eff, sealed: s2 } = effectiveActs(roundActs, sealed);
    sealed = s2;
    const cpuAct = roundJ.cpu;
    roundJ.cpu = eff.find((a) => a.uid === 'cpu')?.id || null; // 刀狩りで消えたCPUの術は効かない
    if (cpuAct && !roundJ.cpu) showJutsuBanner(card, me.name, myNj.name, true, `CPUの【${jutsuName(cpuAct)}】を消した！`);
    const res = resolveHits('me', eff, {
      targetsOf: (a) => [a.uid === 'me' ? 'cpu' : 'me'],
      myPassives: passive ? new Set([passive]) : new Set(),
      migawariLeft,
    });
    if (res.migawari) {
      migawariLeft = false;
      showJutsuBanner(card, me.name, '身代わりの術', true, `【${jutsuOrNjName(res.migawari.id)}】を消した！`);
    }
    for (const a of res.blocked) showJutsuBanner(card, me.name, myNj.name, true, `【${jutsuOrNjName(a.id)}】をふせいだ！`);
    myHits = res.hits.map((a) => a.id);
    // CPUが打つことば
    let cw = extraNext.cpu ? extendWord(word) : word;
    if (roundJ.cpu === 'tanshuku') cw = { ...cw, kana: shortenKana(cw.kana).kana };
    if (roundNj === 'gozaru') cw = gozaruWord(cw);
    extraNext.me = false;
    extraNext.cpu = false;
    cpuRomaji = toRomaji(cw.kana);
    let delay = (CPU_HIT_DELAY[roundJ.me] || 0) + (CPU_NJ_DELAY[roundNj] || 0);
    if (roundNj === 'kagenui' && score.cpu >= score.me) delay += NJ_RULES.kagenuiMs; // CPUが1位なら
    for (const a of res.reflected) delay += CPU_HIT_DELAY[a.id] || CPU_NJ_DELAY[a.id] || 0; // 鏡ではね返した
    if (res.reflected.length) showJutsuBanner(card, me.name, '鏡の術', true, `【${jutsuOrNjName(res.reflected[0].id)}】をはね返した！`);
    plan = planCpu(cpuRomaji, level, Math.random, {
      reactScale: roundJ.cpu === 'sakiyomi' ? 0.25 : 1,
      noMissPause: roundJ.cpu === 'teppeki',
      delay,
    });
    phase = 'typing';
    if (!previewed) {
      renderWord(stage, myWord);
      openScroll(card);
      sfx.scroll();
    }
    // 瞬足の術：最初の3文字を自動で打つ
    if (roundNj === 'shunsoku') {
      for (let i = 0; i < NJ_RULES.shunsokuKeys && !matcher.done; i++) matcher.input(matcher.rest[0]);
    }
    drawProgress(stage, myWord, matcher);
    card.classList.remove('peek');
    t0 = performance.now();
    stopUntil = 0;
    // CPUの術が自分にかかる（結界・鏡・心眼・身代わりでふせいだものはかからない）
    if (myHits.includes('mekuramashi')) blurFor(card, JUTSU_RULES.blurMs);
    if (myHits.includes('koorase')) {
      stopUntil = freezeFor(card, JUTSU_RULES.freezeMs);
      sfx.freeze();
    }
    if (myHits.includes('kakuremi')) hideKana(card, true);
    drawHint();
    loop();
    // 画面が裏にあって描画が止まっても、CPUはちゃんと打ち終わる
    const thisRound = round;
    timers.later(() => {
      if (phase === 'typing' && round === thisRound) endRound('cpu', plan.finishMs);
    }, plan.finishMs + 20);
  }

  // CPUがもう打ち終わっている時刻なら、先にCPUの勝ちにする
  function cpuAlreadyDone() {
    if (phase === 'typing' && performance.now() - t0 >= plan.finishMs) {
      endRound('cpu', plan.finishMs);
      return true;
    }
    return false;
  }

  function loop() {
    if (phase !== 'typing') return;
    const ms = performance.now() - t0;
    drawRival(typedCountAt(plan, ms));
    if (ms >= plan.finishMs) return endRound('cpu', plan.finishMs);
    raf = requestAnimationFrame(loop);
  }

  function bump(who) {
    const side = who === 'me' ? meSide : cpuSide;
    side.classList.remove('bump');
    void side.offsetWidth;
    side.classList.add('bump');
  }

  function endRound(winner, ms) {
    phase = 'roundEnd';
    cancelAnimationFrame(raf);
    const other = winner === 'me' ? 'cpu' : 'me';
    let pts = roundJ[winner] === 'bageki' ? 2 : 1;
    let note = '';
    if (winner === 'me' && roundNj === 'kakushidama') {
      pts = kakushidamaPoints(); // 隠し玉の術：0〜3点
      note = ` 隠し玉で${pts}点`;
    }
    score[winner] += pts;
    let stole = false;
    if (roundJ[winner] === 'gyakuten' && score[other] > 0) {
      score[other]--;
      stole = true;
    }
    if (winner === 'me' && roundNj === 'shuriken') extraNext.cpu = true; // 手裏剣の術：相手の次の問題が1文字ふえる
    // 常時型
    if (winner === 'me') {
      winStreak++;
      lossStreak = 0;
      if (passive === 'tatsujin' && roundMiss === 0) {
        noMissWins++;
        if (noMissWins % PASSIVE_RULES.tatsujinWins === 0) {
          score.me += 1; // 達人：ノーミスで3問取るたびに +1点
          note += ' 達人の術+1';
        }
      }
      if (passive === 'rengeki' && winStreak % PASSIVE_RULES.rengekiWins === 0) rengekiNext = true;
    } else {
      lossStreak++;
      winStreak = 0;
      if (passive === 'nintai' && lossStreak % PASSIVE_RULES.nintaiLosses === 0) nintaiNext = true;
    }
    log.push({ text: word.text, kana: word.kana, winner, ms, pts });
    drawScore();
    hideKana(card, false);
    bump(winner);
    const sec = `${(ms / 1000).toFixed(2)}秒`;
    const extra = `${note || (pts > 1 ? ` +${pts}点` : '')}${stole ? ' 1点うばった' : ''}`;
    if (winner === 'me') {
      card.classList.add('won');
      stage.insertAdjacentHTML('beforeend', stampHtml(`取った！${extra}`, sec));
      sfx.clear();
    } else {
      drawRival(cpuRomaji.length);
      card.classList.add('lost');
      stage.insertAdjacentHTML('beforeend', stampHtml(`取られた…${extra}`, sec, true));
      sfx.lose();
    }
    drawHint();
    const over = score.me >= target || score.cpu >= target;
    // 二段構えの術：取られても、3秒以内に打ち切れば1点
    if (winner === 'cpu' && roundNj === 'nidan' && !over && !matcher.done) {
      phase = 'nidan';
      stage.insertAdjacentHTML('beforeend', `<div class="judging">二段構え！3秒以内に打ち切れ！</div>`);
      const r = round;
      timers.later(() => {
        if (phase === 'nidan' && round === r) finishNidan(false);
      }, NJ_RULES.nidanGraceMs);
      return;
    }
    timers.later(nextRound, over ? MATCH_END_MS : ROUND_END_MS);
  }

  function finishNidan(done) {
    phase = 'roundEnd';
    stage.querySelector('.judging')?.remove();
    if (done) {
      score.me += 1;
      log.push({ text: `${word.text}（2位）`, kana: word.kana, winner: 'me', ms: performance.now() - t0, pts: 1 });
      drawScore();
      bump('me');
      stage.insertAdjacentHTML('beforeend', `<div class="judging done">二段構え +1点！</div>`);
      sfx.clear();
    }
    const over = score.me >= target || score.cpu >= target;
    timers.later(nextRound, over ? MATCH_END_MS : ROUND_END_MS);
  }

  function rewardHtml(r) {
    if (!r) return '';
    if (r.type === 'ninja') {
      const n = getNinja(r.id);
      return `<div class="reward panel">
        <div class="reward-head">${esc(n.name)}が 仲間になった！</div>
        ${ninjaSvg(n.id, { cls: 'reward-ninja' })}
        <div class="reward-sub">【${esc(n.jutsuInfo.name)}】${esc(n.jutsuInfo.desc)}</div>
        <div class="buttons"><button class="btn" type="button" data-act="ninja">この忍者にかえる</button></div>
      </div>`;
    }
    if (r.type === 'item') {
      const it = getItem(r.kind, r.id);
      return `<div class="reward panel">
        <div class="reward-head">ごほうびゲット！</div>
        <div class="reward-thumb">${itemThumb(r.kind, r.id, me.ninja)}</div>
        <div class="reward-sub">${esc(kindLabel(r.kind))}：<b>${esc(it.name)}</b></div>
        <div class="buttons">
          ${r.kind === 'sound' ? '<button class="btn" type="button" data-act="listen">♪ きいてみる</button>' : ''}
          <button class="btn" type="button" data-act="equip">すぐ使う</button>
        </div>
      </div>`;
    }
    return `<div class="reward panel"><div class="reward-head">ごほうびは ぜんぶ集めた！</div></div>`;
  }

  function showResult() {
    phase = 'result';
    const win = score.me > score.cpu;
    const { reward, scrolls } = recordCpuMatch(level, win);
    if (win) {
      sfx.finish();
      if (reward) sfx.reward();
    } else {
      sfx.matchLose();
    }
    const mine = log.filter((r) => r.winner === 'me');
    const avg = mine.length ? mine.reduce((a, r) => a + r.ms, 0) / mine.length / 1000 : null;
    const best = mine.length ? Math.min(...mine.map((r) => r.ms)) / 1000 : null;
    const acc = totalKeys + totalMiss ? Math.round((totalKeys / (totalKeys + totalMiss)) * 100) : 100;
    const canUp = win && level < 5;

    el.innerHTML = `
      <section class="result panel-page">
        <div class="result-grid">
          <div class="result-left">
            <div class="verdict ${win ? 'win' : 'lose'}">${win ? '勝ち！' : '負け…'}</div>
            <div class="final-score">
              ${ninjaSvg(me.ninja, { color: eq.color, costume: eq.costume, cls: 'avatar' })}
              <b>${score.me}</b><i>-</i><b>${score.cpu}</b>
              ${ninjaSvg(foeNinja.id, { cls: 'avatar flip' })}
            </div>
            ${scrollGainHtml(scrolls)}
            ${win ? rewardHtml(reward) : '<p class="note">もう一回 チャレンジしてみよう！</p>'}
          </div>
          <div class="result-right">
            <div class="stats">
              <div class="stat"><span>取った問題の平均</span><b>${avg === null ? '-' : avg.toFixed(2)}<small>秒</small></b></div>
              <div class="stat"><span>いちばん速い</span><b>${best === null ? '-' : best.toFixed(2)}<small>秒</small></b></div>
              <div class="stat"><span>ミス</span><b>${totalMiss}<small>回</small></b></div>
              <div class="stat"><span>正確さ</span><b>${acc}<small>%</small></b></div>
            </div>
            <div class="log-legend">
              <span><i style="background:var(--shu)"></i>${esc(me.name)}が取った</span>
              <span><i style="background:var(--ai)"></i>CPUが取った</span>
            </div>
            <div class="log-grid">
              ${log
                .map(
                  (r) =>
                    `<div class="lg ${r.winner}"><b>${esc(r.text)}</b><span>${r.pts > 1 ? `+${r.pts} ` : ''}${(r.ms / 1000).toFixed(2)}秒</span></div>`
                )
                .join('')}
            </div>
            <div class="buttons">
              ${canUp ? `<button class="btn primary" type="button" data-act="up">Lv${level + 1} にちょうせん</button>` : ''}
              <button class="btn ${canUp ? '' : 'primary'}" type="button" data-act="again">もう一回 <kbd>Enter</kbd></button>
              <button class="btn" type="button" data-act="setup">レベルをえらぶ</button>
              <button class="btn" type="button" data-act="title">タイトルへ</button>
            </div>
          </div>
        </div>
      </section>
    `;
    const on = (act, fn) => el.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn);
    on('again', () => go(showCpuBattle, { level, target, foe: foeNinja.id }));
    on('setup', () => go(showCpuSetup));
    on('title', () => go(showTitle));
    on('up', () => go(showCpuSetup, { level: level + 1 }));
    on('listen', () => sfx.preview(reward.id));
    on('equip', (e) => {
      equip(reward.kind, reward.id);
      sfx.click();
      e.currentTarget.textContent = 'そうびした！';
      e.currentTarget.disabled = true;
    });
    on('ninja', (e) => {
      setProfile(me.name, reward.id);
      sfx.click();
      e.currentTarget.textContent = 'かえた！';
      e.currentTarget.disabled = true;
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      go(showTitle);
      return;
    }
    if (phase === 'result') {
      if (e.key === 'Enter') {
        e.preventDefault();
        go(showCpuBattle, { level, target, foe: foeNinja.id });
      }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) tryMyJutsu();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) tryMyNinjutsu();
      return;
    }
    const k = readTypingKey(e);
    if (!k) return;
    if (k.ime) {
      imeWarn.hidden = false;
      return;
    }
    imeWarn.hidden = true;
    if (phase !== 'typing' && phase !== 'nidan') return;

    e.preventDefault();
    if (phase === 'typing' && cpuAlreadyDone()) return;
    if (performance.now() < stopUntil) return; // ミスのあと・こおらせの間は打てない
    if (matcher.input(k.char)) {
      totalKeys++;
      sfx.type();
      drawProgress(stage, myWord, matcher);
      spawnAt(eq.effect, stage.querySelector('.romaji .typed'));
      if (matcher.done) {
        if (phase === 'nidan') finishNidan(true);
        else endRound('me', performance.now() - t0);
      }
    } else {
      totalMiss++;
      roundMiss++;
      sfx.miss();
      shake(card);
      if (roundNj === 'suketto') keyHelp(card, matcher.rest[0]); // 助っ人の術：次のキーを光らせる
      if (roundJ.me !== 'teppeki') stopUntil = missStop(card); // 鉄壁の術なら止まらない
    }
  }

  window.addEventListener('keydown', onKey);
  drawScore();
  nextRound();

  return () => {
    window.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    timers.clear();
  };
}
