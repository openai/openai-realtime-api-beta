import { expect } from 'chai';

import { RealtimeEventHandler } from '../../lib/event_handler.js';

export function run() {
  describe('RealtimeEventHandler waitForNext cleanup (offline)', () => {
    it('removes its one-shot listener after a timeout', async () => {
      const handler = new RealtimeEventHandler();
      expect(await handler.waitForNext('never', 5)).to.equal(null);
      expect(handler.nextEventHandlers.never || []).to.have.length(0);
    });

    it('does not accumulate listeners over repeated expired waits', async () => {
      const handler = new RealtimeEventHandler();
      for (let index = 0; index < 25; index++) {
        expect(await handler.waitForNext('never', -1)).to.equal(null);
        expect(handler.nextEventHandlers.never || []).to.have.length(0);
      }
    });

    it('preserves an unrelated listener for the same event', async () => {
      const handler = new RealtimeEventHandler();
      const received = [];
      const listener = handler.onNext('event', (event) => received.push(event));
      expect(await handler.waitForNext('event', -1)).to.equal(null);
      expect(handler.nextEventHandlers.event).to.deep.equal([listener]);
      const payload = { value: 1 };
      handler.dispatch('event', payload);
      expect(received).to.deep.equal([payload]);
    });

    it('removes only the expired one of two concurrent waiters', async () => {
      const handler = new RealtimeEventHandler();
      const waiting = handler.waitForNext('event');
      const survivingListener = handler.nextEventHandlers.event[0];
      try {
        expect(await handler.waitForNext('event', -1)).to.equal(null);
        expect(handler.nextEventHandlers.event).to.deep.equal([
          survivingListener,
        ]);
      } finally {
        handler.dispatch('event', { done: true });
        await waiting;
      }
    });

    it('does not call an expired listener when an event arrives later', async () => {
      const handler = new RealtimeEventHandler();
      const onNext = handler.onNext.bind(handler);
      let calls = 0;
      handler.onNext = (name, listener) =>
        onNext(name, (event) => {
          calls++;
          return listener(event);
        });
      expect(await handler.waitForNext('event', -1)).to.equal(null);
      handler.dispatch('event', { late: true });
      expect(calls).to.equal(0);
    });

    for (const timeout of [null, 0, 1000]) {
      it(`preserves event payloads and dispatch cleanup with timeout=${timeout}`, async () => {
        const handler = new RealtimeEventHandler();
        const payload = { value: 'received' };
        const waiting = handler.waitForNext('event', timeout);
        handler.dispatch('event', payload);
        expect(await waiting).to.equal(payload);
        expect(handler.nextEventHandlers.event || []).to.have.length(0);
      });
    }

    it('preserves listeners registered after the awaited event is dispatched', async () => {
      const handler = new RealtimeEventHandler();
      const payload = { value: 2 };
      const waiting = handler.waitForNext('event');
      handler.dispatch('event', payload);
      const later = handler.onNext('event', () => {});
      expect(await waiting).to.equal(payload);
      expect(handler.nextEventHandlers.event).to.deep.equal([later]);
    });

    it('tolerates clearing all handlers before its timeout', async () => {
      const handler = new RealtimeEventHandler();
      const waiting = handler.waitForNext('event', 5);
      handler.clearEventHandlers();
      const replacement = handler.onNext('event', () => {});
      expect(await waiting).to.equal(null);
      expect(handler.nextEventHandlers.event).to.deep.equal([replacement]);
    });

    it('tolerates another caller removing its handler', async () => {
      const handler = new RealtimeEventHandler();
      const waiting = handler.waitForNext('event', 5);
      handler.offNext('event', handler.nextEventHandlers.event[0]);
      expect(await waiting).to.equal(null);
      expect(handler.nextEventHandlers.event || []).to.have.length(0);
    });

    it('cleans up and preserves the original error when scheduling fails', async () => {
      const handler = new RealtimeEventHandler();
      const originalSetTimeout = globalThis.setTimeout;
      const failure = new Error('synthetic scheduling failure');
      let waiting;
      try {
        globalThis.setTimeout = () => {
          throw failure;
        };
        waiting = handler.waitForNext('event', 5);
      } finally {
        globalThis.setTimeout = originalSetTimeout;
      }
      let caught;
      try {
        await waiting;
      } catch (error) {
        caught = error;
      }
      expect(caught).to.equal(failure);
      expect(handler.nextEventHandlers.event || []).to.have.length(0);
    });

    it('leaves persistent handlers and other event names alone', async () => {
      const handler = new RealtimeEventHandler();
      const persistent = handler.on('event', () => {});
      const other = handler.onNext('other', () => {});
      expect(await handler.waitForNext('event', -1)).to.equal(null);
      expect(handler.eventHandlers.event).to.deep.equal([persistent]);
      expect(handler.nextEventHandlers.other).to.deep.equal([other]);
      expect(handler.nextEventHandlers.event || []).to.have.length(0);
    });
  });
}
