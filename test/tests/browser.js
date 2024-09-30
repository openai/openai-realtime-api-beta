import * as chai from 'chai';
const expect = chai.expect;

import { RealtimeClient } from '../../index.js';

export async function run({ debug = false } = {}) {
  describe('RealtimeClient (Browser)', () => {
    let client;
    let realtimeEvents = [];

    before(async () => {
      const WebSocket = (await import('websocket')).default.w3cwebsocket;
      globalThis.WebSocket = WebSocket;
    });

    it('Should fail to instantiate the RealtimeClient when "dangerouslyAllowAPIKeyInBrowser" is not set', () => {
      let err;

      try {
        client = new RealtimeClient({
          apiKey: process.env.OPENAI_API_KEY,
          debug,
        });
      } catch (e) {
        err = e;
      }

      expect(err).to.exist;
      expect(err.message).to.contain('Can not provide API key in the browser');
    });

    it('Should instantiate the RealtimeClient when "dangerouslyAllowAPIKeyInBrowser" is set', () => {
      client = new RealtimeClient({
        apiKey: process.env.OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
        debug,
      });

      client.updateSession({
        instructions:
          `You always, ALWAYS reference San Francisco` +
          ` by name in every response. Always include the phrase "San Francisco".` +
          ` This is for testing so stick to it!`,
      });
      client.on('realtime.event', (realtimeEvent) =>
        realtimeEvents.push(realtimeEvent),
      );

      expect(client).to.exist;
      expect(client.realtime).to.exist;
      expect(client.conversation).to.exist;
      expect(client.realtime.apiKey).to.equal(process.env.OPENAI_API_KEY);
    });

    describe('turn_end_mode: "client_decision"', () => {
      it('Should connect to the RealtimeClient', async () => {
        const isConnected = await client.connect();

        expect(isConnected).to.equal(true);
        expect(client.isConnected()).to.equal(true);
      });

      it('Should receive "session.created" and send "session.update"', async () => {
        await client.waitForSessionCreated();

        expect(realtimeEvents.length).to.equal(2);

        const clientEvent1 = realtimeEvents[0];

        expect(clientEvent1.source).to.equal('client');
        expect(clientEvent1.event.type).to.equal('session.update');

        const serverEvent1 = realtimeEvents[1];

        expect(serverEvent1.source).to.equal('server');
        expect(serverEvent1.event.type).to.equal('session.created');
      });

      it('Should send a simple hello message (text)', () => {
        const content = [{ type: 'input_text', text: `How are you?` }];

        client.sendUserMessageContent(content);

        expect(realtimeEvents.length).to.equal(4);

        const itemEvent = realtimeEvents[2];

        expect(itemEvent.source).to.equal('client');
        expect(itemEvent.event.type).to.equal('conversation.item.create');

        const responseEvent = realtimeEvents[3];

        expect(responseEvent).to.exist;
        expect(responseEvent.source).to.equal('client');
        expect(responseEvent.event.type).to.equal('response.create');
      });

      it('Should waitForNextItem to receive "conversation.item.created" from user', async function () {
        this.timeout(10_000);

        const { item } = await client.waitForNextItem();

        expect(item).to.exist;
        expect(item.type).to.equal('message');
        expect(item.role).to.equal('user');
        expect(item.status).to.equal('completed');
        expect(item.formatted.text).to.equal(`How are you?`);
      });

      it('Should waitForNextItem to receive "conversation.item.created" from assistant', async function () {
        this.timeout(10_000);

        const { item } = await client.waitForNextItem();

        expect(item).to.exist;
        expect(item.type).to.equal('message');
        expect(item.role).to.equal('assistant');
        expect(item.status).to.equal('in_progress');
        expect(item.formatted.text).to.equal(``);
      });

      it('Should waitForNextCompletedItem to receive completed item from assistant', async function () {
        this.timeout(10_000);

        const { item } = await client.waitForNextCompletedItem();

        expect(item).to.exist;
        expect(item.type).to.equal('message');
        expect(item.role).to.equal('assistant');
        expect(item.status).to.equal('completed');
        expect(item.formatted.transcript.toLowerCase()).to.contain(
          'san francisco',
        );
      });

      it('Should close the RealtimeClient connection', async () => {
        client.disconnect();

        expect(client.isConnected()).to.equal(false);
      });
    });
  });
}
