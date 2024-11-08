/**
 * @typedef {import('./types').Listener} Listener
 * @typedef {import('./types').ListenerBool} ListenerBool
 * @typedef {import('./types').WaitForNext} WaitForNext
 * @typedef {import('./types').EventNames} EventNames
 * @typedef {Object.<EventNames, Listener[]>} EventHandlers

 */

const sleep = (t) => new Promise((r) => setTimeout(() => r(), t));

/**
 * Inherited class for RealtimeAPI and RealtimeClient
 * Adds basic event handling
 * @class
 */
export class RealtimeEventHandler {
  /**
   * Create a new RealtimeEventHandler instance
   */
  constructor() {
     /** @type {EventHandlers} */
    this.eventHandlers = {};
     /** @type {EventHandlers} */
    this.nextEventHandlers = {};
  }

  /**
   * Clears all event handlers
   * @returns {true}
   */
  clearEventHandlers() {
    this.eventHandlers = {};
    this.nextEventHandlers = {};
    return true;
  }

 /**
   * Register an event listener
   * @type {Listener}
   */
  on(eventName, callback) {
    this.eventHandlers[eventName] = this.eventHandlers[eventName] || [];
    this.eventHandlers[eventName].push(callback);
    return callback;
  }

  /**
   * Listen for the next event of a specified type
   * @type {Listener}
   */
  onNext(eventName, callback) {
    this.nextEventHandlers[eventName] = this.nextEventHandlers[eventName] || [];
    this.nextEventHandlers[eventName].push(callback);
    return callback;
  }

  /**
   * Turns off event listening for specific events
   * Calling without a callback will remove all listeners for the event
   * @type {ListenerBool}
   */
  off(eventName, callback) {
    const handlers = this.eventHandlers[eventName] || [];
    if (callback) {
      const index = handlers.indexOf(callback);
      if (index === -1) {
        throw new Error(
          `Could not turn off specified event listener for "${eventName}": not found as a listener`,
        );
      }
      handlers.splice(index, 1);
    } else {
      delete this.eventHandlers[eventName];
    }
    return true;
  }

  /**
   * Turns off event listening for the next event of a specific type
   * Calling without a callback will remove all listeners for the next event
   * @type {ListenerBool}
   */
  offNext(eventName, callback) {
    const nextHandlers = this.nextEventHandlers[eventName] || [];
    if (callback) {
      const index = nextHandlers.indexOf(callback);
      if (index === -1) {
        throw new Error(
          `Could not turn off specified next event listener for "${eventName}": not found as a listener`,
        );
      }
      nextHandlers.splice(index, 1);
    } else {
      delete this.nextEventHandlers[eventName];
    }
    return true;
  }

  /**
   * Waits for next event of a specific type and returns the payload
   * @type {WaitForNext}
   */
  async waitForNext(eventName, timeout = null) {
    const t0 = Date.now();
    let nextEvent;
    this.onNext(eventName, (event) => (nextEvent = event));
    while (!nextEvent) {
      if (timeout) {
        const t1 = Date.now();
        if (t1 - t0 > timeout) {
          return null;
        }
      }
      await sleep(1);
    }
    return nextEvent;
  }

  /**
   * Executes all events in the order they were added, with .on() event handlers executing before .onNext() handlers
   * @param {string} eventName
   * @param {any} event
   * @returns {true}
   */
  dispatch(eventName, event) {
    const handlers = [].concat(this.eventHandlers[eventName] || []);
    for (const handler of handlers) {
      handler(event);
    }
    const nextHandlers = [].concat(this.nextEventHandlers[eventName] || []);
    for (const nextHandler of nextHandlers) {
      nextHandler(event);
    }
    delete this.nextEventHandlers[eventName];
    return true;
  }
}
