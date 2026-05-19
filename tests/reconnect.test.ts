import { afterEach, expect, test, vi } from 'vite-plus/test';

import {
  calculateBackoffDelay,
  DEFAULT_RECONNECT_CONFIG,
  retry,
  resolveReconnectConfig,
} from '../src/core/reconnect.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('resolveReconnectConfig fills defaults', () => {
  expect(resolveReconnectConfig()).toEqual(DEFAULT_RECONNECT_CONFIG);
  expect(resolveReconnectConfig({ maxRetries: 3 })).toEqual({
    ...DEFAULT_RECONNECT_CONFIG,
    maxRetries: 3,
  });
});

test('calculateBackoffDelay grows exponentially and caps at maxDelay', () => {
  const config = resolveReconnectConfig({
    initialDelay: 1000,
    maxDelay: 5000,
  });

  expect(calculateBackoffDelay(0, config)).toBe(1000);
  expect(calculateBackoffDelay(1, config)).toBe(2000);
  expect(calculateBackoffDelay(2, config)).toBe(4000);
  expect(calculateBackoffDelay(3, config)).toBe(5000);
});

test('retry resolves after a later attempt succeeds', async () => {
  vi.useFakeTimers();
  let attempts = 0;

  const resultPromise = retry(
    async (retryCount) => {
      attempts++;
      if (retryCount < 2) {
        throw new Error(`attempt ${retryCount} failed`);
      }
      return 'ok';
    },
    {
      maxRetries: 2,
      initialDelay: 1000,
      maxDelay: 1000,
    },
  );

  expect(attempts).toBe(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(attempts).toBe(2);
  await vi.advanceTimersByTimeAsync(1000);

  await expect(resultPromise).resolves.toBe('ok');
  expect(attempts).toBe(3);
});

test('retry rejects with the last error after all retries fail', async () => {
  vi.useFakeTimers();
  const lastError = new Error('last failed');
  let attempts = 0;

  const resultPromise = retry(
    async (retryCount) => {
      attempts++;
      throw retryCount === 2 ? lastError : new Error(`attempt ${retryCount} failed`);
    },
    {
      maxRetries: 2,
      initialDelay: 1000,
      maxDelay: 1000,
    },
  ).catch((error: unknown) => error);

  await vi.advanceTimersByTimeAsync(1000);
  await vi.advanceTimersByTimeAsync(1000);

  await expect(resultPromise).resolves.toBe(lastError);
  expect(attempts).toBe(3);
});

test('retry runs once when maxRetries is zero', async () => {
  let attempts = 0;

  await expect(
    retry(
      async () => {
        attempts++;
        throw new Error('failed');
      },
      {
        maxRetries: 0,
      },
    ),
  ).rejects.toThrow('failed');
  expect(attempts).toBe(1);
});
