import { EventEmitter } from 'events';

import { KeepLiveTCP } from 'bilibili-live-ws';

import { Cmd } from '../events/index.ts';
import {
  type DanmuServer,
  fetchDanmuInfo,
  fetchNavInfo,
  sendDanmu,
  type FetchBiliNavResp,
  type SendDanmuOptions,
} from './bili-api';
import { ListenerCookieProvider } from './cookie-provider';
import * as AllParsers from './parsers';
import {
  calculateBackoffDelay,
  resolveReconnectConfig,
  retry,
  wait,
  type RetryConfig,
} from './reconnect';
import {
  ParserEventStatus,
  ReconnectListenerStatus,
  type ListenerConfig,
  type ListenerEvents,
  type ReconnectConfig,
} from './types';

type ListenerWebSocketEvent = 'msg' | 'close' | 'error';

type ConnectOnceConfig = RetryConfig & {
  onAttempt?: (retryCount: number) => void;
  retryTotal?: number;
};

export interface ListenerWebSocket {
  addListener(event: ListenerWebSocketEvent, callback: (...args: any[]) => void): void;
  close(): void;
}

export interface ListenerDependencies {
  fetchNavInfo: (cookie: string | null) => Promise<Pick<FetchBiliNavResp['data'], 'mid'>>;
  fetchDanmuInfo: (
    roomId: number,
    cookie?: string | null,
  ) => Promise<{ randomServer?: DanmuServer; token: string }>;
  sendDanmu: (
    roomId: number,
    message: string,
    cookie: string | null,
    options?: SendDanmuOptions,
  ) => Promise<Record<string, unknown>>;
  createWebSocket: (
    roomId: number,
    options: {
      host?: string;
      port?: number;
      key: string;
      uid: number;
      buvid: string;
    },
  ) => ListenerWebSocket;
}

const defaultDependencies: ListenerDependencies = {
  fetchNavInfo,
  fetchDanmuInfo,
  sendDanmu,
  createWebSocket: (roomId, options) => new KeepLiveTCP(roomId, options),
};

export class BliveListener {
  private ws: ListenerWebSocket | null = null;
  private roomId: number;
  private emitter = new EventEmitter<ListenerEvents>();
  private cookieProvider: ListenerCookieProvider;
  private dependencies: ListenerDependencies;
  private uid = 0;
  private reconnectConfig: Required<ReconnectConfig>;
  private retryCount = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private reconnectPromise: Promise<void> | null = null;
  private isIntentionallyStopped = false;
  private currentStatus: ReconnectListenerStatus = ReconnectListenerStatus.Idle;
  private static parsers = Object.values(AllParsers);

  constructor(config: ListenerConfig, dependencies: ListenerDependencies = defaultDependencies) {
    this.roomId = config.roomId;
    this.dependencies = dependencies;
    this.cookieProvider = new ListenerCookieProvider(config.cookie ?? '', config.cookieSync);
    this.reconnectConfig = resolveReconnectConfig(
      config.reconnect === false ? { maxRetries: 0 } : config.reconnect,
    );
  }

  refreshCookie(force = false): Promise<string> {
    return this.cookieProvider.refresh(force);
  }

  async sendDanmu(message: string, options?: SendDanmuOptions) {
    const cookie = await this.cookieProvider.refresh();

    return this.dependencies.sendDanmu(this.roomId, message, cookie, options);
  }

  async start() {
    if (
      this.currentStatus === ReconnectListenerStatus.Connecting ||
      this.currentStatus === ReconnectListenerStatus.Connected
    ) {
      return;
    }

    this.isIntentionallyStopped = false;
    this.currentStatus = ReconnectListenerStatus.Connecting;
    this.clearTimers();
    this.closeCurrentWebSocket();

    console.info(
      `[Room ${this.roomId}] Starting listener. reconnect=${this.retryCount}/${this.reconnectConfig.maxRetries}`,
    );
    await this.connectWithFreshCookie().catch((error: unknown) => {
      console.error(`[Room ${this.roomId}] Failed to start:`, error);
      this.currentStatus = ReconnectListenerStatus.Reconnecting;
      throw error;
    });
  }

