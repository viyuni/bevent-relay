import { peek } from 'volta-json-ptr';

import type {
  EmoticonMessage,
  FansMedal,
  InMessageEmoticonList,
  Message,
  Reply,
} from '../../events/index.ts';
import { Cmd, ViyuniEventType, type GuardType } from '../../events/index.ts';
import { defineEventParser } from './parser';

export const DANMU_MSG_PARSER = defineEventParser({
  cmd: Cmd.DANMU_MSG,
  parser(cmd: typeof Cmd.DANMU_MSG, data: DANMU_MSG, roomId, eventListenerUid): Message {
    const info = data.info;

    const timestamp = peek(info, '/0/4');
    const extraData = peek(info, '/0/15');
    const extraJsonStr = extraData?.extra || '{}';
    const extraJson: ExtraMeta = JSON.parse(extraJsonStr) || {};
    const user = extraData?.user;
    const sendType = peek(info, '/0/9');
    const uid = peek(info, '/2/0');
    const uname = peek(info, '/2/1');
    const face = peek(info, '/info/0/15/user/base/face') ?? user?.base?.face ?? '';
    const nameColor = peek(info, '/2/7');
    const wealthMedalLvl = peek(info, '/16/0');
    const phoneVerified = peek(info, '/2/6');
    const content = peek(info, '/1');
    const medalInfo = peek(info, '/3') || [];
    const medalRoomId = peek(medalInfo, '/3');
    const currentRank = peek(info, '/4/4');
    const guardType = peek(info, '/7');

    let inMsgEmoticonList: InMessageEmoticonList | undefined;
    if ('emots' in extraJson && Object.keys(extraJson?.emots || {}).length !== 0) {
      inMsgEmoticonList = {};
      for (const key in extraJson.emots) {
        const emoteItem = extraJson.emots?.[key];
        if (!emoteItem) continue;

        inMsgEmoticonList[key] = {
          url: emoteItem.url,
          width: emoteItem.width,
          height: emoteItem.height,
        };
      }
    }

    const emoteObj = peek(info, '/0/13');
    let emoticon: EmoticonMessage | undefined =
      emoteObj !== '{}'
        ? {
            bulgeDisplay: emoteObj.bulge_display,
            emoticonUnique: emoteObj.emoticon_unique,
            inPlayerArea: emoteObj.in_player_area,
            isDynamic: emoteObj.is_dynamic,
            url: emoteObj.url,
            width: emoteObj.width,
            height: emoteObj.height,
          }
        : undefined;

    if (typeof emoteObj !== 'object' || !('url' in emoteObj)) {
      emoticon = undefined;
    }

    const reply: Partial<Reply> = {};
    if ('show_reply' in extraJson && extraJson?.show_reply) {
      reply.uid = extraJson.reply_mid;
      reply.uname = extraJson.reply_uname;
    }

    const medal = user?.medal
      ? ({
          level: user?.medal?.level ?? 0,
          name: user?.medal?.name ?? '',
          uid: user?.medal?.ruid ?? 0,
          type: user?.medal?.typ ?? 0,
          isLighted: user?.medal?.is_light ?? 0,
          roomId: medalRoomId ?? 0,
          guardType: user.guard?.level ?? 0,
        } satisfies FansMedal)
      : null;

    return {
      id: `${cmd}:${roomId}:${uid}:${timestamp}`,
      type: ViyuniEventType.Message,
      cmd,
      roomId,
      uid,
      uname,
      face,
      nameColor,
      currentRank,
      guardType,
      emoticon,
      timestamp,
      content,
      wealthMedalLvl,
      phoneVerified,
      sendType,
      eventListenerUid,
      isGuard: guardType > 0,
      reply,
      medal,
      inMessageEmoticon: inMsgEmoticonList,
      read: false,
    } satisfies Message;
  },
});

