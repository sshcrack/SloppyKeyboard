import {
  GOOSE_PROTOCOL_VERSION,
  GooseCollider,
  GooseCarry,
  GooseState,
} from './contracts';

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const parseGooseMessage = (line: string, now = Date.now()): GooseState | null => {
  let value: unknown;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.protocolVersion !== GOOSE_PROTOCOL_VERSION || !Array.isArray(message.colliders)) return null;
  const colliders: GooseCollider[] = [];
  for (const raw of message.colliders) {
    if (!raw || typeof raw !== 'object') return null;
    const collider = raw as Record<string, unknown>;
    if (collider.kind === 'circle'
      && (collider.id === 'body' || collider.id === 'head')
      && [collider.x, collider.y, collider.radius, collider.velocityX, collider.velocityY].every(finite)) {
      colliders.push(collider as unknown as GooseCollider);
    } else if (collider.kind === 'window' && typeof collider.id === 'string'
      && collider.bounds && typeof collider.bounds === 'object'
      && Object.values(collider.bounds).every(finite)
      && finite(collider.velocityX) && finite(collider.velocityY)) {
      colliders.push(collider as unknown as GooseCollider);
    } else return null;
  }
  const carries: GooseCarry[] = [];
  if (message.carries !== undefined) {
    if (!Array.isArray(message.carries)) return null;
    for (const raw of message.carries) {
      if (!raw || typeof raw !== 'object') return null;
      const carry = raw as Record<string, unknown>;
      if (typeof carry.ballId !== 'string'
        || ![carry.x, carry.y, carry.velocityX, carry.velocityY].every(finite)
        || typeof carry.released !== 'boolean') return null;
      carries.push(carry as unknown as GooseCarry);
    }
  }
  return {
    protocolVersion: GOOSE_PROTOCOL_VERSION,
    connected: true,
    receivedAt: now,
    colliders,
    carries,
  };
};
