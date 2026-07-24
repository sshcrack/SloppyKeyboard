import { describe, expect, it } from 'vitest';
import { parseGooseMessage } from './goose-protocol';
describe('Goose wire validation', () => {
  it('rejects malformed and mismatched messages', () => {
    expect(parseGooseMessage('{')).toBeNull();
    expect(parseGooseMessage('{"protocolVersion":2,"colliders":[]}')).toBeNull();
    expect(parseGooseMessage('{"protocolVersion":1,"colliders":[{"kind":"circle"}]}')).toBeNull();
  });
  it('accepts a valid snapshot', () => {
    const state = parseGooseMessage(JSON.stringify({
      protocolVersion: 1,
      colliders: [{ id: 'body', kind: 'circle', x: -20, y: 4, radius: 20, velocityX: 1, velocityY: 2 }],
    }), 42);
    expect(state?.receivedAt).toBe(42);
    expect(state?.carries).toEqual([]);
  });
  it('validates carried-ball updates', () => {
    const state = parseGooseMessage(JSON.stringify({
      protocolVersion: 1,
      colliders: [],
      carries: [{
        ballId: 'ball-1', x: -40, y: 80, velocityX: 3,
        velocityY: 4, released: false,
      }],
    }));
    expect(state?.carries[0]).toMatchObject({
      ballId: 'ball-1',
      released: false,
    });
  });
});
