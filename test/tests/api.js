import * as chai from 'chai';
const expect = chai.expect;

import { RealtimeAPI } from '../../index.js';

export async function run() {
  describe('RealtimeAPI', ({ debug = false } = {}) => {
    let realtime;

    it('Should instantiate the RealtimeAPI with no apiKey', () => {
      realtime = new RealtimeAPI({
        debug,
      });

      expect(realtime).to.exist;
      expect(realtime.apiKey).to.not.exist;
    });

    it('Should fail to connect to the RealtimeAPI with no apiKey', async () => {
      await realtime.connect();
      const event = await realtime.waitForNext('server.error', 1000);

      expect(event).to.exist;
      expect(event.error).to.exist;
      expect(event.error.message).to.contain('Incorrect API key provided');
    });

    it('Should instantiate the RealtimeAPI', () => {
      realtime = new RealtimeAPI({
        apiKey: process.env.OPENAI_API_KEY,
        debug,
      });

      expect(realtime).to.exist;
      expect(realtime.apiKey).to.equal(process.env.OPENAI_API_KEY);
    });

    it('Should connect to the RealtimeAPI', async () => {
      const isConnected = await realtime.connect();

      expect(isConnected).to.equal(true);
      expect(realtime.isConnected()).to.equal(true);
    });

    it('Should close the RealtimeAPI connection', async () => {
      realtime.disconnect();

      expect(realtime.isConnected()).to.equal(false);
    });

    it('Should connect to the RealtimeAPI with a model', async () => {
      const model = 'gpt-4o-mini-realtime-preview-2024-12-17';
      realtime = new RealtimeAPI({
        apiKey: process.env.OPENAI_API_KEY,
        debug,
      });
      realtime.connect({ model });
      const session = await new Promise((resolve) => {
        realtime.on('server.session.created', event => resolve(event.session));
      });
      expect(session.model).to.equal(model);
    });

    after(() => {
      realtime.isConnected() && realtime.disconnect();
    });
  });
}
