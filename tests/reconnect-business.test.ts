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

const sendDanmu = vi.fn(async () => ({}));

function createFakeDependencies() {
  const sockets: FakeWebSocket[] = [];
  const deps: ListenerDependencies = {
    fetchNavInfo: async () => ({ mid: 10001 }),
    fetchDanmuInfo: async () => ({
      randomServer: {
        host: 'live.example.test',
        port: 443,
        address: 'wss://live.example.test:443/sub',
      },
      token: 'danmu-token',
    }),
    sendDanmu,
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

test('force refreshes the cookie before starting the connection', async () => {
  const calls: string[] = [];
  const { deps } = createFakeDependencies();
  const fetchNavInfo = deps.fetchNavInfo;
  deps.fetchNavInfo = async (cookie) => {
    calls.push('connect');
    return fetchNavInfo(cookie);
  };
  const listener = new BliveListener({ roomId: 1 }, deps);
  const refreshCookie = vi.spyOn(listener, 'refreshCookie').mockImplementation(async (force) => {
    calls.push(`refresh:${force}`);
    return '';
  });

  await listener.start();

  expect(refreshCookie).toHaveBeenCalledWith(true);
  expect(calls).toEqual(['refresh:true', 'connect']);
});

test('connects with brotli protocol version 3', async () => {
  const { deps } = createFakeDependencies();
  const createWebSocket = vi.fn(deps.createWebSocket);
  deps.createWebSocket = createWebSocket;
  const listener = new BliveListener({ roomId: 1 }, deps);

  await listener.start();

  expect(createWebSocket).toHaveBeenCalledWith(
    1,
    expect.objectContaining({
      protover: 3,
    }),
  );
  listener.dispose();
});

test('awaits a cookie refresh before restarting the connection', async () => {
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener({ roomId: 1 }, deps);
  let finishRefresh: (() => void) | undefined;
  const refreshCookie = vi
    .spyOn(listener, 'refreshCookie')
    .mockResolvedValueOnce('')
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishRefresh = () => resolve('');
        }),
    );

  await listener.start();
  const restartPromise = listener.restart();
  await Promise.resolve();

  expect(refreshCookie).toHaveBeenCalledTimes(2);
  expect(sockets).toHaveLength(1);

  finishRefresh!();
  await restartPromise;

  expect(sockets).toHaveLength(2);
});

test('can restart while the initial connection is still waiting for a cookie refresh', async () => {
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener({ roomId: 1 }, deps);
  let finishFirstRefresh: (() => void) | undefined;
  vi.spyOn(listener, 'refreshCookie')
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishFirstRefresh = () => resolve('');
        }),
    )
    .mockResolvedValue('');

  const firstStart = listener.start();
  await Promise.resolve();
  await listener.restart();

  expect(sockets).toHaveLength(1);
  expect(listener.status).toBe(ReconnectListenerStatus.Connected);

  finishFirstRefresh!();
  await firstStart;
  expect(sockets).toHaveLength(1);
});

test('awaits a cookie refresh before reconnecting', async () => {
  vi.useFakeTimers();
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: {
        initialDelay: 1000,
        maxDelay: 1000,
        maxRetries: 1,
      },
    },
    deps,
  );
  let finishRefresh: (() => void) | undefined;
  const refreshCookie = vi
    .spyOn(listener, 'refreshCookie')
    .mockResolvedValueOnce('')
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishRefresh = () => resolve('');
        }),
    );

  await listener.start();
  sockets[0]!.emitClose();
  await vi.advanceTimersByTimeAsync(1000);

  expect(refreshCookie).toHaveBeenCalledTimes(2);
  expect(sockets).toHaveLength(1);

  finishRefresh!();
  await vi.advanceTimersByTimeAsync(0);

  expect(sockets).toHaveLength(2);
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
        port: 443,
        address: 'wss://live.example.test:443/sub',
      },
      token: 'danmu-token',
    })),
    sendDanmu,
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
        port: 443,
        address: 'wss://live.example.test:443/sub',
      },
      token: 'danmu-token',
    })),
    sendDanmu,
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
  expect(listener.status).toBe(ReconnectListenerStatus.Failed);
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
        port: 443,
        address: 'wss://live.example.test:443/sub',
      },
      token: 'danmu-token',
    }),
    sendDanmu,
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

  expect(listener.status).toBe(ReconnectListenerStatus.Failed);
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

test('handles repeated close events from one connection only once', async () => {
  vi.useFakeTimers();
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: { initialDelay: 1000, maxDelay: 1000, maxRetries: 2 },
    },
    deps,
  );
  const onClose = vi.fn();
  listener.on('close', onClose);

  await listener.start();
  sockets[0]!.emitClose();
  sockets[0]!.emitClose();
  sockets[0]!.emitClose();
  await vi.advanceTimersByTimeAsync(1000);

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(sockets).toHaveLength(2);
});

test('ignores delayed close events from a stale connection', async () => {
  vi.useFakeTimers();
  const { deps, sockets } = createFakeDependencies();
  const listener = new BliveListener(
    {
      roomId: 1,
      reconnect: { initialDelay: 1000, maxDelay: 1000, maxRetries: 2 },
    },
    deps,
  );

  await listener.start();
  sockets[0]!.emitClose();
  await vi.advanceTimersByTimeAsync(1000);
  expect(sockets).toHaveLength(2);

  sockets[0]!.emitClose();
  await vi.advanceTimersByTimeAsync(5000);

  expect(sockets).toHaveLength(2);
});
