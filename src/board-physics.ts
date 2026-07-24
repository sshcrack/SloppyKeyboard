import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  World,
} from 'matter-js';
import { SLOT_COUNT } from './board-state';
import {
  BALL_RADIUS,
  PIN_RADIUS,
  createPinLayout,
} from './pin-layout';

export const BOARD_WIDTH = 880;
export const BOARD_HEIGHT = 560;
export const LAUNCH_HEIGHT = 60;
export const BALL_LIMIT = 25;

const SLOT_TOP = 490;
const SLOT_WIDTH = BOARD_WIDTH / SLOT_COUNT;
const BALL_CATEGORY = 0x0002;
const SENSOR_CATEGORY = 0x0004;

export interface BallRecord {
  body: Body;
  bornAt: number;
}

export interface BoardPhysicsHooks {
  onLanding: (ballId: number, slot: number) => void;
  onAbandon: (ballId: number) => void;
}

export class BoardPhysics {
  readonly engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
  readonly balls = new Map<number, BallRecord>();
  private lastTime = performance.now();
  private animationFrame = 0;

  constructor(private readonly hooks: BoardPhysicsHooks) {
    this.createMachine();
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const sensor = pair.bodyA.label.startsWith('slot:')
          ? pair.bodyA
          : pair.bodyB.label.startsWith('slot:')
            ? pair.bodyB
            : null;
        const ball = pair.bodyA.label === 'ball'
          ? pair.bodyA
          : pair.bodyB.label === 'ball'
            ? pair.bodyB
            : null;
        if (sensor && ball && this.balls.has(ball.id)) {
          const slot = Number(sensor.label.split(':')[1]);
          this.removeBall(ball.id);
          this.hooks.onLanding(ball.id, slot);
        }
      }
    });
  }

  start(): void {
    const tick = (now: number): void => {
      const delta = Math.min(now - this.lastTime, 32);
      this.lastTime = now;
      Engine.update(this.engine, delta);
      this.removeExpired(now);
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.animationFrame);
  }

  launch(x: number): boolean {
    if (this.balls.size >= BALL_LIMIT) return false;
    const clampedX = Math.max(22, Math.min(BOARD_WIDTH - 22, x));
    const ball = Bodies.circle(clampedX, 31, BALL_RADIUS, {
      label: 'ball',
      restitution: 0.58,
      friction: 0.006,
      frictionAir: 0.0015,
      density: 0.002,
      collisionFilter: {
        category: BALL_CATEGORY,
        mask: 0x0001 | SENSOR_CATEGORY,
      },
    });
    Body.setVelocity(ball, {
      x: (Math.random() - 0.5) * 0.45,
      y: 0.5,
    });
    this.balls.set(ball.id, {
      body: ball,
      bornAt: performance.now(),
    });
    World.add(this.engine.world, ball);
    return true;
  }

  private removeBall(id: number): void {
    const record = this.balls.get(id);
    if (!record) return;
    Composite.remove(this.engine.world, record.body);
    this.balls.delete(id);
  }

  private isNearZero(value: number): boolean {
    return Math.abs(value) < 0.001;
  }

  private removeExpired(now: number): void {
    for (const [id, record] of this.balls) {
      const tooOld = now - record.bornAt > 500 && this.isNearZero(record.body.velocity.x) && this.isNearZero(record.body.velocity.y);
      const escaped = record.body.position.y > BOARD_HEIGHT + 80;
      if (tooOld || escaped) {
        this.removeBall(id);
        this.hooks.onAbandon(id);
      }
    }
  }

  private createMachine(): void {
    const solid = {
      isStatic: true,
      restitution: 0.48,
      friction: 0.01,
      collisionFilter: {
        category: 0x0001,
        mask: BALL_CATEGORY,
      },
    };
    const bodies: Body[] = [
      Bodies.rectangle(4, BOARD_HEIGHT / 2, 8, BOARD_HEIGHT, solid),
      Bodies.rectangle(
        BOARD_WIDTH - 4,
        BOARD_HEIGHT / 2,
        8,
        BOARD_HEIGHT,
        solid,
      ),
      Bodies.rectangle(
        BOARD_WIDTH / 2,
        BOARD_HEIGHT - 3,
        BOARD_WIDTH,
        6,
        solid,
      ),
    ];

    this.addPins(bodies, solid);
    this.addSlots(bodies, solid);
    World.add(this.engine.world, bodies);
  }

  private addPins(bodies: Body[], options: object): void {
    for (const pin of createPinLayout(BOARD_WIDTH)) {
      bodies.push(Bodies.circle(pin.x, pin.y, PIN_RADIUS, options));
    }
  }

  private addSlots(bodies: Body[], options: object): void {
    for (let slot = 0; slot <= SLOT_COUNT; slot += 1) {
      bodies.push(Bodies.rectangle(
        slot * SLOT_WIDTH,
        527,
        5,
        72,
        options,
      ));
    }
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      bodies.push(Bodies.rectangle(
        slot * SLOT_WIDTH + SLOT_WIDTH / 2,
        SLOT_TOP + 28,
        SLOT_WIDTH - 8,
        18,
        {
          isStatic: true,
          isSensor: true,
          label: `slot:${slot}`,
          collisionFilter: {
            category: SENSOR_CATEGORY,
            mask: BALL_CATEGORY,
          },
        },
      ));
    }
  }
}
