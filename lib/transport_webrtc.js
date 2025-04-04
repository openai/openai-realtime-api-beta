import { RealtimeTransportType, RealtimeTransport } from './transport.js';

export class RealtimeTransportWebRTC extends RealtimeTransport {
  get transportType() { return RealtimeTransportType.WEBRTC; }

  get defaultUrl() {
    return 'https://api.openai.com/v1/realtime';
  }

  constructor({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug } = {}) {
    super({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug });
    this.peerConnection = null;
    this.dataChannel = null;
  }

  get isConnected() {
    return !!this.peerConnection;
  }

  async connect({ sessionConfig, setAudioOutputCallback, getMicrophoneCallback }) {
    super.connect();
    sessionConfig = {
      model: 'gpt-4o-mini-realtime-preview',
      voice: 'ash',
      ...sessionConfig,
    };
    this.log(`connect(sessionConfig=${JSON.stringify(sessionConfig)}, ...)`);
    const emphemeralApiToken = await this._requestEphemeralApiToken(this.apiKey, sessionConfig);
    await this._init(emphemeralApiToken, sessionConfig.model, setAudioOutputCallback, getMicrophoneCallback);
  }

  /**
   * Initially from:
   * https://platform.openai.com/docs/guides/realtime-webrtc#creating-an-ephemeral-token
   */
  async _requestEphemeralApiToken(dangerousApiKey, sessionConfig) {
    const r = await fetch(`${this.url}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dangerousApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });
    const data = await r.json();
    return data.client_secret.value;
  }

  /**
   * Initially from:
   * https://platform.openai.com/docs/guides/realtime-webrtc#connection-details
   */
  async _init(ephemeralApiToken, model, setAudioOutputCallback, getMicrophoneCallback) {
    this.log(`init(...)`);
    this.peerConnection = new RTCPeerConnection();

    this.peerConnection.ontrack = (e) => setAudioOutputCallback(e.streams[0]);
    this.peerConnection.addTrack(await getMicrophoneCallback());

    return new Promise(async (resolve, reject) => {
      const dataChannel = this.peerConnection?.createDataChannel('oai-events');
      if (!dataChannel) {
        reject(new Error('dataChannel == null'));
        return;
      }
      dataChannel.addEventListener('open', () => {
        this.log('Data channel is open');
        this.dataChannel = dataChannel;
        resolve(true);
      });
      dataChannel.addEventListener('closing', () => {
        this.log('Data channel is closing');
      });
      dataChannel.addEventListener('close', () => {
        this.disconnect();
        this.log('Data channel is closed');
        this.dispatch('close', { error: false });
      });
      dataChannel.addEventListener('message', (event) => {
        this.dispatch('message', event);
      });

      // Start the session using the Session Description Protocol (SDP)
      const offer = await this.peerConnection?.createOffer();
      if (!offer) {
        reject(new Error('offer == null'));
        return;
      }
      await this.peerConnection?.setLocalDescription(offer);
      const sdpResponse = await fetch(`${this.url}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralApiToken}`,
          'Content-Type': 'application/sdp'
        },
      });
      await this.peerConnection?.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      });
    });
  }

  async disconnect() {
    this.log('disconnect()');
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  async send(data) {
    super.send(data);
    this.dataChannel.send(JSON.stringify(data));
  }
}
