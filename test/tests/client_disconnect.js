import * as chai from 'chai';
const expect = chai.expect;

import { RealtimeClient } from '../../index.js';

export async function run({ debug = false } = {}) {
  describe('RealtimeClient (Node.js) - Disconnect', () => {
    
    it('Should not throw an error if the client disconnects while receiving messages', async function() {
        this.timeout(10000);
        const client = new RealtimeClient({
          apiKey: process.env.OPENAI_API_KEY,
          debug,
        });
  
        client.realtime.on('server.response.audio.delta', () => {
          client.disconnect();
        });
  
        await client.connect();
        await client.waitForSessionCreated();
  
        client.sendUserMessageContent([{ type: 'input_text', text: 'Hello' }]);

        await client.waitForNextCompletedItem();
        
  
        expect(client).to.exist;
      
      });
    });

}
