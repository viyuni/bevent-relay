import { peek } from 'volta-json-ptr';

import type { LiveCutoff } from '../../events/index.ts';
import { Cmd, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const CUT_OFF_PARSER = defineEventParser({
  cmd: Cmd.CUT_OFF,
  parser(cmd: typeof Cmd.CUT_OFF, data: CUT_OFF, roomId, eventListenerUid): LiveCutoff {
    const timestamp = Date.now();
    const message = peek(data, '/msg') ?? '';

    return {
      id: `${cmd}:${roomId}:${timestamp}`,
      type: ViyuniEventType.LiveCutoff,
      cmd,
      roomId,
      message,
      timestamp,
      eventListenerUid,
    } satisfies LiveCutoff;
  },
});

export interface CUT_OFF {
  cmd: typeof Cmd.CUT_OFF;
  /**
   * 被切断的理由
   */
  msg: string;
}
