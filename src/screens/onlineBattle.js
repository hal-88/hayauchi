// みんなで対戦の本体。
// ・ホストが「問題」と「巻物が開くサーバー時刻（showAt）」を決める → 全員がその時刻に開く
// ・打ち切った人は rounds/r{n}/winner に早い者勝ちで書きこむ → サーバーが先に受けつけた1人だけが取れる
// ・点数は winner を数えて、全員が同じように計算する
// ・忍者の術：カウントダウン中に X キー → rounds/r{n}/jutsu/{uid} に書く → 全員の画面に「使った！」と効果
// ・忍術（発動型）：カウントダウン中にエンター → rounds/r{n}/nj/{uid}。1問に使える術は1つまで（忍び足の術だけは別）
// ・術どうしがぶつかったら先に押したほうが優先（clash.js）。効き目は巻物が開く直前（lock）に、全員の記録からまとめて決める
import { RomajiMatcher } from '../logic/romaji.js';
import { JUTSU_RULES, jutsuOf, jutsuName, canUseJutsu, shortenKana, leaderToSteal } from '../logic/jutsu.js';
import { jutsuChipHtml, showJutsuBanner, blurFor, freezeFor, hideKana, jutsuHintHtml, drawJutsuHint, nudgeHint, flashCard, smokeFor, wobbleFor, flipFor, showFake, keyHelp, showYokoku, clearYokoku } from '../ui/jutsuUi.js';
import { NJ_RULES, NJ_PASSIVE, PASSIVE_RULES, canUseNinjutsu, shoryakuKana, gozaruWord, joushaWord, extendWord, kakushidamaPoints, undameshiPick, kagenuiTargets, fakeWordFor, ninjaJutsuLimit, rengekiKana, kishikaiseiKana } from '../logic/ninjutsuRules.js';
import { effectiveActs, resolveHits, passivesOn, lastOthersAct } from '../logic/clash.js';
import { getNinjutsu } from '../data/ninjutsu.js';
import { WALL_JUTSU } from '../data/ninjas.js';
import { pickWords, WORDS } from '../data/words.js';
import { ONLINE } from '../online/config.js';
import { getDb, watchRoom, leaveRoom, sortedMembers, activeMembers, effectiveHost, scoresOf, pathOf } from '../online/room.js';
import { getEquip, getProfile, recordOnlineMatch, getMyNinjutsu } from '../progress/save.js';
import { scrollGainHtml } from '../ui/scrollUi.js';
import { sfx } from '../audio/sfx.js';
import { spawnAt } from '../ui/effects.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { STAMP_COOLDOWN_MS, stampIndexOf, stampBarHtml, showStamp, clearStamps } from '../ui/stamps.js';
import { shareButtonHtml, setupShare, closeSharePanel } from '../ui/share.js';
import { showTitle } from './title.js';
import { showOnlineMenu } from './online.js';
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

const roundKey = (n) => `r${n}`; // 数字だけのキーだと Firebase が配列にしてしまうので r をつける

