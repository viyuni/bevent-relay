import { afterEach, expect, test, vi } from 'vite-plus/test';

import {
  BliveListener,
  type ListenerDependencies,
  type ListenerWebSocket,
} from '../src/core/listener.ts';
import { LoginStatus } from '../src/core/types/index.ts';

class FakeWebSocket implements ListenerWebSocket {
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  addListener(event: string, callback: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
  }

  close() {}
}

function createDependencies(loginResults: boolean[]): ListenerDependencies {
  let index = 0;
  return {
    fetchNavInfo: async () => {
      const isLogin = loginResults[Math.min(index++, loginResults.length - 1)] ?? false;
      return { isLogin, mid: isLogin ? 10001 : 0 };
    },
    fetchDanmuInfo: async () => ({ token: 'token' }),
    sendDanmu: async () => ({}),
    createWebSocket: () => new FakeWebSocket(),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('checks login every 10 minutes by default', async () => {
  vi.useFakeTimers();
  const deps = createDependencies([true]);
  const fetchNavInfo = vi.spyOn(deps, 'fetchNavInfo');
  const listener = new BliveListener({ roomId: 1 }, deps);

  await listener.start();
  expect(fetchNavInfo).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(599_999);
  expect(fetchNavInfo).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(1);
  expect(fetchNavInfo).toHaveBeenCalledTimes(2);
  listener.stop();
});

test('emits one invalid incident and a timed restored incident', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-21T03:00:00.000Z'));
  const onInvalid = vi.fn();
  const onRestored = vi.fn();
  const listener = new BliveListener(
    {
      roomId: 1,
      loginCheck: { interval: 1000, onInvalid, onRestored },
    },
    createDependencies([false, false, true]),
  );
  const invalidEvents: unknown[][] = [];
  const restoredEvents: unknown[][] = [];
  listener.on('loginInvalid', (...args) => invalidEvents.push(args));
  listener.on('loginRestored', (...args) => restoredEvents.push(args));

  await listener.start();
  expect(listener.loginState.status).toBe(LoginStatus.LoggedOut);
  expect(invalidEvents).toHaveLength(1);
  expect(onInvalid).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(1000);
  expect(invalidEvents).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(1000);
  expect(listener.loginState.status).toBe(LoginStatus.LoggedIn);
  expect(restoredEvents).toHaveLength(1);
  expect(onRestored).toHaveBeenCalledTimes(1);
  expect(restoredEvents[0]?.[2]).toEqual({
    invalidAt: Date.parse('2026-07-21T03:00:00.000Z'),
    restoredAt: Date.parse('2026-07-21T03:00:02.000Z'),
    durationMs: 2000,
  });

  listener.stop();
});

test('login check errors are not treated as logout incidents', async () => {
  const error = new Error('nav unavailable');
  const deps = createDependencies([true]);
  deps.fetchNavInfo = async () => {
    throw error;
  };
  const listener = new BliveListener({ roomId: 1 }, deps);
  const onInvalid = vi.fn();
  listener.on('loginInvalid', onInvalid);

  await expect(listener.checkLoginStatus()).rejects.toBe(error);
  expect(listener.loginState.status).toBe(LoginStatus.Error);
  expect(onInvalid).not.toHaveBeenCalled();
});

test('accepts a replacement cookie before checking for recovery', async () => {
  const cookies: Array<string | null> = [];
  const deps = createDependencies([false, true]);
  const fetchNavInfo = deps.fetchNavInfo;
  deps.fetchNavInfo = async (cookie) => {
    cookies.push(cookie);
    return fetchNavInfo(cookie);
  };
  const listener = new BliveListener(
    {
      roomId: 1,
      cookie: 'SESSDATA=expired',
      loginCheck: { interval: false, autoReconnect: false },
    },
    deps,
  );

  await listener.start();
  listener.updateCookie('SESSDATA=restored');
  await listener.checkLoginStatus();

  expect(cookies).toEqual(['SESSDATA=expired', 'SESSDATA=restored']);
  expect(listener.loginState.status).toBe(LoginStatus.LoggedIn);
});

test('automatically reconnects after login recovers', async () => {
  const deps = createDependencies([false, true, true]);
  const createWebSocket = vi.fn(() => new FakeWebSocket());
  deps.createWebSocket = createWebSocket;
  const listener = new BliveListener({ roomId: 1, loginCheck: { interval: false } }, deps);

  await listener.start();
  expect(createWebSocket).toHaveBeenCalledTimes(1);

  await listener.checkLoginStatus();
  await vi.waitFor(() => expect(createWebSocket).toHaveBeenCalledTimes(2));

  listener.stop();
});

test('continues checking login after the websocket connection setup fails', async () => {
  vi.useFakeTimers();
  const deps = createDependencies([false, true]);
  deps.fetchDanmuInfo = async () => {
    throw new Error('danmu config unavailable');
  };
  const listener = new BliveListener({ roomId: 1, loginCheck: { interval: 1000 } }, deps);
  const onRestored = vi.fn();
  listener.on('loginRestored', onRestored);

  await expect(listener.start()).rejects.toThrow('danmu config unavailable');
  expect(listener.loginState.status).toBe(LoginStatus.LoggedOut);

  await vi.advanceTimersByTimeAsync(1000);

  expect(listener.loginState.status).toBe(LoginStatus.LoggedIn);
  expect(onRestored).toHaveBeenCalledTimes(1);
  listener.stop();
});
