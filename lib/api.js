import { RealtimeEventHandler } from './event_handler.js';
import { RealtimeUtils } from './utils.js';
import { RealtimeTransportType } from './transport.js';
import { RealtimeTransportWebRTC } from './transport_webrtc.js';
import { RealtimeTransportWebSocket } from './transport_websocket.js';

export class RealtimeAPI extends RealtimeEventHandler {
  /**
   * Create a new RealtimeAPI instance
   * @param {{transportType?: string, url?: string, apiKey?: string, dangerouslyAllowAPIKeyInBrowser?: boolean, debug?: boolean}} [settings]
   * @returns {RealtimeAPI}
   */
  constructor({ transportType, url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug } = {}) {
    super();
    this.debug = !!debug;
    transportType = transportType?.toUpperCase() || RealtimeTransportType.WEBRTC;
    switch (transportType) {
      case RealtimeTransportType.WEBRTC: {
        this.transport = new RealtimeTransportWebRTC({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug });
        break;
      }
      case RealtimeTransportType.WEBSOCKET: {
        this.transport = new RealtimeTransportWebSocket({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug });
        break;
      }
      default: {
        throw new Error(`Invalid transportType: "${transportType}"`);
      }
    }
    this.transport.on('close', (data) => {
      this.disconnect();
      this.dispatch('close', data);
    });
    this.transport.on('message', (event) => {
      const message = JSON.parse(event.data);
      this._receive(message.type, message)
    });
  }

  get transportType() {
    return this.transport.transportType;
  }

  /**
   * Tells us whether or not the Realtime API server is connected
   * @returns {boolean}
   */
  get isConnected() {
    return this.transport.isConnected;
  }

  /**
   * Writes log to console
   * @param  {...any} args
   * @returns {true}
   */
  log(...args) {
    const date = new Date().toISOString();
    const logs = [`[RealtimeAPI/${date}]`].concat(args).map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg, null, 2);
      } else {
        return arg;
      }
    });
    if (this.debug) {
      console.log(...logs);
    }
    return true;
  }

  /**
   * Connects to Realtime API Server
   * @param {{sessionConfig?: SessionConfig, setAudioOutputCallback?: Function, getMicrophoneCallback?: Function}} [settings]
   * @returns {Promise<true>}
   */
  async connect({ sessionConfig, setAudioOutputCallback, getMicrophoneCallback }) {
    return this.transport.connect({ sessionConfig, setAudioOutputCallback, getMicrophoneCallback });
  }

  /**
   * Disconnects from Realtime API server
   * @returns {true}
   */
  async disconnect() {
    await this.transport.disconnect();
    return true;
  }

  /**
   * Receives an event from Realtime API server and dispatches as "server.{eventName}" and "server.*" events
   * @param {string} eventName
   * @param {{[key: string]: any}} event
   * @returns {true}
   */
  _receive(eventName, event) {
    if (this.debug) {
      if (eventName === 'response.audio.delta') {
        const delta = event.delta;
        this.log(`received:`, eventName, { ...event, delta: delta.slice(0, 10) + '...' + delta.slice(-10) });
      } else {
        this.log(`received:`, eventName, event);
      }
    }
    this.dispatch(`server.${eventName}`, event);
    this.dispatch('server.*', event);
    return true;
  }

  /**
   * Sends an event to Realtime API server and dispatches as "client.{eventName}" and "client.*" events
   * @param {string} eventName
   * @param {{[key: string]: any}} event
   * @returns {true}
   */
  async send(eventName, data) {
    if (!this.isConnected) {
      throw new Error(`RealtimeAPI is not connected`);
    }
    data = data || {};
    if (typeof data !== 'object') {
      throw new Error(`data must be an object`);
    }
    const event = {
      event_id: RealtimeUtils.generateId('evt_'),
      type: eventName,
      ...data,
    };
    this.dispatch(`client.${eventName}`, event);
    this.dispatch('client.*', event);
    if (this.debug) {
      if (eventName === 'input_audio_buffer.append') {
        const audio = event.audio;
        this.log(`sending:`, eventName, { ...event, audio: audio.slice(0, 10) + '...' + audio.slice(-10) });
      } else {
        this.log(`sending:`, eventName, event);
      }
    }
    await this.transport.send(event);
    return true;
  }
}
