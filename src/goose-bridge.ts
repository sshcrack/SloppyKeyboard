import { createServer, Server, Socket } from 'net';
import type { BallSnapshot, GooseState, ScreenRect } from './contracts';
import { GOOSE_PROTOCOL_VERSION } from './contracts';
import { parseGooseMessage } from './goose-protocol';

export const GOOSE_PIPE = '\\\\.\\pipe\\sloppy-keyboard-goose-v1';

export class GooseBridge {
  private server: Server | null = null;
  private socket: Socket | null = null;
  private buffer = '';
  private staleTimer: NodeJS.Timeout | null = null;
  constructor(private readonly publish: (state: GooseState) => void) {}

  start(): void {
    if (this.server) return;
    this.server = createServer((socket) => {
      this.socket?.destroy();
      this.socket = socket;
      this.buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => this.receive(chunk));
      socket.on('close', () => this.disconnect());
      socket.on('error', () => this.disconnect());
      socket.write(`${JSON.stringify({ type: 'hello', protocolVersion: GOOSE_PROTOCOL_VERSION })}\n`);
    });
    this.server.on('error', () => this.publishDisconnected('Named pipe unavailable'));
    this.server.listen(GOOSE_PIPE);
  }

  sendBalls(balls: BallSnapshot[], boardBounds: ScreenRect, mysterySlot: ScreenRect | null): void {
    if (!this.socket?.writable) return;
    this.socket.write(`${JSON.stringify({
      type: 'balls', protocolVersion: GOOSE_PROTOCOL_VERSION, balls, boardBounds, mysterySlot,
    })}\n`);
  }

  stop(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.socket?.destroy();
    this.server?.close();
    this.socket = null;
    this.server = null;
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 1024 * 1024) {
      this.socket?.destroy();
      return;
    }
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const state = parseGooseMessage(line.trim());
      if (!state) continue;
      this.publish(state);
      if (this.staleTimer) clearTimeout(this.staleTimer);
      this.staleTimer = setTimeout(() => this.publishDisconnected('Goose updates became stale'), 500);
    }
  }

  private disconnect(): void {
    this.socket = null;
    this.publishDisconnected('Goose disconnected');
  }

  private publishDisconnected(error: string): void {
    this.publish({ protocolVersion: GOOSE_PROTOCOL_VERSION, connected: false, receivedAt: Date.now(), colliders: [], error });
  }
}
