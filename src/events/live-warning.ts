import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Live warning when live content is not allowed
 *
 * 直播间被警告
 */
export interface LiveWarning {
  type: typeof ViyuniEventType.LiveWarning;
  cmd: typeof Cmd.WARNING;
  id: string;
  roomId: number;
  /**
   * 被警告的理由
   */
  message: string;
  timestamp: number;
  eventListenerUid: number;
}
