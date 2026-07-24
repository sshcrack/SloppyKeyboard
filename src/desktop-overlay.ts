import { Bodies, Body, Composite, Engine, World } from 'matter-js';
import type { BallSnapshot, DesktopEffect, GooseState, ScreenRect } from './contracts';

const canvas = document.querySelector<HTMLCanvasElement>('#desktop-balls') as HTMLCanvasElement;
const context = canvas.getContext('2d') as CanvasRenderingContext2D;
const engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
const balls = new Map<string, Body>();
const floors = new Set<string>();
const colliders = new Map<string, Body>();
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
.omen-title{position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:900 54px "MS Sans Serif",Tahoma,sans-serif;text-shadow:4px 4px #000;animation:omen-title 1.55s ease-in-out forwards}.omen-title span{background:#000080;border:4px solid;border-color:#fff #000 #000 #fff;padding:22px 34px}.fracture{position:fixed;width:280px;height:280px;border-radius:50%;background:repeating-conic-gradient(from 11deg,#fff0 0 12deg,#fff 13deg 14deg,#0000 15deg 28deg);mix-blend-mode:difference;animation:vanish .9s forwards}.cameo,.cursor-goose{position:fixed;color:#fff;font:700 50px monospace;text-shadow:3px 3px #000;animation:vanish .7s forwards}.cursor-goose{animation-duration:5s}.effect-ball{position:fixed;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#fff 0 12%,#f00 20%,#700 80%);animation:fall 2.3s ease-in forwards}.eyes{position:fixed;width:375px;height:125px;background:url('${eyesAsset}') center/contain no-repeat;animation:eyes 3.2s ease-in-out forwards}.eyes.blink{animation:eyes 3.2s ease-in-out forwards,blink .16s step-end 2 1.15s}@keyframes omen-title{0%{opacity:0;transform:scale(.55)}28%,70%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(1.75)}}@keyframes vanish{to{opacity:0;transform:scale(1.5)}}@keyframes fall{to{opacity:0;transform:translateY(220px) rotate(360deg)}}@keyframes eyes{0%{opacity:0;transform:translateX(var(--slide))}18%,72%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(var(--slide))}}@keyframes blink{50%{clip-path:inset(45% 0)}}`;
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
    for (let i = 0; i < (effect.count ?? 15); i += 1) {
      const ball = document.createElement('i'); ball.className = 'effect-ball';
      ball.style.left = `${effect.x - window.screenX + (Math.random() - .5) * 240}px`;
      ball.style.top = `${effect.y - window.screenY + (Math.random() - .5) * 80}px`;
      effects.append(ball); setTimeout(() => ball.remove(), 2400);
    } return;
  }
  item.className = effect.kind;
  item.style.left = `${effect.x - window.screenX - 140}px`; item.style.top = `${effect.y - window.screenY - 140}px`;
  item.textContent = effect.kind === 'cameo' ? '◕ᴥ◕' : effect.kind === 'cursor-goose' ? '🪿' : '';
  effects.append(item); setTimeout(() => item.remove(), effect.kind === 'cursor-goose' ? 5100 : 950);
};
// The desktop overlay is intentionally click-through; all effects are visual only.
window.sloppyKeyboard.onDesktopEffect(addEffect);

const tick = (now: number): void => {
  Engine.update(engine, Math.min(now - last, 32));
  last = now;
  context.clearRect(0, 0, innerWidth, innerHeight);
  for (const body of balls.values()) {
    const gradient = context.createRadialGradient(body.position.x - 3, body.position.y - 4, 1, body.position.x, body.position.y, 10);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.24, '#f00');
    gradient.addColorStop(1, '#800');
    context.beginPath();
    context.arc(body.position.x, body.position.y, body.circleRadius ?? 9, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
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
