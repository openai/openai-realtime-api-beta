# Reference Client: Realtime API (beta)

This repository contains a reference client aka sample library for connecting
to OpenAI's Realtime API.
**This library is in beta and should not be treated as a final implementation.**
You can use it to easily prototype conversational apps.

**The easiest way to get playing with the API right away** is to use the
[**Realtime Console**](https://github.com/openai/openai-realtime-console), it uses
the reference client to deliver a fully-functional API inspector with examples
of voice visualization and more.

# Quickstart

This library is built to be used both server-side (Node.js) and in browser (React, Vue),
in both JavaScript and TypeScript codebases. While in beta, to install the library you will
need to `npm install` directly from the GitHub repository.

```shell
$ npm i openai/openai-realtime-api-beta --save
```

```javascript
import { RealtimeClient } from '@openai/realtime-api-beta';

const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY });

// Can set parameters ahead of connecting, either separately or all at once
client.updateSession({ instructions: 'You are a great, upbeat friend.' });
client.updateSession({ voice: 'alloy' });
client.updateSession({
  turn_detection: { type: 'none' }, // or 'server_vad'
  input_audio_transcription: { model: 'whisper-1' },
});

// Set up event handling
client.on('conversation.updated', (event) => {
  const { item, delta } = event;
  const items = client.conversation.getItems();
  /**
   * item is the current item being updated
   * delta can be null or populated
   * you can fetch a full list of items at any time
   */
});

// Connect to Realtime API
await client.connect();

// Send a item and triggers a generation
client.sendUserMessageContent([{ type: 'input_text', text: `How are you?` }]);
```

## Browser (front-end) quickstart

You can use this client directly from the browser in e.g. React or Vue apps.
**We do not recommend this, your API keys are at risk if you connect to OpenAI directly from the browser.**
In order to instantiate the client in a browser environment, use:

```javascript
import { RealtimeClient } from '@openai/realtime-api-beta';

const client = new RealtimeClient({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowAPIKeyInBrowser: true,
});
```

If you are running your own relay server, e.g. with the
[Realtime Console](https://github.com/openai/openai-realtime-console), you can
instead connect to the relay server URL like so:

```javascript
const client = new RealtimeClient({ url: RELAY_SERVER_URL });
```

# Table of contents

1. [Project structure](#project-structure)
1. [Using the reference client](#using-the-reference-client)
   1. [Sending messages](#sending-messages)
   1. [Sending streaming audio](#sending-streaming-audio)
   1. [Adding and using tools](#adding-and-using-tools)
      1. [Manually using tools](#manually-using-tools)
   1. [Interrupting the model](#interrupting-the-model)
1. [Client events](#client-events)
   1. [Reference client utility events](#reference-client-utility-events)
1. [Server events](#server-events)
1. [Running tests](#running-tests)
1. [Acknowledgements and contact](#acknowledgements-and-contact)

# Project structure

In this library, there are three primitives for interfacing with the Realtime API.
We recommend starting with the `RealtimeClient`, but more advanced users may be
more comfortable working closer to the metal.

1. [`RealtimeClient`](./lib/client.js)
   - Primary abstraction for interfacing with the Realtime API
   - Enables rapid application development with a simplified control flow
   - Has custom `conversation.updated`, `conversation.item.appended`, `conversation.item.completed`, `conversation.interrupted` and `realtime.event` events
   - These events send item deltas and conversation history
1. [`RealtimeAPI`](./lib/api.js)
   - Exists on client instance as `client.realtime`
   - Thin wrapper over [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
   - Use this for connecting to the API, authenticating, and sending items
   - There is **no item validation**, you will have to rely on the API specification directly
   - Dispatches events as `server.{event_name}` and `client.{event_name}`, respectively
1. [`RealtimeConversation`](./lib/conversation.js)
   - Exists on client instance as `client.conversation`
   - Stores a client-side cache of your current conversation
   - Has **event validation**, will validate incoming events to make sure it can cache them properly

# Using the reference client

The client comes packaged with some basic utilities that make it easy to build realtime
apps quickly.

## Sending messages

Sending messages to the server from the user is easy.

```javascript
client.sendUserMessageContent([{ type: 'input_text', text: `How are you?` }]);
// or (empty audio)
client.sendUserMessageContent([
  { type: 'input_audio', audio: new Int16Array(0) },
]);
```

## Sending streaming audio

To send streaming audio, use the `.appendInputAudio()` method. If you're in `turn_detection: 'disabled'` mode,
then you need to use `.createResponse()` to tell the model to respond.

```javascript
// Send user audio, must be Int16Array or ArrayBuffer
// Default audio format is pcm16 with sample rate of 24,000 Hz
// This populates 1s of noise in 0.1s chunks
for (let i = 0; i < 10; i++) {
  const data = new Int16Array(2400);
  for (let n = 0; n < 2400; n++) {
    const value = Math.floor((Math.random() * 2 - 1) * 0x8000);
    data[n] = value;
  }
  client.appendInputAudio(data);
}
// Pending audio is committed and model is asked to generate
client.createResponse();
```

## Adding and using tools

Working with tools is easy. Just call `.addTool()` and set a callback as the second parameter.
The callback will be executed with the parameters for the tool, and the result will be automatically
sent back to the model.

```javascript
// We can add tools as well, with callbacks specified
client.addTool(
  {
    name: 'get_weather',
    description:
      'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
    parameters: {
      type: 'object',
      properties: {
        lat: {
          type: 'number',
          description: 'Latitude',
        },
        lng: {
          type: 'number',
          description: 'Longitude',
        },
        location: {
          type: 'string',
          description: 'Name of the location',
        },
      },
      required: ['lat', 'lng', 'location'],
    },
  },
  async ({ lat, lng, location }) => {
    const result = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`,
    );
    const json = await result.json();
    return json;
  },
);
```

### Manually using tools

The `.addTool()` method automatically runs a tool handler and triggers a response
on handler completion. Sometimes you may not want that, for example: using tools
to generate a schema that you use for other purposes.

In this case, we can use the `tools` item with `updateSession`. In this case you
**must** specify `type: 'function'`, which is not required for `.addTool()`.

**Note:** Tools added with `.addTool()` will **not** be overridden when updating
sessions manually like this, but every `updateSession()` change will override previous
`updateSession()` changes. Tools added via `.addTool()` are persisted and appended
to anything set manually here.

```javascript
client.updateSession({
  tools: [
    {
      type: 'function',
      name: 'get_weather',
      description:
        'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
      parameters: {
        type: 'object',
        properties: {
          lat: {
            type: 'number',
            description: 'Latitude',
          },
          lng: {
            type: 'number',
            description: 'Longitude',
          },
          location: {
            type: 'string',
            description: 'Name of the location',
          },
        },
        required: ['lat', 'lng', 'location'],
      },
    },
  ],
});
```

Then, to handle function calls...

```javascript
client.on('conversation.updated', ({ item, delta }) => {
  if (item.type === 'function_call') {
    // do something
    if (delta.arguments) {
      // populating the arguments
    }
  }
});

client.on('conversation.item.completed', ({ item }) => {
  if (item.type === 'function_call') {
    // your function call is complete, execute some custom code
  }
});
```

## Interrupting the model

You may want to manually interrupt the model, especially in `turn_detection: 'disabled'` mode.
To do this, we can use:

```javascript
// id is the id of the item currently being generated
// sampleCount is the number of audio samples that have been heard by the listener
client.cancelResponse(id, sampleCount);
```

This method will cause the model to immediately cease generation, but also truncate the
item being played by removing all audio after `sampleCount` and clearing the text
response. By using this method you can interrupt the model and prevent it from "remembering"
anything it has generated that is ahead of where the user's state is.

# Client events

If you need more manual control and want to send custom client events according
to the [Realtime Client Events API Reference](https://platform.openai.com/docs/api-reference/realtime-client-events),
you can use `client.realtime.send()` like so:

```javascript
// manually send a function call output
client.realtime.send('conversation.item.create', {
  item: {
    type: 'function_call_output',
    call_id: 'my-call-id',
    output: '{function_succeeded:true}',
  },
});
client.realtime.send('response.create');
```

## Reference client utility events

With `RealtimeClient` we have reduced the event overhead from server events to **five**
main events that are most critical for your application control flow. These events
**are not** part of the API specification itself, but wrap logic to make application
development easier.

```javascript
// errors like connection failures
client.on('error', (event) => {
  // do thing
});

// in VAD mode, the user starts speaking
// we can use this to stop audio playback of a previous response if necessary
client.on('conversation.interrupted', () => {
  /* do something */
});

// includes all changes to conversations
// delta may be populated
client.on('conversation.updated', ({ item, delta }) => {
  // get all items, e.g. if you need to update a chat window
  const items = client.conversation.getItems();
  switch (item.type) {
    case 'message':
      // system, user, or assistant message (item.role)
      break;
    case 'function_call':
      // always a function call from the model
      break;
    case 'function_call_output':
      // always a response from the user / application
      break;
  }
  if (delta) {
    // Only one of the following will be populated for any given event
    // delta.audio = Int16Array, audio added
    // delta.transcript = string, transcript added
    // delta.arguments = string, function arguments added
  }
});

// only triggered after item added to conversation
client.on('conversation.item.appended', ({ item }) => {
  /* item status can be 'in_progress' or 'completed' */
});

// only triggered after item completed in conversation
// will always be triggered after conversation.item.appended
client.on('conversation.item.completed', ({ item }) => {
  /* item status will always be 'completed' */
});
```

# Server events

If you want more control over your application development, you can use the
`realtime.event` event and choose only to respond to **server** events.
The full documentation for these events are available on
the [Realtime Server Events API Reference](https://platform.openai.com/docs/api-reference/realtime-server-events).

```javascript
// all events, can use for logging, debugging, or manual event handling
client.on('realtime.event', ({ time, source, event }) => {
  // time is an ISO timestamp
  // source is 'client' or 'server'
  // event is the raw event payload (json)
  if (source === 'server') {
    doSomething(event);
  }
});
```

# Running tests

You will need to make sure you have a `.env` file with `OPENAI_API_KEY=` set in order
to run tests. From there, running the test suite is easy.

```shell
$ npm test
```

To run tests with debug logs (will log events sent to and received from WebSocket), use:

```shell
$ npm test -- --debug
```

# Acknowledgements and contact

Thank you for checking out the Realtime API. Would love to hear from you.
Special thanks to the Realtime API team for making this all possible.

- OpenAI Developers / [@OpenAIDevs](https://x.com/OpenAIDevs)
- Jordan Sitkin / API / [@dustmason](https://x.com/dustmason)
- Mark Hudnall / API / [@landakram](https://x.com/landakram)
- Peter Bakkum / API / [@pbbakkum](https://x.com/pbbakkum)
- Atty Eleti / API / [@athyuttamre](https://x.com/athyuttamre)
- Jason Clark / API / [@onebitToo](https://x.com/onebitToo)
- Keith Horwood / API + DX / [@keithwhor](https://x.com/keithwhor)
