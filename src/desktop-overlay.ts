import { Bodies, Body, Composite, Engine, World } from 'matter-js';
import type { BallSnapshot, DesktopEffect, GooseState, ScreenRect } from './contracts';
import { runMinecraftDig } from './minecraft-surprise';

const canvas = document.querySelector<HTMLCanvasElement>('#desktop-balls') as HTMLCanvasElement;
const context = canvas.getContext('2d') as CanvasRenderingContext2D;
const engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
const balls = new Map<string, Body>();
const floors = new Set<string>();
const colliders = new Map<string, Body>();
const ballLooks = new Map<string, { color: string; face: string }>();
const effects = document.querySelector<HTMLDivElement>('#effects') as HTMLDivElement;
// webpack copies this project-bound alpha asset into the renderer bundle.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eyesAsset = require('../assets/omen/eyes-open-small.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const maskAsset = require('../assets/jumpscares/porcelain-mask-small.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const clippyAsset = require('../assets/clippy/construction-clippy-small.png') as string;
let last = performance.now();

const local = (x: number, y: number): { x: number; y: number } => ({
  x: x - window.screenX, y: y - window.screenY,
});

const resize = (): void => {
  const ratio = devicePixelRatio || 1;
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const addFloor = (area: ScreenRect): void => {
  const key = `${area.x}:${area.y}:${area.width}:${area.height}`;
  if (floors.has(key)) return;
  floors.add(key);
  const bottom = local(area.x + area.width / 2, area.y + area.height);
  World.add(engine.world, Bodies.rectangle(bottom.x, bottom.y + 8, area.width, 16, {
    isStatic: true, restitution: 0.45, friction: 0.18,
  }));
};

window.sloppyKeyboard.onEscapedBall(({ ball, workArea }) => {
  if (balls.has(ball.id)) return;
  addFloor(workArea);
  const point = local(ball.x, ball.y);
  const body = Bodies.circle(point.x, point.y, ball.radius, {
    restitution: 0.58, friction: 0.006, frictionAir: 0.0015,
  });
  Body.setVelocity(body, { x: ball.velocityX, y: ball.velocityY });
  balls.set(ball.id, body);
  World.add(engine.world, body);
});

const syncGoose = (state: GooseState): void => {
  const live = new Set<string>();
  for (const item of state.colliders) {
    if (item.kind === 'circle') continue;
    live.add(item.id);
    let body = colliders.get(item.id);
    const point = local(item.bounds.x, item.bounds.y);
    const width = item.bounds.width;
    const height = item.bounds.height;
    if (!body || body.circleRadius || Math.abs(body.bounds.max.x - body.bounds.min.x - width) > 1) {
      if (body) Composite.remove(engine.world, body);
      body = Bodies.rectangle(point.x + width / 2, point.y + height / 2, width, height, { isStatic: true, restitution: 0.72 });
      colliders.set(item.id, body);
      World.add(engine.world, body);
    }
    Body.setPosition(body, { x: point.x + width / 2, y: point.y + height / 2 });
    Body.setVelocity(body, { x: item.velocityX, y: item.velocityY });
  }
  for (const [id, body] of colliders) if (!live.has(id)) {
    Composite.remove(engine.world, body);
    colliders.delete(id);
  }
};
window.sloppyKeyboard.onGooseState(syncGoose);

const effectStyle = document.createElement('style');
effectStyle.textContent = `
.omen-title{position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:900 54px "MS Sans Serif",Tahoma,sans-serif;text-shadow:4px 4px #000;animation:omen-title 1.55s ease-in-out forwards}.omen-title span{background:#000080;border:4px solid;border-color:#fff #000 #000 #fff;padding:22px 34px}
.fracture{position:fixed;width:340px;height:260px;filter:drop-shadow(7px 7px 0 #0008);animation:rupture .9s steps(7,end) forwards}.fracture:before{content:"FATAL DESKTOP EXCEPTION";position:absolute;z-index:4;left:44px;top:103px;padding:5px 8px;color:#fff;background:#000080;border:3px solid;border-color:#fff #111 #111 #fff;font:700 11px "MS Sans Serif",Tahoma,sans-serif;white-space:nowrap}.fracture i{position:absolute;inset:0;background:linear-gradient(var(--angle),transparent 46%,var(--color) 47% 50%,transparent 51%),repeating-linear-gradient(0deg,transparent 0 17px,#fff9 18px,#000 19px);clip-path:polygon(50% 50%,var(--clip));transform:translate(var(--x),var(--y));mix-blend-mode:difference}
.cameo{position:fixed;width:190px;height:120px;animation:creature-trip .7s steps(7,end) forwards}.cameo .speech{position:absolute;left:10px;top:-34px;padding:5px 7px;background:#ffffc0;border:2px solid #000;color:#000;font:700 11px "MS Sans Serif",Tahoma,sans-serif;box-shadow:3px 3px #0005;white-space:nowrap}.critter{position:absolute;left:62px;top:25px;width:64px;height:52px;background:#7cff00;border:5px solid #082000;box-shadow:inset 8px 0 #caff82,inset -8px 0 #349000,6px 6px #0006}.critter:before{content:"••";position:absolute;left:11px;top:5px;color:#000;font:900 28px monospace;letter-spacing:8px}.critter:after{content:"▔";position:absolute;left:21px;top:23px;color:#000;font:900 22px monospace}.leg{position:absolute;top:72px;width:40px;height:8px;background:#082000;transform-origin:right}.leg.a{left:32px;transform:rotate(-28deg)}.leg.b{right:31px;transform:rotate(28deg)}
.cursor-goose{position:fixed;width:150px;height:130px;animation:goose-arrival 5s steps(10,end) forwards}.goose-body{position:absolute;left:38px;top:55px;width:72px;height:48px;background:#f7f7e8;border:5px solid #17170d;border-radius:52% 45% 48% 52%;box-shadow:inset -9px -7px #b8b8aa,5px 5px #0005}.goose-neck{position:absolute;left:80px;top:16px;width:24px;height:62px;background:#f7f7e8;border:5px solid #17170d;border-bottom:0;border-radius:45% 45% 0 0;transform:rotate(8deg)}.goose-head{position:absolute;left:76px;top:7px;width:43px;height:31px;background:#f7f7e8;border:5px solid #17170d;border-radius:50%}.goose-head:before{content:"";position:absolute;right:7px;top:6px;width:5px;height:5px;background:#000}.goose-head:after{content:"";position:absolute;right:-26px;top:14px;width:27px;height:10px;background:#f39800;border:4px solid #17170d;border-left:0}.goose-leg{position:absolute;top:100px;width:5px;height:22px;background:#e98800}.goose-leg.one{left:62px}.goose-leg.two{left:91px}.peck{position:absolute;right:0;top:28px;color:#ff0;font:900 22px monospace;text-shadow:2px 2px #000;animation:peck .45s steps(2,end) 7}
.eyes{position:fixed;width:375px;height:125px;background:url('${eyesAsset}') center/contain no-repeat;animation:eyes 3.2s ease-in-out forwards}.eyes.blink{animation:eyes 3.2s ease-in-out forwards,blink .16s step-end 2 1.15s}
@keyframes omen-title{0%{opacity:0;transform:scale(.55)}28%,70%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(1.75)}}@keyframes rupture{0%{opacity:0;transform:scale(.1) rotate(8deg)}25%{opacity:1;transform:scale(1.08) rotate(-2deg)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}@keyframes creature-trip{0%{opacity:0;transform:translate(-180px,60px) rotate(-14deg)}22%{opacity:1;transform:translate(0) rotate(0)}62%{transform:translate(0) rotate(0)}78%{transform:translate(15px,-8px) rotate(9deg)}100%{opacity:0;transform:translate(210px,-90px) rotate(25deg)}}@keyframes goose-arrival{0%{opacity:0;transform:translate(-130px,80px) rotate(-12deg)}12%,82%{opacity:1;transform:translate(0)}88%{transform:translate(5px,10px) rotate(8deg)}100%{opacity:0;transform:translate(180px,-80px)}}@keyframes peck{50%{transform:scale(1.7) rotate(18deg)}}@keyframes eyes{0%{opacity:0;transform:translateX(var(--slide))}18%,72%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(var(--slide))}}@keyframes blink{50%{clip-path:inset(45% 0)}}`;
effectStyle.textContent += `
.omen-title{background:radial-gradient(circle,#06060a66,#000c);overflow:hidden}.omen-title span{position:relative;background:#080808;border-color:#a9a9a9 #202020 #202020 #a9a9a9;color:#ddd;letter-spacing:.16em;animation:omen-chroma 1.55s steps(8,end)}.omen-title span:before,.omen-title span:after{content:attr(data-text);position:absolute;inset:22px 34px;mix-blend-mode:screen;opacity:.75}.omen-title span:before{color:#00eaff;transform:translate(-5px,2px);clip-path:inset(0 0 48%)}.omen-title span:after{color:#ff174d;transform:translate(6px,-2px);clip-path:inset(52% 0 0)}
.fracture{inset:0;width:auto;height:auto;filter:none;animation:none;overflow:hidden}.fracture:before{display:none}.fracture:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0000 0 5px,#fff1 6px),linear-gradient(90deg,#f004,#0000 35%,#0ff4 70%,#0000);mix-blend-mode:screen;opacity:0;animation:screen-corrupt 4.1s steps(9,end)}.crack-layer{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(1px 1px #000)}.clippy-smash{position:absolute;left:calc(var(--hit-x) - 86px);top:calc(var(--hit-y) - 150px);width:172px;height:180px;animation:clippy-enter 4.1s ease-in-out forwards}.clip-body{position:absolute;left:48px;top:30px;width:72px;height:108px;border:13px solid #a8adb7;border-radius:46%;box-shadow:inset 4px 3px #f4f7ff,5px 6px #0005}.clip-body:before,.clip-body:after{content:"";position:absolute;top:23px;width:19px;height:25px;background:#fff;border:3px solid #111;border-radius:50%}.clip-body:before{left:7px}.clip-body:after{right:7px}.clip-mouth{position:absolute;left:72px;top:92px;width:27px;height:11px;border-bottom:4px solid #111;border-radius:50%}.hammer{position:absolute;left:104px;top:18px;width:18px;height:105px;background:#6b3b18;border:4px solid #1b0c03;transform-origin:9px 93px;animation:hammer-swing 4.1s cubic-bezier(.3,.8,.2,1) forwards}.hammer:before{content:"";position:absolute;left:-28px;top:-14px;width:72px;height:31px;background:linear-gradient(#ddd,#777);border:5px solid #171717}.clippy-caption{position:absolute;left:-36px;top:-13px;padding:5px 7px;background:#ffffc0;border:2px solid #111;box-shadow:3px 3px #0005;font:bold 10px "MS Sans Serif",Tahoma,sans-serif;white-space:nowrap}
.cameo,.cursor-goose{inset:0;width:auto;height:auto;background:#000;animation:jumpscare 1.05s steps(5,end) forwards}.cameo:before,.cursor-goose:before{content:"";position:absolute;inset:-12%;background-position:center;background-repeat:no-repeat;background-size:contain;filter:contrast(1.35) drop-shadow(0 0 35px #fff5)}.cameo:before{background-image:url('${maskAsset}')}.cursor-goose:before{background-image:url('${eyesAsset}');background-size:105% auto;filter:contrast(1.7) grayscale(1)}.cameo:after,.cursor-goose:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0000 0 4px,#fff2 5px),linear-gradient(90deg,#f004,#0000,#0ff4);mix-blend-mode:screen;animation:jumpscare-static .12s steps(2,end) infinite}
.steve-dig{position:fixed;inset:0}.mine-hole{position:absolute;left:calc(var(--dig-x) - 96px);top:calc(var(--dig-y) - 72px);width:192px;height:144px;background:#020306;box-shadow:inset 0 0 35px #000,0 0 0 5px #111;clip-path:polygon(0 0,100% 0,100% 100%,0 100%);animation:hole-cycle 5s steps(6,end) forwards}.mine-hole i{position:absolute;width:48px;height:48px;background:linear-gradient(135deg,#777,#333);border:3px solid #111;animation:block-break 2.4s steps(5,end) forwards}.mine-hole i:nth-child(2){left:48px;animation-delay:.12s}.mine-hole i:nth-child(3){left:96px;animation-delay:.24s}.mine-hole i:nth-child(4){left:144px;animation-delay:.36s}.mine-hole i:nth-child(5){top:48px;animation-delay:.48s}.mine-hole i:nth-child(6){left:48px;top:48px;animation-delay:.6s}.mine-hole i:nth-child(7){left:96px;top:48px;animation-delay:.72s}.mine-hole i:nth-child(8){left:144px;top:48px;animation-delay:.84s}.steve{position:absolute;z-index:3;left:calc(var(--dig-x) - 34px);top:calc(var(--dig-y) - 190px);width:68px;height:150px;image-rendering:pixelated;animation:steve-drop 5s steps(12,end) forwards}.steve-head{position:absolute;left:10px;width:48px;height:48px;background:#b97850;border:6px solid #3b241b;box-shadow:inset 0 12px #38251f}.steve-head:before{content:"▪  ▪";position:absolute;top:16px;left:7px;color:#bde9ff;font:bold 17px monospace}.steve-body{position:absolute;left:8px;top:48px;width:52px;height:58px;background:#18a9a9;border:6px solid #075d68}.steve-leg{position:absolute;top:102px;width:25px;height:46px;background:#3347a6;border:5px solid #17225c}.steve-leg.a{left:8px}.steve-leg.b{right:8px}.pickaxe{position:absolute;left:50px;top:48px;width:8px;height:92px;background:#75401d;transform-origin:4px 75px;animation:pick-swing .42s steps(3,end) 7}.pickaxe:before{content:"";position:absolute;left:-29px;top:-6px;width:62px;height:12px;background:#aaa;border:3px solid #222}
@keyframes omen-chroma{0%,100%{transform:skew(0)}20%{transform:skew(-4deg) translateX(-3px)}24%{transform:skew(5deg) translateX(4px)}62%{filter:blur(0)}64%{filter:blur(2px)}}@keyframes clippy-enter{0%{opacity:0;transform:translate(-180px,-80px) rotate(-20deg)}18%,75%{opacity:1;transform:translate(0)}88%{opacity:1;transform:translate(20px,-8px)}100%{opacity:0;transform:translate(240px,-120px)}}@keyframes hammer-swing{0%,25%{transform:rotate(-62deg)}42%{transform:rotate(36deg)}46%,100%{transform:rotate(18deg)}}@keyframes screen-corrupt{0%,38%{opacity:0}42%{opacity:1;transform:translateX(18px)}48%{transform:translateX(-12px)}60%,86%{opacity:.8;transform:none}100%{opacity:0}}@keyframes jumpscare{0%{opacity:0;transform:scale(.15)}8%{opacity:1;transform:scale(1.18)}18%{transform:scale(.98) translate(7px,-4px)}72%{opacity:1;transform:scale(1.04)}100%{opacity:0;transform:scale(1.4)}}@keyframes jumpscare-static{50%{transform:translate(7px,-3px);filter:hue-rotate(90deg)}}@keyframes pick-swing{50%{transform:rotate(-85deg)}}@keyframes block-break{0%{filter:brightness(1)}20%{background:repeating-linear-gradient(45deg,#777 0 8px,#111 9px 11px)}60%{transform:scale(.85);opacity:1}100%{transform:scale(0);opacity:0}}@keyframes steve-drop{0%{opacity:0;transform:translateX(-220px)}12%,55%{opacity:1;transform:translateX(0)}72%{transform:translateY(15px)}88%{opacity:1;transform:translateY(180px) scale(.7)}100%{opacity:0;transform:translateY(210px) scale(.5)}}@keyframes hole-cycle{0%,12%{transform:scale(0);opacity:0}42%,82%{transform:scale(1);opacity:1}100%{transform:scale(0);opacity:0}}`;
effectStyle.textContent += `
.clippy-smash{width:300px;height:300px;left:calc(var(--hit-x) - 150px);top:calc(var(--hit-y) - 280px);background:url('${clippyAsset}') center/contain no-repeat;animation:clippy-real 8.35s ease-in-out forwards;transform-origin:65% 82%}.clippy-smash .clip-body,.clippy-smash .clip-mouth,.clippy-smash .hammer{display:none}.clippy-caption{left:-5px;top:5px}.fracture:after{animation-duration:8.35s}.minecraft-monitor{position:fixed;overflow:hidden}.minecraft-3d{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 8px 5px #0008)}@keyframes clippy-real{0%{opacity:0;transform:translate(-220px,80px) rotate(-12deg) scale(.72)}12%{opacity:1;transform:translate(0) rotate(-18deg) scale(1)}18%{transform:rotate(15deg) scale(1.08)}22%,72%{opacity:1;transform:rotate(0) scale(1)}76%{transform:rotate(-7deg) translateY(-8px)}82%{transform:rotate(7deg) translateY(3px)}100%{opacity:0;transform:translate(260px,-130px) rotate(22deg) scale(.78)}}`;
document.head.append(effectStyle);

interface CrackPath {
  points: Array<{ x: number; y: number }>;
  birth: number;
  width: number;
}

const animateCracks = (canvasElement: HTMLCanvasElement, x: number, y: number): void => {
  const ratio = devicePixelRatio || 1;
  const width = canvasElement.clientWidth;
  const height = canvasElement.clientHeight;
  canvasElement.width = width * ratio;
  canvasElement.height = height * ratio;
  const crack = canvasElement.getContext('2d') as CanvasRenderingContext2D;
  crack.scale(ratio, ratio);
  crack.lineCap = 'round';
  crack.lineJoin = 'round';
  const paths: CrackPath[] = [];
  const branch = (
    startX: number,
    startY: number,
    angle: number,
    length: number,
    depth: number,
    birth: number,
  ): void => {
    const points = [{ x: startX, y: startY }];
    let px = startX;
    let py = startY;
    for (let step = 0; step < 9; step += 1) {
      angle += (Math.random() - .5) * .42;
      const segment = length * (.07 + Math.random() * .065);
      px += Math.cos(angle) * segment; py += Math.sin(angle) * segment;
      points.push({ x: px, y: py });
      if (depth > 0 && step > 1 && Math.random() < .38) {
        branch(
          px,
          py,
          angle + (Math.random() < .5 ? -1 : 1) * (.4 + Math.random()),
          length * .48,
          depth - 1,
          birth + step / 26,
        );
      }
    }
    paths.push({ points, birth, width: depth === 2 ? 2.4 : depth === 1 ? 1.6 : .9 });
  };
  for (let ray = 0; ray < 22; ray += 1) {
    branch(
      x,
      y,
      ray / 22 * Math.PI * 2 + Math.random() * .22,
      260 + Math.random() * Math.max(width, height) * .46,
      2,
      ray / 100,
    );
  }

  const startedAt = performance.now();
  const draw = (now: number): void => {
    const elapsed = now - startedAt;
    const growth = Math.min(1, elapsed / 520);
    const repair = elapsed < 5_050 ? 0 : Math.min(1, (elapsed - 5_050) / 1_550);
    const visible = Math.max(0, growth - repair);
    crack.clearRect(0, 0, width, height);
    for (const path of paths) {
      const localProgress = Math.max(0, Math.min(1, (visible - path.birth) / .55));
      const pointCount = Math.ceil((path.points.length - 1) * localProgress) + 1;
      if (pointCount < 2) continue;
      crack.beginPath();
      crack.moveTo(path.points[0].x, path.points[0].y);
      for (let index = 1; index < pointCount; index += 1) {
        crack.lineTo(path.points[index].x, path.points[index].y);
      }
      crack.strokeStyle = '#030509';
      crack.lineWidth = path.width + 2.1;
      crack.stroke();
      crack.strokeStyle = '#f0f8ff';
      crack.lineWidth = path.width;
      crack.stroke();
    }
    if (visible > .02) {
      const craterRadius = 5 + visible * 20;
      const gradient = crack.createRadialGradient(x, y, 1, x, y, craterRadius);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(.22, '#091018');
      gradient.addColorStop(.5, '#eaf7ff');
      gradient.addColorStop(1, '#ffffff00');
      crack.fillStyle = gradient;
      crack.beginPath();
      crack.arc(x, y, craterRadius, 0, Math.PI * 2);
      crack.fill();
    }
    if (elapsed < 6_650) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
};

const playGlassImpact = (): void => {
  const audio = new AudioContext();
  const gain = audio.createGain();
  gain.gain.setValueAtTime(.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .42);
  gain.connect(audio.destination);
  const buffer = audio.createBuffer(1, audio.sampleRate * .45, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * Math.exp(-index / (audio.sampleRate * .11));
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start();
  source.onended = () => void audio.close();
};

const addEffect = (effect: DesktopEffect): void => {
  if (effect.kind === 'omen-title') {
    const title = document.createElement('div'); title.className = 'omen-title'; title.innerHTML = '<span data-text="SOMETHING CHANGED...">SOMETHING CHANGED...</span>';
    effects.append(title); setTimeout(() => title.remove(), 1700); return;
  }
  if (effect.kind === 'eyes') {
    const eyes = document.createElement('div'); eyes.className = 'eyes blink';
    eyes.style.top = `${Math.max(20, effect.y - window.screenY - 62)}px`;
    eyes.style.left = effect.side === 'left' ? '-75px' : `${innerWidth - 300}px`;
    eyes.style.setProperty('--slide', effect.side === 'left' ? '-180px' : '180px');
    effects.append(eyes); setTimeout(() => eyes.remove(), 3300); return;
  }
  const item = document.createElement('div');
  if (effect.kind === 'balls') {
    addFloor({ x: window.screenX, y: window.screenY, width: innerWidth, height: innerHeight });
    const colors = ['#ff2b2b', '#ffe629', '#00e5ff', '#ff55dd', '#75ff45'];
    const faces = ['•ᴗ•', '×﹏×', 'ಠ_ಠ', '•ω•', '?!'];
    for (let i = 0; i < (effect.count ?? 15); i += 1) {
      const id = `cup-ball-${Date.now()}-${i}`;
      const radius = 10 + Math.random() * 7;
      const point = local(effect.x + (Math.random() - .5) * 90, effect.y + (Math.random() - .5) * 35);
      const body = Bodies.circle(point.x, point.y, radius, { restitution: .82, friction: .03, frictionAir: .003 });
      Body.setVelocity(body, { x: (Math.random() - .5) * 13, y: -5 - Math.random() * 8 });
      balls.set(id, body); ballLooks.set(id, { color: colors[i % colors.length], face: faces[i % faces.length] });
      World.add(engine.world, body);
      setTimeout(() => { Composite.remove(engine.world, body); balls.delete(id); ballLooks.delete(id); }, 8_000);
    } return;
  }
  item.className = effect.kind;
  if (effect.kind === 'fracture') {
    const hitX = effect.x - effect.area.x;
    const hitY = effect.y - effect.area.y;
    item.style.left = `${effect.area.x - window.screenX}px`;
    item.style.top = `${effect.area.y - window.screenY}px`;
    item.style.right = 'auto';
    item.style.bottom = 'auto';
    item.style.width = `${effect.area.width}px`;
    item.style.height = `${effect.area.height}px`;
    item.style.setProperty('--hit-x', `${hitX}px`); item.style.setProperty('--hit-y', `${hitY}px`);
    item.innerHTML = '<canvas class="crack-layer"></canvas><div class="clippy-smash"><span class="clippy-caption">It looks like you\'re using a screen.</span></div>';
    effects.append(item);
    setTimeout(() => {
      playGlassImpact();
      animateCracks(item.querySelector('.crack-layer') as HTMLCanvasElement, hitX, hitY);
    }, 1_560);
    setTimeout(() => item.remove(), 8_400); return;
  }
  if (effect.kind === 'steve-dig') {
    item.className = 'minecraft-monitor';
    item.style.left = `${effect.area.x - window.screenX}px`;
    item.style.top = `${effect.area.y - window.screenY}px`;
    item.style.width = `${effect.area.width}px`;
    item.style.height = `${effect.area.height}px`;
    effects.append(item);
    runMinecraftDig(item, effect.x - effect.area.x, effect.y - effect.area.y);
    setTimeout(() => item.remove(), 13_500); return;
  }
  effects.append(item); setTimeout(() => item.remove(), 1_100);
};
// The desktop overlay is intentionally click-through; all effects are visual only.
window.sloppyKeyboard.onDesktopEffect(addEffect);

const tick = (now: number): void => {
  Engine.update(engine, Math.min(now - last, 32));
  last = now;
  context.clearRect(0, 0, innerWidth, innerHeight);
  for (const [id, body] of balls) {
    const look = ballLooks.get(id);
    const radius = body.circleRadius ?? 9;
    const gradient = context.createRadialGradient(body.position.x - 3, body.position.y - 4, 1, body.position.x, body.position.y, 10);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.24, look?.color ?? '#f00');
    gradient.addColorStop(1, look ? '#111' : '#800');
    context.beginPath();
    context.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    if (look && radius >= 11) {
      context.fillStyle = '#111'; context.font = `bold ${Math.max(7, radius * .62)}px monospace`;
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(look.face, body.position.x, body.position.y + 1, radius * 1.55);
    }
  }
  const snapshots: BallSnapshot[] = [...balls].map(([id, body]) => ({
    id, x: window.screenX + body.position.x, y: window.screenY + body.position.y,
    radius: body.circleRadius ?? 9, velocityX: body.velocity.x, velocityY: body.velocity.y,
    space: 'screen', huntEligible: false,
  }));
  window.sloppyKeyboard.sendGooseBalls(snapshots, {
    x: window.screenX, y: window.screenY, width: innerWidth, height: innerHeight,
  }, null);
  requestAnimationFrame(tick);
};
resize();
addEventListener('resize', resize);
requestAnimationFrame(tick);
