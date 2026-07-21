import { expect, test } from 'vite-plus/test';

import { selectDanmuWebSocketServer, signWbiParams } from '../src/core/bili-api.ts';

test('signs getDanmuInfo parameters with WBI keys', () => {
  expect(
    signWbiParams(
      { foo: 114, bar: 514, zab: 1919810 },
      {
        img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
        sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
      },
      1702204169,
    ),
  ).toEqual({
    bar: '514',
    foo: '114',
    zab: '1919810',
    wts: '1702204169',
    w_rid: '8f6f2b5b3d485fe1886cec6a0be8c5d4',
  });
});

test('selects a TLS websocket endpoint from danmu host servers', () => {
  const server = selectDanmuWebSocketServer(
    [
      {
        host: 'live.example.test',
        port: 2243,
        wss_port: 443,
        ws_port: 2244,
      },
    ],
    () => 0,
  );

  expect(server).toEqual({
    host: 'live.example.test',
    port: 443,
    address: 'wss://live.example.test:443/sub',
  });
});

test('returns no websocket endpoint when the API provides no hosts', () => {
  expect(selectDanmuWebSocketServer([])).toBeUndefined();
  expect(selectDanmuWebSocketServer()).toBeUndefined();
});
