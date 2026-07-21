import { EventEmitter } from 'events';

import { KeepLiveTCP } from 'bilibili-live-ws';
import { nanoid } from 'nanoid';
import type { Logger } from 'pino';

import { Cmd } from '../events/index.ts';
import {
  BiliApiError,
  type DanmuServer,
  fetchDanmuInfo,
  fetchNavInfo,
  sendDanmu,
  type FetchBiliNavResp,
  type SendDanmuOptions,
} from './bili-api';
import { ListenerCookieProvider } from './cookie-provider';
import { createRoomLogger } from './logger';
import * as AllParsers from './parsers';
import {
  calculateBackoffDelay,
  isAbortError,
  resolveReconnectConfig,
  retry,
  wait,
  type RetryConfig,
} from './reconnect';
import {
  getListenerState,
  registerListenerState,
  unregisterListenerState,
  updateListenerState,
} from './state-registry';
import {
  LoginStatus,
  ParserEventStatus,
  ReconnectListenerStatus,
  type DanmuHeartbeatConfig,
  type DanmuHeartbeatResult,
  type ListenerConfig,
  type ListenerErrorSnapshot,
  type ListenerEvents,
  type ListenerStateSnapshot,
  type LoginCheckConfig,
  type LoginIncident,
  type LoginState,
  type ReconnectConfig,
} from './types';

type ListenerWebSocketEvent = 'msg' | 'close' | 'error';

type ConnectOnceConfig = RetryConfig & {
  onAttempt?: (retryCount: number) => void;
  retryTotal?: number;
};

const DEFAULT_LOGIN_CHECK_INTERVAL = 10 * 60 * 1000;
const DEFAULT_HEARTBEAT_INTERVAL = 60 * 60 * 1000;
const DEFAULT_HEARTBEAT_MESSAGE_PREFIX = '故嘎嘎嘎';

export interface ListenerWebSocket {
  addListener(event: ListenerWebSocketEvent, callback: (...args: any[]) => void): void;
  close(): void;
}

export interface ListenerDependencies {
  fetchNavInfo: (
    cookie: string | null,
  ) => Promise<Pick<FetchBiliNavResp['data'], 'mid'> & { isLogin?: boolean }>;
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

/**
 * Bilibili 直播间事件监听器。
 *
 * 每次 start/restart 都会创建独立会话。旧会话产生的延迟事件会被忽略，
 * 同一条连接的 error/close 也只会触发一次重连。
 */
export class BliveListener {
  private readonly instanceId = nanoid(8);
  private ws: ListenerWebSocket | null = null;
  private readonly roomId: number;
  private readonly emitter = new EventEmitter<ListenerEvents>();
  private readonly cookieProvider: ListenerCookieProvider;
  private readonly dependencies: ListenerDependencies;
  private readonly reconnectConfig: Required<ReconnectConfig>;
  private readonly loginCheckConfig: LoginCheckConfig | false;
  private readonly heartbeatConfig: DanmuHeartbeatConfig | false;
  private readonly logger: Logger;
  private uid = 0;
  private retryCount = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private loginCheckTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectPromise: Promise<void> | null = null;
  private startPromise: Promise<void> | null = null;
  private loginCheckPromise: Promise<LoginState> | null = null;
  private loginInvalidAt: number | null = null;
  private sessionController: AbortController | null = null;
  private sessionId = 0;
  private disposed = false;
  private currentStatus: ReconnectListenerStatus = ReconnectListenerStatus.Idle;
  private currentLoginState: LoginState = {
    status: LoginStatus.Unknown,
    uid: 0,
    checkedAt: null,
  };
  private static readonly parsers = Object.values(AllParsers);

