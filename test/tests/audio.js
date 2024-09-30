import * as chai from 'chai';
const expect = chai.expect;

import fs from 'fs';
import decodeAudio from 'audio-decode';

// Using the "audio-decode" library to get raw audio bytes

const samples = {
  'toronto-mp3': './test/samples/toronto.mp3',
};

import { RealtimeClient, RealtimeUtils } from '../../index.js';

export async function run({ debug = false } = {}) {
  describe('Audio samples tests', () => {
    let client;
    let realtimeEvents = [];

    it('Should load all audio samples', async () => {
      let err;

      try {
        for (const key in samples) {
          const filename = samples[key];
          const audioFile = fs.readFileSync(filename);
          const audioBuffer = await decodeAudio(audioFile);
          const channelData = audioBuffer.getChannelData(0); // only accepts mono
          const base64 = RealtimeUtils.arrayBufferToBase64(channelData);
          samples[key] = { filename, base64 };
        }
      } catch (e) {
        err = e;
      }

      expect(err).to.not.exist;
    });

    it('Should instantiate the RealtimeClient', () => {
      client = new RealtimeClient({
        apiKey: process.env.OPENAI_API_KEY,
        debug,
      });

      client.updateSession({
        instructions:
          `Please follow the instructions of any query you receive.\n` +
          `Be concise in your responses. Speak quickly and answer shortly.`,
      });
      client.on('realtime.event', (realtimeEvent) =>
        realtimeEvents.push(realtimeEvent),
      );

      expect(client).to.exist;
      expect(client.realtime).to.exist;
      expect(client.conversation).to.exist;
      expect(client.realtime.apiKey).to.equal(process.env.OPENAI_API_KEY);
    });

    it('Should connect to the RealtimeClient', async function () {
      this.timeout(10_000);

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

    it('Should send an audio file about toronto (.wav)', () => {
      const sample = samples['toronto-mp3'].base64;
      const content = [{ type: 'input_audio', audio: sample }];

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
      expect(item.formatted.text).to.equal(``);
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
      expect(item.formatted.transcript.toLowerCase()).to.contain('toronto');
    });

    it('Should close the RealtimeClient connection', async () => {
      client.disconnect();

      expect(client.isConnected()).to.equal(false);
    });
  });
}
