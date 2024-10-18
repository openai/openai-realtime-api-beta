import { EventEmitter } from 'events';
type BaseItem = {
  id: string;
  object: 'realtime.item';
  status: 'completed' | 'in_progress' | 'incomplete';
  role: 'user' | 'assistant' | 'system';
}

type TextContent = {
  type: 'text' | 'input_text';
  text: string
}

type AudioContent = {
  type: 'audio' | 'input_audio';
  audio?: string;
  transcript?: string;
}


type MessageItem = {
  type: 'message',
  content: (TextContent | AudioContent)[]
}

type FunctionCallItem =  {
  type: 'function_call',
  name: string;
  call_id: string;
  arguments: string;
}

type FunctionCallOutputItem = {
  type: 'function_call_output',
  call_id: string;
  output: string;
}

export type ServerItem = BaseItem & (MessageItem | FunctionCallItem );
export type ClientItem = Partial<BaseItem> & (MessageItem | FunctionCallOutputItem );


export type Error = {
  type: string;
  code: string;
  message: string;
  param: string;
}

type Usasge = {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
}

type Output = {
  id: string;
  object: 'realtime.item';
  type: string;
  status: string;
  role: 'user' | 'assistant' | 'system';
  content: [
    {
      type: string;
      text: string;
    }
  ]
}

type Response<T> = {
  id: string;
  object: 'realtime.response';
  status: T;
  status_details: any;
  output: Output[];
  usage: any;
}

type AudioFormatType = "pcm16" | "g711_ulaw" | "g711_alaw";


export type SessionConfig = Partial<{
  modalities: ('text' | 'audio')[];
  instructions: string;
  voice: 'alloy' | 'echo' | 'shimmer';
  input_audio_format: AudioFormatType;
  output_audio_format: AudioFormatType;
  input_audio_transcriptions?: {
    model: 'whisper-1'
  };
  turn_detection?: {
    type: 'server_vad';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, any>

  }>;
  tool_choice?: 'auto' | 'none' | 'required'
  temperature?: number;
  max_output_tokens?: number;
}>

type SessionUpdate = {
  event_id?: string;
  type?: 'session.update';
  session: SessionConfig
}


type ResponseContent = {
  event_id: string;
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
}

type ContentPart = {
  type: 'text';
  text: string;
} | {
  type: 'audio';
  audio: string;
  transcript: string;
}

export interface ClientEvent {
  'session.update': SessionUpdate;
  'input_audio_buffer.append': {
    event_id?: string;
    type?: 'input_audio_buffer.append';
    audio: string;
  }
  'input_audio_buffer.commit': {
    event_id?: string
    type?: 'input_audio_buffer.commit';
  } | null;
  
  'input_audio_buffer.clear': {
    event_id?: string;
    type?: 'input_audio_buffer.clear';
  } | null;
  'conversation.item.create': {
    event_id?: string;
    type?: 'conversation.item.create';
    previous_item_id?: string;
    item: ClientItem;
  } | {
    type?: 'conversation.item.create';
    item: FunctionCallOutputItem
  }
  'conversation.item.truncate': {
    event_id?: string;
    type?: 'conversation.item.truncate';
    item_id: string;
    content_index: number;
    audio_end_ms: number;
  }
  'conversation.item.delete': {
    event_id?: string;
    type?: 'conversation.item.delete';
    item_id: string;
  }

  'response.create': {
    event_id?: string;
    type?: 'response.create';
    response?:  SessionUpdate['session'];
  } | null;
  'response.cancel': {
    event_id?: string;
    type: 'response.cancel';
  } | null;
}

export interface ServerEvent {
  'conversation.created': {
    event_id: string;
    type: 'conversation.created',
    conversation: {
      id: string;
      object: 'realtime.conversation';
    }
  };
  'conversation.item.created': {
    event_id: string;
    type: 'conversation.item.created';
    previous_item_id: string;
    item: ServerItem;
  };

  'conversation.item.completed': {
    event_id: string;
    type: 'conversation.item.completed';
    item: ServerItem;
  };

