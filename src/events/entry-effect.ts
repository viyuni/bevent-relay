import type { FansMedal, GuardType } from './common.ts';
import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Entry effect
 *
 * 进场特效
 */
export interface EntryEffect {
  type: typeof ViyuniEventType.EntryEffect;
  cmd: typeof Cmd.ENTRY_EFFECT;
  id: string;
  roomId: number;
  uid: number;
  uname: string;
  face: string;
  message: string;
  effectId: number;
  textColor: string;
  nameColor: string;
  /**
   * 持续时间，秒
   */
  duration: number;
  background: string;
  /**
   * 动态背景，如果不存在则为空字符串 `""`
   */
  backgroundAnimated: string;
  /**
   * 用于区分不同事务的样式
   */
  business: number;
  /**
   * 舰长状态：该用户在当前直播间的舰长状态
   *
   * 0: 白字
   * 1: 总督
   * 2: 提督
   * 3: 舰长
   */
  guardType: GuardType;
  wealthMedalLevel: number;
  showAvatar: number;
  /**
   * 此处决定是否显示荣耀等级
   */
  showWealthMedal: boolean;
  /** 用户当前佩戴的粉丝勋章/粉丝勋章 */
  medal: FansMedal | null;
  timestamp: number;
  eventListenerUid: number;
}