  /** 停止监听 */
  stop() {
    if (this.currentStatus !== ReconnectListenerStatus.Stopped) {
      console.info(`[Room ${this.roomId}] Stopping listener.`);
    }
    this.isIntentionallyStopped = true;
    this.currentStatus = ReconnectListenerStatus.Stopped;
    this.clearTimers();
    this.closeCurrentWebSocket();
    this.retryCount = 0;
  }

  async restart() {
    console.info(`[Room ${this.roomId}] Restarting listener.`);
    this.stop();
    await this.start();
  }

  /** 获取当前房间号 */
  getRoomId() {
    return this.roomId;
  }

  get status() {
    return this.currentStatus;
  }

  /** 事件监听 */
  on(event: 'event', callback: (...args: ListenerEvents['event']) => void): () => void;
  on(event: 'close', callback: (...args: ListenerEvents['close']) => void): () => void;
  on(event: 'error', callback: (...args: ListenerEvents['error']) => void): () => void;
  on(
    event: typeof ParserEventStatus.Unknown,
    callback: (...args: ListenerEvents['unknown']) => void,
  ): () => void;
  on(
    event: typeof ParserEventStatus.Unimplemented,
    callback: (...args: ListenerEvents['unimplemented']) => void,
  ): () => void;
  on(
    event: typeof ParserEventStatus.ParsingFailed,
    callback: (...args: ListenerEvents['parsingFailed']) => void,
  ): () => void;
  on(event: keyof ListenerEvents, callback: (...args: any[]) => any) {
    this.emitter.on(event, callback);
    return () => this.emitter.off(event, callback);
  }

  private bindWebSocket(ws: ListenerWebSocket) {
    this.ws = ws;
    this.currentStatus = ReconnectListenerStatus.Connected;
    console.info(
      `[Room ${this.roomId}] Connected. uid=${this.uid} reconnect=${this.retryCount}/${this.reconnectConfig.maxRetries}`,
    );

    ws.addListener('msg', (msg) => this.handleMsg(msg));
    ws.addListener('close', () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      this.emitter.emit('close');
      console.warn(`[Room ${this.roomId}] Connection closed.`);
      void this.scheduleReconnect('Connection closed');
    });
    ws.addListener('error', (error) => {
      this.emitter.emit('error', error);
      console.error(`[Room ${this.roomId}] Connection error:`, error);
      void this.scheduleReconnect('Connection error');
    });

