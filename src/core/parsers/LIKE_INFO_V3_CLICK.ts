import { peek } from 'volta-json-ptr';

import type { LikeClick, FansMedal } from '../../events/index.ts';
import { Cmd, GuardType, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const LIKE_INFO_V3_CLICK_PARSER = defineEventParser({
  cmd: Cmd.LIKE_INFO_V3_CLICK,
  parser(
    cmd: typeof Cmd.LIKE_INFO_V3_CLICK,
    data: LIKE_INFO_V3_CLICK,
    roomId,
    eventListenerUid,
  ): LikeClick {
    const timestamp = Date.now();
    const dataField = peek(data, '/data') || {};
    const uid = peek(dataField, '/uid') ?? 0;
    const uname = peek(dataField, '/uname') ?? '';
    const likeText = peek(dataField, '/like_text') ?? '为主播点赞了';
    const uinfo = peek(dataField, '/uinfo');
    const fansMedal = peek(dataField, '/fans_medal');

    const medal: FansMedal | null = fansMedal
      ? {
          level: peek(fansMedal, '/medal_level') ?? 0,
          name: peek(fansMedal, '/medal_name') ?? '',
          roomId: peek(fansMedal, '/anchor_roomid') ?? 0,
          uid: peek(fansMedal, '/target_id') ?? 0,
          isLighted: peek(fansMedal, '/is_lighted') ?? 0,
          guardType: peek(fansMedal, '/guard_level') ?? 0,
        }
      : null;

    return {
      id: `${cmd}:${roomId}:${uid}:${timestamp}`,
      type: ViyuniEventType.LikeClick,
      cmd,
      roomId,
      uid,
      uname,
      message: likeText,
      medal,
      guardType: peek(uinfo, '/guard/level') ?? GuardType.None,
      timestamp,
      eventListenerUid,
    } satisfies LikeClick;
  },
});

export interface LIKE_INFO_V3_CLICK {
  cmd: typeof Cmd.LIKE_INFO_V3_CLICK;
  data: {
    /**
     * 点赞图标 URL
     */
    like_icon: string;
    /**
     * 点赞文本
     */
    like_text: string;
    uid: number;
    uname: string;
    uinfo: {
      medal: {
        level: number;
        name: string;
        guard_level: GuardType;
        guard_icon: string;
        is_light: number;
      } | null;
      guard: {
        level: GuardType;
      } | null;
    };
    fans_medal: {
      guard_level: GuardType;
      medal_level: number;
      medal_name: string;
      anchor_roomid: number;
      target_id: number;
      is_lighted: number;
    };
  };
}
