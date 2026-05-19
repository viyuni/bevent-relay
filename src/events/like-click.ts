import type { FansMedal, GuardType } from './common.ts';
import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Like click
 *
 * 点赞主播事件
 */
export interface LikeClick {
  type: typeof ViyuniEventType.LikeClick;
  cmd: typeof Cmd.LIKE_INFO_V3_CLICK;
  id: string;
  roomId: number;
  uid: number;
  uname: string;
  /**
   * 文案：为主播点赞了
   */
  message: string;
  count?: number;
  /** 用户当前佩戴的粉丝勋章/粉丝勋章 */
  medal: FansMedal | null;
  /**
   * 当前直播间的大航海状态
   */
  guardType: GuardType;
  timestamp: number;
  eventListenerUid: number;
}
