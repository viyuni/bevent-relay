import { Cmd, ViyuniEventType } from './common.ts';

export interface SuperChatDelete {
  cmd: typeof Cmd.SUPER_CHAT_MESSAGE_DELETE;
  type: typeof ViyuniEventType.SuperChatDelete;
  id: string;
  /**
   * 被删除的 SC ID，对应 `SuperChat` 中的 `scId`（`gift_id`）
   */
  scIds: number[];
  timestamp: number;
  timestampNormalized: number;
  read: boolean;
  // 监听服务的UID
  eventListenerUid: number;
  /** 直播间 ID */
  roomId: number;
}
