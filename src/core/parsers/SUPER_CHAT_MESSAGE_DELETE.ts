import { Cmd, ViyuniEventType, type SuperChatDelete } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const SUPER_CHAT_MESSAGE_DELETE_PARSER = defineEventParser({
  cmd: Cmd.SUPER_CHAT_MESSAGE_DELETE,
  parser(
    cmd: typeof Cmd.SUPER_CHAT_MESSAGE_DELETE,
    data: SUPER_CHAT_MESSAGE_DELETE,
    roomId,
    eventListenerUid,
  ): SuperChatDelete {
    const timestamp = Date.now();

    const {
      data: { ids },
    } = data;

    return {
      cmd,
      id: `${cmd}:${roomId}:${timestamp}`,
      type: ViyuniEventType.SuperChatDelete,
      scIds: ids,
      timestamp,
      timestampNormalized: timestamp,
      read: false,
      eventListenerUid,
      roomId,
    } satisfies SuperChatDelete;
  },
});
/**
 * 醒目留言被删除
 */
export interface SUPER_CHAT_MESSAGE_DELETE {
  cmd: 'SUPER_CHAT_MESSAGE_DELETE';
  data: {
    /**
     * 被删除的 SC ID，对应 `SuperChat` 中的 `scId`（`gift_id`）
     */
    ids: number[];
  };
  roomid: number;
}