  constructor(config: ListenerConfig, dependencies: ListenerDependencies = defaultDependencies) {
    this.roomId = config.roomId;
    this.dependencies = dependencies;
    this.logger = createRoomLogger(config.roomId);
    this.cookieProvider = new ListenerCookieProvider(config.cookie ?? '', config.cookieSync);
    this.reconnectConfig = resolveReconnectConfig(
      config.reconnect === false ? { maxRetries: 0 } : config.reconnect,
    );
    this.loginCheckConfig = config.loginCheck === false ? false : (config.loginCheck ?? {});
    this.heartbeatConfig = config.heartbeat ?? false;

    const now = Date.now();
    registerListenerState({
      instanceId: this.instanceId,
      roomId: this.roomId,
      status: this.currentStatus,
      loginState: this.currentLoginState,
      loginInvalidSince: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      lastStatusChangedAt: now,
      connectedAt: null,
      stoppedAt: null,
      lastHeartbeat: null,
      lastError: null,
    });
  }

  /** 当前进程内唯一的 Listener 实例 ID。 */
  get id() {
    return this.instanceId;
  }

  get status() {
    return this.currentStatus;
  }

  get loginState(): Readonly<LoginState> {
    return this.currentLoginState;
  }

  /** 获取当前实例的外部监控快照。dispose 后返回 undefined。 */
  get state(): ListenerStateSnapshot | undefined {
    return getListenerState(this.instanceId);
  }

  /** 当前登录失效周期的起始时间；登录有效时为 `null`。 */
  get loginInvalidSince(): number | null {
    return this.loginInvalidAt;
  }

  /** 获取当前房间号。 */
  getRoomId() {
    return this.roomId;
  }

  refreshCookie(force = false): Promise<string> {
    return this.cookieProvider.refresh(force);
  }

  /** 更新手动 Cookie；可随后调用 `checkLoginStatus()` 或 `restart()` 使其生效。 */
  updateCookie(cookie: string) {
    this.cookieProvider.update(cookie);
  }

  /** 主动检测一次登录状态。并发调用会复用同一个请求。 */
  async checkLoginStatus(forceRefreshCookie = false): Promise<LoginState> {
    if (this.loginCheckPromise) return this.loginCheckPromise;

    this.loginCheckPromise = this.performLoginCheck(forceRefreshCookie).finally(() => {
      this.loginCheckPromise = null;
    });
    return this.loginCheckPromise;
  }

  async sendDanmu(message: string, options?: SendDanmuOptions) {
    const cookie = await this.cookieProvider.refresh();
    return this.dependencies.sendDanmu(this.roomId, message, cookie, options);
  }

  /** 立即发送一次弹幕探针，并返回成功状态与耗时。此方法始终返回结果，不抛出发送错误。 */
  async sendHeartbeat(): Promise<DanmuHeartbeatResult> {
    const id = nanoid(8);
    const message = `${this.heartbeatConfig ? (this.heartbeatConfig.messagePrefix ?? DEFAULT_HEARTBEAT_MESSAGE_PREFIX) : DEFAULT_HEARTBEAT_MESSAGE_PREFIX}${id}`;
    const startedAt = Date.now();

    let result: DanmuHeartbeatResult;
    try {
      const response = await this.sendDanmu(
        message,
        this.heartbeatConfig ? this.heartbeatConfig.sendOptions : undefined,
      );
      const completedAt = Date.now();
      result = {
        id,
        message,
        success: true,
        startedAt,
        completedAt,
        durationMs: Math.max(0, completedAt - startedAt),
        response,
      };
      this.logger.info(
        {
          event: 'heartbeat',
          success: true,
          heartbeatId: id,
          danmu: message,
          durationMs: result.durationMs,
          startedAt,
          completedAt,
        },
        'Danmu heartbeat succeeded',
      );
    } catch (error) {
      const completedAt = Date.now();
      result = {
        id,
        message,
        success: false,
        startedAt,
        completedAt,
        durationMs: Math.max(0, completedAt - startedAt),
        error,
      };
      this.logger.warn(
        {
          err: error,
          event: 'heartbeat',
          success: false,
          heartbeatId: id,
          danmu: message,
          durationMs: result.durationMs,
          startedAt,
          completedAt,
        },
        'Danmu heartbeat failed',
      );

      if (error instanceof BiliApiError && error.code === -101) {
        this.updateLoginState({
          status: LoginStatus.LoggedOut,
          uid: 0,
          checkedAt: completedAt,
        });
      }
    }

    this.syncState({ lastHeartbeat: result });

    try {
      this.emitter.emit('heartbeat', result);
    } catch (error) {
      this.logger.error(
        { err: error, event: 'heartbeat_event_listener_failed' },
        'Heartbeat event listener failed',
      );
    }
    this.callHeartbeatCallback(result);
    return result;
  }

