import * as chai from 'chai';
const expect = chai.expect;

import { RealtimeAPI } from '../../index.js';

export async function run() {
  describe('RealtimeAPI', ({ debug = false } = {}) => {
    let realtime;

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

    after(() => {
      realtime.isConnected() && realtime.disconnect();
    });
  });
}
