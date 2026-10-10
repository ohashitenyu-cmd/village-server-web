/*!
 * mura-neko.js — 村のネコ「タマ」 チャットAI用アバター
 * 依存なしの Web Component。<script src="mura-neko.js"></script> で読み込むだけで使えます。
 *
 *   <mura-neko mood="happy" follow></mura-neko>
 *   <mura-neko crop="bust"></mura-neko>                     // 頭まわりだけ（丸いアイコン用）
 *
 *   const tama = document.querySelector('mura-neko');
 *   tama.setMood('love');                                   // 表情
 *   tama.play('tilt');                                      // 動き
 *   await tama.speak('[happy]こんにちは！', { onChar: c => out.textContent += c });
 *   tama.feed(chunk); await tama.end();                     // LLMのストリーミング
 *   tama.connectAudio(audioElement);                        // 音声の音量で口パク
 */
(() => {
  'use strict';
  if (!window.customElements || customElements.get('mura-neko')) return;

  /* ---------------- 形 ---------------- */
  // ほおがふっくら張った横長の頭と、前足をしまって丸くなった「香箱座り」の体
  const HEAD = 'M120 44C92 44 70 47 59 61C49 75 44 88 42 100Q36 104 33.5 109Q33 111 35 112L42 115Q37 120 34.5 125Q34 127 36 127.8L46 130C58 146 90 154 120 154C150 154 182 146 194 130L204 127.8Q206 127 205.5 125Q203 120 198 115L205 112Q207 111 206.5 109Q204 104 198 100C196 88 191 75 181 61C170 47 148 44 120 44Z';
  const BODY = 'M64 128C44 142 36 176 40 199C42 213 62 219 120 219C178 219 198 213 200 199C204 176 196 142 176 128Z';
  // しっぽは体の右うしろから前へ巻きつけ、先は「かぎしっぽ」。先だけがぴくぴく動く
  const TAIL_BACK = 'M184 196C200 196 212 202 213 212';
  const TAIL_FRONT = 'M213 212C214 220 206 223.5 194 224C180 224.5 168 223.5 160 221.5';
  const TAIL_B = 'M160 221.5C154 220 150 217 149 212';
  const TAIL_TIP = 'M149 212C148.5 208.5 150.5 206 154 205.5';
  const HEART = 'M0 6C-9-.5-8.5-9-3.2-9C-1.2-9 0-7.6 0-6.4C0-7.6 1.2-9 3.2-9C8.5-9 9-.5 0 6Z';
  const DROP = 'M0-7C3-2 5.5 1.5 5.5 4A5.5 5.5 0 0 1-5.5 4C-5.5 1.5-3-2 0-7Z';
  const DIAMOND = 'M0-8L5.5 0 0 8-5.5 0Z';
  const NOTE = '<ellipse rx="5" ry="4" transform="rotate(-20)"/><rect x="3" y="-17" width="2.6" height="17" rx="1.3"/><path d="M5.6-17C10-16 12.5-12 11.5-8 10.5-11 8.5-12.5 5.6-12.5Z"/>';

  /* ---------------- 表情と動き ----------------
     lid: [上まぶたの下がり px, 左の傾き deg, 右の傾き deg]
     low: 下まぶたの上がり px（マイナスで上がる）
     pupil: [瞳孔の横幅, 縦幅]（ネコらしく、怒ると細く、驚くと丸く）
     lips: [ω の幅, くぼみ, 口角]（口角マイナスで上がる）
     base: [口の開き 0〜1, 口の幅 0〜1]（しゃべっていない時）
     look: 目線の初期値 [x, y]（-1〜1） */
  const MOODS = {
    // ふだんはジト目（まぶたが平らに半分かぶさり、丸い瞳孔がその下からのぞく）。下まぶたは上げない
    // happy は目を閉じた「^ ^」、smug は閉じた「u u」の目に切り替わる（CSS の .smile-eye）
    neutral:   { lid: [11, 0, 0],    low: 0,   eye: 1.08, pupil: [.95, .8], blush: .55, lips: [8, 3, 2],     base: [0, .55],   tail: 2.8 },
    happy:     { lid: [0, 0, 0],     low: 0,   eye: 1.08, pupil: [.95, .85], blush: .8, lips: [12, 6, -3],   base: [.35, .85], tail: 1.4 },
    excited:   { lid: [0, 0, 0],     low: 0,   eye: 1.16, pupil: [1, .9],   blush: .8,  lips: [12, 6, -3],   base: [.7, .9],   tail: .8 },
    love:      { lid: [2, 0, 0],     low: 0,   eye: 1.12, pupil: [.8, 1],   blush: 1,   lips: [11, 6, -2],   base: [.22, .7],  tail: 2 },
    sad:       { lid: [9, -14, 14],  low: 0,   eye: 1.08, pupil: [.95, .85], blush: .3,  lips: [8, 0, 4],    base: [0, .5],    tail: 4.5, look: [0, .45] },
    angry:     { lid: [11, 22, -22], low: 0,   eye: 1.06, pupil: [.5, .85], blush: 0,   lips: [9, 0, 3],     base: [.15, .55], tail: .45 },
    sleepy:    { lid: [21, 0, 0],    low: 0,   eye: 1.08, pupil: [.95, .8], blush: .5,  lips: [8, 3, 1],     base: [0, .5],    tail: 5,   look: [0, .5] },
    surprised: { lid: [0, 0, 0],     low: 0,   eye: 1.2,  pupil: [1, .8],   blush: .5,  lips: [6, 3, 1],     base: [.6, .32],  tail: 1.1 },
    thinking:  { lid: [9, -3, 3],    low: 0,   eye: 1.08, pupil: [.95, .8], blush: .5,  lips: [7, 2, 1.5],   base: [0, .5],    tail: 3,   look: [.55, -.4] },
    smug:      { lid: [0, 0, 0],     low: 0,   eye: 1.08, pupil: [.95, .8], blush: .6,  lips: [10, 5, -1.5], base: [0, .6],    tail: 2.2, look: [.25, 0] },
    shy:       { lid: [8, -6, 6],    low: 0,   eye: 1.08, pupil: [.95, .9], blush: 1,   lips: [6, 3, 1.5],   base: [0, .5],    tail: 1.8, look: [-.65, .45] },
  };
  const ACTIONS = { nod: 900, shake: 900, tilt: 1200, jump: 800, dance: 1600, bow: 1500, yawn: 2400 };
  const YAWN_MOUTH = { o: 1.2, w: .5 };

  /* ---------------- 口の形（母音） ---------------- */
  const SHAPES = {
    a: { o: 1, w: .78 }, i: { o: .38, w: 1 }, u: { o: .5, w: .32 }, e: { o: .62, w: .88 },
    o: { o: .84, w: .46 }, n: { o: .12, w: .5 }, x: { o: 0, w: .6 },
  };
  const CLOSED = SHAPES.x;
  const VOWEL = {};
  for (const [v, s] of Object.entries({
    a: 'あかさたなはまやらわがざだばぱぁゃゎ',
    i: 'いきしちにひみりぎじぢびぴぃ',
    u: 'うくすつぬふむゆるぐずづぶぷぅゅゔ',
    e: 'えけせてねへめれげぜでべぺぇ',
    o: 'おこそとのほもよろをごぞどぼぽぉょ',
  })) for (const ch of s) VOWEL[ch] = v;
  const SMALL = 'ぁぃぅぇぉゃゅょゎ';
  const KANJI = /[㐀-鿿豈-﫿々〆]/;

  const toHira = ch => {
    const c = ch.charCodeAt(0);
    return c >= 0x30A1 && c <= 0x30F6 ? String.fromCharCode(c - 0x60) : ch;
  };
  const rv = () => 'aiueo'[Math.random() * 5 | 0];

  // 1文字 → [[母音, 長さ(拍)], ...]
  function beatsFor(ch, last) {
    const h = toHira(ch);
    if (VOWEL[h]) return [[VOWEL[h], SMALL.includes(h) ? .5 : 1]];
    if (h === 'ん') return [['n', .9]];
    if (h === 'っ') return [['x', .6]];
    if ('ー〜～'.includes(h)) return [[last, 1]];
    if (KANJI.test(ch)) return [[rv(), .85], [rv(), .85]];
    if (/[aiueo]/i.test(ch)) return [[ch.toLowerCase(), .55]];
    if (/[a-z]/i.test(ch)) return [[/[mbp]/i.test(ch) ? 'x' : /[wqu]/i.test(ch) ? 'u' : 'e', .4]];
    if (/[0-9０-９]/.test(ch)) return [[rv(), .7], [rv(), .7]];
    if (/[、，,；;：:]/.test(ch)) return [['x', 2.4]];
    if (/[。．.!?！？…]/.test(ch)) return [['x', 3.6]];
    if (ch === '\n') return [['x', 3]];
    if (/\s/.test(ch)) return [['x', .5]];
    return [['x', .35]];
  }

  // "[happy]こんにちは" → [{tag:'happy'}, {ch:'こ'}, ...]  知らないタグは文字のまま
  const TAG = /\[([a-z]+)\]/gi;
  function tokenize(text) {
    const out = [];
    let i = 0, m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(text))) {
      const name = m[1].toLowerCase();
      if (!MOODS[name] && !ACTIONS[name]) continue;
      for (const ch of text.slice(i, m.index)) out.push({ ch });
      out.push({ tag: name });
      i = m.index + m[0].length;
    }
    for (const ch of text.slice(i)) out.push({ ch });
    return out;
  }

  const f = n => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MEDIA_NODES = new WeakMap();
  let sharedCtx = null;
  let uid = 0;

  /* ---------------- スタイル ---------------- */
  const CSS = `
:host{
  /* 毛色：焚き火に照らされたこはく色。線は夜空の藍、口元と胸は炎のクリーム、目・首輪・鈴はロゴの色 */
  --neko-fur:#EFA93E; --neko-stripe:#D9822F;
  --neko-cream:#F3EEE3; --neko-cream-dark:#D9CDB8; --neko-ear:#F6A7B0; --neko-nose:#EE6A7E;
  --neko-iris:#40C68B; --neko-iris-light:#A8E9C9; --neko-eye:#161827; --neko-eyeline:#1E2138;
  --neko-mouth:#4A1F33; --neko-tongue:#F27C8E; --neko-line:#2C3060; --neko-whisker:#8C87A3;
  --neko-collar:#EE395B; --neko-bell:#F2BC1B; --neko-bell-dark:#A87C00; --neko-shadow:rgba(22,24,39,.14);
  display:inline-block; width:var(--neko-size,200px); aspect-ratio:260/256; line-height:0; vertical-align:bottom;
  -webkit-tap-highlight-color:transparent;
}
:host([crop="bust"]){aspect-ratio:1/1}
:host([crop="bust"]) .shadow{display:none}
.cat,svg{display:block;width:100%;height:100%}
svg{overflow:visible}
.fur{fill:var(--neko-fur)}
.cream{fill:var(--neko-cream)} .ear-in{fill:var(--neko-ear)} .nose{fill:var(--neko-nose)}
.bean{fill:var(--neko-ear)} .iris{fill:var(--neko-iris)} .iris-l{fill:var(--neko-iris-light)}
.ink{fill:var(--neko-eye)} .hl{fill:#fff}
.collar{fill:var(--neko-collar)} .bell{fill:var(--neko-bell)} .bell-d{fill:var(--neko-bell-dark)}
.shadow{fill:var(--neko-shadow)} .mouth-open{fill:var(--neko-mouth)} .tongue{fill:var(--neko-tongue)} .fangs{fill:#fff}
.paw{fill:var(--neko-cream);stroke:var(--neko-cream-dark);stroke-width:1.4}
.st{fill:none;stroke-linecap:round;stroke-linejoin:round}
.butt{stroke-linecap:butt}
.st-fur{stroke:var(--neko-fur)} .st-stripe{stroke:var(--neko-stripe)}
.st-tail{stroke:var(--neko-fur)} .st-ring,.st-tip{stroke:var(--neko-stripe)}
.st-cream{stroke:var(--neko-cream-dark)} .st-light{stroke:var(--neko-cream)} .st-line{stroke:var(--neko-line)} .st-bell{stroke:var(--neko-bell-dark)}
.wh{stroke:var(--neko-whisker);opacity:.8}
.smile-eye{fill:var(--neko-eyeline);stroke:var(--neko-eyeline);stroke-width:2.2;stroke-linejoin:round;opacity:0;transition:opacity .15s}
.smile-lash{fill:none;stroke-linecap:round}
.rim{fill:none;stroke:var(--neko-eyeline)}
.lidline{fill:none;stroke:var(--neko-eyeline);stroke-width:2.6;stroke-linecap:round}
.lid-low{stroke:none}
.blush{fill:#F48A9E;opacity:var(--blush,.35);transition:opacity .4s}
.heart-eye{fill:#EE395B} .heart{fill:#EE395B}
.sp1{fill:#EFBB0C;stroke:#EFBB0C} .sp2{fill:#40C68B;stroke:#40C68B} .sp3{fill:#A257EB;stroke:#A257EB}
.sp1,.sp2,.sp3{stroke-width:2.5;stroke-linejoin:round}
.z,.q,.ex{font-family:"Arial Rounded MT Bold","Hiragino Maru Gothic ProN",system-ui,sans-serif;font-weight:900}
.z{fill:#A257EB} .q{fill:#009ACF} .ex{fill:#EE395B}
.steam{fill:#C9C6D6} .vein{stroke:#EE395B} .burst{stroke:#EFBB0C}
.tear,.sweat,.tearpool{fill:#4FB6E8} .note{fill:#009ACF}

.rig,.motion,.body-g,.neck,.head,.face,.ear,.tail-tip,.bell-g,.eye-scale,.eye-blink,.lid,.pupil-n,.pupil-h,.shadow{transform-box:view-box}
/* 伸び縮みするのは胴体だけ。頭は形を変えず、上下と傾きだけで動かす */
.rig,.motion,.body-g{transform-origin:120px 219px}
.shadow{transform-origin:120px 220px}
.motion{transition:transform .45s cubic-bezier(.3,1.4,.5,1)}
.body-g{animation:breathe 3.4s ease-in-out infinite}
.neck{animation:breatheNeck 3.4s ease-in-out infinite}
.head{transform-origin:120px 150px;transition:transform .4s cubic-bezier(.3,1.4,.5,1)}
.face{transition:transform .35s ease}
.tail-tip{transform-origin:160px 221.5px;animation:tailTip var(--tail-dur,2.6s) ease-in-out infinite alternate}
.ear{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
.ear-l{transform-origin:78px 64px} .ear-r{transform-origin:162px 64px}
.bell-g{transform-origin:120px 159px}

.eye-l .eye-scale,.eye-l .eye-blink,.eye-l .lid{transform-origin:87px 101px}
.eye-r .eye-scale,.eye-r .eye-blink,.eye-r .lid{transform-origin:153px 101px}
.eye-l .pupil-n,.eye-l .pupil-h{transform-origin:88.5px 101.5px}
.eye-r .pupil-n,.eye-r .pupil-h{transform-origin:151.5px 101.5px}
.eye-scale{transform:scale(var(--eye-s,1));transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.eye-blink{transition:transform 70ms ease-in}
.blink .eye-blink{transform:scaleY(.08)}
.lid-up,.lid-low{transition:transform .3s cubic-bezier(.3,1.3,.5,1)}
.eye-l .lid-up{transform:translateY(var(--lid-y,0px)) rotate(var(--lid-rl,0deg))}
.eye-r .lid-up{transform:translateY(var(--lid-y,0px)) rotate(var(--lid-rr,0deg))}
.lid-low{transform:translateY(var(--low-y,0px))}
.pupil-n{transform:scale(var(--pupil-sx,.68),var(--pupil-sy,1));transition:transform .3s cubic-bezier(.3,1.4,.5,1),opacity .2s}
.pupil-h{opacity:0;transform:scale(.4);transition:transform .3s cubic-bezier(.3,1.8,.5,1),opacity .2s}
.m-love .pupil-n{opacity:0}
.m-love .pupil-h{opacity:1;transform:scale(1)}
/* ごきげんは「^ ^」、ドヤは「u u」の閉じ目。開いた目は隠す */
.eye-blink{transition:transform 70ms ease-in,opacity .12s}
.m-happy .eye-blink,.m-smug .eye-blink{opacity:0}
.m-happy .smile-up,.m-smug .smile-down{opacity:1}
.tearpool{opacity:0;transition:opacity .4s}
.m-sad .tearpool{opacity:.9}

/* 表情ごとの体・頭・耳 */
.m-happy .motion{animation:bob 1s ease-in-out infinite}
.m-excited .motion{animation:hop .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .body-g{animation:hopBody .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .neck{animation:hopNeck .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .shadow{animation:hopShadow .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .bell-g{animation:jingle .32s ease-in-out infinite}
.m-love .motion{animation:sway 2.4s ease-in-out infinite}
.m-shy .motion{animation:sway 1.8s ease-in-out infinite}
.m-angry .motion{animation:tremble .16s linear infinite}
.m-sleepy .body-g,.m-sleepy .neck{animation-duration:5s}
.m-thinking .head{transform:rotate(-8deg)}
.m-sleepy .head{transform:translateY(2px) rotate(6deg)}
.m-sad .head{transform:translateY(4px)}
.m-shy .head{transform:rotate(-6deg)}
.m-smug .head{transform:rotate(4deg)}
.m-sad .ear-l{transform:rotate(-18deg)} .m-sad .ear-r{transform:rotate(18deg)}
.m-angry .ear-l{transform:rotate(-30deg)} .m-angry .ear-r{transform:rotate(30deg)}
.m-sleepy .ear-l{transform:rotate(-8deg)} .m-sleepy .ear-r{transform:rotate(8deg)}
.m-shy .ear-l{transform:rotate(-12deg)} .m-shy .ear-r{transform:rotate(12deg)}
.m-surprised .ear-l,.m-excited .ear-l{transform:rotate(6deg)}
.m-surprised .ear-r,.m-excited .ear-r{transform:rotate(-6deg)}
.tw-l .ear-l{animation:twitchL .42s ease-in-out}
.tw-r .ear-r{animation:twitchR .42s ease-in-out}

/* 動き（1回） */
.a-nod .head{animation:nod .9s ease-in-out}
.a-shake .head{animation:shakeHead .9s ease-in-out}
.a-tilt .head{animation:tilt 1.2s cubic-bezier(.3,1.3,.5,1)}
.a-tilt .ear-l{animation:tiltEarL 1.2s ease-in-out}
.a-jump .rig{animation:jump .8s linear}
.a-jump .body-g{animation:jumpBody .8s ease-in-out}
.a-jump .neck{animation:jumpNeck .8s ease-in-out}
.a-jump .shadow{animation:jumpShadow .8s linear}
.a-dance .rig{animation:dance 1.6s ease-in-out}
.a-dance .head{animation:danceHead 1.6s ease-in-out}
.a-jump .bell-g,.a-dance .bell-g,.a-shake .bell-g{animation:jingle .3s ease-in-out 3}
.a-bow .head{animation:bowHead 1.5s ease-in-out}
.a-bow .eye-blink{animation:bowEyes 1.5s ease-in-out}
.a-yawn .head{animation:yawnHead 2.4s ease-in-out}
.a-yawn .eye-blink{animation:yawnEyes 2.4s ease-in-out}
.a-yawn .ear-l{animation:yawnEarL 2.4s ease-in-out}
.a-yawn .ear-r{animation:yawnEarR 2.4s ease-in-out}

/* まわりのエフェクト */
.fx>g{opacity:0;transition:opacity .3s}
.m-love .fx-hearts,.m-excited .fx-spark,.m-sleepy .fx-zzz,.m-angry .fx-steam,.m-sad .fx-tears,
.m-happy .fx-notes,.a-dance .fx-notes,.m-thinking .fx-q,.m-surprised .fx-ex,.m-shy .fx-sweat{opacity:1}
.fx .a{transform-box:fill-box;transform-origin:center}
.d1{animation-delay:-.8s!important} .d2{animation-delay:-1.6s!important}
.fx-hearts .a{animation:heartUp 2.4s ease-out infinite}
.fx-spark .a{animation:twinkle 1.4s ease-in-out infinite}
.fx-zzz .a{animation:zfloat 2.7s ease-in-out infinite}
.fx-steam .a{animation:steam 1.3s ease-in-out infinite}
.fx-steam .vein{animation:vein .6s ease-in-out infinite alternate}
.fx-tears .a{animation:tear 1.4s ease-in infinite}
.fx-notes .a{animation:note 1.8s ease-in-out infinite}
.fx-q .a{animation:qbob 1.6s ease-in-out infinite}
.m-surprised .fx-ex .a{animation:pop .45s cubic-bezier(.3,1.8,.5,1) both}
.fx-sweat .a{animation:sweat 2.2s ease-in infinite}

@keyframes breathe{0%,100%{transform:none}50%{transform:scale(1.006,1.018)}}
@keyframes breatheNeck{0%,100%{transform:none}50%{transform:translateY(-1.5px)}}
@keyframes tailTip{from{transform:rotate(-8deg)}to{transform:rotate(12deg)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes hop{0%,100%{transform:translateY(0)}15%,85%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes hopBody{0%,100%{transform:scale(1.03,.96)}15%,85%{transform:none}}
@keyframes hopNeck{0%,100%{transform:translateY(3px)}15%,85%{transform:none}}
@keyframes hopShadow{0%,15%,85%,100%{transform:scale(1);opacity:1}50%{transform:scale(.75);opacity:.6}}
@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes tremble{0%,100%{transform:translateX(-.9px)}50%{transform:translateX(.9px)}}
@keyframes jingle{0%,100%{transform:rotate(0)}25%{transform:rotate(-18deg)}75%{transform:rotate(18deg)}}
@keyframes twitchL{0%,100%{transform:none}30%{transform:rotate(-14deg)}60%{transform:rotate(4deg)}}
@keyframes twitchR{0%,100%{transform:none}30%{transform:rotate(14deg)}60%{transform:rotate(-4deg)}}
@keyframes nod{0%,50%,100%{transform:none}25%,75%{transform:translateY(6px)}}
@keyframes shakeHead{0%,100%{transform:none}20%{transform:rotate(-9deg)}40%{transform:rotate(9deg)}60%{transform:rotate(-9deg)}80%{transform:rotate(6deg)}}
@keyframes tilt{0%{transform:none}22%,72%{transform:translateX(3px) rotate(14deg)}100%{transform:none}}
@keyframes tiltEarL{0%,100%{transform:none}22%,72%{transform:rotate(-10deg)}}
@keyframes jump{
  0%,14%{transform:none;animation-timing-function:cubic-bezier(.2,.75,.45,1)}
  46%{transform:translateY(-36px);animation-timing-function:cubic-bezier(.55,0,.8,.45)}
  72%,100%{transform:none}}
@keyframes jumpBody{0%{transform:none}14%{transform:scale(1.05,.93)}28%{transform:scale(.98,1.03)}60%{transform:none}72%{transform:scale(1.05,.93)}86%,100%{transform:none}}
@keyframes jumpNeck{0%{transform:none}14%{transform:translateY(5px)}28%{transform:translateY(-1px)}60%{transform:none}72%{transform:translateY(5px)}86%,100%{transform:none}}
@keyframes jumpShadow{0%,14%,72%,100%{transform:none;opacity:1}46%{transform:scale(.6);opacity:.45}}
@keyframes dance{0%,100%{transform:none}12.5%,62.5%{transform:translateY(-8px) rotate(-6deg)}25%,50%,75%{transform:none}37.5%,87.5%{transform:translateY(-8px) rotate(6deg)}}
@keyframes danceHead{0%,100%{transform:none}12.5%,62.5%{transform:rotate(8deg)}25%,50%,75%{transform:none}37.5%,87.5%{transform:rotate(-8deg)}}
@keyframes bowHead{0%,100%{transform:none}30%,65%{transform:translateY(11px)}}
@keyframes bowEyes{0%,20%,75%,100%{transform:none}30%,65%{transform:scaleY(.08)}}
@keyframes yawnHead{0%,100%{transform:none}25%,62%{transform:translateY(-3px) rotate(-3deg)}}
@keyframes yawnEyes{0%,12%,80%,100%{transform:none}22%,70%{transform:scaleY(.08)}}
@keyframes yawnEarL{0%,100%{transform:none}25%,62%{transform:rotate(-12deg)}}
@keyframes yawnEarR{0%,100%{transform:none}25%,62%{transform:rotate(12deg)}}
@keyframes heartUp{0%{transform:translateY(8px) scale(.5);opacity:0}20%{opacity:1;transform:translateY(0) scale(1)}100%{transform:translateY(-22px) scale(.9);opacity:0}}
@keyframes twinkle{0%,100%{transform:scale(.55) rotate(0);opacity:.5}50%{transform:scale(1.1) rotate(15deg);opacity:1}}
@keyframes zfloat{0%{transform:translate(-6px,8px) scale(.6);opacity:0}30%{opacity:1}100%{transform:translate(6px,-10px) scale(1.05);opacity:0}}
@keyframes steam{0%{transform:translateY(6px) scale(.8);opacity:0}30%{opacity:1}100%{transform:translateY(-12px) scale(1.15,1.1);opacity:0}}
@keyframes vein{from{transform:scale(.85)}to{transform:scale(1.1)}}
@keyframes tear{0%{transform:translateY(-4px) scale(.6);opacity:0}20%{opacity:1;transform:translateY(0) scale(1)}100%{transform:translateY(30px) scale(.9);opacity:0}}
@keyframes note{0%{transform:translate(0,6px) rotate(-10deg);opacity:0}25%{opacity:1}100%{transform:translate(8px,-16px) rotate(10deg);opacity:0}}
@keyframes qbob{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(8deg) translateY(-4px)}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes sweat{0%{transform:translateY(-4px);opacity:0}25%{opacity:1}100%{transform:translateY(14px);opacity:0}}

@media (prefers-reduced-motion:reduce){.body-g,.neck,.tail-tip,.motion,.shadow,.bell-g,.fx .a{animation:none!important}}
.still *{animation:none!important;transition:none!important}
`;

  /* ---------------- 絵 ---------------- */
  // ネコの目：色のついた虹彩、丸い瞳孔、ふちどり。ふだんは上まぶたでジト目になる
  // skin はまぶたの色（目のまわりの毛と同じクラス）。smile-up / smile-down は閉じた笑い目（smile-up は丸い「∩」に、目じりの小さなまつげ）
  const eye = (side, cx, px, clip, skin) => {
    const shape = `cx="${cx}" cy="101" rx="17.5" ry="16.5"`;
    return `
    <g class="eye eye-${side}"><g class="eye-scale"><g class="eye-blink">
      <g clip-path="url(#${clip})">
        <rect class="iris" x="${cx - 20}" y="81" width="40" height="40"/>
        <ellipse class="iris-l" cx="${cx}" cy="110" rx="15" ry="8"/>
        <g class="pupils">
          <ellipse class="pupil-n ink" cx="${px}" cy="101.5" rx="10" ry="13"/>
          <g class="pupil-h"><path class="heart-eye" transform="translate(${px} 102.5) scale(1.25)" d="${HEART}"/></g>
          <circle class="hl" cx="${px - 4}" cy="101.2" r="4.6"/><circle class="hl" cx="${px + 4.4}" cy="108.6" r="2.1"/>
        </g>
        <ellipse class="tearpool" cx="${cx}" cy="118" rx="19" ry="6.5"/>
        <ellipse class="rim" stroke-width="4.4" ${shape}/>
      </g>
      <g clip-path="url(#${clip}w)">
        <g class="lid lid-up"><rect class="${skin}" x="${cx - 28}" y="37" width="56" height="47"/><path class="lidline" d="M${cx - 28} 84H${cx + 28}"/></g>
        <ellipse class="lid lid-low ${skin}" cx="${cx}" cy="140.5" rx="30" ry="22"/>
      </g>
    </g></g>
    <path class="smile-eye smile-up" d="M${cx - 12} 104.5Q${cx} 80.5 ${cx + 12} 104.5Q${cx} 92.5 ${cx - 12} 104.5Z"/>
    <path class="smile-eye smile-up smile-lash" d="${side === 'l' ? `M${cx - 12} 103.6q-3.6-.6-5.8-4.4` : `M${cx + 12} 103.6q3.6-.6 5.8-4.4`}"/>
    <path class="smile-eye smile-down" d="M${cx - 14} 98Q${cx} 120 ${cx + 14} 98Q${cx} 106 ${cx - 14} 98Z"/>
    </g>`;
  };

  const svg = u => `
<div class="cat" part="cat">
<svg viewBox="-10 -16 260 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="${u}h"><path d="${HEAD}"/></clipPath>
    <clipPath id="${u}b"><path d="${BODY}"/></clipPath>
    <clipPath id="${u}l"><ellipse cx="87" cy="101" rx="17.5" ry="16.5"/></clipPath>
    <clipPath id="${u}r"><ellipse cx="153" cy="101" rx="17.5" ry="16.5"/></clipPath>
    <clipPath id="${u}lw"><ellipse cx="87" cy="101" rx="18.6" ry="17.6"/></clipPath>
    <clipPath id="${u}rw"><ellipse cx="153" cy="101" rx="18.6" ry="17.6"/></clipPath>
    <clipPath id="${u}m"><path class="mouth-clip"/></clipPath>
  </defs>
  <ellipse class="shadow" cx="120" cy="220" rx="84" ry="6.5"/>
  <g class="rig"><g class="motion">
    <g class="body-g">
      <path class="st st-tail" stroke-width="13" d="${TAIL_BACK}"/>
      <path class="fur" d="${BODY}"/>
      <g clip-path="url(#${u}b)">
        <path class="st st-stripe" stroke-width="5" d="M38 166Q50 164 58 170M37 180Q49 178 56 184M37 194Q47 193 53 198M202 166Q190 164 182 170M203 180Q191 178 184 184M203 194Q193 193 187 198"/>
        <ellipse class="cream" cx="120" cy="187" rx="31" ry="27"/>
        <path class="collar" d="M50 128Q120 176 190 128L192 138Q120 190 48 138Z"/>
      </g>
      <ellipse class="paw" cx="105" cy="214.5" rx="10.5" ry="5.5"/><ellipse class="paw" cx="135" cy="214.5" rx="10.5" ry="5.5"/>
      <path class="st st-cream" stroke-width="1.6" d="M101.5 211.5V214.5M108.5 211.5V214.5M131.5 211.5V214.5M138.5 211.5V214.5"/>
      <path class="st st-tail" stroke-width="13" d="${TAIL_FRONT}"/>
      <path class="st st-ring butt" stroke-width="13" stroke-dasharray="0 22 6 12 6 12 6 100" d="${TAIL_FRONT}"/>
      <g class="tail-tip">
        <path class="st st-tail" stroke-width="13" d="${TAIL_B}"/>
        <path class="st st-tip" stroke-width="13" d="${TAIL_TIP}"/>
      </g>
      <g class="bell-g">
        <circle class="bell" cx="120" cy="167" r="7.5"/>
        <path class="st st-bell" stroke-width="1.6" d="M112.8 165.4H127.2M120 170.6V174"/>
        <circle class="bell-d" cx="120" cy="170.2" r="1.8"/>
        <ellipse class="hl" cx="116.6" cy="163.2" rx="2" ry="1.3" opacity=".85"/>
      </g>
    </g>
    <g class="neck"><g class="head"><g class="head-bob">
      <g class="ear ear-l">
        <path class="fur st-fur" stroke-width="6" stroke-linejoin="round" d="M52 80L47 22Q46 8 58 14L104 48Z"/>
        <path class="ear-in" d="M60 66L55 30Q55 22 62 26L92 50Z"/>
        <path class="st st-light" stroke-width="2.2" d="M64 58Q60 48 59 40M70 54Q67 46 66 40"/>
      </g>
      <g class="ear ear-r">
        <path class="fur st-fur" stroke-width="6" stroke-linejoin="round" d="M188 80L193 22Q194 8 182 14L136 48Z"/>
        <path class="ear-in" d="M180 66L185 30Q185 22 178 26L148 50Z"/>
        <path class="st st-light" stroke-width="2.2" d="M176 58Q180 48 181 40M170 54Q173 46 174 40"/>
      </g>
      <path class="fur" d="${HEAD}"/>
      <g clip-path="url(#${u}h)">
        <path class="st st-stripe" stroke-width="5" d="M109 44L111 58M120 42V61M131 44L129 58"/>
        <path class="st st-stripe" stroke-width="5" d="M42 89Q53 91 63 88M42 99Q51 100 59 98M198 89Q187 91 177 88M198 99Q189 100 181 98"/>
      </g>
      <g class="face"><g class="face-look">
        <ellipse class="blush" cx="69" cy="121" rx="10" ry="5.6"/><ellipse class="blush" cx="171" cy="121" rx="10" ry="5.6"/>
        <ellipse class="cream" cx="120" cy="138.5" rx="12.5" ry="8.5"/>
        <ellipse class="cream" cx="110.5" cy="123.5" rx="12" ry="9.5"/><ellipse class="cream" cx="129.5" cy="123.5" rx="12" ry="9.5"/>
        ${eye('l', 87, 88.5, u + 'l', 'fur')}
        ${eye('r', 153, 151.5, u + 'r', 'fur')}
        <path class="mouth-open"/>
        <g clip-path="url(#${u}m)"><ellipse class="tongue"/><path class="fangs"/></g>
        <path class="st st-line lips" stroke-width="2.4"/>
        <path class="nose" d="M114 114.5Q120 111.5 126 114.5Q127.5 116 123 120Q120 122.5 117 120Q112.5 116 114 114.5Z"/>
        <ellipse class="hl" cx="117.6" cy="114.6" rx="2" ry="1" opacity=".7"/>
        <path class="st wh" stroke-width="2" d="M99 124L50 118M99 128L47 129M100 132L52 140M141 124L190 118M141 128L193 129M140 132L188 140"/>
      </g></g>
    </g></g></g>
    <g class="fx">
      <g class="fx-hearts">
        <g transform="translate(28 52) scale(1.4)"><path class="a heart" d="${HEART}"/></g>
        <g transform="translate(214 34) scale(1.1)"><path class="a heart d1" d="${HEART}"/></g>
        <g transform="translate(224 80) scale(.85)"><path class="a heart d2" d="${HEART}"/></g>
      </g>
      <g class="fx-spark">
        <g transform="translate(26 70) scale(1.5)"><path class="a sp1" d="${DIAMOND}"/></g>
        <g transform="translate(214 44) scale(1.3)"><path class="a sp2 d1" d="${DIAMOND}"/></g>
        <g transform="translate(224 124) scale(.9)"><path class="a sp3 d2" d="${DIAMOND}"/></g>
        <g transform="translate(24 24) scale(.8)"><path class="a sp3 d1" d="${DIAMOND}"/></g>
      </g>
      <g class="fx-zzz">
        <g transform="translate(202 46)"><text class="a z" font-size="16">Z</text></g>
        <g transform="translate(216 28)"><text class="a z d1" font-size="21">Z</text></g>
        <g transform="translate(230 8)"><text class="a z d2" font-size="26">Z</text></g>
      </g>
      <g class="fx-steam">
        <g transform="translate(120 28)"><path class="a steam" d="M0 18C-10 10-3 2-7-8C-6-14-2-17 2-19C0-11 8-6 8 4C8 11 4 15 0 18Z"/></g>
        <g transform="translate(208 62) scale(1.5)"><path class="a vein st" stroke-width="2.6" d="M-6.5-2Q-2-2-2-6.5M2-6.5Q2-2 6.5-2M6.5 2Q2 2 2 6.5M-2 6.5Q-2 2-6.5 2"/></g>
      </g>
      <g class="fx-tears">
        <g transform="translate(76 120)"><path class="a tear" d="${DROP}"/></g>
        <g transform="translate(164 120)"><path class="a tear d1" d="${DROP}"/></g>
      </g>
      <g class="fx-notes">
        <g transform="translate(214 60) scale(1.2)"><g class="a note">${NOTE}</g></g>
        <g transform="translate(232 26)"><g class="a note d1">${NOTE}</g></g>
        <g transform="translate(20 50)"><g class="a note d2">${NOTE}</g></g>
      </g>
      <g class="fx-q"><g transform="translate(218 50)"><text class="a q" font-size="40" text-anchor="middle">?</text></g></g>
      <g class="fx-ex">
        <g transform="translate(218 52)"><text class="a ex" font-size="42" text-anchor="middle">!</text></g>
        <g transform="translate(28 44)"><path class="a burst st" stroke-width="3.5" d="M-2 6L-12 1M0-3L-8-12M8-8L6-19"/></g>
      </g>
      <g class="fx-sweat"><g transform="translate(210 74) scale(1.5)"><path class="a sweat" d="${DROP}"/></g></g>
    </g>
  </g></g>
</svg></div>`;

  /* ---------------- 本体 ---------------- */
  class MuraNeko extends HTMLElement {
    static get observedAttributes() { return ['mood', 'size', 'follow', 'speed', 'still', 'reset-after', 'crop']; }
    static get moods() { return Object.keys(MOODS); }
    static get actions() { return Object.keys(ACTIONS); }
    /** タグを取り除いた表示用テキスト */
    static stripTags(text) { return tokenize(String(text ?? '')).filter(t => !t.tag).map(t => t.ch).join(''); }

    constructor() {
      super();
      const u = 'mn' + (++uid) + '-';
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${CSS}</style>${svg(u)}`;
      const q = s => root.querySelector(s);
      this._el = {
        cat: q('.cat'), svg: q('svg'), mouth: q('.mouth-open'), mclip: q('.mouth-clip'), tongue: q('.tongue'),
        fangs: q('.fangs'), lips: q('.lips'), face: q('.face-look'), bob: q('.head-bob'),
        pupils: [...root.querySelectorAll('.pupils')],
      };
      this._mood = 'neutral'; this._rest = 'neutral'; this._def = MOODS.neutral;
      this._m = { o: 0, w: .6 }; this._lips = MOODS.neutral.lips.slice(); this._look = { x: 0, y: 0 };
      this._beat = null; this._free = false; this._manual = null; this._analyser = null;
      this._queue = Promise.resolve(); this._gen = 0; this._pending = 0; this._buf = '';
      this._timers = new Set(); this._flashT = {}; this._cache = {};
      this.speed = 10;        // 1秒あたりの拍（モーラ）数
      this.resetAfter = 4000; // タグで変わった表情が元に戻るまで(ms)。0で戻さない
      this._tick = this._tick.bind(this);
      this._onPointer = this._onPointer.bind(this);
      this._onLeave = () => { this._pointer = null; };
      this._applyMood('neutral', true, true);
    }

    connectedCallback() {
      if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
      if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', '村のネコ');
      this._render();
      if (this._still) return;
      this._raf = requestAnimationFrame(this._tick);
      this._loopBlink(); this._loopEars(); this._loopGlance(); this._loopYawn();
      if (this.hasAttribute('follow')) this.follow(true);
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf); this._t = 0;
      this._timers.forEach(clearTimeout); this._timers.clear();
      this.follow(false);
      this.stop();
    }

    attributeChangedCallback(name, _old, v) {
      if (name === 'mood') { if (v) this.setMood(v); }
      else if (name === 'size') { v ? this.style.setProperty('--neko-size', /^\d+(\.\d+)?$/.test(v) ? v + 'px' : v) : this.style.removeProperty('--neko-size'); }
      else if (name === 'follow') { if (this.isConnected && !this._still) this.follow(v !== null); }
      else if (name === 'speed') this.speed = +v || 10;
      else if (name === 'reset-after') this.resetAfter = v === null ? 4000 : +v || 0;
      else if (name === 'still') { this._still = v !== null; this._el.cat.classList.toggle('still', this._still); }
      else if (name === 'crop') { this._crop = v === 'bust' ? 'bust' : 'full'; this._el.svg.setAttribute('viewBox', this._crop === 'bust' ? '6 -10 228 228' : '-10 -16 260 256'); }
    }

    /* ---------- 表情 ---------- */
    get mood() { return this._mood; }
    set mood(v) { this.setMood(v); }

    /** 表情を変える。{ duration } を付けるとその時間だけ変えて元に戻る */
    setMood(name, { duration } = {}) {
      if (!MOODS[name]) { console.warn(`[mura-neko] 知らない表情です: ${name}`); return this; }
      clearTimeout(this._moodT); this._speechMood = false;
      if (duration) {
        this._applyMood(name);
        this._moodT = this._later(() => this._applyMood(this._rest), duration);
      } else {
        this._rest = name;
        this._applyMood(name);
      }
      return this;
    }

    _applyMood(name, instant = false, silent = false) {
      const d = MOODS[name] || MOODS.neutral, c = this._el.cat, s = c.style;
      c.classList.remove('m-' + this._mood); c.classList.add('m-' + name);
      const changed = this._mood !== name;
      this._mood = name; this._def = d;
      s.setProperty('--lid-y', d.lid[0] + 'px');
      s.setProperty('--lid-rl', d.lid[1] + 'deg');
      s.setProperty('--lid-rr', d.lid[2] + 'deg');
      s.setProperty('--low-y', d.low + 'px');
      s.setProperty('--eye-s', d.eye);
      s.setProperty('--pupil-sx', d.pupil[0]);
      s.setProperty('--pupil-sy', d.pupil[1]);
      s.setProperty('--blush', Math.min(1, d.blush));
      s.setProperty('--tail-dur', d.tail + 's');
      if (instant || this._still) {
        this._lips = d.lips.slice();
        this._m = { o: d.base[0], w: d.base[1] };
        this._look = d.look ? { x: d.look[0], y: d.look[1] } : { x: 0, y: 0 };
        this._render();
      }
      if (changed && !silent) this._emit('moodchange', { mood: name });
    }

    /* ---------- 動き ---------- */
    /** 動きを1回。nod / shake / tilt / jump / dance / bow / yawn */
    play(name) {
      const ms = ACTIONS[name];
      if (!ms) { console.warn(`[mura-neko] 知らない動きです: ${name}`); return Promise.resolve(); }
      this._flash('a-' + name, ms);
      if (name === 'yawn') { const t = performance.now(); this._yawn = [t + ms * .16, t + ms * .66]; }
      return new Promise(r => this._later(r, ms));
    }

    blink(double = false) {
      const c = this._el.cat;
      c.classList.add('blink');
      this._later(() => {
        c.classList.remove('blink');
        if (double) this._later(() => { c.classList.add('blink'); this._later(() => c.classList.remove('blink'), 110); }, 120);
      }, 120);
    }

    /** 目線。x, y は -1〜1。lookAt(null) で自動に戻す */
    lookAt(x, y = 0) {
      this._lookOverride = x == null ? null : { x: clamp(+x, -1, 1), y: clamp(+y, -1, 1) };
      return this;
    }

    /** カーソルを目で追う */
    follow(on = true) {
      if (on && !this._following) {
        addEventListener('pointermove', this._onPointer, { passive: true });
        document.documentElement.addEventListener('mouseleave', this._onLeave);
        this._following = true;
      } else if (!on && this._following) {
        removeEventListener('pointermove', this._onPointer);
        document.documentElement.removeEventListener('mouseleave', this._onLeave);
        this._following = false; this._pointer = null;
      }
      return this;
    }

    _onPointer(e) {
      const r = this.getBoundingClientRect();
      if (!r.width) return;
      const bust = this._crop === 'bust';
      const cx = r.left + r.width * .5, cy = r.top + r.height * (bust ? 111 / 228 : 117 / 256);
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / (r.width * 1.2 + 60));
      this._pointer = { x: dx / d * k, y: dy / d * k };
    }

    /* ---------- しゃべる ---------- */
    get speaking() { return this._pending > 0 || this._free; }

    /**
     * タグ入りテキストを口パクで話す。前の発話が終わってから順番に話す。
     * options: { onChar(c), onTag(name), speed, tts, lang, rate, pitch, voice }
     */
    speak(text, opts = {}) {
      const gen = this._gen, tokens = tokenize(String(text ?? ''));
      if (!tokens.length) return this._queue;
      this._begin();
      const run = () => gen !== this._gen ? null
        : opts.tts ? this._runTTS(tokens, opts, gen) : this._runBeats(tokens, opts, gen);
      const p = this._queue.then(run).finally(() => { if (gen === this._gen) this._finish(); });
      this._queue = p.catch(() => {});
      return p;
    }

    /** ストリーミングの断片を渡す。途中で切れたタグは次の断片まで持っておく */
    feed(chunk, opts = {}) {
      this._buf += String(chunk ?? '');
      let cut = this._buf.length;
      const lb = this._buf.lastIndexOf('[');
      if (lb !== -1 && this._buf.indexOf(']', lb) === -1 && this._buf.length - lb < 16) cut = lb;
      const out = this._buf.slice(0, cut);
      this._buf = this._buf.slice(cut);
      return out ? this.speak(out, opts) : this._queue;
    }

    /** feed() の残りを流しきる。話し終わると解決する */
    end(opts = {}) {
      const out = this._buf; this._buf = '';
      return out ? this.speak(out, opts) : this._queue;
    }

    /** 話すのをやめて、待っている発話も捨てる */
    stop() {
      this._gen++; this._buf = '';
      this._beat = null; this._free = false; this._queue = Promise.resolve();
      if (this._tts && window.speechSynthesis) speechSynthesis.cancel();
      this._tts = false;
      if (this._pending) {
        this._pending = 0;
        this._el.cat.classList.remove('talking');
        this._emit('speechend');
        this._scheduleReset();
      }
      return this;
    }

    /** 文字なしで口をパクパク（音声だけ流す時など） */
    talk(on = true) { this._free = !!on; this._freeNext = 0; return this; }

    /** 口の開きを直接指定（0〜1）。null で自動に戻す */
    setMouth(open, width = .6) {
      this._manual = open == null ? null : { o: clamp(+open, 0, 1), w: clamp(+width, 0, 1) };
      return this;
    }

    /** <audio>/<video>、AudioNode、MediaStream の音量で口パク。戻り値を呼ぶと解除 */
    connectAudio(src, { gain = 7 } = {}) {
      this.disconnectAudio();
      let ctx, node;
      if (src && src.context && typeof src.connect === 'function') {
        ctx = src.context; node = src;
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = sharedCtx || (sharedCtx = new AC());
        if (src instanceof HTMLMediaElement) {
          node = MEDIA_NODES.get(src);
          if (!node) { node = ctx.createMediaElementSource(src); node.connect(ctx.destination); MEDIA_NODES.set(src, node); }
        } else if (typeof MediaStream !== 'undefined' && src instanceof MediaStream) {
          node = ctx.createMediaStreamSource(src);
        } else {
          throw new TypeError('connectAudio: <audio>/<video>、AudioNode、MediaStream のどれかを渡してください');
        }
        if (ctx.state === 'suspended') ctx.resume();
      }
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      node.connect(an);
      this._analyser = an; this._abuf = new Float32Array(an.fftSize); this._gain = gain; this._audioLast = 0;
      this._audioOff = () => { try { node.disconnect(an); } catch (e) { /* もう切れている */ } };
      return () => this.disconnectAudio();
    }

    disconnectAudio() {
      if (this._audioOff) this._audioOff();
      this._audioOff = null; this._analyser = null;
    }

    _begin() {
      clearTimeout(this._resetT);
      if (this._pending++ === 0) { this._el.cat.classList.add('talking'); this._emit('speechstart'); }
    }

    _finish() {
      if (--this._pending > 0) return;
      this._pending = 0; this._beat = null;
      this._el.cat.classList.remove('talking');
      this._emit('speechend');
      this._scheduleReset();
    }

    _scheduleReset() {
      clearTimeout(this._resetT);
      if (!this._speechMood || !(this.resetAfter > 0)) return;
      this._resetT = this._later(() => {
        if (!this._pending && this._speechMood) { this._speechMood = false; this._applyMood(this._rest); }
      }, this.resetAfter);
    }

    _tag(name, opts) {
      if (MOODS[name]) { clearTimeout(this._moodT); this._speechMood = true; this._applyMood(name); }
      else if (ACTIONS[name]) this.play(name);
      if (opts && opts.onTag) opts.onTag(name);
    }

    async _runBeats(tokens, opts, gen) {
      const unit = 1000 / (opts.speed || this.speed || 10);
      let last = 'a';
      for (const t of tokens) {
        if (gen !== this._gen) return;
        if (t.tag) { this._tag(t.tag, opts); continue; }
        if (opts.onChar) opts.onChar(t.ch);
        for (const [v, len] of beatsFor(t.ch, last)) {
          if (gen !== this._gen) return;
          const d = unit * len;
          if (v === 'x') { this._beat = CLOSED; await sleep(d); continue; }
          if (v !== 'n') last = v;
          const s = SHAPES[v];
          this._beat = { o: s.o * (.85 + Math.random() * .25), w: s.w };
          await sleep(d * .62);
          if (gen !== this._gen) return;
          this._beat = { o: s.o * .18, w: s.w };
          await sleep(d * .38);
        }
      }
      if (gen === this._gen) this._beat = null;
    }

    _runTTS(tokens, opts, gen) {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return this._runBeats(tokens, opts, gen);
      let plain = '';
      const marks = [];
      for (const t of tokens) t.tag ? marks.push([plain.length, t.tag]) : (plain += t.ch);
      let shown = 0, mi = 0;
      const reveal = n => {
        n = Math.min(plain.length, n);
        while (shown < n) {
          while (mi < marks.length && marks[mi][0] <= shown) this._tag(marks[mi++][1], opts);
          if (opts.onChar) opts.onChar(plain[shown]);
          shown++;
        }
        if (n >= plain.length) while (mi < marks.length) this._tag(marks[mi++][1], opts);
      };
      return new Promise(res => {
        const u = new SpeechSynthesisUtterance(plain.trim() ? plain : ' ');
        u.lang = opts.lang || 'ja-JP';
        u.rate = opts.rate ?? 1.05;
        u.pitch = opts.pitch ?? 1.4;
        const voice = opts.voice || synth.getVoices().find(v => v.lang.replace('_', '-').toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()));
        if (voice) u.voice = voice;
        let t0 = 0, bpos = 0, iv = 0, done = false;
        const cps = 7.5 * u.rate;
        const finish = () => {
          if (done) return;
          done = true; clearInterval(iv);
          this._free = false; this._tts = false;
          if (gen === this._gen) reveal(plain.length);
          res();
        };
        u.onstart = () => {
          t0 = performance.now(); this._free = true; reveal(0);
          iv = setInterval(() => {
            if (gen !== this._gen) return finish();
            const est = Math.floor((performance.now() - t0) / 1000 * cps);
            reveal(Math.min(plain.length - 1, Math.max(bpos, est)));
          }, 80);
        };
        u.onboundary = e => { bpos = Math.max(bpos, e.charIndex + (e.charLength || 1)); };
        u.onend = finish;
        u.onerror = finish;
        this._tts = true;
        synth.speak(u);
        setTimeout(() => { if (!t0 && !done) { synth.cancel(); finish(); } }, 5000);
      });
    }

    /* ---------- 毎フレーム ---------- */
    _mouthTarget(now) {
      if (this._manual) return this._manual;
      if (this._yawn && now < this._yawn[1]) { if (now > this._yawn[0]) return YAWN_MOUTH; }
      else this._yawn = null;
      if (this._analyser) {
        const lv = this._level();
        if (lv > .04) { this._audioLast = now; return { o: Math.min(1, lv), w: .45 + .4 * Math.abs(Math.sin(now / 140)) }; }
        if (now - this._audioLast < 350) return { o: lv * .5, w: .6 };
      }
      if (this._beat) return this._beat;
      if (this._free) {
        if (now > (this._freeNext || 0)) {
          this._freeOpen = !this._freeOpen;
          this._freeShape = this._freeOpen ? SHAPES[rv()] : { o: .08, w: .6 };
          this._freeNext = now + (this._freeOpen ? 110 : 60) + Math.random() * 70;
        }
        return this._freeShape;
      }
      return { o: this._def.base[0], w: this._def.base[1] };
    }

    _level() {
      const a = this._analyser, buf = this._abuf;
      a.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return clamp((Math.sqrt(s / buf.length) - .015) * this._gain, 0, 1);
    }

    _lookTarget() {
      if (this._lookOverride) return this._lookOverride;
      if (this._def.look) return { x: this._def.look[0], y: this._def.look[1] };
      if (this._pointer) return this._pointer;
      if (this._glance) return this._glance;
      return { x: 0, y: 0 };
    }

    _tick(now) {
      const dt = Math.min(.05, this._t ? (now - this._t) / 1000 : .016);
      this._t = now;
      const mt = this._mouthTarget(now);
      const km = 1 - Math.exp(-dt * 30), kl = 1 - Math.exp(-dt * 10), kk = 1 - Math.exp(-dt * 8);
      this._m.o += (mt.o - this._m.o) * km;
      this._m.w += (mt.w - this._m.w) * km;
      const lt = this._def.lips;
      for (let i = 0; i < 3; i++) this._lips[i] += (lt[i] - this._lips[i]) * kl;
      const lk = this._lookTarget();
      this._look.x += (lk.x - this._look.x) * kk;
      this._look.y += (lk.y - this._look.y) * kk;
      this._render();
      this._raf = requestAnimationFrame(this._tick);
    }

    _render() {
      const E = this._el, c = this._cache;
      const { o, w } = this._m;
      const W = 3.5 + 7.5 * w, H = 15 * o, T = 126.5;
      let md = '', fg = '';
      if (H > .7) {
        const b = T + H, s = T + H * .8;
        md = `M${f(120 - W)} ${T}Q120 ${T - 1.6} ${f(120 + W)} ${T}C${f(120 + W)} ${f(s)} ${f(120 + W * .55)} ${f(b)} 120 ${f(b)}C${f(120 - W * .55)} ${f(b)} ${f(120 - W)} ${f(s)} ${f(120 - W)} ${T}Z`;
        if (H > 4) {
          const fh = Math.min(3.4, H * .3), x1 = 120 - W * .5, x2 = 120 + W * .5;
          fg = `M${f(x1 - 1.9)} ${T - 1}L${f(x1 + 1.9)} ${T - 1}L${f(x1)} ${f(T + fh)}ZM${f(x2 - 1.9)} ${T - 1}L${f(x2 + 1.9)} ${T - 1}L${f(x2)} ${f(T + fh)}Z`;
        }
      }
      if (md !== c.md) {
        c.md = md;
        E.mouth.setAttribute('d', md);
        E.mclip.setAttribute('d', md);
        E.fangs.setAttribute('d', fg);
        E.tongue.setAttribute('cx', 120);
        E.tongue.setAttribute('cy', f(T + H));
        E.tongue.setAttribute('rx', f(W * .62));
        E.tongue.setAttribute('ry', H > 3 ? f(H * .45) : 0);
      }
      const [lw, dip, end] = this._lips;
      const ld = `M120 121.2V125M120 125Q${f(120 - lw * .5)} ${f(125 + dip)} ${f(120 - lw)} ${f(125 + end)}M120 125Q${f(120 + lw * .5)} ${f(125 + dip)} ${f(120 + lw)} ${f(125 + end)}`;
      if (ld !== c.ld) { c.ld = ld; E.lips.setAttribute('d', ld); }
      const { x, y } = this._look;
      const pt = `translate(${f(x * 6)} ${f(y * 5)})`;
      if (pt !== c.pt) { c.pt = pt; E.pupils.forEach(p => p.setAttribute('transform', pt)); }
      const ft = `translate(${f(x * 2.4)} ${f(y * 1.6)})`;
      if (ft !== c.ft) { c.ft = ft; E.face.setAttribute('transform', ft); }
      // しゃべっている間は口の開きに合わせて頭が少し持ち上がる
      const voiced = this._pending > 0 || this._free || this._manual || (this._analyser && this._audioLast);
      const a = voiced ? Math.max(0, o - this._def.base[0] * .5) : 0;
      const bt = a > .01 ? `translate(0 ${f(-a * 1.8)})` : '';
      if (bt !== c.bt) { c.bt = bt; bt ? E.bob.setAttribute('transform', bt) : E.bob.removeAttribute('transform'); }
    }

    /* ---------- 気まぐれ ---------- */
    _loopBlink() {
      const wait = (this._mood === 'sleepy' ? 3500 : 2000) + Math.random() * 3500;
      this._later(() => { this.blink(Math.random() < .2); this._loopBlink(); }, wait);
    }

    _loopEars() {
      this._later(() => {
        if (!reducedMotion()) this._flash(Math.random() < .5 ? 'tw-l' : 'tw-r', 420);
        this._loopEars();
      }, 4000 + Math.random() * 6000);
    }

    // ジト目やねむい時は、しばらく放っておくとあくびをする
    _loopYawn() {
      this._later(() => {
        const busy = this._pending || this._free || this._analyser || [...this._el.cat.classList].some(c => c.startsWith('a-'));
        if (!busy && (this._mood === 'neutral' || this._mood === 'sleepy') && !reducedMotion()) this.play('yawn');
        this._loopYawn();
      }, 25000 + Math.random() * 35000);
    }

    _loopGlance() {
      this._later(() => {
        if (!this._lookOverride && !this._pointer && !this._def.look && !this._pending && !reducedMotion()) {
          this._glance = { x: (Math.random() * 2 - 1) * .7, y: (Math.random() * 2 - 1) * .35 };
          this._later(() => { this._glance = null; }, 700 + Math.random() * 900);
        }
        this._loopGlance();
      }, 3000 + Math.random() * 4000);
    }

    _flash(cls, ms) {
      const c = this._el.cat;
      clearTimeout(this._flashT[cls]);
      c.classList.remove(cls);
      void c.getBoundingClientRect(); // アニメーションを最初からやり直す
      c.classList.add(cls);
      this._flashT[cls] = this._later(() => c.classList.remove(cls), ms);
    }

    _later(fn, ms) {
      const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
      this._timers.add(id);
      return id;
    }

    _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  }

  window.MuraNeko = MuraNeko;
  customElements.define('mura-neko', MuraNeko);
})();