export interface DANMU_MSG {
  cmd: typeof Cmd.DANMU_MSG;
  info: [
    [
      number, // [0][0]: unknown
      mode: number, // [0][1]: 弹幕的 mode
      fontSize: number, // [0][2]: 弹幕的 fontsize
      /**
       * [0][3]: 弹幕颜色, 十六进制颜色值的十进制数字
       * @example 16777215
       */
      textColor: number,
      /**
       * [0][4]: 时间戳
       * @example 1773297885116
       */
      timestamp: number,
      number, // [0][5]: unknown
      number, // [0][6]: unknown
      string, // [0][7]: unknown
      number, // [0][8]: unknown
      /**
       * [0][9]: 弹幕类型，可判断是否是自动弹幕，用于屏蔽自动发送的弹幕（节奏风暴、红包、天选）
       * @default 0
       */
      sendType: number,
      0, // [0][10]: unknown
      /**
       * [0][11]: 暂时不知道是啥
       * @example "#1453BAFF,#4C2263A2,#3353BAFF" | ""
       */
      string,
      /**
       * [0][12]: DanmakuType ?, 好像是表情弹幕时为 `1`
       * @example 0
       */
      danmakuType: number,
      /**
       * [0][13]: 表情弹幕内容
       * @example "{}"
       */
      emoticon: Emoticon | '{}',
      /**
       * [0][14]: 不知道是啥
       * @example "{}"
       */
      string,
      /**
       * [0][15]: 用户信息
       */
      userInfo: {
        /**
         * JSON String, `JSON.stringify` 后 `ExtraMeta`
         */
        extra: string;
        /**
         * 不知道是啥, 通常为 `0`
         */
        mode: 0;
        /**
         * 不知道是啥, 通常为 `0`
         */
        show_player_type: 0;
        user: UserInfo | null;
      },
      /**
       * [0][16]: 暂时不知道是啥
       */
      {
        activity_identity: string;
        activity_source: number;
        not_show: number;
      },
      0,
    ],

    /**
     * [1]: 消息内容
     */
    content: string,

    /** [2]: 用户信息 */
    [
      // [2][0]: uid
      uid: number,

      // [2][1]: username
      username: string,

      /**
       * [2][2]: userType
       * - 0: normal user
       * - 1: room mod
       */
      userType: number,

      // [2][3]: isVip
      isVip: number,

      // [2][4]: isSvip
      isSvip: number,

      /**
       * [2][5]: isNewUser
       * < 10000: new user
       */
      isNewUser: number,

      /**
       * [2][6]: phoneVerified
       * - 0: not verified
       * - 1: verified
       */
      phoneVerified: number,

      /**
       * [2][7]: nameColor
       * username color in HEX format. normal user is empty
       */
      nameColor: string,
    ],

    // [3] badge
    (
      | [
          /**
           * [3][0]: medalLvl = 0, 同 info[0][15].user.medal.level
           */
          medalLvl: number,

          /**
           * [3][1]: medalName = '', 同 info[0][15].user.medal.name
           */
          medalName: string,

          /**
           * [3][2]: 粉丝牌创建主播名称
           */
          medalOriginUsername: string,

          /**
           * [3][3]: medalRoom
           */
          medalRoom: number,

          /**
           * [3][4]: 同 info[0][15].user.medal.color
           */
          medalColor: number,
          unknown, // [3][5]
          unknown, // [3][6]
          unknown, // [3][7]: medalBgStart, // 8
          unknown, // [3][8]: medalBorder, // 7
          unknown, // [3][9]: medalBgEnd, // 9
          /**
           * [3][10]: medalGuardType
           */
          medalGuardType: number, // 10
          /**
           * [3][11]: medalLightened
           */
          medalLightened: number, // 11
          /**
           * [3][12]: medalUid
           */
          medalUid: number,
        ]
      | null
    ),

    // [4]
    [
      userLvl: number,
      unknown,
      userLvlBorder: number,
      unknown,
      /**
       * currentRank
       * 0: 未上榜
       * 1: 榜1
       * 3: 榜2
       * 2: 榜3
       */
      currentRank: number,
    ],

    // [5]: 头衔, 有头衔时会返回 ["title-902-1", "title-902-1"], 无头衔时会返回 ["", ""]
    [string, string],

    // [6]: 不知道是啥
    number, // 6

    /**
     * [7]: GuardType
     * 0: 白字
     * 1: 总督
     * 2: 提督
     * 3: 舰长
     */
    guardType: GuardType,

    // [8]: 通常为 null
    null, // 8

    // [9]
    {
      // This is short and may have collision with high traffic danmakus
      // Use `timestamp` defined above
      ts: number;

      /**
       * `ct` seems to be unique random string
       * 弹幕签名，配合 `extra` 字段中的 `id_str` 用于举报弹幕
       */
      ct: string;
    },

    // [10]: unknown
    number,

    // [11]: unknown
    number,

    // [12]: null
    null,

    // [13]: null
    null,

    // [14]: unknown
    number,

    // [15]: unknown
    number,

    // [16]
    [
      /**
       * [16][0]
       * wealthMedalLvl = 0
       */
      wealthMedalLvl: number,
    ],

    /**
     * [17]: 当是大航海套票时，此字段存在
     */
    (
      | [
          /** 套票粉丝团 id */
          number,
          /** 套票粉丝团名称，ie. 柚饼糖 */
          string,
          /** 未知，通常为 1 */
          number,
        ]
      | null
    ),
  ];
  /**
   * @deprecated
   * Base64 String
   */
  dm_v2: string;
}

