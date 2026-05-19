import { peek } from 'volta-json-ptr';

import type { LiveWarning } from '../../events/index.ts';
import { Cmd, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const WARNING_PARSER = defineEventParser({
  cmd: Cmd.WARNING,
  parser(cmd: typeof Cmd.WARNING, data: WARNING, roomId, eventListenerUid): LiveWarning {
    const timestamp = Date.now();
    const message = peek(data, '/msg') ?? '';

    return {
      id: `${cmd}:${roomId}:${timestamp}`,
      type: ViyuniEventType.LiveWarning,
      cmd,
      roomId,
      message,
      timestamp,
      eventListenerUid,
    } satisfies LiveWarning;
  },
});

export interface WARNING {
  cmd: typeof Cmd.WARNING;
  /**
   * 被警告的理由
   */
  msg: string;
}
