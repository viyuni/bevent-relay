import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Live starts
 *
 * 开播事件
 */
export interface LiveStart {
  type: typeof ViyuniEventType.LiveStart;
  cmd: typeof Cmd.LIVE;
  id: string;
  roomId: number;
  /**
   * 开播时，开播事件必会触发两次，通常情况下，第一次带 `live_time` 以及额外的 `special_types` 字段，第二次触发的则不带这两个字段
   *
   * 此额外字段用来判断是否为初始化的开播事件
   */
  initial?: boolean;
  specialTypes?: number[];
  timestamp: number;
  eventListenerUid: number;
}