export interface Emoticon {
  /**
   * 表情是否凸起，1 代表凸起，通常为自定义表情，0 为b站内置长条表情
   */
  bulge_display: number;
  emoticon_unique: string;
  height: number;
  in_player_area: number;
  is_dynamic: number;
  url: string;
  width: number;
}

export interface UserInfo {
  /**
   * 未登录时此处为 0
   */
  uid: number;
  base: {
    /**
     * 匿名时此处 **通常** 会被打码，下列事件包含 UINFO 时此处没打码，完整行为需更多调查
     *
     * - `ONLINE_RANK_V2` 没打码
     */
    name: string;
    face: string;
    name_color: number;
    /**
     * 是否是神秘人
     */
    is_mystery: boolean;
    risk_ctrl_info: null;
    origin_info: {
      name: string;
      face: string;
    };
    official_info: {
      role: number;
      title: string;
      desc: string;
      // -1
      type: number;
    };
    name_color_str: string;
  };
  /**
   * 粉丝牌对象，有时候会直接返回 null，不知道什么原因（大概风控），目前已知下列事件永远返回 null
   * - `DANMU_MSG`
   * - `LIKE_INFO_V3_CLICK`
   * - `ONLINE_RANK_V2`
   * - `POPULARITY_RED_POCKET_V2_START`
   * - `SEND_GIFT`
   */
  medal: MedalInfo | null;
  /**
   * 荣耀等级，已知下列事件中包含：
   * - `EFFECT_DANMAKU_MSG`
   *
   * 已知下列事件中为 null
   * - `ONLINE_RANK_V2`
   * - `SUPER_CHAT_MESSAGE`
   * - `POPULARITY_RED_POCKET_V2_START`
   * - `SEND_GIFT`
   */
  wealth: {
    /**
     * 通常为 `''`
     */
    dm_icon_key: string;
    level: number;
  } | null;
  title: {
    /**
     * 通常为 `''`
     */
    old_title_css_id: string;
    /**
     * 通常为 `''`
     */
    title_css_id: string;
  } | null;
  /**
   * 当前直播间的大航海信息（非粉丝牌的大航海状态），已知下列事件中包含：
   * - `ONLINE_RANK_V2`
   * - `EFFECT_DANMAKU_MSG`
   * - `SUPER_CHAT_MESSAGE`
   * - `LIKE_INFO_V3_CLICK`
   *
   * 已知无：
   * - `SEND_GIFT`
   */
  guard?: {
    /**
     * ie. `'2025-02-01 23:59:59'`
     */
    expired_str: string;
    /**
     * 0: 白字
     * 1: 总督
     * 2: 提督
     * 3: 舰长
     */
    level: GuardType;
  };
  /**
   * 在某些特殊事件中会返回对应的头像框，目前已知返回：
   *
   * - `ONLINE_RANK_V2`
   *
   * 已知无：
   *
   * - `DANMU_MSG`
   * - `SEND_GIFT`
   * - `SUPER_CHAT_MESSAGE`
   */
  uhead_frame?: {
    /**
     * @example `https://i0.hdslb.com/bfs/live/484a499a5b0091991e32c2fd6f0968503e95ce36.png`
     */
    frame_img: string;
    /**
     * @example 1750
     */
    id: number;
  };
  /**
   * 舰队指挥官对象，并非所有事件都有
   *
   * @updated May 25, 2025, 10:13:44 AM PDT
   *
   * 已知有：
   * - `DANMU_MSG`
   *
   * 已知无：
   * - `SEND_GIFT`
   * - `ONLINE_RANK_V2`
   */
  guard_leader?: {
    is_guard_leader: boolean;
  };
}

