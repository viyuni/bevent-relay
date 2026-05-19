import { peek } from 'volta-json-ptr';

import type { LikesUpdate } from '../../events/index.ts';
import { Cmd, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const LIKE_INFO_V3_UPDATE_PARSER = defineEventParser({
  cmd: Cmd.LIKE_INFO_V3_UPDATE,
  parser(
    cmd: typeof Cmd.LIKE_INFO_V3_UPDATE,
    data: LIKE_INFO_V3_UPDATE,
    roomId,
    eventListenerUid,
  ): LikesUpdate {
    const timestamp = Date.now();
    const clickCount = peek(data, '/data/click_count') ?? 0;

    return {
      id: `${cmd}:${roomId}:${timestamp}:${clickCount}`,
      type: ViyuniEventType.LikesUpdate,
      cmd,
      roomId,
      likes: clickCount,
      timestamp,
      eventListenerUid,
    } satisfies LikesUpdate;
  },
});

export interface LIKE_INFO_V3_UPDATE {
  cmd: typeof Cmd.LIKE_INFO_V3_UPDATE;
  data: {
    /**
     * 当前点赞总数
     */
    click_count: number;
    /**
     * 点赞文本
     */
    like_text: string;
  };
}
