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
import type { BallSnapshot, GooseState, ScreenRect } from './contracts';
import { screenToCanvas } from './coordinates';
import { shouldEscape, shouldHunt } from './goose-rules';

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
  appId: string;
  huntEligible: boolean;
}

export interface BoardPhysicsHooks {
  onLanding: (ballId: number, slot: number) => void;
  onAbandon: (ballId: number) => void;
  onEscape: (ballId: number, snapshot: BallSnapshot) => void;
}

export class BoardPhysics {
  readonly engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
  readonly balls = new Map<number, BallRecord>();
  private lastTime = performance.now();
  private animationFrame = 0;
  private nextBallId = 1;
  private gooseConnected = false;
  private externalBodies = new Map<string, Body>();
  private carriedBalls = new Set<string>();

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
          if (this.gooseConnected && shouldEscape()) {
            const record = this.balls.get(ball.id) as BallRecord;
            const snapshot = this.snapshot(record, { x: 0, y: 0, width: BOARD_WIDTH, height: BOARD_HEIGHT });
            this.removeBall(ball.id);
            this.hooks.onEscape(ball.id, snapshot);
            continue;
          }
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

  launch(x: number): string | false {
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
    const appId = `ball-${Date.now().toString(36)}-${this.nextBallId++}`;
    this.balls.set(ball.id, {
      body: ball,
      bornAt: performance.now(),
      appId,
      huntEligible: shouldHunt(),
    });
    World.add(this.engine.world, ball);
    return appId;
  }

  snapshots(canvasBounds: ScreenRect): BallSnapshot[] {
    return [...this.balls.values()].map((record) => this.snapshot(record, canvasBounds));
  }

  syncGoose(state: GooseState, canvasBounds: ScreenRect): void {
    this.gooseConnected = state.connected;
    const carriedNow = new Set<string>();
    for (const carry of state.carries) {
      const record = [...this.balls.values()].find((candidate) =>
        candidate.appId === carry.ballId);
      if (!record) continue;
      const point = screenToCanvas(carry, canvasBounds, BOARD_WIDTH, BOARD_HEIGHT);
      Body.setPosition(record.body, point);
      if (carry.released) {
        Body.setStatic(record.body, false);
        Body.setVelocity(record.body, {
          x: carry.velocityX,
          y: Math.max(1.5, carry.velocityY),
        });
      } else {
        carriedNow.add(carry.ballId);
        if (!record.body.isStatic) Body.setStatic(record.body, true);
        Body.setVelocity(record.body, { x: 0, y: 0 });
      }
    }
    for (const ballId of this.carriedBalls) {
      if (carriedNow.has(ballId)) continue;
      const record = [...this.balls.values()].find((candidate) =>
        candidate.appId === ballId);
      if (record?.body.isStatic) Body.setStatic(record.body, false);
    }
    this.carriedBalls = carriedNow;
    const live = new Set<string>();
    for (const collider of state.colliders) {
      // Goose bodies are visual tracking data, not physical ball colliders.
      // Intentional interaction happens through the carry protocol below.
      if (collider.kind === 'circle') continue;
      live.add(collider.id);
      let body = this.externalBodies.get(collider.id);
      const topLeft = screenToCanvas(collider.bounds, canvasBounds, BOARD_WIDTH, BOARD_HEIGHT);
      const width = collider.bounds.width * BOARD_WIDTH / canvasBounds.width;
      const height = collider.bounds.height * BOARD_HEIGHT / canvasBounds.height;
      if (!body || body.circleRadius || Math.abs(body.bounds.max.x - body.bounds.min.x - width) > 1) {
        if (body) Composite.remove(this.engine.world, body);
        body = Bodies.rectangle(topLeft.x + width / 2, topLeft.y + height / 2, width, height, {
          isStatic: true, label: `goose-window:${collider.id}`, restitution: 0.72,
        });
        this.externalBodies.set(collider.id, body);
        World.add(this.engine.world, body);
      }
      Body.setPosition(body, { x: topLeft.x + width / 2, y: topLeft.y + height / 2 });
      Body.setVelocity(body, { x: collider.velocityX, y: collider.velocityY });
    }
    for (const [id, body] of this.externalBodies) {
      if (!live.has(id)) {
        Composite.remove(this.engine.world, body);
        this.externalBodies.delete(id);
      }
    }
  }

  private snapshot(record: BallRecord, canvasBounds: ScreenRect): BallSnapshot {
    const xScale = canvasBounds.width / BOARD_WIDTH;
    const yScale = canvasBounds.height / BOARD_HEIGHT;
    return {
      id: record.appId,
      x: canvasBounds.x + record.body.position.x * xScale,
      y: canvasBounds.y + record.body.position.y * yScale,
      radius: BALL_RADIUS * xScale,
      velocityX: record.body.velocity.x * xScale,
      velocityY: record.body.velocity.y * yScale,
      space: 'screen',
      huntEligible: record.huntEligible,
    };
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
