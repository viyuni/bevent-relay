import { expect, test } from 'vite-plus/test';

import { selectDanmuWebSocketServer } from '../src/core/bili-api.ts';

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
