import { Cmd, ViyuniEventType } from './common.ts';

export interface Guard {
  cmd: typeof Cmd.USER_TOAST_MSG_V2;
  type: typeof ViyuniEventType.Guard;
  id: string;
  uid: number;
  uname: string;
  /** 官方事件无头像，这个字段是给开放平台用的 */
  face: string;
  /**
   * - `toast_msg`: <%用户昵称%> 续费了舰长，今天是TA陪伴主播的第322天
   * - `toast_msg`: <%用户昵称%>续费了舰长1*8天
   * - `role_name`: 大航海名称，舰长、提督、总督
   */
  message: string;
  /**
   * 大航海价格
   */
  price: number;
  /**
   * 实际货币单位的价格
   */
  priceNormalized: number;
  duration: number;
  color: string;
  /**
   * 0: 白字
   * 1: 总督
   * 2: 提督
   * 3: 舰长
   */
  guardType: number;
  /**
   * 大航海数量，盲盒时该数量依然为 1
   */
  total: number;
  /**
   * 统一用月来计算舰长数量
   */
  totalNormalized: number;

  /** 是否为年舰 */
  isYearGuard: boolean;
  /**
   * 单位，月、年，盲盒时该单位为 `*8天`、`*15天`、etc
   */
  unit: string;
  /**
   * 大航海名称，舰长，etc.
   */
  guardName: string;
  /**
   * 当前主播大航海总数，用于判断是否是千舰、万舰，而从使用特殊主题
   */
  guardTotalCount: number;
  /**
   * 用来触发礼物特效 id
   */
  effectId: number;
  timestamp: number;
  timestampNormalized: number;
  eventListenerUid: number;

  /** 直播间 ID */
  roomId: number;
  read: boolean;
}
