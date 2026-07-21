import { afterEach, expect, test, vi } from 'vite-plus/test';

import {
  BliveListener,
  type ListenerDependencies,
  type ListenerWebSocket,
} from '../src/core/listener.ts';

class FakeWebSocket implements ListenerWebSocket {
  addListener() {}
  close() {}
}

function createDependencies(sendDanmu: ListenerDependencies['sendDanmu']): ListenerDependencies {
  return {
    fetchNavInfo: async () => ({ isLogin: true, mid: 10001 }),
    fetchDanmuInfo: async () => ({ token: 'token' }),
    sendDanmu,
    createWebSocket: () => new FakeWebSocket(),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('sends automatic heartbeats every hour by default', async () => {
  vi.useFakeTimers();
  const sendDanmu = vi.fn(async () => ({}));
  const listener = new BliveListener(
    { roomId: 1, loginCheck: { interval: false }, heartbeat: {} },
    createDependencies(sendDanmu),
  );

  await listener.start();
  await vi.advanceTimersByTimeAsync(3_599_999);
  expect(sendDanmu).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(1);
  expect(sendDanmu).toHaveBeenCalledTimes(1);
  listener.dispose();
});

test('periodically sends a danmu heartbeat and reports success with duration', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-21T03:00:00.000Z'));
  const sendDanmu = vi.fn(
    () =>
      new Promise<Record<string, unknown>>((resolve) => {
        setTimeout(() => resolve({ accepted: true }), 125);
      }),
  );
  const onResult = vi.fn();
  const onHeartbeat = vi.fn();
  const listener = new BliveListener(
    {
      roomId: 1,
      loginCheck: { interval: false },
      heartbeat: { interval: 1000, onResult },
    },
    createDependencies(sendDanmu),
  );
  listener.on('heartbeat', onHeartbeat);

  await listener.start();
  await vi.advanceTimersByTimeAsync(1000);
  expect(sendDanmu).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(125);

  const result = onResult.mock.calls[0]?.[0];
  expect(result).toMatchObject({
    success: true,
    durationMs: 125,
    response: { accepted: true },
  });
  expect(result.message).toMatch(/^故嘎嘎嘎[0-9A-Za-z_-]{8}$/);
  expect(onHeartbeat).toHaveBeenCalledWith(result);

  listener.stop();
  await vi.advanceTimersByTimeAsync(5000);
  expect(sendDanmu).toHaveBeenCalledTimes(1);
});

test('returns and emits a failed heartbeat result without throwing', async () => {
  const error = new Error('send rejected');
  const onResult = vi.fn();
  const listener = new BliveListener(
    {
      roomId: 1,
      heartbeat: { interval: 60_000, onResult },
    },
    createDependencies(async () => {
      throw error;
    }),
  );

  const result = await listener.sendHeartbeat();

  expect(result.success).toBe(false);
  expect(result.error).toBe(error);
  expect(result.message).toMatch(/^故嘎嘎嘎[0-9A-Za-z_-]{8}$/);
  expect(onResult).toHaveBeenCalledWith(result);
});
