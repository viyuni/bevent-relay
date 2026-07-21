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
import { createListener, getListenerState } from '@viyuni/bevent-relay';
import { ViyuniEventType } from '@viyuni/bevent-relay/events';

const listener = createListener({
  roomId: 123456,
  cookie: 'SESSDATA=...; buvid3=...',
  loginCheck: {
    interval: 600_000,
    autoReconnect: true,
    onInvalid: (_state, _previousState, incident) => {
      console.warn('Login expired at', new Date(incident.invalidAt));
    },
    onRestored: (_state, _previousState, incident) => {
      console.info('Login restored after', incident.durationMs, 'ms');
    },
  },
  heartbeat: {
    interval: 3_600_000,
    onResult: (result) => {
      console.info('Danmu heartbeat', result.success, result.durationMs, 'ms');
    },
  },
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

// Safe to expose from an internal health endpoint; never contains the Cookie.
console.log(getListenerState(listener.id));
```

The live event connection uses WSS over port 443, which is compatible with Docker and cloud
networks that block Bilibili's raw TCP port 2243.

The listener checks login state when connecting and every 10 minutes by default. A logout
incident is emitted once and remains active across temporary API check errors. When login is
restored, the recovery payload contains the exact invalid time, restored time, and duration:

```ts
listener.on('loginInvalid', (_state, _previousState, { invalidAt }) => {
  console.warn('Login invalid:', new Date(invalidAt).toISOString());
});

listener.on('loginRestored', (_state, _previousState, incident) => {
  console.info({
    invalidAt: new Date(incident.invalidAt).toISOString(),
    restoredAt: new Date(incident.restoredAt).toISOString(),
    durationMs: incident.durationMs,
  });
});

listener.on('heartbeat', (result) => {
  console.info(result.message, result.success, result.durationMs);
});

const current = listener.loginState;
const invalidSince = listener.loginInvalidSince;
listener.updateCookie('SESSDATA=new-value; buvid3=...');
await listener.checkLoginStatus(true);
```

Login recovery automatically restarts an already connected or failed listener by default. If a
connection is already being established or reconnected, the active attempt uses the restored
login instead of starting a duplicate connection. Set `loginCheck.autoReconnect` to `false` to
disable this behavior.

## Global Runtime State

Every listener is registered in a process-wide in-memory state registry as soon as it is created.
The registry is intended for health endpoints, monitoring jobs, or other modules in the same Node.js
process. Snapshots never contain Cookie values.

```ts
import { getListenerState, getListenerStates, getRoomListenerStates } from '@viyuni/bevent-relay';

const oneInstance = getListenerState(listener.id);
const oneRoom = getRoomListenerStates(listener.getRoomId());
const allInstances = getListenerStates();

console.log(oneInstance?.status);
console.log(oneInstance?.loginState.status);
console.log(oneInstance?.lastHeartbeat?.success);
```

Each `ListenerStateSnapshot` contains:

- `instanceId` and `roomId`
- connection `status` and current `loginState`
- `loginInvalidSince` and `retryCount`
- `createdAt`, `updatedAt`, `lastStatusChangedAt`, `connectedAt`, and `stoppedAt`
- the latest `lastHeartbeat` result
- a serializable `lastError` containing `name`, `message`, and `at`

All query functions return copies. Mutating a returned object cannot modify the registry. Call
`listener.dispose()` when an instance will never be used again; it stops the listener and removes
its global state record. `dispose()` is permanent.

## Exports

`@viyuni/bevent-relay` exports the listener API:

```ts
import {
  BliveListener,
  createListener,
  getListenerState,
  getListenerStates,
  getRoomListenerStates,
  LoginStatus,
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
  loginCheck?:
    | false
    | {
        interval?: number | false;
        autoReconnect?: boolean;
        onStatusChange?: (state, previousState) => void;
        onInvalid?: (state, previousState, incident) => void;
        onRestored?: (state, previousState, incident) => void;
      };
  heartbeat?:
    | false
    | {
        interval?: number;
        immediate?: boolean;
        messagePrefix?: string;
        sendOptions?: SendDanmuOptions;
        onResult?: (result: DanmuHeartbeatResult) => void;
      };
}
```

Set `loginCheck.interval` to `false` or `0` to disable only the periodic check. Set
`loginCheck: false` to disable all automatic checks; `checkLoginStatus()` remains available.
Login recovery reconnects the listener automatically unless `autoReconnect` is `false`.
The danmu heartbeat is opt-in and sends `故嘎嘎嘎<8-character nanoid>` every hour by default.
Set `heartbeat.interval` in milliseconds to override the interval.

## Listener Methods

- `start()` starts a new listener session. Repeated calls while active are ignored.
- `stop()` stops timers and connections but keeps the instance in the global registry.
- `restart()` stops and starts the instance with a freshly synchronized Cookie.
- `dispose()` permanently stops the instance and removes it from the global registry.
- `checkLoginStatus(forceRefreshCookie?)` performs an immediate login check.
- `refreshCookie(force?)` returns the current or freshly synchronized Cookie.
- `updateCookie(cookie)` replaces a manually managed Cookie.
- `sendDanmu(message, options?)` sends a normal danmu and rejects on failure.
- `sendHeartbeat()` sends one heartbeat immediately and always returns a success/failure result.
- `id`, `state`, `status`, `loginState`, and `loginInvalidSince` expose current instance state.

## Logging

All internal logs use [Pino](https://getpino.io/) and are written as structured JSON. Logger
injection and `ListenerConfig.logger` are intentionally not supported. Every room-scoped entry
contains `roomId`; operational entries also contain a stable `event` field such as
`connection_established`, `login_invalid`, `login_restored`, `heartbeat`, or
`reconnect_exhausted`.

A successful heartbeat log includes fields similar to:

```json
{
  "level": 30,
  "roomId": 123456,
  "event": "heartbeat",
  "success": true,
  "heartbeatId": "Ab3_xP9q",
  "danmu": "故嘎嘎嘎Ab3_xP9q",
  "durationMs": 125,
  "msg": "Danmu heartbeat succeeded"
}
```

Errors are serialized under Pino's standard `err` field.

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
