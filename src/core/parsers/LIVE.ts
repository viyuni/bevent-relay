import { peek } from 'volta-json-ptr';

import type { LiveStart } from '../../events/index.ts';
import { Cmd, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const LIVE_PARSER = defineEventParser({
  cmd: Cmd.LIVE,
  parser(cmd: typeof Cmd.LIVE, data: LIVE, roomId, eventListenerUid): LiveStart {
    const liveTime = peek(data, '/live_time') ?? Date.now() / 1000;
    const timestamp = typeof liveTime === 'number' ? liveTime * 1000 : Date.now();
    const isInitial = peek(data, '/live_time') !== undefined;

    return {
      id: `${cmd}:${roomId}:${timestamp}`,
      type: ViyuniEventType.LiveStart,
      cmd,
      roomId,
      timestamp,
      eventListenerUid,
      initial: isInitial,
      specialTypes: peek(data, '/special_types'),
    } satisfies LiveStart;
  },
});

export interface LIVE {
  cmd: typeof Cmd.LIVE;
  /**
   * 开播时间戳，秒
   */
  live_time?: number;
  /**
   * 特殊类型数组
   */
  special_types?: number[];
}
