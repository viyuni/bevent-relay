import { Cmd, ViyuniEventType, GuardType, type Guard } from '../../events/index.ts';
import { defineEventParser } from './parser';
import durationByPrice from './utils';

function getTotalNormalized(total: number, unit: string) {
  if (unit === '月') return total;
  if (unit === '年') return total * 12;
  return 0;
}

export const USER_TOAST_MSG_V2_PARSER = defineEventParser({
  cmd: Cmd.USER_TOAST_MSG_V2,
  parser(
    cmd: typeof Cmd.USER_TOAST_MSG_V2,
    data: USER_TOAST_MSG_V2,
    roomId,
    eventListenerUid,
  ): Guard {
    const {
      data: { sender_uinfo, guard_info, pay_info, option, toast_msg, effect_info },
      send_time,
    } = data;

    const totalNormalized = getTotalNormalized(pay_info.num, pay_info.unit);

    const effectId = option?.is_group
      ? (effect_info?.room_group_effect_id ?? 0)
      : (effect_info.room_effect_id ?? 0);

    return {
      id: `${send_time}:${guard_info.start_time}:${roomId}:${sender_uinfo.uid}:${guard_info.guard_level}:${pay_info.price}`,
      type: ViyuniEventType.Guard,
      cmd,
      uid: sender_uinfo.uid,
      uname: sender_uinfo.base?.name,
      face: sender_uinfo.base?.face,
      color: option.color,
      message: toast_msg,
      price: pay_info.price,
      priceNormalized: pay_info.price / 1000,
      duration: durationByPrice(pay_info.price / 1000),
      effectId,
      guardType: guard_info.guard_level,
      guardName: guard_info.role_name,
      total: pay_info.num,
      unit: pay_info.unit,
      totalNormalized,
      isYearGuard: pay_info.unit === '年',
      guardTotalCount: guard_info.room_guard_count,
      timestamp: guard_info.start_time,
      timestampNormalized: guard_info.start_time * 1000,
      eventListenerUid,
      roomId,
      read: false,
    } satisfies Guard;
  },
});

interface USER_TOAST_MSG_V2 {
  cmd: typeof Cmd.USER_TOAST_MSG_V2;
  data: Data;
  msg_id: string;
  p_is_ack: boolean;
  send_time: number;
  p_msg_type: number;
}
interface Data {
  option: Option;
  pay_info: Payinfo;
  gift_info: Giftinfo;
  toast_msg: string;
  guard_info: Guardinfo;
  effect_info: Effectinfo;
  sender_uinfo: Senderuinfo;
  receiver_uinfo: Senderuinfo;
  group_guard_info?: any;
}
interface Senderuinfo {
  uid: number;
  base: Base;
}
interface Base {
  face: string;
  name: string;
}
interface Effectinfo {
  effect_id: number;
  face_effect_id: number;
  room_effect_id: number;
  ship_effect_id: number;
  room_gift_effect_id: number;
  room_group_effect_id: number;
}
interface Guardinfo {
  op_type: number;
  end_time: number;
  role_name: string;
  start_time: number;
  guard_level: GuardType;
  room_guard_count: number;
}
interface Giftinfo {
  gift_id: number;
}
interface Payinfo {
  /** 流水号，`'2412152205251792198695335'` */
  payflow_id: string;
  /**
   * 价格，金瓜子数量，真实货币需要 / 1000
   *
   * 这里给的直接就是单价 * 数量
   */
  price: number;

  /** 大航海数量 */
  num: number;
  /**
   * 单位，月、年
   */
  unit: string;
}
interface Option {
  color: string;
  source: number;
  is_show: number;
  is_group: number;
  user_show: boolean;
  svga_block: number;
  anchor_show: boolean;
}