  async start(): Promise<void> {
    if (this.disposed) throw new Error('Cannot start a disposed listener.');
    if (this.startPromise) return this.startPromise;
    if (
      this.currentStatus === ReconnectListenerStatus.Connecting ||
      this.currentStatus === ReconnectListenerStatus.Connected ||
      this.currentStatus === ReconnectListenerStatus.Reconnecting
    ) {
      return;
    }

    const sessionId = this.beginSession();
    const signal = this.sessionController!.signal;
    this.setStatus(ReconnectListenerStatus.Connecting);
    this.logger.info(
      { event: 'listener_start', reconnectCount: 0, maxRetries: this.reconnectConfig.maxRetries },
      'Starting listener',
    );

    let startPromise: Promise<void>;
    startPromise = this.connectWithFreshCookie(this.reconnectConfig, sessionId, signal)
      .catch((error: unknown) => {
        if (isAbortError(error) || !this.isCurrentSession(sessionId)) return;
        this.setStatus(ReconnectListenerStatus.Failed);
        this.recordError(error);
        this.logger.error(
          { err: error, event: 'listener_start_failed' },
          'Failed to start listener',
        );
        throw error;
      })
      .finally(() => {
        if (this.isCurrentSession(sessionId)) this.scheduleLoginCheck(sessionId);
        if (this.startPromise === startPromise) this.startPromise = null;
      });
    this.startPromise = startPromise;
    return startPromise;
  }

  /** 停止监听，并取消正在等待的重连和登录检测。 */
  stop() {
    if (this.currentStatus !== ReconnectListenerStatus.Stopped) {
      this.logger.info({ event: 'listener_stop' }, 'Stopping listener');
    }

    this.sessionId++;
    this.sessionController?.abort();
    this.sessionController = null;
    this.clearTimers();
    this.detachAndCloseCurrentWebSocket();
    this.reconnectPromise = null;
    this.startPromise = null;
    this.retryCount = 0;
    this.setStatus(ReconnectListenerStatus.Stopped);
  }

  async restart() {
    if (this.disposed) throw new Error('Cannot restart a disposed listener.');
    this.logger.info({ event: 'listener_restart' }, 'Restarting listener');
    this.stop();
    await this.start();
  }

  /** 永久停止实例并从全局状态注册表移除。 */
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    unregisterListenerState(this.instanceId);
  }

