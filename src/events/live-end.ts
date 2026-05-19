import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Live ends
 *
 * 直播间准备事件，触发此事件时通常代表主播已下播
 */
export interface LiveEnd {
  type: typeof ViyuniEventType.LiveEnd;
  cmd: typeof Cmd.PREPARING;
  id: string;
  roomId: number;
  timestamp: number;
  eventListenerUid: number;
}
