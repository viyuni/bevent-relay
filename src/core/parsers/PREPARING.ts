import type { LiveEnd } from '../../events/index.ts';
import { Cmd, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const PREPARING_PARSER = defineEventParser({
  cmd: Cmd.PREPARING,
  parser(cmd: typeof Cmd.PREPARING, _data: PREPARING, roomId, eventListenerUid): LiveEnd {
    const timestamp = Date.now();

    return {
      id: `${cmd}:${roomId}:${timestamp}`,
      type: ViyuniEventType.LiveEnd,
      cmd,
      roomId,
      timestamp,
      eventListenerUid,
    } satisfies LiveEnd;
  },
});

export interface PREPARING {
  cmd: typeof Cmd.PREPARING;
  roomid?: number;
}