  /** 事件监听；返回的函数可用于取消订阅。 */
  on<K extends keyof ListenerEvents>(event: K, callback: (...args: ListenerEvents[K]) => void) {
    const listener = callback as (...args: any[]) => void;
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  private beginSession() {
    this.sessionController?.abort();
    this.clearTimers();
    this.detachAndCloseCurrentWebSocket();
    this.retryCount = 0;
    this.sessionController = new AbortController();
    return ++this.sessionId;
  }

  private bindWebSocket(ws: ListenerWebSocket, sessionId: number) {
    if (!this.isCurrentSession(sessionId)) {
      ws.close();
      return;
    }

    this.ws = ws;
    this.setStatus(ReconnectListenerStatus.Connected);
    this.logger.info(
      {
        event: 'connection_established',
        uid: this.uid,
        reconnectCount: this.retryCount,
        maxRetries: this.reconnectConfig.maxRetries,
      },
      'Connected',
    );

    let terminated = false;
    const terminate = (reason: 'close' | 'error', error?: unknown) => {
      if (terminated || !this.isCurrentSession(sessionId) || this.ws !== ws) return;
      terminated = true;
      this.ws = null;
      this.clearHealthCheckTimer();
      this.clearHeartbeatTimer();

      if (reason === 'error') {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.recordError(normalizedError);
        this.emitError(normalizedError);
        this.logger.error({ err: normalizedError, event: 'connection_error' }, 'Connection error');
        this.closeWebSocket(ws);
      } else {
        this.emitter.emit('close');
        this.logger.warn({ event: 'connection_closed' }, 'Connection closed');
      }

      void this.scheduleReconnect(
        reason === 'error' ? 'Connection error' : 'Connection closed',
        sessionId,
      );
    };

    ws.addListener('msg', (msg) => {
      if (!terminated && this.isCurrentSession(sessionId) && this.ws === ws) this.handleMsg(msg);
    });
    ws.addListener('close', () => terminate('close'));
    ws.addListener('error', (error) => terminate('error', error));

    this.healthCheckTimer = setTimeout(() => {
      if (this.isCurrentSession(sessionId) && this.ws === ws) {
        this.retryCount = 0;
        this.syncState();
      }
    }, this.reconnectConfig.healthyAfter);
    this.healthCheckTimer.unref?.();
    this.scheduleLoginCheck(sessionId);
    this.scheduleHeartbeat(
      sessionId,
      ws,
      this.heartbeatConfig !== false && this.heartbeatConfig.immediate === true,
    );
  }

  private async connectWithFreshCookie(
    config: ConnectOnceConfig,
    sessionId: number,
    signal: AbortSignal,
  ) {
    if (config.delayBeforeFirstAttempt) {
      const resolvedConfig = resolveReconnectConfig(config);
      await wait(calculateBackoffDelay(config.retryOffset ?? 0, resolvedConfig), signal);
    }

    if (!this.isCurrentSession(sessionId)) return;
    await this.refreshCookie(true);
    if (!this.isCurrentSession(sessionId)) return;
    await this.connectOnce(config, sessionId, signal);
  }

  private async connectOnce(config: ConnectOnceConfig, sessionId: number, signal: AbortSignal) {
    const cookie = this.cookieProvider.value;
    const loginPromise =
      this.loginCheckConfig === false
        ? Promise.resolve(this.currentLoginState)
        : this.performLoginCheckWithCookie(cookie);
    const [loginState, { randomServer, token }] = await Promise.all([
      loginPromise,
      this.dependencies.fetchDanmuInfo(this.roomId, cookie),
    ]);

    if (!this.isCurrentSession(sessionId)) return;
    this.uid = loginState.status === LoginStatus.LoggedIn ? loginState.uid : 0;

    await retry(
      async (retryCount) => {
        if (!this.isCurrentSession(sessionId)) return;
        config.onAttempt?.(retryCount);
        this.logger.info(
          {
            event: 'connection_attempt',
            retryLabel: this.getRetryLogLabel(retryCount, config),
          },
          'Connecting',
        );
        const ws = this.dependencies.createWebSocket(this.roomId, {
          host: randomServer?.host,
          port: randomServer?.port,
          key: token,
          uid: this.uid,
          buvid: this.cookieProvider.buvid,
        });
        this.bindWebSocket(ws, sessionId);
      },
      {
        ...config,
        signal,
        delayBeforeFirstAttempt: false,
        onError: (error, retryCount) => {
          if (isAbortError(error)) return;
          this.logger.warn(
            {
              err: error,
              event: 'connection_attempt_failed',
              retryLabel: this.getRetryLogLabel(retryCount, config),
            },
            'Connect failed',
          );
          config.onError?.(error, retryCount);
        },
      },
    );
  }

  private async performLoginCheck(forceRefreshCookie: boolean): Promise<LoginState> {
    const cookie = await this.refreshCookie(forceRefreshCookie);
    return this.performLoginCheckWithCookie(cookie);
  }

  private async performLoginCheckWithCookie(cookie: string): Promise<LoginState> {
    let nav: Awaited<ReturnType<ListenerDependencies['fetchNavInfo']>>;
    try {
      nav = await this.dependencies.fetchNavInfo(cookie);
    } catch (error) {
      this.updateLoginState({ status: LoginStatus.Error, uid: 0, checkedAt: Date.now(), error });
      throw error;
    }

    const isLoggedIn = nav.isLogin ?? nav.mid > 0;
    return this.updateLoginState({
      status: isLoggedIn ? LoginStatus.LoggedIn : LoginStatus.LoggedOut,
      uid: isLoggedIn ? nav.mid : 0,
      checkedAt: Date.now(),
    });
  }

  private updateLoginState(state: LoginState): LoginState {
    const previousState = this.currentLoginState;
    this.currentLoginState = state;
    this.uid = state.status === LoginStatus.LoggedIn ? state.uid : 0;

    const changed = previousState.status !== state.status || previousState.uid !== state.uid;
    if (changed) {
      this.emitter.emit('loginStatusChange', state, previousState);
      this.callSafely(
        this.loginCheckConfig && this.loginCheckConfig.onStatusChange,
        state,
        previousState,
      );
    }

    if (state.status === LoginStatus.LoggedOut && this.loginInvalidAt === null) {
      const invalidAt = state.checkedAt ?? Date.now();
      this.loginInvalidAt ??= invalidAt;
      const incident: LoginIncident = { invalidAt: this.loginInvalidAt };
      this.emitter.emit('loginInvalid', state, previousState, incident);
      this.callSafely(
        this.loginCheckConfig && this.loginCheckConfig.onInvalid,
        state,
        previousState,
        incident,
      );
      this.logger.warn(
        {
          event: 'login_invalid',
          invalidAt: this.loginInvalidAt,
          invalidAtIso: new Date(this.loginInvalidAt).toISOString(),
        },
        'Login is invalid or expired',
      );
    }

    if (state.status === LoginStatus.LoggedIn && this.loginInvalidAt !== null) {
      const restoredAt = state.checkedAt ?? Date.now();
      const incident: Required<LoginIncident> = {
        invalidAt: this.loginInvalidAt,
        restoredAt,
        durationMs: Math.max(0, restoredAt - this.loginInvalidAt),
      };
      this.loginInvalidAt = null;
      this.emitter.emit('loginRestored', state, previousState, incident);
      this.callSafely(
        this.loginCheckConfig && this.loginCheckConfig.onRestored,
        state,
        previousState,
        incident,
      );
      this.logger.info(
        {
          event: 'login_restored',
          invalidAt: incident.invalidAt,
          restoredAt: incident.restoredAt,
          durationMs: incident.durationMs,
        },
        'Login restored',
      );
      this.reconnectAfterLoginRestore();
    }

    this.syncState();

    return state;
  }

  private callSafely(
    callback: unknown,
    state: LoginState,
    previousState: LoginState,
    incident?: LoginIncident | Required<LoginIncident>,
  ) {
    if (typeof callback !== 'function') return;
    try {
      const resolvedCallback = callback as (...args: unknown[]) => void;
      resolvedCallback(state, previousState, incident);
    } catch (error) {
      this.logger.error({ err: error, event: 'login_callback_failed' }, 'Login callback failed');
    }
  }

  private reconnectAfterLoginRestore() {
    if (this.loginCheckConfig === false || this.loginCheckConfig.autoReconnect === false) return;
    if (
      this.currentStatus !== ReconnectListenerStatus.Connected &&
      this.currentStatus !== ReconnectListenerStatus.Failed
    ) {
      return;
    }

    this.logger.info(
      { event: 'login_recovery_reconnect' },
      'Restarting connection after login recovery',
    );
    void this.restart().catch((error: unknown) => {
      this.logger.error(
        { err: error, event: 'login_recovery_reconnect_failed' },
        'Login recovery reconnect failed',
      );
    });
  }

  private scheduleHeartbeat(sessionId: number, ws: ListenerWebSocket, immediate = false) {
    this.clearHeartbeatTimer();
    if (this.heartbeatConfig === false) return;

    const interval = this.heartbeatConfig.interval ?? DEFAULT_HEARTBEAT_INTERVAL;
    if (interval <= 0) return;

    this.heartbeatTimer = setTimeout(
      () => {
        if (!this.isCurrentSession(sessionId) || this.ws !== ws) return;
        void this.sendHeartbeat().finally(() => {
          if (this.isCurrentSession(sessionId) && this.ws === ws) {
            this.scheduleHeartbeat(sessionId, ws);
          }
        });
      },
      immediate ? 0 : interval,
    );
    this.heartbeatTimer.unref?.();
  }

  private callHeartbeatCallback(result: DanmuHeartbeatResult) {
    if (this.heartbeatConfig === false || !this.heartbeatConfig.onResult) return;
    try {
      this.heartbeatConfig.onResult(result);
    } catch (error) {
      this.logger.error(
        { err: error, event: 'heartbeat_callback_failed' },
        'Heartbeat callback failed',
      );
    }
  }

  private scheduleLoginCheck(sessionId: number) {
    this.clearLoginCheckTimer();
    if (this.loginCheckConfig === false) return;

    const interval = this.loginCheckConfig.interval ?? DEFAULT_LOGIN_CHECK_INTERVAL;
    if (interval === false || interval <= 0) return;

    this.loginCheckTimer = setTimeout(() => {
      if (!this.isCurrentSession(sessionId)) return;
      void this.checkLoginStatus(true)
        .catch((error: unknown) => {
          this.logger.warn(
            { err: error, event: 'login_check_failed' },
            'Login status check failed',
          );
        })
        .finally(() => {
          if (this.isCurrentSession(sessionId)) this.scheduleLoginCheck(sessionId);
        });
    }, interval);
    this.loginCheckTimer.unref?.();
  }

  private getRetryLogLabel(retryCount: number, config: ConnectOnceConfig) {
    const reconnectCount = retryCount + (config.retryOffset ?? 0);
    const maxReconnects = config.retryTotal ?? config.maxRetries ?? 0;
    return `attempt ${reconnectCount + 1}/${maxReconnects + 1}, reconnect ${reconnectCount}/${maxReconnects}`;
  }

  private handleMsg(msg: any) {
    const cmd = msg?.cmd as Cmd | undefined;
    if (!cmd) return;

    if (!Object.values(Cmd).includes(cmd)) {
      this.emitter.emit(ParserEventStatus.Unknown, msg);
      return;
    }

    const parserEntry = BliveListener.parsers.find((item) => item.cmd === cmd);
    if (!parserEntry) {
      this.emitter.emit(ParserEventStatus.Unimplemented, cmd, msg);
      return;
    }

    try {
      const parsed = parserEntry.parser(cmd, msg, this.roomId, this.uid);
      if (parsed) this.emitter.emit('event', parsed);
    } catch (error) {
      this.logger.error({ err: error, event: 'parse_failed', cmd }, 'Event parsing failed');
      this.emitter.emit(ParserEventStatus.ParsingFailed, cmd, msg, error);
    }
  }

  private async scheduleReconnect(reason: string, sessionId: number) {
    if (!this.isCurrentSession(sessionId)) return;

    if (this.reconnectPromise) {
      await this.reconnectPromise;
      if (
        this.isCurrentSession(sessionId) &&
        !this.ws &&
        this.currentStatus === ReconnectListenerStatus.Connected
      ) {
        await this.scheduleReconnect(reason, sessionId);
      }
      return;
    }

    let reconnectPromise: Promise<void>;
    reconnectPromise = this.reconnect(reason, sessionId).finally(() => {
      if (this.reconnectPromise === reconnectPromise) this.reconnectPromise = null;
    });
    this.reconnectPromise = reconnectPromise;
    await reconnectPromise;
  }

  private async reconnect(reason: string, sessionId: number) {
    if (!this.isCurrentSession(sessionId)) return;
    this.setStatus(ReconnectListenerStatus.Reconnecting);

    if (this.retryCount >= this.reconnectConfig.maxRetries) {
      this.setStatus(ReconnectListenerStatus.Failed);
      this.logger.error(
        { event: 'reconnect_exhausted', reason, maxRetries: this.reconnectConfig.maxRetries },
        'Exceeded maximum reconnect retries',
      );
      return;
    }

    this.clearHealthCheckTimer();
    const initialRetryCount = this.retryCount;
    const remainingRetries = this.reconnectConfig.maxRetries - initialRetryCount - 1;
    this.logger.warn(
      {
        event: 'reconnecting',
        reason,
        reconnectCount: initialRetryCount + 1,
        maxRetries: this.reconnectConfig.maxRetries,
      },
      'Reconnecting',
    );

    try {
      await this.connectWithFreshCookie(
        {
          ...this.reconnectConfig,
          maxRetries: remainingRetries,
          delayBeforeFirstAttempt: true,
          retryOffset: initialRetryCount,
          retryTotal: this.reconnectConfig.maxRetries,
          onAttempt: (retryCount) => {
            this.retryCount = initialRetryCount + retryCount + 1;
            this.syncState();
          },
        },
        sessionId,
        this.sessionController!.signal,
      );
    } catch (error) {
      if (isAbortError(error) || !this.isCurrentSession(sessionId)) return;
      this.setStatus(ReconnectListenerStatus.Failed);
      this.recordError(error);
      this.logger.error(
        {
          err: error,
          event: 'reconnect_exhausted',
          reason,
          maxRetries: this.reconnectConfig.maxRetries,
        },
        'Exceeded maximum reconnect retries',
      );
    }
  }

  private setStatus(status: ReconnectListenerStatus) {
    if (status === this.currentStatus) return;
    const previousStatus = this.currentStatus;
    this.currentStatus = status;
    const now = Date.now();
    const patch: Partial<ListenerStateSnapshot> = { lastStatusChangedAt: now };
    if (status === ReconnectListenerStatus.Connected) {
      patch.connectedAt = now;
      patch.lastError = null;
    }
    if (status === ReconnectListenerStatus.Stopped) patch.stoppedAt = now;
    this.syncState(patch);
    this.emitter.emit('statusChange', status, previousStatus);
  }

  private syncState(
    patch: Partial<
      Omit<ListenerStateSnapshot, 'instanceId' | 'roomId' | 'createdAt' | 'updatedAt'>
    > = {},
  ) {
    updateListenerState(this.instanceId, {
      status: this.currentStatus,
      loginState: this.currentLoginState,
      loginInvalidSince: this.loginInvalidAt,
      retryCount: this.retryCount,
      ...patch,
    });
  }

  private recordError(error: unknown) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const snapshot: ListenerErrorSnapshot = {
      name: normalizedError.name,
      message: normalizedError.message,
      at: Date.now(),
    };
    this.syncState({ lastError: snapshot });
  }

