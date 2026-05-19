import {
  Cmd,
  GuardType,
  ViyuniEventType,
  type BlindGift,
  type FansMedal,
  type Gift,
} from '../../events/index.ts';
import { defineEventParser } from './parser';
import durationByPrice from './utils';

export const SEND_GIFT_PARSER = defineEventParser({
  cmd: Cmd.SEND_GIFT,
  parser(cmd: typeof Cmd.SEND_GIFT, { data }: SEND_GIFT, roomId, eventListenerUid): Gift {
    const {
      sender_uinfo,
      uid,
      uname,
      face,
      timestamp,
      giftId,
      combo_total_coin: comboTotalCoin,
      coin_type: coinType,
      action: giftAction,
      gift_info: giftInfo,
      giftName,
      giftType,
      remain: giftRemain,
      total_coin: totalCoin,
      num: giftAmount,
      blind_gift,
      biz_source: bizSource,
      guard_level,
      medal_info,
      wealth_level: wealthMedalLevel,
      send_master: master,
      receive_user_info: receiveUserInfo,
    } = data;

    const finalUid = sender_uinfo?.uid ?? uid;
    const finalUname = sender_uinfo.base?.name ?? uname;
    const finalFace = sender_uinfo.base?.face ?? face;
    const giftIcon = giftInfo?.webp ?? giftInfo?.gif ?? giftInfo?.img_basic ?? '';
    const duration = durationByPrice(totalCoin / 1000);
    const effectId = giftInfo.effect_id ?? 0;

    const medal = medal_info
      ? ({
          roomId: medal_info?.anchor_roomid ?? 0,
          name: medal_info?.medal_name ?? '',
          level: medal_info?.medal_level ?? 0,
          isLighted: medal_info?.is_lighted ?? false,
          uid: medal_info?.target_id ?? 0,
          guardType: medal_info.guard_level ?? 0,
        } satisfies FansMedal)
      : null;

    const receiver = {
      master: {
        uid: master?.uid ?? 0,
        uname: master?.uname ?? '',
        roomId: master?.room_id ?? 0,
      },
      uid: receiveUserInfo.uid ?? 0,
      uname: receiveUserInfo.uname ?? '',
    };

    const blindGift = blind_gift
      ? ({
          blindGiftConfigId: blind_gift?.blind_gift_config_id ?? 0,
          from: blind_gift?.from ?? 0,
          giftAction: blind_gift?.gift_action ?? '',
          giftTipPrice: blind_gift?.gift_tip_price ?? 0,
          originalGiftId: blind_gift?.original_gift_id ?? 0,
          originalGiftName: blind_gift?.original_gift_name ?? '',
          originalGiftPrice: blind_gift?.original_gift_price ?? 0,
        } satisfies BlindGift)
      : null;

    return {
      id: `${cmd}:${roomId}:${uid}:${timestamp}:${giftId}:${comboTotalCoin / 1000}`,
      type: ViyuniEventType.Gift,
      cmd,
      uid: finalUid,
      uname: finalUname,
      face: finalFace,
      guardType: guard_level,
      giftId: giftId,
      giftAction,
      giftIcon,
      giftName,
      giftType,
      giftRemain,
      duration,
      price: totalCoin,
      priceNormalized: totalCoin / 1000,
      comboTotalCoin,
      coinType,
      giftAmount,
      effectId,
      blindGift,
      bizSource,
      eventListenerUid,
      roomId,
      timestamp: timestamp,
      timestampNormalized: timestamp * 1000,
      wealthMedalLevel,
      medal,
      receiver,
      read: false,
    } satisfies Gift;
  },
});

