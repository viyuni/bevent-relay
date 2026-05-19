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

test('retries start failures before connecting', async () => {
  vi.useFakeTimers();
  let navAttempts = 0;
  const sockets: FakeWebSocket[] = [];
  const deps: ListenerDependencies = {
    fetchNavInfo: async () => {
      navAttempts++;
      if (navAttempts < 3) {
        throw new Error(`nav failed ${navAttempts}`);
      }
      return { mid: 10001 };
    },
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
        maxRetries: 2,
      },
    },
    deps,
  );

  const startPromise = listener.start();
  await vi.advanceTimersByTimeAsync(0);

  expect(navAttempts).toBe(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(navAttempts).toBe(2);
  await vi.advanceTimersByTimeAsync(1000);

  await startPromise;
  expect(navAttempts).toBe(3);
  expect(sockets).toHaveLength(1);
  expect(listener.status).toBe(ReconnectListenerStatus.Connected);
});

test('rejects start after all retries fail', async () => {
  vi.useFakeTimers();
  const lastError = new Error('nav failed finally');
  let navAttempts = 0;
  const deps: ListenerDependencies = {
    fetchNavInfo: async () => {
      navAttempts++;
      throw navAttempts === 3 ? lastError : new Error(`nav failed ${navAttempts}`);
    },
    fetchDanmuInfo: async () => ({
      randomServer: {
        host: 'live.example.test',
        port: 2243,
      },
      token: 'danmu-token',
    }),
    createWebSocket: () => new FakeWebSocket(),
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

  await vi.advanceTimersByTimeAsync(1000);
  await vi.advanceTimersByTimeAsync(1000);

  await expect(startPromise).resolves.toBe(lastError);
  expect(navAttempts).toBe(3);
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