  private emitError(error: Error) {
    // Node EventEmitter 会在没有 error 监听器时抛出异常；库内部错误不应因此导致进程退出。
    if (this.emitter.listenerCount('error') > 0) this.emitter.emit('error', error);
  }

  private isCurrentSession(sessionId: number) {
    return this.sessionId === sessionId && !this.sessionController?.signal.aborted;
  }

  private clearHealthCheckTimer() {
    if (this.healthCheckTimer) clearTimeout(this.healthCheckTimer);
    this.healthCheckTimer = null;
  }

  private clearLoginCheckTimer() {
    if (this.loginCheckTimer) clearTimeout(this.loginCheckTimer);
    this.loginCheckTimer = null;
  }

  private clearHeartbeatTimer() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearTimers() {
    this.clearHealthCheckTimer();
    this.clearLoginCheckTimer();
    this.clearHeartbeatTimer();
  }

  private detachAndCloseCurrentWebSocket() {
    const ws = this.ws;
    this.ws = null;
    if (ws) this.closeWebSocket(ws);
  }

  private closeWebSocket(ws: ListenerWebSocket) {
    try {
      ws.close();
    } catch (error) {
      this.logger.debug(
        { err: error, event: 'stale_connection_close_failed' },
        'Failed to close stale connection',
      );
    }
  }
}

export function createListener(config: ListenerConfig) {
  return new BliveListener(config);
}
