import { parseCookie } from 'cookie';
import ky from 'ky';

export interface BiliResponse<T> {
  /** -101 未登录 */
  code: number;
  data: T;
  message: string;
  ttl: number;
}

export class BiliApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
    this.name = 'BiliApiError';
  }
}

export interface DanmuHostServer {
  host: string;
  port: number;
  wss_port: number;
  ws_port: number;
}

export interface DanmuServer {
  host: string;
  port: number;
  address: string;
}

export type DanmuConf = {
  refresh_row_factor: number;
  refresh_rate: number;
  max_delay: number;
  port: number;
  host: string;
  host_server_list: DanmuHostServer[];
  server_list: DanmuServer[];
  token: string;
};

export type FetchDanmuConfResp = BiliResponse<DanmuConf>;

export function selectDanmuWebSocketServer(
  servers: DanmuHostServer[] = [],
  random = Math.random,
): DanmuServer | undefined {
  if (servers.length === 0) return undefined;

  const server = servers[Math.floor(random() * servers.length)];
  if (!server) return undefined;

  return {
    host: server.host,
    port: server.wss_port,
    address: `wss://${server.host}:${server.wss_port}/sub`,
  };
}

export interface SendDanmuOptions {
  color?: number;
  fontSize?: number;
  mode?: number;
  bubble?: number;
  rnd?: number;
  csrfToken?: string;
}

export type SendDanmuResp = BiliResponse<Record<string, unknown>>;

// bili nav 接口返回的用户信息
export type FetchBiliNavResp = BiliResponse<{
  isLogin: boolean;
  email_verified: number;
  uname: string;
  face: string;
  face_nft: number;
  face_nft_type: number;
  level_info: {
    current_level: number;
    current_min: number;
    current_exp: number;
    next_exp: string;
  };
  mid: number;
  mobile_verified: number;
  money: number;
  moral: number;
  official: {
    role: number;
    title: string;
    desc: string;
    type: number;
  };
  officialVerify: {
    type: number;
    desc: string;
  };
  pendant: {
    pid: number;
    name: string;
    image: string;
    expire: number;
    image_enhance: string;
    image_enhance_frame: string;
    n_pid: number;
  };
  scores: number;
  vipDueDate: number;
  vipStatus: number;
  vipType: number;
  vip_pay_type: number;
  vip_theme_type: number;
  vip_label: {
    path: string;
    text: string;
    label_theme: string;
    text_color: string;
    bg_style: number;
    bg_color: string;
    border_color: string;
    use_img_label: boolean;
    img_label_uri_hans: string;
    img_label_uri_hant: string;
    img_label_uri_hans_static: string;
    img_label_uri_hant_static: string;
    label_id: number;
    label_goto: {
      mobile: string;
      pc_web: string;
    };
  };
  vip_avatar_subscript: number;
  vip_nickname_color: string;
  wallet: {
    mid: number;
    bcoin_balance: number;
    coupon_balance: number;
    coupon_due_time: number;
  };
  has_shop: boolean;
  shop_url: string;
  answer_status: number;
  is_senior_member: number;
  wbi_img: {
    img_url: string;
    sub_url: string;
  };
  is_jury: boolean;
  name_render: null;
}>;

export async function fetchDanmuInfo(roomId: number, cookie?: string | null) {
  const res = await ky
    .get<FetchDanmuConfResp>(
      `https://api.live.bilibili.com/room/v1/Danmu/getConf?room_id=${roomId}`,
      {
        credentials: 'include',
        headers: {
          Cookie: cookie ?? '',
        },
      },
    )
    .json();

  if (res.code !== 0) throw new BiliApiError(res.message, res.code);

  // Prefer WSS over the raw TCP endpoints in server_list. Containers and cloud
  // networks commonly block Bilibili's TCP port 2243, while WSS uses TLS/443.
  const randomServer = selectDanmuWebSocketServer(res.data.host_server_list);

  return {
    ...res.data,
    randomServer,
  };
}

export async function fetchNavInfo(cookie: string | null) {
  const res = await ky<FetchBiliNavResp>('https://api.bilibili.com/x/web-interface/nav', {
    credentials: 'include',
    headers: { Cookie: cookie ?? '' },
  }).json();

  if (res.code === 0) return res.data;
  if (res.code === -101) return { isLogin: false, mid: 0 };

  throw new BiliApiError(res.message, res.code);
}

export async function sendDanmu(
  roomId: number,
  message: string,
  cookie: string | null,
  options: SendDanmuOptions = {},
) {
  const csrfToken = options.csrfToken ?? parseCookie(cookie ?? '').bili_jct;

  if (!csrfToken) {
    throw new Error('Missing csrf token: bili_jct cookie is required to send danmu.');
  }

  const body = new FormData();
  body.set('color', String(options.color ?? 0xffffff));
  body.set('fontsize', String(options.fontSize ?? 25));
  body.set('mode', String(options.mode ?? 1));
  body.set('msg', message);
  body.set('rnd', String(options.rnd ?? Math.floor(Date.now() / 1000)));
  body.set('roomid', String(roomId));
  body.set('bubble', String(options.bubble ?? 0));
  body.set('csrf_token', csrfToken);
  body.set('csrf', csrfToken);

  const res = await ky
    .post<SendDanmuResp>('https://api.live.bilibili.com/msg/send', {
      credentials: 'include',
      headers: {
        Cookie: cookie ?? '',
        Referer: `https://live.bilibili.com/${roomId}`,
      },
      body,
    })
    .json();

  if (res.code !== 0) throw new BiliApiError(res.message, res.code);

  return res.data;
}
