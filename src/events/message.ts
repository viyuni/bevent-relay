import type { FansMedal, GuardType, ViyuniEventType, Cmd } from './common.ts';

export interface EmoticonMessage {
  bulgeDisplay: number;
  emoticonUnique: string;
  height: number;
  inPlayerArea: number;
  isDynamic: number;
  url: string;
  width: number;
}

export interface InMessageEmoticon {
  url: string;
  width: number;
  height: number;
}

export interface InMessageEmoticonList {
  [key: string]: InMessageEmoticon;
}

/**
 * `DANMU_MSG` 事件中 @ 用户回复的 type
 */
export interface Reply {
  uid: number;
  uname: string;
}

export interface Message {
  cmd: typeof Cmd.DANMU_MSG;

  type: typeof ViyuniEventType.Message;

  /** 消息id */
  id: string;

  /** 发送时间，毫秒 */
  timestamp: number;

  /** 用户uid */
  uid: number;

  /** 用户名 */
  uname: string;

  /** 用户头像 */
  face: string;

  /** 弹幕内容 */
  content: string;

  /** 大航海类型 */
  guardType: GuardType;

  /** 是否是大航海 */
  isGuard: boolean;

  /** 勋章信息 */
  medal: FansMedal | null;

  /** 表情包信息 */
  emoticon?: EmoticonMessage;

  /** 直播间 ID */
  roomId: number;

  /** 用户名颜色 */
  nameColor: string;

  /**
   * currentRank
   * 0: 未上榜
   * 1: 榜1
   * 3: 榜2
   * 2: 榜3
   */
  currentRank: number;

  /** 荣耀等级 */
  wealthMedalLvl: number;

  /** 弹幕类型（节奏风暴、红包、天选） */
  sendType: number;

  /** 从哪个用户监听到的 */
  eventListenerUid: number;

  /**
   * phoneVerified
    0: not verified
    1: verified
   */
  phoneVerified: number;

  /**
   * 在消息中的表情包
   */
  inMessageEmoticon?: InMessageEmoticonList;

  reply?: Partial<Reply>;

  read: boolean;
}
