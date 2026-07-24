import { Bodies, Body, Composite, Engine, World } from 'matter-js';
import type { BallSnapshot, DesktopEffect, GooseState, ScreenRect } from './contracts';

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
document.head.append(effectStyle);

const addEffect = (effect: DesktopEffect): void => {
  if (effect.kind === 'omen-title') {
    const title = document.createElement('div'); title.className = 'omen-title'; title.innerHTML = '<span>SOMETHING CHANGED...</span>';
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
  item.style.left = `${effect.x - window.screenX - 140}px`; item.style.top = `${effect.y - window.screenY - 140}px`;
  if (effect.kind === 'fracture') {
    const colors = ['#ff006e', '#00f5ff', '#fff', '#ffe600', '#0066ff', '#fff'];
    item.replaceChildren(...colors.map((color, index) => {
      const shard = document.createElement('i');
      shard.style.setProperty('--color', color); shard.style.setProperty('--angle', `${index * 31 + 12}deg`);
      shard.style.setProperty('--clip', `${index % 2 ? '100% 0,86% 100%' : '100% 100%,0 78%'}`);
      shard.style.setProperty('--x', `${(index % 3 - 1) * 7}px`); shard.style.setProperty('--y', `${(index % 2) * 8 - 4}px`);
      return shard;
    }));
  } else if (effect.kind === 'cameo') {
    item.innerHTML = '<span class="speech">WRONG DESKTOP, SORRY</span><i class="leg a"></i><i class="leg b"></i><i class="critter"></i>';
  } else if (effect.kind === 'cursor-goose') {
    item.innerHTML = '<i class="goose-body"></i><i class="goose-neck"></i><i class="goose-head"></i><i class="goose-leg one"></i><i class="goose-leg two"></i><b class="peck">!!</b>';
  }
  effects.append(item); setTimeout(() => item.remove(), effect.kind === 'cursor-goose' ? 5100 : 950);
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
