/*!
 * yuki-fukurou.js — 雪フクロウ「ユキ」 チャットAI用アバター
 * 依存なしの Web Component。<script src="yuki-fukurou.js"></script> で読み込むだけで使えます。
 * ARK の雪フクロウ（白い羽・光る機械の仮面・アンテナ）をもとにした、ファンメイドのデフォルメです。
 *
 *   <yuki-fukurou mood="happy" follow></yuki-fukurou>
 *   <yuki-fukurou crop="bust"></yuki-fukurou>                // 頭まわりだけ（丸いアイコン用）
 *
 *   const yuki = document.querySelector('yuki-fukurou');
 *   yuki.setMood('love');                                   // 表情
 *   yuki.play('flap');                                      // 動き
 *   await yuki.speak('[happy]こんにちは！', { onChar: c => out.textContent += c });
 *   yuki.feed(chunk); await yuki.end();                     // LLMのストリーミング
 *   yuki.connectAudio(audioElement);                        // 音声の音量でくちばしを動かす
 */
(() => {
  'use strict';
  if (!window.customElements || customElements.get('yuki-fukurou')) return;

  /* ---------------- 形 ---------------- */
  // まんまるの頭と、雪玉のような体。ふちの小さな丸がふわふわの羽になる
  const BODY = 'M120 112C162 112 188 144 188 180C188 206 160 220 120 220C80 220 52 206 52 180C52 144 78 112 120 112Z';
  const BODY_FLUFF = [[54, 176, 9], [56, 196, 9], [67, 210, 8], [186, 176, 9], [184, 196, 9], [173, 210, 8]];
  const HEAD = 'M120 26C160 26 196 50 198 92C200 128 172 154 120 154C68 154 40 128 42 92C44 50 80 26 120 26Z';
  const HEAD_FLUFF = [[45, 112, 10], [51, 130, 10], [63, 144, 9], [195, 112, 10], [189, 130, 10], [177, 144, 9], [100, 29, 7], [140, 29, 7]];
  // 目のまわりの機械の仮面（ゴーグル形・目じりが上にはねる）
  const MASK = 'M120 82C112 75 102 72 90 72C78 72 68 76 61 83L42 73L54 95C53 109 60 121 73 125C86 129 100 126 108 120L120 132L132 120C140 126 154 129 167 125C180 121 187 109 186 95L198 73L179 83C172 76 162 72 150 72C138 72 128 75 120 82Z';
  const CIRCUIT = 'M64 86C72 79 82 76 92 76M57 92L46 78M62 112C66 118 72 121 80 122M176 86C168 79 158 76 148 76M183 92L194 78M178 112C174 118 168 121 160 122M113 117L120 125L127 117';
  const WING_L = 'M74 128C56 138 48 166 52 192C54 204 60 212 70 214L74 206L80 212L84 202C88 180 88 148 74 128Z';
  const WING_R = 'M166 128C184 138 192 166 188 192C186 204 180 212 170 214L166 206L160 212L156 202C152 180 152 148 166 128Z';
  const HEART = 'M0 6C-9-.5-8.5-9-3.2-9C-1.2-9 0-7.6 0-6.4C0-7.6 1.2-9 3.2-9C8.5-9 9-.5 0 6Z';
  const DROP = 'M0-7C3-2 5.5 1.5 5.5 4A5.5 5.5 0 0 1-5.5 4C-5.5 1.5-3-2 0-7Z';
  const DIAMOND = 'M0-8L5.5 0 0 8-5.5 0Z';
  const NOTE = '<ellipse rx="5" ry="4" transform="rotate(-20)"/><rect x="3" y="-17" width="2.6" height="17" rx="1.3"/><path d="M5.6-17C10-16 12.5-12 11.5-8 10.5-11 8.5-12.5 5.6-12.5Z"/>';
  const EYE_Y = 98;

  /* ---------------- 表情と動き ----------------
     lid: [上まぶたの下がり px, 左の傾き deg, 右の傾き deg]（まぶたは仮面と同じ色）
     low: 下まぶたの上がり px（使わないので 0）
     pupil: [瞳孔の横幅, 縦幅]
     base: [くちばしの開き 0〜1, 開き方 0〜1]（しゃべっていない時）
     tail: アンテナのゆれる周期（秒）
     look: 目線の初期値 [x, y]（-1〜1）
     happy は閉じた「^ ^」、smug は閉じた「u u」の光る目に切り替わる（CSS の .smile-eye） */
  const MOODS = {
    neutral:   { lid: [12, 0, 0],    low: 0, eye: 1,    pupil: [1, 1],     blush: .5,  base: [0, .5],   tail: 3.2 },
    happy:     { lid: [0, 0, 0],     low: 0, eye: 1,    pupil: [1, 1],     blush: .8,  base: [.3, .6],  tail: 1.6 },
    excited:   { lid: [0, 0, 0],     low: 0, eye: 1.1,  pupil: [1.15, 1.15], blush: .8, base: [.6, .7], tail: .9 },
    love:      { lid: [2, 0, 0],     low: 0, eye: 1.06, pupil: [1, 1],     blush: 1,   base: [.15, .5], tail: 2.2 },
    sad:       { lid: [9, -14, 14],  low: 0, eye: 1,    pupil: [1.05, 1.05], blush: .3, base: [0, .5],  tail: 4.5, look: [0, .45] },
    angry:     { lid: [12, 22, -22], low: 0, eye: 1,    pupil: [.8, .8],   blush: 0,   base: [.15, .5], tail: .5 },
    sleepy:    { lid: [20, 0, 0],    low: 0, eye: 1,    pupil: [1, 1],     blush: .5,  base: [0, .5],   tail: 5,   look: [0, .5] },
    surprised: { lid: [0, 0, 0],     low: 0, eye: 1.15, pupil: [.7, .7],   blush: .5,  base: [.55, .5], tail: 1.1 },
    thinking:  { lid: [10, -3, 3],   low: 0, eye: 1,    pupil: [1, 1],     blush: .5,  base: [0, .5],   tail: 3,   look: [.55, -.4] },
    smug:      { lid: [0, 0, 0],     low: 0, eye: 1,    pupil: [1, 1],     blush: .6,  base: [0, .5],   tail: 2.4, look: [.25, 0] },
    shy:       { lid: [8, -6, 6],    low: 0, eye: 1,    pupil: [1, 1],     blush: 1,   base: [0, .5],   tail: 1.8, look: [-.65, .45] },
  };
  const ACTIONS = { nod: 900, shake: 900, tilt: 1200, flap: 1100, jump: 800, dance: 1600, bow: 1500, yawn: 2400 };
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
  /* 白い羽・夜空の藍の仮面と金属・光は青。Village Server の焚き火パレットに合わせてある */
  --owl-fur:#F3F5FA; --owl-face:#FFFFFF; --owl-shade:#DCE2EE; --owl-outline:#C9D0E0;
  --owl-mask:#1E2138; --owl-metal:#2C3060; --owl-glow:#3CD3FF; --owl-glow-soft:#A9EEFF;
  --owl-iris:#2EC8FA; --owl-pupil:#081A2B; --owl-blush:#F5A3B6;
  --owl-mouth:#4A1F33; --owl-tongue:#F27C8E; --owl-shadow:rgba(22,24,39,.14);
  display:inline-block; width:var(--owl-size,200px); aspect-ratio:260/256; line-height:0; vertical-align:bottom;
  -webkit-tap-highlight-color:transparent;
}
:host([crop="bust"]){aspect-ratio:1/1}
:host([crop="bust"]) .shadow{display:none}
.cat,svg{display:block;width:100%;height:100%}
svg{overflow:visible}
.fur{fill:var(--owl-fur)} .face-disc{fill:var(--owl-face)} .shade{fill:var(--owl-shade)}
.outline{fill:none;stroke:var(--owl-outline);stroke-width:4}
.mask{fill:var(--owl-mask);stroke:var(--owl-mask);stroke-width:5;stroke-linejoin:round}
.metal{fill:var(--owl-metal)} .glow{fill:var(--owl-glow)}
.st{fill:none;stroke-linecap:round;stroke-linejoin:round}
.st-metal{stroke:var(--owl-metal)} .st-glow{stroke:var(--owl-glow)}
.circuit{fill:none;stroke:var(--owl-glow);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.halo{fill:var(--owl-glow);opacity:.45}
.iris{fill:var(--owl-iris)} .ring{fill:none;stroke:var(--owl-glow-soft);stroke-width:2.2}
.ink{fill:var(--owl-pupil)} .hl{fill:#fff}
.lidskin{fill:var(--owl-mask)}
.lidline{fill:none;stroke:var(--owl-glow);stroke-width:2;stroke-linecap:round;opacity:.85}
.lid-low{stroke:none}
.shadow{fill:var(--owl-shadow)} .mouth-open{fill:var(--owl-mouth)} .tongue{fill:var(--owl-tongue)}
.beak{fill:var(--owl-metal);stroke:var(--owl-metal);stroke-width:1.6;stroke-linejoin:round}
.blush{fill:var(--owl-blush);opacity:var(--blush,.5);transition:opacity .4s}
.smile-eye{fill:var(--owl-glow);stroke:var(--owl-glow);stroke-width:2.2;stroke-linejoin:round;opacity:0;transition:opacity .15s}
.smile-gloss{fill:#fff;stroke:none}
.heart-eye{fill:#FF7BA8} .heart{fill:#EE395B}
.sp1{fill:#EFBB0C;stroke:#EFBB0C} .sp2{fill:#40C68B;stroke:#40C68B} .sp3{fill:#A257EB;stroke:#A257EB}
.sp1,.sp2,.sp3{stroke-width:2.5;stroke-linejoin:round}
.z,.q,.ex{font-family:"Arial Rounded MT Bold","Hiragino Maru Gothic ProN",system-ui,sans-serif;font-weight:900}
.z{fill:#A257EB} .q{fill:#009ACF} .ex{fill:#EE395B}
.steam{fill:#C9C6D6} .vein{stroke:#EE395B} .burst{stroke:#EFBB0C}
.tear,.sweat,.tearpool{fill:#4FB6E8} .note{fill:#009ACF}

.rig,.motion,.body-g,.neck,.head,.face,.ant,.wing,.bell-g,.eye-scale,.eye-blink,.lid,.pupil-n,.pupil-h,.shadow,.tip{transform-box:view-box}
/* 伸び縮みするのは胴体だけ。頭は形を変えず、上下と傾きだけで動かす */
.rig,.motion,.body-g{transform-origin:120px 219px}
.shadow{transform-origin:120px 220px}
.motion{transition:transform .45s cubic-bezier(.3,1.4,.5,1)}
.body-g{animation:breathe 3.4s ease-in-out infinite}
.neck{animation:breatheNeck 3.4s ease-in-out infinite}
.head{transform-origin:120px 150px;transition:transform .4s cubic-bezier(.3,1.4,.5,1)}
.face{transition:transform .35s ease}
.ant{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
.ant-l{transform-origin:100px 76px;animation:antL var(--tail-dur,3s) ease-in-out infinite alternate}
.ant-r{transform-origin:140px 76px;animation:antR var(--tail-dur,3s) ease-in-out infinite alternate;animation-delay:calc(var(--tail-dur,3s) * -.5)}
.tip{transform-box:fill-box;transform-origin:center;animation:tipGlow 2.2s ease-in-out infinite alternate}
.wing{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
.wing-l{transform-origin:76px 134px} .wing-r{transform-origin:164px 134px}
.halo,.circuit{animation:glowPulse 2.8s ease-in-out infinite alternate}

.eye-l .eye-scale,.eye-l .eye-blink,.eye-l .lid{transform-origin:90px 98px}
.eye-r .eye-scale,.eye-r .eye-blink,.eye-r .lid{transform-origin:150px 98px}
.eye-l .pupil-n,.eye-l .pupil-h{transform-origin:91.5px 99px}
.eye-r .pupil-n,.eye-r .pupil-h{transform-origin:148.5px 99px}
.eye-scale{transform:scale(var(--eye-s,1));transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.eye-blink{transition:transform 70ms ease-in,opacity .12s}
.blink .eye-blink{transform:scaleY(.08)}
.lid-up,.lid-low{transition:transform .3s cubic-bezier(.3,1.3,.5,1)}
.eye-l .lid-up{transform:translateY(var(--lid-y,0px)) rotate(var(--lid-rl,0deg))}
.eye-r .lid-up{transform:translateY(var(--lid-y,0px)) rotate(var(--lid-rr,0deg))}
.lid-low{transform:translateY(var(--low-y,0px))}
.pupil-n{transform:scale(var(--pupil-sx,1),var(--pupil-sy,1));transition:transform .3s cubic-bezier(.3,1.4,.5,1),opacity .2s}
.pupil-h{opacity:0;transform:scale(.4);transition:transform .3s cubic-bezier(.3,1.8,.5,1),opacity .2s}
.m-love .pupil-n{opacity:0}
.m-love .pupil-h{opacity:1;transform:scale(1)}
.tearpool{opacity:0;transition:opacity .4s}
.m-sad .tearpool{opacity:.9}
/* ごきげんは「^ ^」、ドヤは「u u」の光る閉じ目。開いた目は隠す */
.m-happy .eye-blink,.m-smug .eye-blink{opacity:0}
.m-happy .smile-up,.m-smug .smile-down{opacity:1}

/* 表情ごとの体・頭・アンテナ */
.m-happy .motion{animation:bob 1s ease-in-out infinite}
.m-excited .motion{animation:hop .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .body-g{animation:hopBody .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .neck{animation:hopNeck .64s cubic-bezier(.33,0,.4,1) infinite}
.m-excited .shadow{animation:hopShadow .64s cubic-bezier(.33,0,.4,1) infinite}
.m-love .motion{animation:sway 2.4s ease-in-out infinite}
.m-shy .motion{animation:sway 1.8s ease-in-out infinite}
.m-angry .motion{animation:tremble .16s linear infinite}
.m-sleepy .body-g,.m-sleepy .neck{animation-duration:5s}
.m-thinking .head{transform:rotate(-10deg)}
.m-sleepy .head{transform:translateY(2px) rotate(6deg)}
.m-sad .head{transform:translateY(4px)}
.m-shy .head{transform:rotate(-6deg)}
.m-smug .head{transform:rotate(4deg)}
.m-sad .ant-l,.m-sleepy .ant-l{animation:none;transform:rotate(-22deg)}
.m-sad .ant-r,.m-sleepy .ant-r{animation:none;transform:rotate(22deg)}
.m-surprised .ant-l,.m-excited .ant-l{animation:none;transform:rotate(8deg)}
.m-surprised .ant-r,.m-excited .ant-r{animation:none;transform:rotate(-8deg)}
.m-angry .ant-l{animation:none;transform:rotate(-12deg)}
.m-angry .ant-r{animation:none;transform:rotate(12deg)}
.m-sleepy .halo,.m-sleepy .circuit{opacity:.25;animation:none}
.tw-l .ant-l{animation:twitchL .42s ease-in-out}
.tw-r .ant-r{animation:twitchR .42s ease-in-out}

/* 動き（1回） */
.a-nod .head{animation:nod .9s ease-in-out}
.a-shake .head{animation:shakeHead .9s ease-in-out}
.a-tilt .head{animation:tilt 1.2s cubic-bezier(.3,1.3,.5,1)}
.a-flap .wing-l{animation:flapL 1.1s ease-in-out}
.a-flap .wing-r{animation:flapR 1.1s ease-in-out}
.a-flap .rig{animation:flapBody 1.1s ease-in-out}
.a-jump .rig{animation:jump .8s linear}
.a-jump .body-g{animation:jumpBody .8s ease-in-out}
.a-jump .neck{animation:jumpNeck .8s ease-in-out}
.a-jump .shadow{animation:jumpShadow .8s linear}
.a-jump .wing-l{animation:flapL .8s ease-in-out}
.a-jump .wing-r{animation:flapR .8s ease-in-out}
.a-dance .rig{animation:dance 1.6s ease-in-out}
.a-dance .head{animation:danceHead 1.6s ease-in-out}
.a-bow .head{animation:bowHead 1.5s ease-in-out}
.a-bow .eye-blink{animation:bowEyes 1.5s ease-in-out}
.a-yawn .head{animation:yawnHead 2.4s ease-in-out}
.a-yawn .eye-blink{animation:yawnEyes 2.4s ease-in-out}

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
@keyframes antL{from{transform:rotate(-4deg)}to{transform:rotate(3deg)}}
@keyframes antR{from{transform:rotate(4deg)}to{transform:rotate(-3deg)}}
@keyframes tipGlow{from{opacity:.75}to{opacity:1}}
@keyframes glowPulse{from{opacity:.55}to{opacity:.95}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes hop{0%,100%{transform:translateY(0)}15%,85%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes hopBody{0%,100%{transform:scale(1.03,.96)}15%,85%{transform:none}}
@keyframes hopNeck{0%,100%{transform:translateY(3px)}15%,85%{transform:none}}
@keyframes hopShadow{0%,15%,85%,100%{transform:scale(1);opacity:1}50%{transform:scale(.75);opacity:.6}}
@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes tremble{0%,100%{transform:translateX(-.9px)}50%{transform:translateX(.9px)}}
@keyframes twitchL{0%,100%{transform:none}30%{transform:rotate(-14deg)}60%{transform:rotate(4deg)}}
@keyframes twitchR{0%,100%{transform:none}30%{transform:rotate(14deg)}60%{transform:rotate(-4deg)}}
@keyframes nod{0%,50%,100%{transform:none}25%,75%{transform:translateY(6px)}}
@keyframes shakeHead{0%,100%{transform:none}20%{transform:rotate(-9deg)}40%{transform:rotate(9deg)}60%{transform:rotate(-9deg)}80%{transform:rotate(6deg)}}
@keyframes tilt{0%{transform:none}22%,72%{transform:translateX(3px) rotate(16deg)}100%{transform:none}}
@keyframes flapL{0%,100%{transform:none}15%,45%,75%{transform:rotate(28deg)}30%,60%,90%{transform:rotate(4deg)}}
@keyframes flapR{0%,100%{transform:none}15%,45%,75%{transform:rotate(-28deg)}30%,60%,90%{transform:rotate(-4deg)}}
@keyframes flapBody{0%,100%{transform:none}15%,45%,75%{transform:translateY(-6px)}30%,60%,90%{transform:translateY(-2px)}}
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

@media (prefers-reduced-motion:reduce){.body-g,.neck,.ant,.tip,.halo,.circuit,.motion,.shadow,.fx .a{animation:none!important}}
.still *{animation:none!important;transition:none!important}
`;

  /* ---------------- 絵 ---------------- */
  const circles = (list, cls) => list.map(([x, y, r]) => `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`).join('');

  // 光る目：青い虹彩・明るい輪・丸い瞳孔。ふだんは仮面と同じ色の上まぶたでジト目になる
  const eye = (side, cx, px, clip) => {
    const cy = EYE_Y;
    return `
    <g class="eye eye-${side}"><g class="eye-scale"><g class="eye-blink">
      <circle class="halo" cx="${cx}" cy="${cy}" r="22" filter="url(#${clip}g)"/>
      <g clip-path="url(#${clip})">
        <rect class="iris" x="${cx - 20}" y="${cy - 20}" width="40" height="40"/>
        <g class="pupils">
          <circle class="ring" cx="${px}" cy="${cy + 1}" r="11.5"/>
          <circle class="pupil-n ink" cx="${px}" cy="${cy + 1}" r="7.2"/>
          <g class="pupil-h"><path class="heart-eye" transform="translate(${px} ${cy + 2}) scale(1.15)" d="${HEART}"/></g>
          <circle class="hl" cx="${px - 4.5}" cy="${cy - 4}" r="3.8"/><circle class="hl" cx="${px + 4.2}" cy="${cy + 5.6}" r="1.7"/>
        </g>
        <ellipse class="tearpool" cx="${cx}" cy="${cy + 16}" rx="19" ry="6"/>
      </g>
      <g clip-path="url(#${clip}w)">
        <g class="lid lid-up"><rect class="lidskin" x="${cx - 28}" y="${cy - 64}" width="56" height="47"/><path class="lidline" d="M${cx - 28} ${cy - 17}H${cx + 28}"/></g>
        <ellipse class="lid lid-low lidskin" cx="${cx}" cy="${cy + 39}" rx="30" ry="22"/>
      </g>
    </g></g>
    <path class="smile-eye smile-up" d="M${cx - 14} ${cy + 5.5}Q${cx} ${cy - 19} ${cx + 14} ${cy + 5.5}Q${cx} ${cy - 4} ${cx - 14} ${cy + 5.5}Z"/>
    <ellipse class="smile-eye smile-up smile-gloss" cx="${cx - 5.5}" cy="${cy - 2.4}" rx="2.1" ry="1.4" transform="rotate(-28 ${cx - 5.5} ${cy - 2.4})"/>
    <path class="smile-eye smile-down" d="M${cx - 14} ${cy - 3}Q${cx} ${cy + 19} ${cx + 14} ${cy - 3}Q${cx} ${cy + 5} ${cx - 14} ${cy - 3}Z"/>
    </g>`;
  };

  const foot = (x) => `
      <g class="foot">
        <ellipse class="metal" cx="${x - 6.5}" cy="218" rx="3.4" ry="5.6" transform="rotate(14 ${x - 6.5} 218)"/>
        <ellipse class="metal" cx="${x}" cy="219.5" rx="3.6" ry="6"/>
        <ellipse class="metal" cx="${x + 6.5}" cy="218" rx="3.4" ry="5.6" transform="rotate(-14 ${x + 6.5} 218)"/>
        <circle class="glow" cx="${x}" cy="216" r="1.5"/>
      </g>`;

  const svg = u => `
<div class="cat" part="owl">
<svg viewBox="-10 -16 260 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="${u}l"><circle cx="90" cy="${EYE_Y}" r="17"/></clipPath>
    <clipPath id="${u}r"><circle cx="150" cy="${EYE_Y}" r="17"/></clipPath>
    <clipPath id="${u}lw"><circle cx="90" cy="${EYE_Y}" r="18.1"/></clipPath>
    <clipPath id="${u}rw"><circle cx="150" cy="${EYE_Y}" r="18.1"/></clipPath>
    <filter id="${u}lg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="${u}rg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="${u}tg" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse class="shadow" cx="120" cy="221" rx="74" ry="6.5"/>
  <g class="rig"><g class="motion">
    <g class="body-g">
      <path class="outline" d="${BODY}"/>${circles(BODY_FLUFF, 'outline')}
      <path class="fur" d="${BODY}"/>${circles(BODY_FLUFF, 'fur')}
      <ellipse class="face-disc" cx="120" cy="184" rx="38" ry="30"/>
      ${foot(104)}${foot(136)}
      <g class="wing wing-l"><path class="shade" d="${WING_L}"/></g>
      <g class="wing wing-r"><path class="shade" d="${WING_R}"/></g>
    </g>
    <g class="neck"><g class="head"><g class="head-bob">
      <path class="outline" d="${HEAD}"/>${circles(HEAD_FLUFF, 'outline')}
      <path class="fur" d="${HEAD}"/>${circles(HEAD_FLUFF, 'fur')}
      <ellipse class="face-disc" cx="120" cy="104" rx="66" ry="48"/>
      <g class="ant ant-l">
        <path class="st st-metal" stroke-width="5" d="M101 76C99 56 82 40 80 13"/>
        <path class="st st-metal" stroke-width="4" d="M92 52C84 46 74 40 66 30"/>
        <circle class="glow tip" cx="80" cy="12" r="5.5" filter="url(#${u}tg)"/><circle class="glow tip" cx="65.5" cy="29.5" r="4.5" filter="url(#${u}tg)"/>
      </g>
      <g class="ant ant-r">
        <path class="st st-metal" stroke-width="5" d="M139 76C141 56 158 40 160 13"/>
        <path class="st st-metal" stroke-width="4" d="M148 52C156 46 166 40 174 30"/>
        <circle class="glow tip" cx="160" cy="12" r="5.5" filter="url(#${u}tg)"/><circle class="glow tip" cx="174.5" cy="29.5" r="4.5" filter="url(#${u}tg)"/>
      </g>
      <g class="face"><g class="face-look">
        <ellipse class="blush" cx="66" cy="136" rx="9" ry="5"/><ellipse class="blush" cx="174" cy="136" rx="9" ry="5"/>
        <path class="st st-metal" stroke-width="3.2" d="M60 116C50 122 41 124 31 122M180 116C190 122 199 124 209 122"/>
        <circle class="glow tip" cx="30" cy="122" r="3.6" filter="url(#${u}tg)"/><circle class="glow tip" cx="210" cy="122" r="3.6" filter="url(#${u}tg)"/>
        <path class="mouth-open"/>
        <ellipse class="tongue"/>
        <path class="beak beak-low" d="M116 134Q120 133 124 134L121 140Q120 141.5 119 140Z"/>
        <path class="beak" d="M112 121Q120 117 128 121L121.6 138.5Q120 141 118.4 138.5Z"/>
        <path class="mask" d="${MASK}"/>
        <path class="circuit" d="${CIRCUIT}" filter="url(#${u}tg)"/>
        ${eye('l', 90, 91.5, u + 'l')}
        ${eye('r', 150, 148.5, u + 'r')}
      </g></g>
    </g></g></g>
    <g class="fx">
      <g class="fx-hearts">
        <g transform="translate(28 56) scale(1.4)"><path class="a heart" d="${HEART}"/></g>
        <g transform="translate(214 40) scale(1.1)"><path class="a heart d1" d="${HEART}"/></g>
        <g transform="translate(224 84) scale(.85)"><path class="a heart d2" d="${HEART}"/></g>
      </g>
      <g class="fx-spark">
        <g transform="translate(24 72) scale(1.5)"><path class="a sp1" d="${DIAMOND}"/></g>
        <g transform="translate(216 50) scale(1.3)"><path class="a sp2 d1" d="${DIAMOND}"/></g>
        <g transform="translate(224 128) scale(.9)"><path class="a sp3 d2" d="${DIAMOND}"/></g>
        <g transform="translate(30 30) scale(.8)"><path class="a sp3 d1" d="${DIAMOND}"/></g>
      </g>
      <g class="fx-zzz">
        <g transform="translate(200 52)"><text class="a z" font-size="16">Z</text></g>
        <g transform="translate(214 34)"><text class="a z d1" font-size="21">Z</text></g>
        <g transform="translate(228 14)"><text class="a z d2" font-size="26">Z</text></g>
      </g>
      <g class="fx-steam">
        <g transform="translate(120 4)"><path class="a steam" d="M0 18C-10 10-3 2-7-8C-6-14-2-17 2-19C0-11 8-6 8 4C8 11 4 15 0 18Z"/></g>
        <g transform="translate(208 64) scale(1.5)"><path class="a vein st" stroke-width="2.6" d="M-6.5-2Q-2-2-2-6.5M2-6.5Q2-2 6.5-2M6.5 2Q2 2 2 6.5M-2 6.5Q-2 2-6.5 2"/></g>
      </g>
      <g class="fx-tears">
        <g transform="translate(80 124)"><path class="a tear" d="${DROP}"/></g>
        <g transform="translate(160 124)"><path class="a tear d1" d="${DROP}"/></g>
      </g>
      <g class="fx-notes">
        <g transform="translate(214 62) scale(1.2)"><g class="a note">${NOTE}</g></g>
        <g transform="translate(232 30)"><g class="a note d1">${NOTE}</g></g>
        <g transform="translate(18 56)"><g class="a note d2">${NOTE}</g></g>
      </g>
      <g class="fx-q"><g transform="translate(220 56)"><text class="a q" font-size="40" text-anchor="middle">?</text></g></g>
      <g class="fx-ex">
        <g transform="translate(220 58)"><text class="a ex" font-size="42" text-anchor="middle">!</text></g>
        <g transform="translate(26 50)"><path class="a burst st" stroke-width="3.5" d="M-2 6L-12 1M0-3L-8-12M8-8L6-19"/></g>
      </g>
      <g class="fx-sweat"><g transform="translate(212 78) scale(1.5)"><path class="a sweat" d="${DROP}"/></g></g>
    </g>
  </g></g>
</svg></div>`;

  /* ---------------- 本体 ---------------- */
  class YukiFukurou extends HTMLElement {
    static get observedAttributes() { return ['mood', 'size', 'follow', 'speed', 'still', 'reset-after', 'crop']; }
    static get moods() { return Object.keys(MOODS); }
    static get actions() { return Object.keys(ACTIONS); }
    /** タグを取り除いた表示用テキスト */
    static stripTags(text) { return tokenize(String(text ?? '')).filter(t => !t.tag).map(t => t.ch).join(''); }

    constructor() {
      super();
      const u = 'yf' + (++uid) + '-';
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${CSS}</style>${svg(u)}`;
      const q = s => root.querySelector(s);
      this._el = {
        cat: q('.cat'), svg: q('svg'), mouth: q('.mouth-open'), tongue: q('.tongue'), beakLow: q('.beak-low'),
        face: q('.face-look'), bob: q('.head-bob'),
        pupils: [...root.querySelectorAll('.pupils')],
      };
      this._mood = 'neutral'; this._rest = 'neutral'; this._def = MOODS.neutral;
      this._m = { o: 0, w: .6 }; this._look = { x: 0, y: 0 };
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
      if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', '雪フクロウ');
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
      else if (name === 'size') { v ? this.style.setProperty('--owl-size', /^\d+(\.\d+)?$/.test(v) ? v + 'px' : v) : this.style.removeProperty('--owl-size'); }
      else if (name === 'follow') { if (this.isConnected && !this._still) this.follow(v !== null); }
      else if (name === 'speed') this.speed = +v || 10;
      else if (name === 'reset-after') this.resetAfter = v === null ? 4000 : +v || 0;
      else if (name === 'still') { this._still = v !== null; this._el.cat.classList.toggle('still', this._still); }
      else if (name === 'crop') { this._crop = v === 'bust' ? 'bust' : 'full'; this._el.svg.setAttribute('viewBox', this._crop === 'bust' ? '20 -2 200 200' : '-10 -16 260 256'); }
    }

    /* ---------- 表情 ---------- */
    get mood() { return this._mood; }
    set mood(v) { this.setMood(v); }

    /** 表情を変える。{ duration } を付けるとその時間だけ変えて元に戻る */
    setMood(name, { duration } = {}) {
      if (!MOODS[name]) { console.warn(`[yuki-fukurou] 知らない表情です: ${name}`); return this; }
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
      if (!ms) { console.warn(`[yuki-fukurou] 知らない動きです: ${name}`); return Promise.resolve(); }
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
      const cx = r.left + r.width * .5, cy = r.top + r.height * (bust ? 100 / 200 : 114 / 256);
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
      const km = 1 - Math.exp(-dt * 30), kk = 1 - Math.exp(-dt * 8);
      this._m.o += (mt.o - this._m.o) * km;
      this._m.w += (mt.w - this._m.w) * km;
      const lk = this._lookTarget();
      this._look.x += (lk.x - this._look.x) * kk;
      this._look.y += (lk.y - this._look.y) * kk;
      this._render();
      this._raf = requestAnimationFrame(this._tick);
    }

    _render() {
      const E = this._el, c = this._cache;
      const { o, w } = this._m;
      // くちばし：下のくちばしが下がり、そのすき間に口の中と舌が見える
      const H = 11 * o, hw = 6.5 + 3 * w;
      const md = H > .6 ? `M${f(120 - hw)} 129Q${f(120 - hw)} ${f(138 + H)} 120 ${f(139 + H)}Q${f(120 + hw)} ${f(138 + H)} ${f(120 + hw)} 129Z` : '';
      if (md !== c.md) {
        c.md = md;
        E.mouth.setAttribute('d', md);
        E.tongue.setAttribute('cx', 120);
        E.tongue.setAttribute('cy', f(136 + H * .62));
        E.tongue.setAttribute('rx', f(hw * .55));
        E.tongue.setAttribute('ry', H > 3 ? f(H * .32) : 0);
        E.beakLow.setAttribute('transform', `translate(0 ${f(H)})`);
      }
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

  window.YukiFukurou = YukiFukurou;
  customElements.define('yuki-fukurou', YukiFukurou);
})();
