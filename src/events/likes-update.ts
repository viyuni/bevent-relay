import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Likes update
 *
 * 点赞人数变更，总的点赞更新
 */
export interface LikesUpdate {
  type: typeof ViyuniEventType.LikesUpdate;
  cmd: typeof Cmd.LIKE_INFO_V3_UPDATE;
  id: string;
  roomId: number;
  /**
   * 当前点赞总数
   */
  likes: number;
  timestamp: number;
  eventListenerUid: number;
}