export interface SEND_GIFT {
  cmd: string;
  danmu: {
    area: number;
  };
  data: {
    action: string;
    bag_gift?: any;
    batch_combo_id: string;
    batch_combo_send?: any;
    beatId: string;
    benefits?: any;
    /**
     * 当前礼物所处的事务源
     * - 'Live' - 普通直播
     * - 'voice_chat_room' - 语音连麦，多人连麦时会影响 `receiver`，即 `receive_user_info`
     */
    biz_source: string;
    blind_gift?: SEND_GIFT_BLIND_GIFT | null;
    broadcast_id: number;
    /**
     * 'gold': 金瓜子，现金购买 'silver': 银瓜子，兑换的礼物
     */
    coin_type: string;
    combo_resources_id: number;
    combo_send?: any;
    combo_stay_time: number;
    combo_total_coin: number;
    crit_prob: number;
    demarcation: number;
    discount_price: number;
    dmscore: number;
    draw: number;
    effect: number;
    effect_block: number;
    effect_config?: any;
    face: string;
    face_effect: Faceeffect;
    face_effect_id: number;
    face_effect_type: number;
    face_effect_v2: Faceeffectv2;
    float_sc_resource_id: number;
    giftId: number;
    giftName: string;
    giftType: number;
    gift_info: Giftinfo;
    gift_tag: number[];
    gold: number;
    group_medal?: any;
    guard_level: GuardType;
    is_first: boolean;
    is_join_receiver: boolean;
    is_naming: boolean;
    is_special_batch: number;
    magnification: number;
    medal_info: Medalinfo;
    name_color: string;
    num: number;
    original_gift_name: string;
    price: number;
    rcost: number;
    receive_user_info: Receiveuserinfo;
    receiver_uinfo: Receiveruinfo;
    remain: number;
    rnd: string;
    send_master?: {
      room_id: number;
      uid: number;
      uname: string;
    } | null;
    sender_uinfo: Senderuinfo;
    silver: number;
    super: number;
    super_batch_gift_num: number;
    super_gift_num: number;
    svga_block: number;
    switch: boolean;
    tag_image: string;
    tid: string;
    timestamp: number;
    top_list?: any;
    total_coin: number;
    uid: number;
    uname: string;
    wealth_level: number;
  };
}

interface Senderuinfo {
  base: Base;
  guard?: any;
  guard_leader?: any;
  medal: Medal;
  title?: any;
  uhead_frame?: any;
  uid: number;
  wealth?: any;
}
interface Medal {
  color: number;
  color_border: number;
  color_end: number;
  color_start: number;
  guard_icon: string;
  guard_level: number;
  honor_icon: string;
  id: number;
  is_light: number;
  level: number;
  name: string;
  ruid: number;
  score: number;
  typ: number;
  user_receive_count: number;
  v2_medal_color_border: string;
  v2_medal_color_end: string;
  v2_medal_color_level: string;
  v2_medal_color_start: string;
  v2_medal_color_text: string;
}
interface Receiveruinfo {
  base: Base;
  guard?: any;
  guard_leader?: any;
  medal?: any;
  title?: any;
  uhead_frame?: any;
  uid: number;
  wealth?: any;
}
interface Base {
  face: string;
  is_mystery: boolean;
  name: string;
  name_color: number;
  name_color_str: string;
  official_info: Officialinfo;
  origin_info: Origininfo;
  risk_ctrl_info?: any;
}
interface Origininfo {
  face: string;
  name: string;
}
interface Officialinfo {
  desc: string;
  role: number;
  title: string;
  type: number;
}
interface Receiveuserinfo {
  uid: number;
  uname: string;
}
interface Medalinfo {
  anchor_roomid: number;
  anchor_uname: string;
  guard_level: GuardType;
  icon_id: number;
  is_lighted: number;
  medal_color: number;
  medal_color_border: number;
  medal_color_end: number;
  medal_color_start: number;
  medal_level: number;
  medal_name: string;
  special: string;
  target_id: number;
}
interface Giftinfo {
  effect_id: number;
  gif: string;
  has_imaged_gift: number;
  img_basic: string;
  webp: string;
}
interface Faceeffectv2 {
  id: number;
  type: number;
}
interface Faceeffect {
  candidate_face_effects: Candidatefaceeffect[];
  face_effect_type: number;
}
interface Candidatefaceeffect {
  effect_id: number;
  gender: number;
  source: number;
}

/** 盲盒礼物 of `SEND_GIFT` */
export interface SEND_GIFT_BLIND_GIFT {
  blind_gift_config_id: number;
  /** 通常为 `0` */
  from: number;
  /** `"爆出"` */
  gift_action: string;
  /** 爆奖的虚拟价格，单位金瓜子。此处为单价，即如果爆出了两个相同的礼物，此处也会显示一个的价格 */
  gift_tip_price: number;
  original_gift_id: number;
  /** 盲盒名称 */
  original_gift_name: string;
  /** 盲盒本身价格，单价。单位金瓜子 */
  original_gift_price: number;
}
