import { ViyuniEventType } from './common.ts';

/** 订阅请求 */
export interface SubscribeRequest {
  type: 'subscribe';
  roomId?: number;
  events: ViyuniEventType[];
}

/** 取消订阅请求 */
export interface UnsubscribeRequest {
  type: 'unsubscribe';
  roomId?: number;
  events?: string[];
}

/** 心跳请求 */
export interface PingRequest {
  type: 'ping';
}

/** 客户端请求事件（与服务端推送事件 ServerPushEvent 对应） */
export type ClientRequestEvent = SubscribeRequest | UnsubscribeRequest | PingRequest;