  'conversation.item.input_audio_transcription.completed': {
    event_id: string;
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: string;
    content_index: number;
    transcript: string
  }
  'conversation.item.input_audio_transcription.failed': {
    event_id: string;
    type: 'conversation.item.input_audio_transcription.failed',
    item_id: string;
    content_index: number;
    error: Error
  }
  'conversation.item.truncated': {
    event_id: string;
    type: 'conversation.item.truncated',
    item_id: string;
    content_index: number;
    audio_end_ms: number;
  }
  'conversation.item.deleted': {
    event_id: string;
    type: 'conversation.item.deleted',
    item_id: string;
  }
  'conversation.item.appended': {
    event_id: string;
    type: 'conversation.item.appended',
    item: ServerItem;

  }
  'input_audio_buffer.committed': {
    event_id: string;
    type: 'input_audio_buffer.committed',
    previous_item_id: string;
    item_id: string
  }
  'input_audio_buffer.cleared': {
    event_id: string;
    type: 'input_audio_buffer.cleared'
  }
  'input_audio_buffer.speech_started': {
    event_id: string;
    type: 'input_audio_buffer.speech_started';
    item_id: string;
    audio_start_ms: number;
  }
  'input_audio_buffer.speech_stopped': {
    event_id: string;
    type: 'input_audio_buffer.speech_stopped';
    audio_end_ms: number;
    item_id: string;
  }
  'response.created' : {
    event_id: string;
    type: 'response.created';
    response: Response<'in_progress'>;
  }
  'response.audio.delta': ResponseContent & {
    type: 'response.audio.delta';
    delta: string;
  }
  'response.audio_transcript.delta': ResponseContent & {
    type: 'response.audio_transcript.delta';
    delta: string;
  }
  'response.audio_transcript.done': ResponseContent & {
    type: 'response.audio_transcript.done';
    transcript: string;
  }
  'response.content_part.added': {
    event_id?: string;
    type: 'response.content_part.added';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    part: ContentPart;
  }
  'response.done': {
    event_id: string;
    type: 'response.done';
    ressponse: Response<'completed' | 'cancelled' | 'failed' | 'incomplete'>;
  }
  'response.output_item.added': {
    event_id: string;
    type: 'response.output_item.added';
    response_id: string;
    output_index: number;
    item: ServerItem;
  }
  'response.output_item.done': {
    event_id: string;
    type: 'response.output_item.done';
    response_id: string;
    output_index: number;
    item: ServerItem;
  }
  'response.function_call_arguments.delta': {
    event_id: string;
    type: 'response.function_call_arguments.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    call_id: string;
    arguments: string;
    delta: string;
  }
  'response.function_call_arguments.done': {
    event_id: string;
    type: 'response.function_call_arguments.done';
    response_id: string;
    item_id: string;
    output_index: number;
    call_id: string;
    arguments: string;
  }
  'response.text.delta': {
    event_id;
    type: 'response.text.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string
  }

  'rate_limits.updated': {
    event_id: string;
    type: 'rate_limits.updated';
    rate_limits: {
      name: string;
      limit: number;
      remaining: number;
      reset_seconds: number;
    }
  }
  'session.updated': {
    event_id: string;
    type: 'session.updated';
    session: SessionUpdate['session'];
  }
  'session.created': {
    event_id: string;
    type: 'session.created';
    session: SessionUpdate['session'];
  }
}

// Utility type to prefix keys with 'server.'
type PrefixedServerEvent<T> = {
  [K in keyof T as `server.${string & K}`]: T[K];
};

// New type with prefixed keys
type ServerServerEvent = PrefixedServerEvent<ServerEvent>;

type AllMap = ServerEvent & ServerServerEvent & { 'client.*': any, 'server.*': any };

type Exact<T, U> = T extends U ? (U extends T ? T : never) : never;

export type SendEvent = <K extends keyof ClientEvent>(event: K, data: Exact<ClientEvent[K], ClientEvent[K]>) => boolean;
export type Listener = <K extends keyof AllMap>(event: K, listener: (data: AllMap[K]) => void) => AllMap[K];
export type ListenerBool = <K extends keyof AllMap>(event: K, listener: (data: AllMap[K]) => void) => boolean;
export type WaitForNext = <K extends keyof AllMap>(event: K, timeout?: number) => Promise<AllMap[K] | null>;
export type EventNames = keyof AllMap;
export type EventProcessors = {
  [K in keyof AllMap]?: (data: AllMap[K]) => void;
};