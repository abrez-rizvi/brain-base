import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

export interface UiEvent {
  id: string;
  rev: number;
  type:
    | 'command_start'
    | 'command_progress'
    | 'command_complete'
    | 'command_error'
    | 'file_change'
    | 'sync'
    | 'diff'
    | 'status_update'
    | 'heartbeat';
  command?: string;
  message?: string;
  timestamp: string;
  payload?: Record<string, any>;
}

export class UiEventHub {
  private emitter = new EventEmitter();
  private ringBuffer: UiEvent[] = [];
  private maxBufferSize = 100;
  private currentRev = 1;

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  getRevision(): number {
    return this.currentRev;
  }

  emitEvent(
    data: Omit<UiEvent, 'id' | 'rev' | 'timestamp'> & { timestamp?: string }
  ): UiEvent {
    this.currentRev += 1;
    const event: UiEvent = {
      id: crypto.randomUUID(),
      rev: this.currentRev,
      type: data.type,
      command: data.command,
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString(),
      payload: data.payload || {},
    };

    this.ringBuffer.push(event);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }

    this.emitter.emit('event', event);
    return event;
  }

  getRecentEvents(limit = 50): UiEvent[] {
    return this.ringBuffer.slice(-limit);
  }

  subscribe(listener: (event: UiEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => {
      this.emitter.off('event', listener);
    };
  }

  clearEvents(): void {
    this.ringBuffer = [];
  }
}

export const uiEventHub = new UiEventHub();
