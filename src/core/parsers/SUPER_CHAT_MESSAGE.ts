import {
  Cmd,
  GuardType,
  ViyuniEventType,
  type FansMedal,
  type SuperChat,
} from '../../events/index.ts';
import { defineEventParser } from './parser';

export const SUPER_CHAT_MESSAGE = defineEventParser({
  cmd: Cmd.SUPER_CHAT_MESSAGE,
  parser(
    cmd: typeof Cmd.SUPER_CHAT_MESSAGE,
    data: SUPER_CHAT_MESSAGE,
    roomId,
    eventListenerUid,
  ): SuperChat {
    const {
      data: {
        uid,
        background_image: guardBackground = '',
        message,
        message_font_color: messageColor = '',
        message_trans: messageTrans = '',
        price,
        time: duration = 0,
        token,
        trans_mark: transMark = 0,
        ts: timestamp,
        user_info: { uname, face, face_frame: faceFrame, guard_level: guardType = 0 },

        gift: { gift_name: giftName, num: scAmount },
        id: scId,
        is_send_audit: isAudited = 0,
        medal_info,
        group_medal,
      },
    } = data;

    const medal = {
      level: medal_info?.medal_level ?? 0,
      name: medal_info?.medal_name ?? group_medal?.name ?? '',
      roomId: medal_info?.anchor_roomid ?? 0,
      uid: medal_info?.target_id ?? 0,
      guardType: medal_info?.guard_level ?? 0,
      isLighted: medal_info?.is_lighted ?? group_medal?.is_lighted ?? 0,
      type: group_medal?.medal_id && group_medal?.name && group_medal?.is_lighted ? 1 : 0,
    } satisfies FansMedal;

    return {
      id: `${cmd}:${roomId}:${uid}${timestamp}:${scId}`,
      type: ViyuniEventType.SuperChat,
      cmd,
      scId,
      uid,
      uname,
      face,
      faceFrame,
      medal,
      message,
      messageColor,
      messageTrans,
      transMark,
      isAudited,
      duration,
      price: price,
      priceNormalized: price,
      token,
      timestamp,
      timestampNormalized: timestamp * 1000,
      guardType,
      guardBackground,
      scAmount,
      giftName,
      read: false,
      deleted: false,
      eventListenerUid,
      roomId,
    } satisfies SuperChat;
  },
});

export interface SUPER_CHAT_MESSAGE {
  cmd: typeof Cmd.SUPER_CHAT_MESSAGE;
  data: {
    id: number;
    ts: number;
    uid: number;
    gift: {
      num: number;
      gift_id: number;
      gift_name: string;
    };
    rate: number;
    time: number;
    price: number;
    token: string;
    uinfo: {
      uid: number;
      base: {
        face: string;
        name: string;
        /** 是否是神秘人 */
        is_mystery: boolean;
        name_color: number;
        origin_info: {
          face: string;
          name: string;
        };
        official_info: {
          desc: string;
          role: number;
          type: number;
          title: string;
        };
        name_color_str: string;
        risk_ctrl_info: any;
      };
      guard: {
        level: number;
        expired_str: string;
      };
      medal: {
        id: number;
        typ: number;
        name: string;
        ruid: number;
        color: number;
        level: number;
        score: number;
        is_light: number;
        color_end: number;
        guard_icon: string;
        honor_icon: string;
        color_start: number;
        guard_level: number;
        color_border: number;
        user_receive_count: number;
        v2_medal_color_end: string;
        v2_medal_color_text: string;
        v2_medal_color_level: string;
        v2_medal_color_start: string;
        v2_medal_color_border: string;
      };
      title: {
        title_css_id: string;
        old_title_css_id: string;
      };
      wealth: any;
      uhead_frame: any;
      guard_leader: any;
    };
    /**
     * 一种事件风控分数标准，通常为整数，在2024 8-9月的某一天，b站支持显示自己sc的审核状态后，当前登录状态的 ws 会显示两个 sc 事件，
     * 一个是正常发出的状态，一个是不包含 `dmscore` 的状态，可通过这个状态来判断是否是公开的 sc
     */
    dmscore: number;
    message: string;
    end_time: number;
    is_ranked: number;
    user_info: {
      face: string;
      title: string;
      uname: string;
      is_vip: number;
      is_svip: number;
      manager: number;
      face_frame: string;
      name_color: string;
      user_level: number;
      guard_level: GuardType;
      is_main_vip: number;
      level_color: string;
    };
    is_mystery: boolean;
    medal_info: {
      icon_id: number;
      special: string;
      target_id: number;
      is_lighted: number;
      medal_name: string;
      guard_level: GuardType | null;
      medal_color: string;
      medal_level: number;
      anchor_uname: string;
      anchor_roomid: number;
      medal_color_end: number;
      medal_color_start: number;
      medal_color_border: number;
    } | null;
    start_time: number;
    /**
     * 是否开启翻译
     *
     * - 0: 未开启翻译
     * - 1: 已开启翻译
     */
    trans_mark: number;
    color_point: number;
    group_medal: {
      name: string;
      medal_id: number;
      is_lighted: number;
    };
    /**
     * 是否是被审核过的 SC
     *
     * - 0: 无审核
     * - 1: 已审核
     */
    is_send_audit: number;
    /**
     * SC 翻译正文
     *
     * 用户勾选翻译的话可用，目前为日文
     *
     * 如果直播间见开启了 SC 全局审核，那么所有的 SC 都会自动附上翻译，需要通过 `transMark` 判断
     * 是否真的开启了 SC 翻译
     */
    message_trans: string;
    background_icon: string;
    background_color: string;
    /**
     * 通常为荣耀等级所对应的角标
     * @link https://i0.hdslb.com/bfs/live/8552fe0bbcdea2bc1c72911c015f858f4b32f7f7.png
     * */
    background_image: string;
    /** Message color in HEX format */
    message_font_color: string;
    background_color_end: string;
    background_color_start: string;
    background_price_color: string;
    background_bottom_color: string;
  };
  /** `"25633924938475008:1000:1000"` */
  msg_id: string;
  p_is_ack: boolean;
  is_report: boolean;
  /** 1737446711685，比 data.ts/start_time 精度高 */
  send_time: number;
  p_msg_type: number;
}
