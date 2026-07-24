import { createServer, Server, Socket } from 'net';
import type {
  BallSnapshot,
  GooseCollider,
  GooseState,
  ScreenRect,
} from './contracts';
import { GOOSE_PROTOCOL_VERSION } from './contracts';
import { parseGooseMessage } from './goose-protocol';

export const GOOSE_PIPE = '\\\\.\\pipe\\sloppy-keyboard-goose-v1';

interface GooseSession {
  id: number;
  socket: Socket;
  buffer: string;
  state: GooseState | null;
  staleTimer: NodeJS.Timeout | null;
}

export class GooseBridge {
  private server: Server | null = null;
  private readonly sessions = new Map<Socket, GooseSession>();
  private nextSessionId = 1;

  constructor(private readonly publish: (state: GooseState) => void) {}

  start(): void {
    if (this.server) return;
    this.server = createServer((socket) => this.connect(socket));
    this.server.on('error', () => {
      if (this.sessions.size === 0) this.publishDisconnected('Named pipe unavailable');
    });
    this.server.listen(GOOSE_PIPE);
  }

  sendBalls(
    balls: BallSnapshot[],
    boardBounds: ScreenRect,
    mysterySlot: ScreenRect | null,
  ): void {
    const sessions = [...this.sessions.values()];
    const assignments = new Map<string, number>();
    let targetIndex = 0;
    for (const ball of balls) {
      if (!ball.huntEligible || sessions.length === 0) continue;
      assignments.set(ball.id, targetIndex % sessions.length);
      targetIndex += 1;
    }
    sessions.forEach((session, sessionIndex) => {
      if (!session.socket.writable) return;
      const assignedBalls = balls.map((ball) => ({
        ...ball,
        huntEligible: ball.huntEligible
          && assignments.get(ball.id) === sessionIndex,
      }));
      session.socket.write(`${JSON.stringify({
        type: 'balls',
        protocolVersion: GOOSE_PROTOCOL_VERSION,
        balls: assignedBalls,
        boardBounds,
        mysterySlot,
      })}\n`);
    });
  }

  stop(): void {
    for (const session of this.sessions.values()) {
      if (session.staleTimer) clearTimeout(session.staleTimer);
      session.socket.destroy();
    }
    this.sessions.clear();
    this.server?.close();
    this.server = null;
  }

  private connect(socket: Socket): void {
    const session: GooseSession = {
      id: this.nextSessionId++,
      socket,
      buffer: '',
      state: null,
      staleTimer: null,
    };
    this.sessions.set(socket, session);
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.receive(session, chunk));
    socket.once('close', () => this.disconnect(session));
    // `close` follows `error`; handling only `close` avoids duplicate removal.
    socket.on('error', () => undefined);
    socket.write(`${JSON.stringify({
      type: 'hello',
      protocolVersion: GOOSE_PROTOCOL_VERSION,
      sessionId: session.id,
    })}\n`);
  }

  private receive(session: GooseSession, chunk: string): void {
    session.buffer += chunk;
    if (session.buffer.length > 1024 * 1024) {
      session.socket.destroy();
      return;
    }
    const lines = session.buffer.split('\n');
    session.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const state = parseGooseMessage(line.trim());
      if (!state) continue;
      session.state = state;
      if (session.staleTimer) clearTimeout(session.staleTimer);
      session.staleTimer = setTimeout(() => this.expire(session), 500);
      this.publishCombined();
    }
  }

  private expire(session: GooseSession): void {
    session.staleTimer = null;
    session.state = null;
    this.publishCombined('One Goose stopped sending updates');
  }

  private disconnect(session: GooseSession): void {
    if (!this.sessions.delete(session.socket)) return;
    if (session.staleTimer) clearTimeout(session.staleTimer);
    this.publishCombined('A Goose disconnected');
  }

  private publishCombined(error?: string): void {
    const active = [...this.sessions.values()].filter((session) => session.state);
    if (active.length === 0) {
      this.publishDisconnected(error ?? 'Goose disconnected');
      return;
    }
    const colliders = active.flatMap((session) =>
      (session.state as GooseState).colliders.map((collider) =>
        this.namespaceCollider(session.id, collider)));
    const carries = active.flatMap((session) =>
      (session.state as GooseState).carries);
    this.publish({
      protocolVersion: GOOSE_PROTOCOL_VERSION,
      connected: true,
      receivedAt: Date.now(),
      colliders,
      carries,
      error,
    });
  }

  private namespaceCollider(sessionId: number, collider: GooseCollider): GooseCollider {
    return {
      ...collider,
      id: `goose-${sessionId}:${collider.id}`,
    } as GooseCollider;
  }

  private publishDisconnected(error: string): void {
    this.publish({
      protocolVersion: GOOSE_PROTOCOL_VERSION,
      connected: false,
      receivedAt: Date.now(),
      colliders: [],
      carries: [],
      error,
    });
  }
}
