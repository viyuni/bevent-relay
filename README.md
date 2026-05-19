# @viyuni/bevent-relay

Typed Bilibili live event listener and parser utilities.

## Install

```bash
bun add @viyuni/bevent-relay
```

```bash
npm install @viyuni/bevent-relay
```

## Usage

```ts
import { createListener } from '@viyuni/bevent-relay';
import { ViyuniEventType } from '@viyuni/bevent-relay/events';

const listener = createListener({
  roomId: 123456,
  cookie: 'SESSDATA=...; buvid3=...',
});

listener.on('event', (event) => {
  if (event.type === ViyuniEventType.Message) {
    console.log(`${event.user.name}: ${event.content}`);
  }
});

listener.on('error', (error) => {
  console.error(error);
});

await listener.start();
```

## Exports

`@viyuni/bevent-relay` exports the listener API:

```ts
import {
  BliveListener,
  createListener,
  ParserEventStatus,
  ReconnectListenerStatus,
} from '@viyuni/bevent-relay';
```

`@viyuni/bevent-relay/events` exports event constants and event payload types:

```ts
import type { ViyuniEvent, Message, Gift, Guard } from '@viyuni/bevent-relay/events';
import { Cmd, GuardType, ViyuniEventType } from '@viyuni/bevent-relay/events';
```

## Listener Config

```ts
interface ListenerConfig {
  roomId: number;
  cookie?: string;
  cookieSync?: {
    url: string;
    password: string;
  };
  reconnect?:
    | false
    | {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        healthyAfter?: number;
      };
}
```

## Events

The listener emits parsed events through `event`. Unknown, unsupported, and parse-failed commands are exposed through parser status channels.

```ts
import { ParserEventStatus } from '@viyuni/bevent-relay';

listener.on(ParserEventStatus.Unknown, (raw) => {
  console.warn('Unknown command', raw);
});

listener.on(ParserEventStatus.Unimplemented, (cmd, raw) => {
  console.warn('Unsupported command', cmd, raw);
});

listener.on(ParserEventStatus.ParsingFailed, (cmd, raw, error) => {
  console.error('Failed to parse command', cmd, raw, error);
});
```

## Development

```bash
vp install
vp check
vp test
vp pack
```

Run everything before publishing:

```bash
vp run ready
```
