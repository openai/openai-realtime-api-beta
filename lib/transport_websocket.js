import { RealtimeTransportType, RealtimeTransport } from './transport.js';

export class RealtimeTransportWebSocket extends RealtimeTransport {
  get transportType() { return RealtimeTransportType.WEBSOCKET; }

  get defaultUrl() {
    return 'wss://api.openai.com/v1/realtime';
  }

  constructor({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug } = {}) {
    super({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug });
    this.ws = null;
  }

  get isConnected() {
    return !!this.ws;
  }

  async connect({ sessionConfig }) {
    super.connect();
    sessionConfig = {
      model: 'gpt-4o-mini-realtime-preview',
      ...sessionConfig,
    };
    this.log(`connect(sessionConfig=${JSON.stringify(sessionConfig)}, ...)`);
    const { model } = sessionConfig;
    if (globalThis.WebSocket) {
      const WebSocket = globalThis.WebSocket;
      const ws = new WebSocket(`${this.url}${model ? `?model=${model}` : ''}`, [
        'realtime',
        `openai-insecure-api-key.${this.apiKey}`,
        'openai-beta.realtime-v1',
      ]);
      ws.addEventListener('message', (event) => {
        this.dispatch('message', event);
      });
      return new Promise((resolve, reject) => {
        const connectionErrorHandler = () => {
          this.disconnect(ws);
          reject(new Error(`Could not connect to "${this.url}"`));
        };
        ws.addEventListener('error', connectionErrorHandler);
        ws.addEventListener('open', () => {
          this.log(`Connected to "${this.url}"`);
          ws.removeEventListener('error', connectionErrorHandler);
          ws.addEventListener('error', () => {
            this.disconnect(ws);
            this.log(`Error, disconnected from "${this.url}"`);
            this.dispatch('close', { error: true });
          });
          ws.addEventListener('close', () => {
            this.disconnect(ws);
            this.log(`Disconnected from "${this.url}"`);
            this.dispatch('close', { error: false });
          });
          this.ws = ws;
          resolve(true);
        });
      });
    } else {
      /**
       * Node.js
       */
      const moduleName = 'ws';
      const wsModule = await import(/* webpackIgnore: true */ moduleName);
      const WebSocket = wsModule.default;
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        [],
        {
          finishRequest: (request) => {
            // Auth
            request.setHeader('Authorization', `Bearer ${this.apiKey}`);
            request.setHeader('OpenAI-Beta', 'realtime=v1');
            request.end();
          },
        },
      );
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.receive(message.type, message);
      });
      return new Promise((resolve, reject) => {
        const connectionErrorHandler = () => {
          this.disconnect(ws);
          reject(new Error(`Could not connect to "${this.url}"`));
        };
        ws.on('error', connectionErrorHandler);
        ws.on('open', () => {
          this.log(`Connected to "${this.url}"`);
          ws.removeListener('error', connectionErrorHandler);
          ws.on('error', () => {
            this.disconnect(ws);
            this.log(`Error, disconnected from "${this.url}"`);
            this.dispatch('close', { error: true });
          });
          ws.on('close', () => {
            this.disconnect(ws);
            this.log(`Disconnected from "${this.url}"`);
            this.dispatch('close', { error: false });
          });
          this.ws = ws;
          resolve(true);
        });
      });
    }
  }

  async disconnect({ ws } = {}) {
    this.log(`disconnect(${ws})`);
    if (!ws || this.ws === ws) {
      this.ws && this.ws.close();
      this.ws = null;
      return true;
    }
  }

  async send(data) {
    super.send(data);
    this.ws.send(JSON.stringify(data));
    return true;
  }
}
