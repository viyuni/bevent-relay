import { peek } from 'volta-json-ptr';

import type { EntryEffect, FansMedal, GuardType } from '../../events/index.ts';
import { Cmd, ViyuniEventType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const ENTRY_EFFECT_PARSER = defineEventParser({
  cmd: Cmd.ENTRY_EFFECT,
  parser(cmd: typeof Cmd.ENTRY_EFFECT, data: ENTRY_EFFECT, roomId, eventListenerUid): EntryEffect {
    const dataField = peek(data, '/data') || {};
    const uid = peek(dataField, '/uid') ?? 0;
    const triggerTime = peek(dataField, '/trigger_time') ?? Date.now() * 1000000;
    const timestamp =
      typeof triggerTime === 'number' ? Math.floor(triggerTime / 1000000) : Date.now();
    const face = peek(dataField, '/face') ?? '';
    const copyWriting = peek(dataField, '/copy_writing_v2') ?? '';
    const copyColor = peek(dataField, '/copy_color') ?? '';
    const highlightColor = peek(dataField, '/highlight_color') ?? '';
    const effectiveTime = peek(dataField, '/effective_time') ?? 0;
    const privilegeType = peek(dataField, '/privilege_type') ?? 0;
    const wealthyInfo = peek(dataField, '/wealthy_info');
    const uinfo = peek(dataField, '/uinfo');

    const medal: FansMedal | null = uinfo?.medal
      ? {
          level: peek(uinfo, '/medal/level') ?? 0,
          name: peek(uinfo, '/medal/name') ?? '',
          roomId: 0,
          uid: peek(uinfo, '/medal/ruid') ?? 0,
          isLighted: peek(uinfo, '/medal/is_light') ?? 0,
          guardType: peek(uinfo, '/medal/guard_level') ?? 0,
        }
      : null;

    return {
      id: `${cmd}:${roomId}:${uid}:${timestamp}`,
      type: ViyuniEventType.EntryEffect,
      cmd,
      roomId,
      uid,
      uname: peek(uinfo, '/base/name') ?? '',
      face,
      message: copyWriting,
      effectId: peek(dataField, '/id') ?? 0,
      textColor: copyColor,
      nameColor: highlightColor,
      duration: effectiveTime,
      background: peek(dataField, '/basemap_url') ?? '',
      backgroundAnimated: peek(dataField, '/web_dynamic_url_webp') ?? '',
      business: peek(dataField, '/business') ?? 0,
      guardType: privilegeType,
      wealthMedalLevel: wealthyInfo?.level ?? peek(uinfo, '/wealth/level') ?? 0,
      showAvatar: peek(dataField, '/show_avatar') ?? 0,
      showWealthMedal: !!wealthyInfo?.level,
      medal,
      timestamp,
      eventListenerUid,
    } satisfies EntryEffect;
  },
});

export interface ENTRY_EFFECT {
  cmd: typeof Cmd.ENTRY_EFFECT;
  data: {
    uid: number;
    privilege_type: GuardType;
    face: string;
    copy_writing_v2: string;
    copy_color: string;
    highlight_color: string;
    effective_time: number;
    trigger_time: number;
    /**
     * 动态背景 URL
     */
    basemap_url: string;
    /**
     * Web 动态背景 URL
     */
    web_dynamic_url_webp: string;
    business: number;
    id: number;
    show_avatar: number;
    wealthy_info: {
      level: number;
    } | null;
    uinfo: {
      base: {
        name: string;
      };
      medal: {
        level: number;
        name: string;
        guard_level: GuardType;
        ruid: number;
        is_light: number;
      } | null;
      wealth: {
        level: number;
      } | null;
    };
  };
}
