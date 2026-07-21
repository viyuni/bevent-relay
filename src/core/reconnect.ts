import type { ReconnectConfig } from './types';

export interface RetryConfig extends ReconnectConfig {
  delayBeforeFirstAttempt?: boolean;
  retryOffset?: number;
  onError?: (error: unknown, retryCount: number) => void;
  signal?: AbortSignal;
}

export class RetryAbortedError extends Error {
  constructor() {
    super('Retry was aborted.');
    this.name = 'AbortError';
  }
}

export const DEFAULT_RECONNECT_CONFIG = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  healthyAfter: 10000,
} as const satisfies Required<ReconnectConfig>;

export function resolveReconnectConfig(config?: ReconnectConfig): Required<ReconnectConfig> {
  return {
    ...DEFAULT_RECONNECT_CONFIG,
    ...config,
  };
}

export function calculateBackoffDelay(
  retryCount: number,
  config: Required<ReconnectConfig>,
): number {
  return Math.min(config.initialDelay * Math.pow(2, retryCount), config.maxDelay);
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new RetryAbortedError());

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RetryAbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function retry<T>(
  fn: (retryCount: number) => Promise<T>,
  config?: RetryConfig,
): Promise<T> {
  const resolvedConfig = resolveReconnectConfig(config);
  let lastError: unknown;

  for (let retryCount = 0; retryCount <= resolvedConfig.maxRetries; retryCount++) {
    if (config?.signal?.aborted) throw new RetryAbortedError();
    const backoffRetryCount = retryCount + (config?.retryOffset ?? 0);

    try {
      if (config?.delayBeforeFirstAttempt && retryCount === 0) {
        await wait(calculateBackoffDelay(backoffRetryCount, resolvedConfig), config.signal);
      }

      return await fn(retryCount);
    } catch (error) {
      lastError = error;
      config?.onError?.(error, retryCount);

      if (retryCount >= resolvedConfig.maxRetries) {
        throw lastError;
      }

      await wait(calculateBackoffDelay(backoffRetryCount, resolvedConfig), config?.signal);
    }
  }

  throw lastError;
}
