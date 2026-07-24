import { Bodies, Body, Composite, Engine, World } from 'matter-js';
import type { BallSnapshot, GooseState, ScreenRect } from './contracts';

const canvas = document.querySelector<HTMLCanvasElement>('#desktop-balls') as HTMLCanvasElement;
const context = canvas.getContext('2d') as CanvasRenderingContext2D;
const engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
const balls = new Map<string, Body>();
const floors = new Set<string>();
const colliders = new Map<string, Body>();
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
