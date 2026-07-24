import { connect, Socket } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import type { GooseState } from './contracts';
import { GooseBridge } from './goose-bridge';

const clients: Socket[] = [];
let bridge: GooseBridge | null = null;
const testPipe = `\\\\.\\pipe\\sloppy-keyboard-goose-test-${process.pid}`;
afterEach(() => {
  clients.forEach((client) => client.destroy());
  clients.length = 0;
  bridge?.stop();
  bridge = null;
});

const openClient = (): Promise<Socket> => new Promise((resolve, reject) => {
  const client = connect(testPipe, () => resolve(client));
  client.once('error', reject);
  clients.push(client);
});

describe('GooseBridge multiple instances', () => {
  it('keeps both clients connected and namespaces their colliders', async () => {
    const states: GooseState[] = [];
    bridge = new GooseBridge((state) => states.push(state), testPipe);
    bridge.start();
    const first = await openClient();
    const second = await openClient();
    const snapshot = JSON.stringify({
      protocolVersion: 1,
      colliders: [{
        id: 'body', kind: 'circle', x: 1, y: 2, radius: 3,
        velocityX: 0, velocityY: 0,
      }],
    });
    first.write(`${snapshot}\n`);
    second.write(`${snapshot}\n`);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const latest = states[states.length - 1];
    expect(latest?.connected).toBe(true);
    expect(latest?.colliders.map((collider) => collider.id)).toEqual([
      'goose-1:body',
      'goose-2:body',
    ]);
    expect(first.destroyed).toBe(false);
    expect(second.destroyed).toBe(false);
  });
});
