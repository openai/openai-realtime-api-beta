import { RealtimeEventHandler } from './event_handler.js';

/**
 * Enum representing the transport types.
 * @readonly
 * @enum {string}
 */
export const RealtimeTransportType = {
  WEBRTC: "WEBRTC",
  WEBSOCKET: "WEBSOCKET",
};

/**
 * An abstract base class representing a RealtimeTransport.
 * Subclasses must implement all of these methods.
 *
 * @interface
 */
export class RealtimeTransport extends RealtimeEventHandler {
  get transportType() {
    throw new Error("Not implemented: transportType getter");
  }

  get defaultUrl() {
    throw new Error("Not implemented: defaultUrl getter");
  }

  log(...args) {
    if (this.debug) {
      const date = new Date().toISOString();
      const logs = [`[${this.transportType}/${date}]`].concat(args).map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          return JSON.stringify(arg, null, 2);
        } else {
          return arg;
        }
      });
      console.log(...logs);
    }
    return true;
  }

  constructor({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug } = {}) {
    super();
    this.url = url || this.defaultUrl;
    this.apiKey = apiKey || null;
    this.debug = !!debug;
    if (globalThis.document && this.apiKey) {
      if (!dangerouslyAllowAPIKeyInBrowser) {
        throw new Error(
          `Can not provide API key in the browser without "dangerouslyAllowAPIKeyInBrowser" set to true`,
        );
      }
    }
  }

  get isConnected() {
    throw new Error("Not implemented: isConnected getter");
  }

  async connect(options = {}) {
    if (!this.apiKey && this.url === this.defaultUrl) {
      console.warn(`No apiKey provided for connection to "${this.url}"`);
    }
    if (this.isConnected) {
      throw new Error(`Already connected`);
    }
    if (globalThis.document && this.apiKey) {
      console.warn(
        'Warning: Connecting using API key in the browser, this is not recommended',
      );
    }
  }

  async disconnect(options = {}) {
    throw new Error("Not implemented: disconnect");
  }

  async send(data) {
    if (!this.isConnected) {
      throw new Error(`RealtimeAPI is not connected`);
    }
  }
}
