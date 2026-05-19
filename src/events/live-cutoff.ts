import { Cmd, ViyuniEventType } from './common.ts';

/**
 * Live cutoff
 *
 * 直播间被切断
 */
export interface LiveCutoff {
  type: typeof ViyuniEventType.LiveCutoff;
  cmd: typeof Cmd.CUT_OFF;
  id: string;
  roomId: number;
  /**
   * 被切断的理由
   */
  message: string;
  timestamp: number;
  eventListenerUid: number;
}