    this.healthCheckTimer = setTimeout(() => {
      this.retryCount = 0;
    }, this.reconnectConfig.healthyAfter);
  }

  private async connectWithFreshCookie(config: ConnectOnceConfig = this.reconnectConfig) {
    if (this.isIntentionallyStopped) return;

    if (config.delayBeforeFirstAttempt) {
      const resolvedConfig = resolveReconnectConfig(config);
      await wait(calculateBackoffDelay(config.retryOffset ?? 0, resolvedConfig));
    }

    if (this.isIntentionallyStopped) return;

    await this.refreshCookie(true);

    if (this.isIntentionallyStopped) return;

    await this.connectOnce(config);
  }

  private async connectOnce(config: ConnectOnceConfig = this.reconnectConfig) {
    if (this.isIntentionallyStopped) return;

    const cookie = this.cookieProvider.value;

    const [{ mid = 0 }, { randomServer, token }] = await Promise.all([
      this.dependencies.fetchNavInfo(cookie),
      this.dependencies.fetchDanmuInfo(this.roomId, cookie),
    ]);

    this.uid = mid;
    if (mid === 0) console.warn('Viyuni Sync account not logged in.');

    await retry(
      async (retryCount) => {
        if (this.isIntentionallyStopped) return;

        config.onAttempt?.(retryCount);
        console.info(
          `[Room ${this.roomId}] Connecting (${this.getRetryLogLabel(retryCount, config)}).`,
        );
        const ws = this.dependencies.createWebSocket(this.roomId, {
          host: randomServer?.host,
          port: randomServer?.port,
          key: token,
          uid: this.uid ?? 0,
          buvid: this.cookieProvider.buvid,
        });

        this.bindWebSocket(ws);
      },
      {
        ...config,
        delayBeforeFirstAttempt: false,
        onError: (error, retryCount) => {
          console.warn(
            `[Room ${this.roomId}] Connect failed (${this.getRetryLogLabel(retryCount, config)}).`,
            error,
          );
          config.onError?.(error, retryCount);
        },
      },
    );
  }

  private getRetryLogLabel(retryCount: number, config: ConnectOnceConfig) {
    const reconnectCount = retryCount + (config.retryOffset ?? 0);
    const maxReconnects = config.retryTotal ?? config.maxRetries ?? 0;
    const attempt = reconnectCount + 1;
    const totalAttempts = maxReconnects + 1;

    return `attempt ${attempt}/${totalAttempts}, reconnect ${reconnectCount}/${maxReconnects}`;
  }

  private handleMsg(msg: any) {
    const cmd = msg?.cmd as Cmd | undefined;

    if (!cmd) return;

    const isKnownCmd = Object.values(Cmd).includes(cmd);

    if (!isKnownCmd) {
      this.emitter.emit(ParserEventStatus.Unknown, msg);
      return;
    }
    const parserEntry = BliveListener.parsers.find((item) => item.cmd === cmd);

    if (!parserEntry) {
      this.emitter.emit(ParserEventStatus.Unimplemented, cmd, msg);
      return;
    }

    try {
      const parsed = parserEntry.parser(cmd, msg, this.roomId, this.uid ?? 0);

      if (parsed) {
        this.emitter.emit('event', parsed);
      }
    } catch (error) {
      console.error(`[Room ${this.roomId}] [ParseError] [${cmd}]:`, error);
      this.emitter.emit(ParserEventStatus.ParsingFailed, cmd, msg, error);
    }
  }

  private async scheduleReconnect(reason: string) {
    if (this.isIntentionallyStopped) return;
    if (this.currentStatus === ReconnectListenerStatus.Connecting) return;
    if (this.reconnectPromise) return;

    this.reconnectPromise = this.reconnect(reason).finally(() => {
      this.reconnectPromise = null;
    });

    await this.reconnectPromise;
  }

  private async reconnect(reason: string) {
    this.currentStatus = ReconnectListenerStatus.Reconnecting;

    if (this.retryCount >= this.reconnectConfig.maxRetries) {
      console.error(
        `[Room ${this.roomId}] ${reason}. Exceeded max retries (${this.reconnectConfig.maxRetries}).`,
      );
      return;
    }

    this.clearTimers();

    const initialRetryCount = this.retryCount;
    const remainingRetries = this.reconnectConfig.maxRetries - this.retryCount - 1;
    console.warn(
      `[Room ${this.roomId}] ${reason}. Reconnecting (${initialRetryCount + 1}/${this.reconnectConfig.maxRetries}).`,
    );

    await this.connectWithFreshCookie({
      ...this.reconnectConfig,
      maxRetries: remainingRetries,
      delayBeforeFirstAttempt: true,
      retryOffset: initialRetryCount,
      retryTotal: this.reconnectConfig.maxRetries,
      onAttempt: (retryCount) => {
        this.retryCount = initialRetryCount + retryCount + 1;
      },
    }).catch((error: unknown) => {
      console.error(
        `[Room ${this.roomId}] ${reason}. Exceeded max retries (${this.reconnectConfig.maxRetries}).`,
        error,
      );
    });
  }

  private clearTimers() {
    if (this.healthCheckTimer) clearTimeout(this.healthCheckTimer);
    this.healthCheckTimer = null;
  }

  private closeCurrentWebSocket() {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
  }
}

export function createListener(config: ListenerConfig) {
  return new BliveListener(config);
}
