import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLogEvents, createLogger, getRecentLogEvents } from './logging';

describe('logging', () => {
  afterEach(() => {
    clearLogEvents();
    vi.restoreAllMocks();
  });

  it('records events with scope and level', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createLogger('test').warn('something odd', { code: 7 });
    const events = getRecentLogEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      level: 'warn',
      scope: 'test',
      message: 'something odd',
      data: { code: 7 },
    });
  });

  it('caps the ring buffer at 200 events, keeping the newest', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const log = createLogger('spam');
    for (let i = 0; i < 250; i++) {
      log.info(String(i));
    }
    const events = getRecentLogEvents();
    expect(events).toHaveLength(200);
    expect(events[0]?.message).toBe('50');
    expect(events.at(-1)?.message).toBe('249');
  });
});
