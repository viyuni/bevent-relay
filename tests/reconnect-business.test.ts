import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import {
  BliveListener,
  type ListenerDependencies,
  type ListenerWebSocket,
} from '../src/core/listener.ts';
import { ReconnectListenerStatus } from '../src/core/types/index.ts';

class FakeWebSocket implements ListenerWebSocket {
  closed = false;
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  addListener(event: string, callback: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
  }

  close() {
    this.closed = true;
  }

  emitClose() {
    this.emit('close');
  }

  emitError(error = new Error('ws error')) {
    this.emit('error', error);
  }

  private emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}

function createFakeDependencies() {
  const sockets: FakeWebSocket[] = [];
  const deps: ListenerDependencies = {
    fetchNavInfo: async () => ({ mid: 10001 }),
    fetchDanmuInfo: async () => ({
      randomServer: {
        host: 'live.example.test',
        port: 2243,
      },
      token: 'danmu-token',
    }),
    createWebSocket: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  };

  return { deps, sockets };
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('reconnects after the websocket closes', async () => {
  vi.useFakeTimers();
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener(
    {
      roomId: 1,
      cookie: 'buvid3=test-buvid',
      reconnect: {
        initialDelay: 1000,
        maxDelay: 1000,
        maxRetries: 2,
        healthyAfter: 60_000,
      },
    },
    deps,
  );
  listener.on('error', () => {});

  await listener.start();
  expect(listener.status).toBe(ReconnectListenerStatus.Connected);
  expect(sockets).toHaveLength(1);

  sockets[0]!.emitClose();

  expect(listener.status).toBe(ReconnectListenerStatus.Reconnecting);

  await vi.advanceTimersByTimeAsync(999);
  expect(sockets).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(1);
  expect(sockets).toHaveLength(2);
  expect(listener.status).toBe(ReconnectListenerStatus.Connected);
});

test('retries websocket creation without refetching connection config', async () => {
  vi.useFakeTimers();
  let createAttempts = 0;
  const sockets: FakeWebSocket[] = [];
  const deps: ListenerDependencies = {
    fetchNavInfo: vi.fn(async () => ({ mid: 10001 })),
    fetchDanmuInfo: vi.fn(async () => ({
      randomServer: {
        host: 'live.example.test',
        port: 2243,
      },
      token: 'danmu-token',
    })),
    createWebSocket: () => {
      createAttempts++;
      if (createAttempts < 3) {
        throw new Error(`create failed ${createAttempts}`);
      }

      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  };
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: {
        initialDelay: 1000,
        maxDelay: 1000,
        maxRetries: 2,
      },
    },
    deps,
  );

  const startPromise = listener.start();
  await vi.advanceTimersByTimeAsync(0);

  expect(createAttempts).toBe(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(createAttempts).toBe(2);
  await vi.advanceTimersByTimeAsync(1000);

  await startPromise;
  expect(createAttempts).toBe(3);
  expect(deps.fetchNavInfo).toHaveBeenCalledTimes(1);
  expect(deps.fetchDanmuInfo).toHaveBeenCalledTimes(1);
  expect(sockets).toHaveLength(1);
  expect(listener.status).toBe(ReconnectListenerStatus.Connected);
});

test('does not retry connection config fetch failures', async () => {
  vi.useFakeTimers();
  const lastError = new Error('nav failed');
  const deps: ListenerDependencies = {
    fetchNavInfo: vi.fn(async () => {
      throw lastError;
    }),
    fetchDanmuInfo: vi.fn(async () => ({
      randomServer: {
        host: 'live.example.test',
        port: 2243,
      },
      token: 'danmu-token',
    })),
    createWebSocket: vi.fn(() => new FakeWebSocket()),
  };
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: {
        initialDelay: 1000,
        maxDelay: 1000,
        maxRetries: 2,
      },
    },
    deps,
  );
  const startPromise = listener.start().catch((error: unknown) => error);

  await vi.advanceTimersByTimeAsync(0);

  await expect(startPromise).resolves.toBe(lastError);
  expect(deps.fetchNavInfo).toHaveBeenCalledTimes(1);
  expect(deps.createWebSocket).not.toHaveBeenCalled();
  expect(listener.status).toBe(ReconnectListenerStatus.Reconnecting);
});

test('does not reconnect after an intentional stop', async () => {
  vi.useFakeTimers();
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: {
        initialDelay: 1000,
        maxRetries: 2,
      },
    },
    deps,
  );
  listener.on('error', () => {});

  await listener.start();
  listener.stop();
  sockets[0]!.emitClose();

  await vi.advanceTimersByTimeAsync(5000);

  expect(listener.status).toBe(ReconnectListenerStatus.Stopped);
  expect(sockets).toHaveLength(1);
});

test('stops retrying after maxRetries is reached', async () => {
  vi.useFakeTimers();
  const sockets: FakeWebSocket[] = [];
  const deps: ListenerDependencies = {
    fetchNavInfo: async () => ({ mid: 10001 }),
    fetchDanmuInfo: async () => ({
      randomServer: {
        host: 'live.example.test',
        port: 2243,
      },
      token: 'danmu-token',
    }),
    createWebSocket: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  };
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: {
        initialDelay: 1000,
        maxDelay: 1000,
        maxRetries: 1,
        healthyAfter: 60_000,
      },
    },
    deps,
  );
  listener.on('error', () => {});

  await listener.start();
  sockets[0]!.emitError();
  await vi.advanceTimersByTimeAsync(1000);
  expect(sockets).toHaveLength(2);

  sockets[1]!.emitError();
  await vi.advanceTimersByTimeAsync(5000);

  expect(listener.status).toBe(ReconnectListenerStatus.Reconnecting);
  expect(sockets).toHaveLength(2);
});

test('deduplicates reconnect when websocket emits error then close', async () => {
  vi.useFakeTimers();
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: {
        initialDelay: 1000,
        maxDelay: 1000,
        maxRetries: 2,
        healthyAfter: 60_000,
      },
    },
    deps,
  );
  listener.on('error', () => {});

  await listener.start();
  sockets[0]!.emitError();
  sockets[0]!.emitClose();

  await vi.advanceTimersByTimeAsync(1000);

  expect(sockets).toHaveLength(2);
  expect(listener.status).toBe(ReconnectListenerStatus.Connected);
});