export function showOnlineBattle(el, go, { code }) {
  el.innerHTML = `
    <section class="play battle online" data-nav="off">
      <div class="players"></div>
      ${SCROLL_HTML}
      <div class="rivals"></div>
      ${IME_WARN_HTML}
      <div class="play-foot">${jutsuHintHtml('X', 'jh-ninja')}${jutsuHintHtml('エンター', 'jh-nj')}<button class="btn small" type="button" data-act="quit">やめる</button></div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);
  const stage = $('.stage');
  const card = $('.card');
  const imeWarn = $('.ime-warn');
  const hintEl = $('.jh-ninja');
  const njHintEl = $('.jh-nj');
  setupShake(card);
  card.insertAdjacentHTML('beforeend', stampBarHtml()); // カウントダウン中に出るスタンプの案内
  const stampSeen = new Map(); // だれ → 最後に出したスタンプの時刻
  let stampAt = 0;

  const eq = getEquip();
  let db = null;
  let myUid = null;
  let room = null;
  let stop = null;
  let closed = false;

  // 今の問題
  let localRound = 0;
  let word = null;
  let myWord = null; // 自分が打つことば（術で長さが変わる）
  let matcher = null;
  let phase = 'wait'; // wait | countdown | typing | judging | nidan | roundEnd | over
  let t0 = 0;
  let roundEnded = false;
  let showAtCur = 0; // この問題が開くサーバー時刻
  let stopUntil = 0; // ミスのあと・こおらせの間は打てない（performance.now）
  const roundTimers = timerBag();

  // 術（この問題で押されたもの。二重押しよけと「1問1つまで」の判定用。効き目は lock() でまとめて決める）
  let roundJ = {}; // uid → 忍者の術ID
  let roundNj = {}; // uid → { id, sub, target }
  const announced = new Set();
  const njAnnounced = new Set();
  let previewed = false; // 先読み・忍耐の術で先に開いた
  let revealPerf = 0; // 開いた時刻（performance.now）
  let revealDelay = 0; // 影縫いの術でおそく見える時間
  let locked = false; // この問題の効き目を決めた
  const appliedHits = new Set(); // もうかけた じゃま術
  let myHitIds = new Set(); // 自分にかかった じゃま術
  let makibishiHit = false; // まきびし：最初のミスだけ長く止まる
  let secondShown = false; // 二段構えの +1 を出した
  let shurikenOnMe = false; // 前の問題で手裏剣を受けた
  let roundMiss = 0;
  let outThisRound = false; // 真剣勝負：この問題でまちがえたので、もう打てない
  const hard = () => !!room?.meta?.hard;

  // 自分の忍術
  const myNj = getNinjutsu(getMyNinjutsu());
  const myPassive = NJ_PASSIVE.has(myNj.id) ? myNj.id : null;
  let migawariLeft = myPassive === 'migawari';
  let migawariRoundStart = migawariLeft;
  let noMissWins = 0; // 達人
  let winStreak = 0; // 連撃
  let lossStreak = 0; // 忍耐
  let rengekiNext = false;
  let nintaiNext = false;

  const myJutsu = () => jutsuOf(room?.members?.[myUid]?.ninja);
  const order = () => sortedMembers(room).map(([u]) => u);
  const nameOf = (uid) => room?.members?.[uid]?.name || '？';
  const njName = (id) => getNinjutsu(id)?.name || jutsuName(id);

  // ---------- 術の記録から計算する ----------
  const roundsSorted = () =>
    Object.entries(room?.rounds || {})
      .map(([k, v]) => [+k.slice(1), v])
      .sort((a, b) => a[0] - b[0]);
  /** その問題で使われた術（運試し・写し身は、出た術／まねした術として） */
  function actsOf(rr) {
    const acts = [];
    for (const [uid, j] of Object.entries(rr?.jutsu || {})) acts.push({ uid, id: j.id, at: j.at });
    for (const [uid, n] of Object.entries(rr?.nj || {})) acts.push({ uid, id: n.sub || n.id, raw: n.id, at: n.at, target: n.target || null });
    return acts;
  }
  /** n問目より前に封印された人 */
  function sealedBefore(n) {
    let sealed = new Set();
    for (const [k, rr] of roundsSorted()) {
      if (k >= n) break;
      sealed = effectiveActs(actsOf(rr), sealed).sealed;
    }
    return sealed;
  }
  /** n問目がはじまる前の点数 */
  function scoresBefore(n) {
    const rounds = Object.fromEntries(Object.entries(room?.rounds || {}).filter(([k]) => +k.slice(1) < n));
    return scoresOf({ ...room, rounds });
  }
  /** この問題で効いている術 */
  function effNow() {
    return effectiveActs(actsOf(room?.rounds?.[roundKey(localRound)]), sealedBefore(localRound));
  }
  const myEffIds = () => new Set(effNow().eff.filter((a) => a.uid === myUid).map((a) => a.id));
  const passiveOn = () => !!myPassive && passivesOn(effNow().eff, myUid);
  const isSealed = (uid) => effNow().sealed.has(uid);
  // 忍者の術を使った回数と、使える回数（二刀流なら2回）
  const ninjaUses = (uid) => roundsSorted().filter(([, rr]) => rr?.jutsu?.[uid]).length;
  const ninjaLimit = (uid) => ninjaJutsuLimit(uid === myUid ? myNj.id : room?.members?.[uid]?.nj);
  const ninjaUsedUp = (uid) => ninjaUses(uid) >= ninjaLimit(uid);
  const njUsedBy = (uid) => roundsSorted().some(([, rr]) => rr?.nj?.[uid]);
  const myNjRoundId = () => (roundNj[myUid] ? roundNj[myUid].sub || roundNj[myUid].id : null);
  // 1問に使える術は1つまで（忍び足の術を使った問題だけは、忍者の術も使える）
  const ninjaBlocked = () => roundNj[myUid] && myNjRoundId() !== 'shinobiashi';
  const njBlocked = () => roundJ[myUid] && myNj.id !== 'shinobiashi';

  /** じゃま術がだれにかかるか */
  function targetsOf(a) {
    if (a.id === 'kagenui' || a.id === 'jousha') return kagenuiTargets(scoresBefore(localRound), a.uid, order()); // 1位の人
    if (a.id === 'shuriken') return []; // 手裏剣はつぎの問題で（setupRound）
    return activeMembers(room)
      .map(([u]) => u)
      .filter((u) => u !== a.uid);
  }

  // ---------- 表示 ----------
  function drawPlayers() {
    const target = room.meta.target;
    const scores = scoresOf(room);
    const members = sortedMembers(room);
    const sealed = room.game ? effNow().sealed : new Set();
    $('.players').style.setProperty('--n', members.length);
    $('.players').innerHTML = members
      .map(([uid, m]) => {
        const pts = scores[uid] || 0;
        const gone = !m.online || m.left;
        const left = ninjaLimit(uid) - ninjaUses(uid);
        return `<div class="pl ${uid === myUid ? 'me' : ''} ${gone ? 'off' : ''}" data-uid="${esc(uid)}">
          ${ninjaSvg(m.ninja, { color: m.color, costume: m.costume, cls: 'avatar' })}
          <div class="pl-info">
            <div class="pl-name">${jutsuChipHtml(m.ninja, left <= 0)}${ninjaLimit(uid) > 1 && left > 0 ? `<small>×${left}</small>` : ''}${
              sealed.has(uid) ? '<small class="sealed">封</small>' : ''
            } ${esc(m.name)}${uid === myUid ? ' <small>あなた</small>' : ''}${gone ? ' <small>ぬけた</small>' : ''}</div>
            <div class="dots">${Array.from({ length: target }, (_, i) => `<i class="${i < pts ? 'on' : ''}"></i>`).join('')}</div>
          </div>
          <b class="pts">${pts}</b>
        </div>`;
      })
      .join('');
  }

  function drawRivals(prog, out) {
    const others = sortedMembers(room).filter(([uid]) => uid !== myUid);
    const konoha = new Set(effNow().eff.filter((a) => a.id === 'konoha').map((a) => a.uid)); // 木の葉隠れの術
    $('.rivals').innerHTML = others
      .map(([uid, m]) => {
        const p = Math.max(0, Math.min(1, phase === 'countdown' ? 0 : prog?.[uid] || 0));
        const hidden = konoha.has(uid);
        const isOut = !!out?.[uid] && phase !== 'countdown';
        return `<div class="rv ${!m.online || m.left ? 'off' : ''} ${isOut ? 'out' : ''}">
          ${ninjaSvg(m.ninja, { color: m.color, costume: m.costume, cls: 'rv-ninja' })}
          <span class="rv-name">${esc(m.name)}${hidden ? ' <small>？？？</small>' : ''}${isOut ? ' <small class="rv-out">ミスで終わり</small>' : ''}</span>
          <div class="bar ${hidden ? 'hidden' : ''}"><i style="width:${(p * 100).toFixed(0)}%"></i></div>
        </div>`;
      })
      .join('');
  }

  function drawHint() {
    const id = myJutsu();
    if (!id || !room) return;
    const name = jutsuName(id);
    const left = ninjaLimit(myUid) - ninjaUses(myUid);
    if (isSealed(myUid)) drawJutsuHint(hintEl, name, 'used', '封印された');
    else if (left <= 0) drawJutsuHint(hintEl, name, 'used');
    else if (phase !== 'countdown') drawJutsuHint(hintEl, name, 'wait', left > 1 ? `あと${left}回` : '');
    else if (ninjaBlocked()) drawJutsuHint(hintEl, name, 'blocked', '1問に1つまで');
    else {
      const [mine, best] = myScoreAndBest();
      const c = canUseJutsu(id, mine, best);
      drawJutsuHint(hintEl, name, c.ok ? 'ready' : 'blocked', c.why);
    }
    const c = canUseNinjutsu(myNj.id);
    if (myPassive) drawJutsuHint(njHintEl, myNj.name, 'passive', passiveOn() ? 'ずっと効いている' : '刀狩りで止まっている');
    else if (!c.ok) drawJutsuHint(njHintEl, myNj.name, 'blocked', c.why);
    else if (isSealed(myUid)) drawJutsuHint(njHintEl, myNj.name, 'used', '封印された');
    else if (njUsedBy(myUid)) drawJutsuHint(njHintEl, myNj.name, 'used');
    else if (phase !== 'countdown') drawJutsuHint(njHintEl, myNj.name, 'wait');
    else if (njBlocked()) drawJutsuHint(njHintEl, myNj.name, 'blocked', '1問に1つまで');
    else drawJutsuHint(njHintEl, myNj.name, 'ready');
  }

  const myScoreAndBest = () => {
    const scores = scoresOf(room);
    const others = Object.entries(scores).filter(([u]) => u !== myUid).map(([, s]) => s);
    return [scores[myUid] || 0, Math.max(0, ...others)];
  };

  // ---------- 1問の流れ ----------
  function setupRound(g) {
    localRound = g.round;
    word = g.word;
    roundEnded = false;
    phase = 'countdown';
    roundTimers.clear();
    lastProg = 0;
    showAtCur = g.showAt;
    stopUntil = 0;
    roundJ = {};
    roundNj = {};
    announced.clear();
    njAnnounced.clear();
    appliedHits.clear();
    myHitIds = new Set();
    revealDelay = 0;
    locked = false;
    makibishiHit = false;
    secondShown = false;
    previewed = false;
    revealPerf = 0;
    roundMiss = 0;
    outThisRound = false;
    card.classList.remove('out');
    stage.querySelector('.out-msg')?.remove();
    migawariRoundStart = migawariLeft;
    card.classList.remove('peek');
    hideKana(card, false);
    clearYokoku(card);

    // 手裏剣の術：前の問題で取った人が2位に投げた（結界・鏡でふせげる。鏡ならはね返る）
    shurikenOnMe = false;
    const prev = room.rounds?.[roundKey(g.round - 1)];
    const pw = prev?.winner;
    if (pw?.shurikenTo) {
      const prevEff = effectiveActs(actsOf(prev), sealedBefore(g.round - 1)).eff;
      const res = resolveHits(myUid, prevEff, {
        targetsOf: (a) => (a.id === 'shuriken' && a.uid === pw.uid ? [pw.shurikenTo] : []),
        myPassives: passivesOn(prevEff, myUid) && myPassive ? new Set([myPassive]) : new Set(),
      });
      shurikenOnMe = res.hits.some((a) => a.id === 'shuriken');
    }
    myWord = shurikenOnMe ? extendWord(word) : word;
    matcher = new RomajiMatcher(myWord.kana);

    const scores = scoresOf(room);
    const reach = sortedMembers(room)
      .filter(([uid]) => (scores[uid] || 0) === room.meta.target - 1)
      .map(([uid]) => nameOf(uid));
    let label = reach.length ? `${reach.join('・')} あと1点！` : `${hard() ? '真剣勝負 ' : ''}第${g.round}問`;
    if (shurikenOnMe) label = '手裏剣で1文字ふえる！';

    const delay = g.showAt - db.now();
    const steps = Math.round(COUNTDOWN_MS / 1000); // 5・4・3・2・1
    for (let k = steps; k >= 1; k--) {
      const at = delay - k * 1000;
      if (at <= -1000) continue;
      roundTimers.later(() => {
        if (phase !== 'countdown') return;
        if (previewed) setCountdown(card, k, label);
        else closeScroll(card, k, label);
        sfx.count();
        drawHint();
      }, Math.max(0, at));
    }
    // 忍耐の術：3問つづけて取られたら、この問題が2秒早く見える
    if (nintaiNext) {
      nintaiNext = false;
      roundTimers.later(() => {
        if (passiveOn()) preview();
      }, Math.max(0, delay - JUTSU_RULES.previewMs));
    }
    // 開く少し前に術の効き目を決めて（lock）、そこからは画面の描きかえごとに時刻を見る
    const showAt = g.showAt;
    const round = g.round;
    roundTimers.later(() => {
      lock();
      const check = () => {
        if (phase !== 'countdown' || localRound !== round) return;
        if (db.now() >= showAt + revealDelay) reveal();
        else requestAnimationFrame(check);
      };
      check();
    }, Math.max(0, delay - 120));
    // 画面が裏にあって描きかえが止まっているとき用
    const fallback = () => {
      if (phase !== 'countdown' || localRound !== round) return;
      lock();
      const left = showAt + revealDelay - db.now();
      if (left <= 0) reveal();
      else roundTimers.later(fallback, left + 30);
    };
    roundTimers.later(fallback, Math.max(0, delay) + 50);
  }

  /** 自分が打つことばを決める（自分の術・受けたじゃま術・常時型） */
  function buildMyWord(myIds, hitIds) {
    let w = shurikenOnMe ? myWord : word;
    if (hitIds.has('jousha')) w = joushaWord(w); // 盛者必衰：2回つづけて
    if (hitIds.has('gozaru')) w = gozaruWord(w); // ござる
    if (myIds.has('tanshuku')) {
      const s = shortenKana(w.kana);
      w = { ...w, kana: s.kana, cut: s.cut };
    }
    if (myIds.has('shoryaku')) w = { ...w, kana: shoryakuKana(w.kana) };
    if (passiveOn()) {
      if (rengekiNext) {
        const r = rengekiKana(w.kana);
        w = { ...w, kana: r.kana, cut: (r.cut || '') + (w.cut || '') };
      }
      const [, best] = myScoreAndBest();
      if (myPassive === 'kishikaisei' && best === room.meta.target - 1) {
        const r = kishikaiseiKana(w.kana);
        w = { ...w, kana: r.kana, cut: (r.cut || '') + (w.cut || '') };
      }
    }
    return w;
  }

  /** 術の効き目を決める（先に押したほうが優先）。開く直前に1回、そのあと遅れて届いた術があればもう1回 */
  function lock() {
    if (!room || phase === 'over') return;
    const { eff } = effNow();
    const myIds = new Set(eff.filter((a) => a.uid === myUid).map((a) => a.id));
    const res = resolveHits(myUid, eff, {
      targetsOf,
      myPassives: passiveOn() ? new Set([myPassive]) : new Set(),
      migawariLeft: migawariRoundStart,
    });
    const hitIds = new Set(res.hits.map((a) => a.id));
    myHitIds = hitIds;
    if (!locked) {
      locked = true;
      migawariLeft = migawariRoundStart && !res.migawari;
      // ふせいだ・はね返した・身代わり を自分の画面に出す
      for (const a of res.blocked) showJutsuBanner(card, nameOf(myUid), myNj.name, true, `【${njName(a.id)}】をふせいだ！`);
      for (const a of res.reflected) showJutsuBanner(card, nameOf(myUid), '鏡の術', true, `${nameOf(a.uid)}の【${njName(a.id)}】をはね返した！`);
      if (res.migawari) showJutsuBanner(card, nameOf(myUid), '身代わりの術', true, `【${njName(res.migawari.id)}】を消した！`);
      for (const a of res.hits) if (a.reflectedBack) showJutsuBanner(card, nameOf(myUid), njName(a.id), false, '鏡ではね返された！');
      if (hitIds.has('kagenui')) revealDelay = NJ_RULES.kagenuiMs; // 影縫い：1秒おそく見える
      if (!previewed) {
        myWord = buildMyWord(myIds, hitIds);
        matcher = new RomajiMatcher(myWord.kana);
      }
      if (rengekiNext && passiveOn()) rengekiNext = false;
    }
    if (phase === 'typing') applyHits();
  }

  /** 受けたじゃま術を画面にかける（おくれて届いたら残りの時間だけ） */
  function applyHits() {
    for (const id of myHitIds) {
      if (appliedHits.has(id)) continue;
      appliedHits.add(id);
      const left = (ms) => Math.max(0, revealPerf + ms - performance.now());
      if (id === 'mekuramashi' && left(JUTSU_RULES.blurMs) > 0) blurFor(card, left(JUTSU_RULES.blurMs));
      if (id === 'koorase' && left(JUTSU_RULES.freezeMs) > 0) {
        stopUntil = Math.max(stopUntil, freezeFor(card, left(JUTSU_RULES.freezeMs)));
        sfx.freeze();
      }
      if (id === 'kakuremi') hideKana(card, true);
      if (id === 'kemuridama' && left(NJ_RULES.smokeMs) > 0) smokeFor(card, left(NJ_RULES.smokeMs));
      if (id === 'yurashi' && left(NJ_RULES.wobbleMs) > 0) wobbleFor(card, left(NJ_RULES.wobbleMs));
      if (id === 'sakasa' && left(NJ_RULES.flipMs) > 0) flipFor(card, left(NJ_RULES.flipMs));
      if (id === 'bunshin' && left(NJ_RULES.fakeMs) > 0) showFake(card, fakeWordFor(word, WORDS), left(NJ_RULES.fakeMs));
    }
  }

  function reveal() {
    if (phase !== 'countdown') return;
    lock();
    if (!previewed) {
      renderWord(stage, myWord);
      drawProgress(stage, myWord, matcher);
      openScroll(card);
      sfx.scroll();
    }
    card.classList.remove('peek');
    clearYokoku(card);
    phase = 'typing';
    t0 = performance.now();
    revealPerf = t0;
    // 瞬足の術：最初の3文字を自動で打つ
    if (myEffIds().has('shunsoku')) {
      for (let i = 0; i < NJ_RULES.shunsokuKeys && !matcher.done; i++) matcher.input(matcher.rest[0]);
      drawProgress(stage, myWord, matcher);
    }
    applyHits();
    drawHint();
  }

  /** 先読み・忍耐の術：自分だけ先に巻物が開く（打てるのはみんなと同じ時刻） */
  function preview() {
    if (phase !== 'countdown' || previewed) return;
    lock();
    previewed = true;
    clearYokoku(card);
    renderWord(stage, myWord);
    drawProgress(stage, myWord, matcher);
    card.classList.add('peek');
    openScroll(card, true);
    sfx.scroll();
  }

  // ---------- 術を使う ----------
  const tooLate = () => db.now() > showAtCur - JUTSU_RULES.lastCallMs; // 出る直前はもう使えない

  async function tryMyJutsu() {
    const id = myJutsu();
    if (!id) return;
    if (isSealed(myUid)) return nudgeHint(hintEl, '封印された');
    if (ninjaUsedUp(myUid)) return nudgeHint(hintEl, 'もう使った');
    if (phase !== 'countdown' || tooLate()) return nudgeHint(hintEl, 'カウントダウン中に');
    if (roundJ[myUid] || ninjaBlocked()) return nudgeHint(hintEl, '1問に1つまで');
    const [mine, best] = myScoreAndBest();
    if (!canUseJutsu(id, mine, best).ok) {
      sfx.miss();
      return;
    }
    roundJ[myUid] = id; // 二重押しよけ（本当の反映は部屋の変化で受けとる）
    const rec = { id, at: db.now() };
    if (myNjRoundId() === 'shinobiashi') rec.hidden = true; // 忍び足：使ったことを相手に見せない
    await db.claim(pathOf(code, `rounds/${roundKey(localRound)}/jutsu/${myUid}`), rec);
  }

  async function tryMyNinjutsu() {
    if (myPassive) return nudgeHint(njHintEl, 'セットするだけで効く');
    if (isSealed(myUid)) return nudgeHint(njHintEl, '封印された');
    if (njUsedBy(myUid)) return nudgeHint(njHintEl, 'もう使った');
    if (phase !== 'countdown' || tooLate()) return nudgeHint(njHintEl, 'カウントダウン中に');
    if (roundNj[myUid] || njBlocked()) return nudgeHint(njHintEl, '1問に1つまで');
    if (!canUseNinjutsu(myNj.id).ok) {
      sfx.miss();
      return;
    }
    const [mine, best] = myScoreAndBest();
    const rec = { id: myNj.id, at: db.now() };
    if (myNj.id === 'undameshi') rec.sub = undameshiPick(mine, best); // 運試し：出た忍者の術
    if (myNj.id === 'utsushimi') {
      // 写し身：自分以外が最後に使った術をまねる
      const all = roundsSorted().flatMap(([, rr]) => actsOf(rr));
      const copy = lastOthersAct(all, myUid);
      if (!copy || (copy === 'gyakuten' && !(mine < best))) {
        sfx.miss();
        drawJutsuHint(njHintEl, myNj.name, 'blocked', copy ? '負けているときだけまねできる' : 'まねする術がまだない');
        return;
      }
      rec.sub = copy;
    }
    if ((rec.sub || rec.id) === 'fuin') rec.target = leaderToSteal(scoresOf(room), myUid, order()); // 封印：1位の人
    roundNj[myUid] = rec; // 二重押しよけ
    await db.claim(pathOf(code, `rounds/${roundKey(localRound)}/nj/${myUid}`), rec);
  }

  // ---------- 術を受けとったとき（「使った！」を出す。効き目は lock で決める） ----------
  function onJutsu(uid, rec) {
    const mine = uid === myUid;
    roundJ[uid] = rec.id;
    if (mine || !rec.hidden) {
      showJutsuBanner(card, nameOf(uid), jutsuName(rec.id), mine, rec.hidden ? '（相手には見えない）' : '');
      flashCard(card);
      sfx.jutsu(mine);
    }
    if (mine && rec.id === 'sakiyomi') scheduleSakiyomi();
    afterActChange();
  }

  function onNinjutsu(uid, rec) {
    const mine = uid === myUid;
    roundNj[uid] = rec;
    const j = getNinjutsu(rec.id);
    if (!j) return;
    const eid = rec.sub || rec.id;
    const hidden = eid === 'shinobiashi'; // 忍び足の術は相手に見せない
    if (mine || !hidden) {
      let after = hidden ? '（相手には見えない）' : '';
      if (rec.id === 'undameshi') after = `→【${jutsuName(rec.sub)}】が出た！`;
      if (rec.id === 'utsushimi') after = `→【${njName(rec.sub)}】をまねした！`;
      if (eid === 'fuin' && rec.target) after += ` ${nameOf(rec.target)}を封印！`;
      showJutsuBanner(card, nameOf(uid), j.name, mine, after);
      flashCard(card);
      sfx.jutsu(mine);
    }
    if (mine) {
      if (eid === 'yokoku' && phase === 'countdown' && !previewed) showYokoku(card, word.kana[0]); // 予告
      if (eid === 'sakiyomi') scheduleSakiyomi(); // 運試し・写し身で先読みが出た
    }
    afterActChange();
  }

  function scheduleSakiyomi() {
    roundTimers.later(() => {
      if (myEffIds().has('sakiyomi')) preview(); // 刀狩り・封印で消えていなければ
    }, Math.max(0, showAtCur - JUTSU_RULES.previewMs - db.now()));
  }

  /** 術がふえたとき：開いたあとなら、おくれて届いたじゃま術をかける */
  function afterActChange() {
    if (locked) lock();
    drawHint();
  }

  // ---------- 打ち終わり ----------
  let lastProg = 0;
  let progTimer = 0;
  function sendProgress(force = false) {
    if (myEffIds().has('konoha') && !force) return; // 木の葉隠れの術：どこまで打ったか見せない
    const now = performance.now();
    const ratio = matcher.done ? 1 : matcher.typed.length / Math.max(1, matcher.typed.length + matcher.rest.length);
    const write = () => {
      lastProg = performance.now();
      progTimer = 0;
      db.set(pathOf(code, `rounds/${roundKey(localRound)}/prog/${myUid}`), Math.round(ratio * 100) / 100);
    };
    if (force || now - lastProg >= ONLINE.progressEveryMs) {
      clearTimeout(progTimer);
      write();
    } else if (!progTimer) {
      progTimer = setTimeout(write, ONLINE.progressEveryMs - (now - lastProg));
    }
  }

  async function finish() {
    phase = 'judging';
    const ms = Math.round(performance.now() - t0);
    sendProgress(true);
    stage.insertAdjacentHTML('beforeend', `<div class="judging">はんてい中…</div>`);
    const ids = myEffIds(); // 刀狩り・封印で消えた術は入らない
    // 鉄壁の術：ほかの人がこの問題で使っていたら、取っても点が入らない（逆転・達人もなし）
    const walledBy = effNow().eff.find((a) => a.uid !== myUid && WALL_JUTSU.has(a.id))?.uid || null; // 鉄壁・龍神の術
    const steal = !walledBy && ids.has('gyakuten') ? leaderToSteal(scoresOf(room), myUid, order()) : null;
    let pts = ids.has('bageki') || ids.has('ryujin') ? 2 : 1; // 倍撃・龍神の術
    if (ids.has('kakushidama')) pts = kakushidamaPoints(); // 隠し玉の術：0〜3点
    if (walledBy) pts = 0;
    // 手裏剣の術：2位（いちばん進んでいた人）の次の問題を1文字ふやす
    let shurikenTo = null;
    if (ids.has('shuriken')) {
      const prog = room.rounds?.[roundKey(localRound)]?.prog || {};
      shurikenTo = order().filter((u) => u !== myUid).sort((a, b) => (prog[b] || 0) - (prog[a] || 0))[0] || null;
    }
    // 達人の術：ノーミスで3問取るたびに +1点
    const bonus = !walledBy && passiveOn() && myPassive === 'tatsujin' && roundMiss === 0 && (noMissWins + 1) % PASSIVE_RULES.tatsujinWins === 0 ? 1 : null;
    await db.claim(pathOf(code, `rounds/${roundKey(localRound)}/winner`), {
      uid: myUid,
      ms,
      at: db.now(),
      pts,
      kd: (!walledBy && ids.has('kakushidama')) || null,
      wall: walledBy, // 鉄壁の術を使っていた人
      steal, // 逆転の術：この人から1点うばう
      shurikenTo,
      bonus,
    });
    // 結果は部屋の変化（onRoom）で受けとる
  }

  function onWinner(w) {
    roundEnded = true;
    roundTimers.clear();
    if (phase === 'countdown' && !previewed) {
      // 出る前に決まった（通信がおくれた など）ときも、ことばは見せる
      renderWord(stage, myWord);
      drawProgress(stage, myWord, matcher);
      openScroll(card);
    }
    const wasTyping = revealPerf > 0; // 自分の画面で巻物が開いていた
    card.classList.remove('peek');
    hideKana(card, false);
    phase = 'roundEnd';
    stage.querySelector('.judging')?.remove();
    log.push({ text: word.text, uid: w.uid || null, ms: w.ms });
    const sec = w.ms != null ? `${(w.ms / 1000).toFixed(2)}秒` : '';
    const pts = w.pts ?? 1;
    const wallId = w.wall ? effNow().eff.find((a) => a.uid === w.wall && WALL_JUTSU.has(a.id))?.id : null;
    const extra = `${w.wall ? `（${nameOf(w.wall)}の${wallId === 'ryujin' ? '龍神' : '鉄壁'}で0点）` : w.kd ? ` 隠し玉で${pts}点` : pts > 1 ? ` +${pts}点` : ''}${w.bonus ? ' 達人+1' : ''}${
      w.steal ? `（${nameOf(w.steal)}から1点うばった）` : ''
    }${w.shurikenTo ? `（${nameOf(w.shurikenTo)}に手裏剣）` : ''}`;
    if (w.uid === myUid) {
      card.classList.add('won');
      stage.insertAdjacentHTML('beforeend', stampHtml(`取った！${extra}`, sec));
      sfx.clear();
    } else if (w.uid) {
      card.classList.add('lost');
      stage.insertAdjacentHTML('beforeend', stampHtml(`${nameOf(w.uid)}が取った${extra}`, sec, true));
      sfx.lose();
    } else {
      stage.insertAdjacentHTML('beforeend', stampHtml(w.out ? 'みんなミス！だれも取れず' : 'だれも取れず', '', true));
    }
    // 常時型の数え
    if (w.uid === myUid) {
      winStreak++;
      lossStreak = 0;
      if (passiveOn() && myPassive === 'tatsujin' && roundMiss === 0 && !w.wall) noMissWins++;
      if (passiveOn() && myPassive === 'rengeki' && winStreak % PASSIVE_RULES.rengekiWins === 0) rengekiNext = true;
    } else if (w.uid) {
      lossStreak++;
      winStreak = 0;
      if (passiveOn() && myPassive === 'nintai' && lossStreak % PASSIVE_RULES.nintaiLosses === 0) nintaiNext = true;
    }
    // 二段構えの術：取られても、3秒以内に打ち切れば1点
    if (w.uid && w.uid !== myUid && myEffIds().has('nidan') && !matcher.done && wasTyping) {
      phase = 'nidan';
      stage.insertAdjacentHTML('beforeend', `<div class="judging">二段構え！3秒以内に打ち切れ！</div>`);
      const r = localRound;
      roundTimers.later(() => {
        if (phase === 'nidan' && localRound === r) {
          phase = 'roundEnd';
          stage.querySelector('.judging')?.remove();
        }
      }, NJ_RULES.nidanGraceMs);
    }
  }

  async function finishNidan() {
    phase = 'roundEnd';
    stage.querySelector('.judging')?.remove();
    await db.claim(pathOf(code, `rounds/${roundKey(localRound)}/second`), { uid: myUid, pts: 1, at: db.now() });
  }

  function onSecond(s) {
    if (secondShown) return;
    secondShown = true;
    stage.insertAdjacentHTML('beforeend', `<div class="judging done">${esc(nameOf(s.uid))} 二段構え +1点！</div>`);
    if (s.uid === myUid) sfx.clear();
  }

  // 自分の成績
  let myKeys = 0;
  let myMiss = 0;
  const log = []; // { text, uid, ms }
  let overShown = false;

  // ホストの仕事
  const hostTimers = timerBag();
  let scheduledRound = 0; // 次の問題を出す予約をした番号
  let timeoutRound = 0; // だれも取れないときの予約をした番号
  let outSkipRound = 0; // 真剣勝負で、みんながまちがえたときの予約をした番号
  let removeScheduled = false;
  const deck = [];

  // ---------- 試合のおわり ----------
  function overState() {
    if (!room || room.meta.status === 'lobby') return null;
    const scores = scoresOf(room);
    const max = Math.max(0, ...Object.values(scores));
    if (max >= room.meta.target) return 'target';
    if (isGone(room.members?.[myUid])) return 'cut'; // 自分の通信がきれていた → 負けでおしまい
    if (activeMembers(room).length < ONLINE.minPlayers) return 'alone';
    return null;
  }

  const isGone = (m) => !m || !m.online || m.left;
  let shareFn = null;
  function showResult(snapshot, reason) {
    phase = 'over';
    roundTimers.clear();
    const scores = scoresOf(snapshot);
    const members = sortedMembers(snapshot);
    // とちゅうでぬけた人・通信がきれた人は、点数があっても負け（順位なしで下にならべる）
    const all = members.map(([uid, m]) => ({ uid, m, pts: scores[uid] || 0, gone: isGone(m) }));
    const byPts = (a, b) => b.pts - a.pts;
    const stay = all.filter((r) => !r.gone).sort(byPts);
    const gone = all.filter((r) => r.gone).sort(byPts);
    // 同点は同じ順位
    let rank = 0;
    stay.forEach((r, i) => {
      if (i === 0 || r.pts < stay[i - 1].pts) rank = i + 1;
      r.rank = rank;
    });
    const ranked = [...stay, ...gone];
    const me = ranked.find((r) => r.uid === myUid);
    const iGone = !me || me.gone;
    const myRank = iGone ? ranked.length : me.rank;
    myRank === 1 ? sfx.finish() : sfx.matchLose();
    const scrolls = recordOnlineMatch(myRank);
    const mine = log.filter((l) => l.uid === myUid);
    const avg = mine.length ? mine.reduce((a, l) => a + l.ms, 0) / mine.length / 1000 : null;
    const acc = myKeys + myMiss ? Math.round((myKeys / (myKeys + myMiss)) * 100) : 100;

    el.innerHTML = `
      <section class="result panel-page">
        <div class="result-grid">
          <div class="result-left">
            <div class="verdict ${myRank === 1 && !iGone ? 'win' : 'lose'}">${iGone ? '負け' : myRank === 1 ? '1位！' : `${myRank}位`}</div>
            ${
              iGone
                ? '<p class="note">通信がきれたので、負けになったよ</p>'
                : reason === 'alone'
                  ? '<p class="note">ほかの人がぬけたので、ここでおしまい</p>'
                  : ''
            }
            ${scrollGainHtml(scrolls)}
            <ol class="ranking">
              ${ranked
                .map(
                  (r) => `<li class="${r.uid === myUid ? 'me' : ''} ${r.gone ? 'off' : ''}">
                    <span class="rk">${r.gone ? '負け' : `${r.rank}位`}</span>
                    ${ninjaSvg(r.m.ninja, { color: r.m.color, costume: r.m.costume, cls: 'rk-ninja' })}
                    <b>${esc(r.m.name)}${r.gone ? ' <small>ぬけた</small>' : ''}</b>
                    <span class="rk-pts">${r.pts}点</span>
                  </li>`
                )
                .join('')}
            </ol>
          </div>
          <div class="result-right">
            <div class="stats">
              <div class="stat"><span>取った問題</span><b>${mine.length}<small>問</small></b></div>
              <div class="stat"><span>取ったときの平均</span><b>${avg === null ? '-' : avg.toFixed(2)}<small>秒</small></b></div>
              <div class="stat"><span>ミス</span><b>${myMiss}<small>回</small></b></div>
              <div class="stat"><span>正確さ</span><b>${acc}<small>%</small></b></div>
            </div>
            <div class="log-legend"><span><i style="background:var(--shu)"></i>あなたが取った</span><span><i style="background:var(--ai)"></i>ほかの人</span></div>
            <div class="log-grid">
              ${log
                .map(
                  (l) => `<div class="lg ${l.uid === myUid ? 'me' : l.uid ? 'cpu' : ''}"><b>${esc(l.text)}</b><span>${
                    l.uid ? esc(snapshot.members?.[l.uid]?.name || '？') : 'なし'
                  }</span></div>`
                )
                .join('')}
            </div>
          </div>
        </div>
        <div class="buttons result-foot">
          <button class="btn primary" type="button" data-act="online">みんなでたいせんへ <kbd>Enter</kbd></button>
          ${shareButtonHtml()}
          <button class="btn" type="button" data-act="title">タイトルへ</button>
        </div>
      </section>
    `;
    el.querySelector('[data-act="online"]').addEventListener('click', () => go(showOnlineMenu));
    el.querySelector('[data-act="title"]').addEventListener('click', () => go(showTitle));
    const myM = snapshot.members?.[myUid] || getProfile();
    shareFn = setupShare(
      el,
      {
        mode: `みんなでたいせん${snapshot.meta?.hard ? '・真剣勝負' : ''} ${ranked.length}人`,
        headline: iGone ? '負け…' : `${myRank}位${myRank === 1 ? '！' : ''}`,
        sub: `${me?.pts ?? 0}点（${snapshot.meta?.target ?? ''}点先取${snapshot.meta?.hard ? '・真剣勝負' : ''}）`,
        lines: [`取った問題 ${mine.length}問・正確さ ${acc}%`],
        name: myM.name,
        ninja: myM.ninja,
        color: myM.color || eq.color,
        costume: myM.costume || eq.costume,
        win: myRank === 1 && !iGone,
      },
      iGone ? `はやうち忍者の みんなでたいせんに ${ranked.length}人で ちょうせん！` : `はやうち忍者の みんなでたいせんで ${ranked.length}人中 ${myRank}位！`
    );
  }

  function showGone() {
    phase = 'over';
    closed = true;
    stop?.();
    roundTimers.clear();
    hostTimers.clear();
    el.innerHTML = `
      <section class="result panel-page">
        <h2>部屋がなくなりました</h2>
        <p class="note">ホストの通信がきれたか、みんな出ていったみたい</p>
        <div class="buttons"><button class="btn primary" type="button" data-act="online">みんなでたいせんへ</button></div>
      </section>`;
    el.querySelector('[data-act="online"]').addEventListener('click', () => go(showOnlineMenu));
  }

  // ---------- ホストの仕事（だれがホストでも同じように動く） ----------
  function nextWord() {
    if (!deck.length) deck.push(...pickWords(60));
    return deck.pop();
  }

  async function hostStartRound(n) {
    if (closed || overShown || !room || effectiveHost(room) !== myUid || overState()) return;
    const w = nextWord();
    // key＝今の問題の場所（r1, r2…）。ルールで「今の問題にだけ点を書ける」ようにするのに使う
    await db.set(pathOf(code, 'game'), { round: n, key: roundKey(n), word: { text: w.text, kana: w.kana }, showAt: db.now() + COUNTDOWN_MS + ONLINE.revealBufferMs });
  }

  function hostDuties() {
    if (effectiveHost(room) !== myUid) return;
    if (room.meta.host !== myUid) db.update(pathOf(code, 'meta'), { host: myUid }); // ホストのひきつぎ

    const over = overState();
    if (over) {
      if (room.meta.status !== 'done') db.update(pathOf(code, 'meta'), { status: 'done' });
      if (!removeScheduled) {
        removeScheduled = true;
        // 試合が終わったら部屋のデータは消す（みんなの結果画面が出てから）
        hostTimers.later(() => db.remove(pathOf(code)), ONLINE.removeRoomAfterMs);
      }
      return;
    }
    const g = room.game;
    if (!g) {
      if (scheduledRound < 1) {
        scheduledRound = 1;
        hostStartRound(1);
      }
      return;
    }
    const rr = room.rounds?.[roundKey(g.round)];
    const winner = rr?.winner;
    if (winner) {
      if (scheduledRound < g.round + 1) {
        scheduledRound = g.round + 1;
        // 二段構えの術を使った人がいたら、打ち切るのを待つ
        const nidan = Object.entries(rr.nj || {}).some(([u, rec]) => rec?.id === 'nidan' && u !== winner.uid);
        hostTimers.later(() => hostStartRound(g.round + 1), nidan ? NJ_RULES.nidanGraceMs + 600 : ONLINE.roundEndMs);
      }
    } else {
      // 真剣勝負：いる人みんながまちがえたら、待たずに「だれも取れず」
      const act = activeMembers(room).map(([u]) => u);
      if (hard() && outSkipRound < g.round && act.length && act.every((u) => rr?.out?.[u])) {
        outSkipRound = g.round;
        const r = g.round;
        hostTimers.later(() => {
          if (closed || overShown || !room || room.game?.round !== r || room.rounds?.[roundKey(r)]?.winner) return;
          db.claim(pathOf(code, `rounds/${roundKey(r)}/winner`), { uid: null, skip: true, out: true, at: db.now() });
        }, 900);
      }
    }
    if (!winner && timeoutRound < g.round) {
      timeoutRound = g.round;
      const r = g.round;
      hostTimers.later(() => {
        // もう決まっている・次の問題に進んだ・部屋が消えた ときは何もしない
        if (closed || overShown || !room || room.game?.round !== r || room.rounds?.[roundKey(r)]?.winner) return;
        db.claim(pathOf(code, `rounds/${roundKey(r)}/winner`), { uid: null, skip: true, at: db.now() });
      }, Math.max(0, g.showAt + ONLINE.roundTimeoutMs - db.now()));
    }
  }

  // ---------- 部屋の変化 ----------
  function onRoom(r) {
    if (closed) return;
    if (!r) {
      if (!overShown) showGone();
      return;
    }
    room = r;
    if (overShown) return;
    const g = r.game;
    if (g && g.round !== localRound) setupRound(g);
    drawPlayers();
    const rr = g ? r.rounds?.[roundKey(g.round)] : null;
    // この問題で新しく使われた術
    if (g && localRound === g.round && rr?.jutsu) {
      for (const [uid, j] of Object.entries(rr.jutsu)) {
        if (announced.has(uid)) continue;
        announced.add(uid);
        onJutsu(uid, j);
      }
    }
    if (g && localRound === g.round && rr?.nj) {
      for (const [uid, rec] of Object.entries(rr.nj)) {
        if (njAnnounced.has(uid)) continue;
        njAnnounced.add(uid);
        onNinjutsu(uid, rec);
      }
    }
    if (g && rr?.winner && !roundEnded && localRound === g.round) onWinner(rr.winner);
    if (g && rr?.second && localRound === g.round) onSecond(rr.second);
    // スタンプ：この問題で新しく届いたもの
    if (g && localRound === g.round && rr?.stamp) {
      for (const [uid, st] of Object.entries(rr.stamp)) {
        if (stampSeen.get(uid) === st.at) continue;
        stampSeen.set(uid, st.at);
        if (uid !== myUid) {
          showStamp(el.querySelector(`.pl[data-uid="${uid}"] .avatar`), st.s, uid);
          sfx.click();
        }
      }
    }
    drawRivals(rr?.prog, rr?.out);
    drawHint();

    const over = overState();
    if (over && !overShown) {
      overShown = true;
      db.cancelOnDisconnect(); // 部屋はこのあと消えるので、切れたときの書きこみはもういらない
      const snapshot = JSON.parse(JSON.stringify(r));
      roundTimers.later(() => showResult(snapshot, over), over === 'target' ? ONLINE.roundEndMs : 300);
    }
    hostDuties();
  }

  // ---------- スタンプ（カウントダウン中に F〜L） ----------
  function sendStamp(i) {
    const now = performance.now();
    if (!db || now - stampAt < STAMP_COOLDOWN_MS) return;
    stampAt = now;
    const at = db.now();
    stampSeen.set(myUid, at); // 自分のはすぐ出す（届いたときに2回出さない）
    showStamp(el.querySelector(`.pl[data-uid="${myUid}"] .avatar`), i, myUid);
    sfx.click();
    Promise.resolve(db.set(pathOf(code, `rounds/${roundKey(localRound)}/stamp/${myUid}`), { s: i, at })).catch(() => {});
  }

  // ---------- キー入力 ----------
  function onKey(e) {
    if (phase === 'over') {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        shareFn?.();
        return;
      }
      if (e.key === 'Enter') go(showOnlineMenu);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      quit(); // やめる（部屋から出る）
      return;
    }
    // 忍者の術：X キー（カウントダウン中だけ。打っている間の x はふつうに文字として打つ）。スペースでも出る
    const si = stampIndexOf(e);
    if (si >= 0 && phase === 'countdown') {
      e.preventDefault();
      sendStamp(si);
      return;
    }
    const isX = (e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === ' ' || (isX && phase !== 'typing' && phase !== 'nidan')) {
      e.preventDefault();
      if (!e.repeat) tryMyJutsu();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) tryMyNinjutsu(); // 忍術はカウントダウン中にエンター
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
    if (outThisRound) return; // 真剣勝負：まちがえたので、この問題はもう打てない
    if (performance.now() < stopUntil) return; // ミスのあと・こおらせの間は打てない
    if (matcher.input(k.char)) {
      myKeys++;
      sfx.type();
      drawProgress(stage, myWord, matcher);
      spawnAt(eq.effect, stage.querySelector('.romaji .typed'));
      if (matcher.done) phase === 'nidan' ? finishNidan() : finish();
      else if (phase === 'typing') sendProgress();
    } else if (k.char === 'x' || k.char === 'X') {
      // 術の X を巻物が開いてから押した（ここでは x を打てない）→ ミスにしないで、術の案内で知らせる
      nudgeHint(hintEl, 'カウントダウン中に');
    } else {
      myMiss++;
      roundMiss++;
      sfx.miss();
      shake(card);
      if (hard()) {
        knockOut();
        return;
      }
      const ids = myEffIds();
      if (ids.has('suketto')) keyHelp(card, matcher.rest[0]); // 助っ人の術：次のキーを光らせる
      // ふだんはミスしても止まらない。まきびしの術を受けていたら、最初のミスだけ0.5秒止まる
      if (!makibishiHit && myHitIds.has('makibishi')) {
        makibishiHit = true;
        stopUntil = Math.max(stopUntil, missStop(card, NJ_RULES.makibishiMs));
      }
    }
  }

  /** 真剣勝負：まちがえたので、この問題はここまで */
  function knockOut() {
    outThisRound = true;
    card.classList.add('out');
    stage.insertAdjacentHTML('beforeend', '<div class="out-msg"><b>ミス！</b><span>この問題はここまで</span></div>');
    db.set(pathOf(code, `rounds/${roundKey(localRound)}/out/${myUid}`), true);
  }

  async function quit() {
    if (closed) return;
    closed = true;
    stop?.();
    await leaveRoom(code);
    go(showOnlineMenu);
  }

  $('[data-act="quit"]').addEventListener('click', quit);
  window.addEventListener('keydown', onKey);

  (async () => {
    db = await getDb();
    myUid = db.uid;
    stop = await watchRoom(code, onRoom);
  })();

  return () => {
    window.removeEventListener('keydown', onKey);
    clearStamps();
    closeSharePanel();
    roundTimers.clear();
    clearTimeout(progTimer);
    const wasHost = room && effectiveHost(room) === myUid;
    hostTimers.clear();
    stop?.();
    if (!closed) {
      closed = true;
      // 結果画面から出るとき：ホストならすぐ部屋を消す。とちゅうで出たら「ぬけた」にする
      if (overShown && wasHost) db?.remove(pathOf(code));
      else if (!overShown) leaveRoom(code);
      else db?.cancelOnDisconnect();
    }
  };
}
