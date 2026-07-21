import type { Cmd, ViyuniEvent } from '../../events/index.ts';
import type { SendDanmuOptions } from '../bili-api';

/** B站事件处理状态 */
export const ParserEventStatus = {
  /** 未知的命令 */
  Unknown: 'unknown',
  /** 未实现的命令 */
  Unimplemented: 'unimplemented',
  /** 解析失败的命令 */
  ParsingFailed: 'parsingFailed',
} as const;

/** B站事件处理状态类型 */
export type ParserEventStatus = (typeof ParserEventStatus)[keyof typeof ParserEventStatus];

export const ReconnectListenerStatus = {
  Idle: 'idle',
  Connecting: 'connecting',
  Connected: 'connected',
  Reconnecting: 'reconnecting',
  Failed: 'failed',
  Stopped: 'stopped',
} as const;

export type ReconnectListenerStatus =
  (typeof ReconnectListenerStatus)[keyof typeof ReconnectListenerStatus];

export interface ReconnectConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  healthyAfter?: number;
}

/** 当前登录状态。`error` 表示检测失败，不等同于登录失效。 */
export const LoginStatus = {
  Unknown: 'unknown',
  LoggedIn: 'loggedIn',
  LoggedOut: 'loggedOut',
  Error: 'error',
} as const;

export type LoginStatus = (typeof LoginStatus)[keyof typeof LoginStatus];

export interface LoginState {
  status: LoginStatus;
  uid: number;
  checkedAt: number | null;
  error?: unknown;
}

export interface LoginIncident {
  /** 首次检测到登录失效的 Unix 毫秒时间戳。 */
  invalidAt: number;
  /** 检测到登录恢复的 Unix 毫秒时间戳；失效事件中不存在。 */
  restoredAt?: number;
  /** 从失效到恢复的持续时间（毫秒）；失效事件中不存在。 */
  durationMs?: number;
}

export interface LoginCheckConfig {
  /** 自动检测间隔（毫秒）。设为 `false` 或 `0` 可关闭定时检测。默认 10 分钟。 */
  interval?: number | false;
  /** 登录状态发生变化时调用。 */
  onStatusChange?: (state: LoginState, previousState: LoginState) => void;
  /** 检测到未登录时调用；连续未登录只调用一次。 */
  onInvalid?: (state: LoginState, previousState: LoginState, incident: LoginIncident) => void;
  /** 登录从失效状态恢复时调用，包含失效、恢复时间及持续时长。 */
  onRestored?: (
    state: LoginState,
    previousState: LoginState,
    incident: Required<LoginIncident>,
  ) => void;
  /** 登录恢复后自动重启连接。默认开启。 */
  autoReconnect?: boolean;
}

export interface DanmuHeartbeatResult {
  id: string;
  message: string;
  success: boolean;
  /** 请求开始的 Unix 毫秒时间戳。 */
  startedAt: number;
  /** 请求完成的 Unix 毫秒时间戳。 */
  completedAt: number;
  durationMs: number;
  response?: Record<string, unknown>;
  error?: unknown;
}

export interface DanmuHeartbeatConfig {
  /** 两次探针之间的间隔（毫秒）。默认 1 小时。 */
  interval?: number;
  /** 建立连接后是否立即发送一次；默认 false。 */
  immediate?: boolean;
  /** 消息前缀。默认 `故嘎嘎嘎`。 */
  messagePrefix?: string;
  /** 发送弹幕时使用的额外参数。 */
  sendOptions?: SendDanmuOptions;
  /** 每次探针完成后调用，无论成功或失败。 */
  onResult?: (result: DanmuHeartbeatResult) => void;
}

export interface ListenerErrorSnapshot {
  name: string;
  message: string;
  at: number;
}

/** 可供健康检查、监控接口或进程内其他模块读取的 Listener 状态快照。 */
export interface ListenerStateSnapshot {
  instanceId: string;
  roomId: number;
  status: ReconnectListenerStatus;
  loginState: LoginState;
  loginInvalidSince: number | null;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
  lastStatusChangedAt: number;
  connectedAt: number | null;
  stoppedAt: number | null;
  lastHeartbeat: DanmuHeartbeatResult | null;
  lastError: ListenerErrorSnapshot | null;
}

export interface CookieSyncConfig {
  url: string;
  password: string;
}

export interface ListenerConfig {
  roomId: number;
  cookie?: string;
  cookieSync?: CookieSyncConfig;
  reconnect?: ReconnectConfig | false;
  /** 设为 `false` 可关闭自动登录检测；仍可手动调用 `checkLoginStatus()`。 */
  loginCheck?: LoginCheckConfig | false;
  /** 开启定时弹幕探针；未配置或设为 false 时不会自动发送弹幕。 */
  heartbeat?: DanmuHeartbeatConfig | false;
}

export type ListenerEvents = {
  event: [event: ViyuniEvent];
  close: [];
  error: [error: Error];
  statusChange: [status: ReconnectListenerStatus, previousStatus: ReconnectListenerStatus];
  loginStatusChange: [state: LoginState, previousState: LoginState];
  loginInvalid: [state: LoginState, previousState: LoginState, incident: LoginIncident];
  loginRestored: [state: LoginState, previousState: LoginState, incident: Required<LoginIncident>];
  heartbeat: [result: DanmuHeartbeatResult];
  [ParserEventStatus.Unknown]: [event: Record<string, unknown> | unknown[]];
  [ParserEventStatus.Unimplemented]: [cmd: Cmd, raw: Record<string, unknown>];
  [ParserEventStatus.ParsingFailed]: [cmd: Cmd, raw: Record<string, unknown>, error: unknown];
};
