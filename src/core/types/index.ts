import type { Cmd, ViyuniEvent } from '../../events/index.ts';

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

export interface CookieSyncConfig {
  url: string;
  password: string;
}

export interface ListenerConfig {
  roomId: number;
  cookie?: string;
  cookieSync?: CookieSyncConfig;
  reconnect?: ReconnectConfig | false;
}

export type ListenerEvents = {
  event: [event: ViyuniEvent];
  close: [];
  error: [error: Error];
  [ParserEventStatus.Unknown]: [event: Record<string, unknown> | unknown[]];
  [ParserEventStatus.Unimplemented]: [cmd: Cmd, raw: Record<string, unknown>];
  [ParserEventStatus.ParsingFailed]: [cmd: Cmd, raw: Record<string, unknown>, error: unknown];
};
