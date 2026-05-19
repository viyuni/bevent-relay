import type { FansMedal, GuardType } from './common.ts';
import { Cmd, ViyuniEventType } from './common.ts';

export interface SuperChat {
  cmd: typeof Cmd.SUPER_CHAT_MESSAGE;

  type: typeof ViyuniEventType.SuperChat;
  /**
   * 在极端情况下，例如直播间开启了全员 SC 审核，那么会导致 id 重复，因此需要从 `data.id`
   * 中获取唯一识别符，在开放平台中为 `data.message_id
   * from `Laplace.live`
   */
  id: string;
  uid: number;
  uname: string;
  face: string;
  faceFrame: string;
  message: string;
  /** Message color in HEX format */
  messageColor: string;
  /**
   * SC 翻译正文
   */
  messageTrans: string;
  /**
   * 是否开启翻译
   *
   * - 0: 未开启翻译
   * - 1: 已开启翻译
   */
  transMark: number;
  /**
   * 是否是被审核过的 SC
   *
   * - 0: 无审核
   * - 1: 已审核
   */
  isAudited: number;
  price: number;
  /**
   * 实际货币单位的价格
   */
  priceNormalized: number;
  /**
   * 举报 SC 时会用到
   */
  token: string;

  /** SC 持续时间，单位秒 */
  duration: number;
  timestamp: number;
  timestampNormalized: number;
  /**
   * 0: 白字
   * 1: 总督
   * 2: 提督
   * 3: 舰长
   */
  guardType: GuardType;
  guardBackground: string;
  scId: number;
  scAmount: number;
  giftName: string;
  medal: FansMedal | null;
  read: boolean;
  /**
   * 该 SC 是否被删除，由 `SUPER_CHAT_MESSAGE_DELETE` 事件触发
   */
  deleted: boolean;

  // 监听服务的UID
  eventListenerUid: number;

  roomId: number;
}