/**
 * Global user Medals used by live APIs
 * 部分 WebSocket 事件中也会使用此 interface：
 * - DANMU_MSG
 */
export interface MedalInfo {
  // ie. 7996451
  color: number;
  color_border: number;
  color_end: number;
  color_start: number;
  guard_icon: string;
  /**
   * 0: 白字
   * 1: 总督
   * 2: 提督
   * 3: 舰长
   */
  guard_level: number;
  /**
   * 没有时返回 `''`
   */
  honor_icon: string;
  /**
   * 未知，通常为 0
   */
  id: number;
  /**
   * 粉丝牌是否点亮，1 为点亮
   */
  is_light: number;
  /**
   * 粉丝牌等级，也可能是 0
   */
  level: number;
  /**
   * 粉丝牌名称
   */
  name: string;
  /**
   * 粉丝牌所对应主播的 UID，当 `typ` 为 1 时，此时为粉丝团套票，此处的 ruid 等于粉丝团 id
   */
  ruid: number;
  /**
   * 未知
   */
  score: number;
  /**
   * 类型，通常为 0，为 1 时为大航海套票
   */
  typ: number;
  /** 通常为 0 */
  user_receive_count: number;
  /** "#5FC7F4FF" */
  v2_medal_color_border: string;
  v2_medal_color_end: string;
  v2_medal_color_level: string;
  v2_medal_color_start: string;
  v2_medal_color_text: string;
}

/**
 * 文本弹幕中的额外对象
 */
export interface ExtraMeta {
  send_from_me: boolean;
  mode: number;
  color: number;
  dm_type: number;
  font_size: number;
  player_mode: number;
  show_player_type: number;
  content: string;
  user_hash: string;
  emoticon_unique: string;
  bulge_display: number;
  recommend_score: number;
  main_state_dm_color: string;
  objective_state_dm_color: string;
  direction: number;
  pk_direction: number;
  quartet_direction: number;
  anniversary_crowd: number;
  yeah_space_type: string;
  yeah_space_url: string;
  jump_to_url: string;
  space_type: string;
  space_url: string;
  animation: Record<string, unknown>;
  emots: { [key: string]: ExtraMetaEmoteItem };
  is_audited: boolean;
  /**
   * 弹幕唯一识别 id，用于举报、弹幕回复
   */
  id_str: string;
  show_reply?: boolean;
  reply_mid?: number;
  reply_uname?: string;
  reply_uname_color?: string;
  /** 被回复用户是否是神秘人 */
  reply_is_mystery?: boolean;
  /** 未知 */
  reply_type_enum?: number;
  /** 未知 */
  hit_combo?: number;
  /** 未知 */
  esports_jump_url?: string;
  /**
   * 是否是跨房弹幕
   *
   * @since Sep 20, 2025
   */
  is_mirror?: boolean;
  is_collaboration_member?: boolean;
}

/** Item of `ExtraMeta` */
export interface ExtraMetaEmoteItem {
  emoticon_id: number;
  emoji: string;
  descript: string;
  url: string;
  width: number;
  height: number;
  emoticon_unique: string;
  count: number;
}
