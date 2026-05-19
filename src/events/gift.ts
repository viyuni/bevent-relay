import type { FansMedal, GuardType } from './common.ts';
import { Cmd, ViyuniEventType } from './common.ts';

export interface Gift {
  cmd: typeof Cmd.SEND_GIFT;
  type: typeof ViyuniEventType.Gift;
  id: string;
  uid: number;
  uname: string;
  /**
   * 礼物会返回头像，直接使用以节约流量
   */
  face: string;
  /**
   * 包含了折扣（大航海折扣）后的礼物总价（单价 * 数量）
   */
  price: number;
  /**
   * 实际货币单位的价格
   */
  priceNormalized: number;
  duration: number;
  /**
   * 'gold': 金瓜子，现金购买
   * 'silver': 银瓜子，兑换的礼物
   */
  coinType: 'gold' | 'silver' | (string & {});
  /**
   * 0: 白字
   * 1: 总督
   * 2: 提督
   * 3: 舰长
   */
  guardType: GuardType;
  /**
   * 未知，先预留
   */
  giftType: number;
  /**
   * 礼物动作名称，投喂，etc.
   */
  giftAction: string;
  giftAmount: number;
  giftId: number;
  giftName: string;
  effectId: number; // 没的时候为0
  comboTotalCoin: number;
  /**
   * 被投喂礼物在当前用户包裹中剩余多少
   * 0 可能代表非包裹礼物（需购买礼物）
   */
  giftRemain: number;
  /**
   * Mar 26, 2025 之后加的，为了兼容之前的数据可能为空
   */
  giftIcon: string;
  /**
   * 当前礼物所处的事务源
   * - 'Live' - 普通直播
   * - 'voice_chat_room' - 语音连麦，多人连麦时会影响 `receiver`，即 `receive_user_info`
   */
  bizSource: 'Live' | 'voice_chat_room' | (string & {});
  /**
   * 当前礼物的接收方，多人连麦时会与当前主播不同，可从 `bizSource` 进行判断
   */
  receiver: {
    uid: number;
    uname: string;
    master?: {
      uid: number;
      uname: string;
      roomId: number;
    } | null;
  };
  blindGift?: BlindGift | null;
  timestamp: number;
  timestampNormalized: number;
  medal: FansMedal | null;
  wealthMedalLevel: number;
  // 收到礼物的直播间
  roomId: number;
  // 监听服务的UID
  eventListenerUid: number;
  read: boolean;
}

/** 盲盒礼物 of `SEND_GIFT` */
export interface BlindGift {
  blindGiftConfigId: number;
  /** 通常为 `0` */
  from: number;
  /** `"爆出"` */
  giftAction: string;
  /** 爆奖的虚拟价格，单位金瓜子。此处为单价，即如果爆出了两个相同的礼物，此处也会显示一个的价格 */
  giftTipPrice: number;
  originalGiftId: number;
  /** 盲盒名称 */
  originalGiftName: string;
  /** 盲盒本身价格，单价。单位金瓜子 */
  originalGiftPrice: number;
}
