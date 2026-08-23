import { describe, it, expect, beforeEach } from 'vitest';
import { UiEventHub } from '../src/services/ui-event-hub.js';

describe('UiEventHub', () => {
  let hub: UiEventHub;

  beforeEach(() => {
    hub = new UiEventHub();
  });

  it('should initialize with revision 1 and empty buffer', () => {
    expect(hub.getRevision()).toBe(1);
    expect(hub.getRecentEvents()).toEqual([]);
  });

  it('should emit events, assign UUID and increment monotonic revision', () => {
    const event1 = hub.emitEvent({
      type: 'command_start',
      command: 'sync',
      message: 'Starting sync...',
    });

    expect(event1.id).toBeDefined();
    expect(event1.rev).toBe(2);
    expect(event1.type).toBe('command_start');
    expect(event1.command).toBe('sync');
    expect(hub.getRevision()).toBe(2);

    const event2 = hub.emitEvent({
      type: 'sync',
      command: 'sync',
      message: 'Sync finished',
    });

    expect(event2.rev).toBe(3);
    expect(hub.getRevision()).toBe(3);

    const recent = hub.getRecentEvents();
    expect(recent.length).toBe(2);
    expect(recent[0].id).toBe(event1.id);
    expect(recent[1].id).toBe(event2.id);
  });

  it('should notify subscribers on new events', () => {
    const received: any[] = [];
    const unsubscribe = hub.subscribe((e) => {
      received.push(e);
    });

    hub.emitEvent({ type: 'file_change', message: 'test.md modified' });
    expect(received.length).toBe(1);
    expect(received[0].message).toBe('test.md modified');

    unsubscribe();
    hub.emitEvent({ type: 'diff', message: 'diff computed' });
    expect(received.length).toBe(1); // not called after unsubscribe
  });

  it('should cap buffer at max size without memory leak', () => {
    for (let i = 0; i < 120; i++) {
      hub.emitEvent({ type: 'status_update', message: `event ${i}` });
    }

    const recent = hub.getRecentEvents(200);
    expect(recent.length).toBe(100);
  });
});
