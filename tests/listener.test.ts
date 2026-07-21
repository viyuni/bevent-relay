import { expect, test } from 'vite-plus/test';

import { BliveListener } from '../src/core/listener.ts';
import { ReconnectListenerStatus } from '../src/core/types/index.ts';
import { createListener, LoginStatus, ParserEventStatus } from '../src/index.ts';

test('createListener creates an idle BliveListener', () => {
  const listener = createListener({
    roomId: 123,
    cookie: 'buvid3=test-buvid',
  });

  expect(listener).toBeInstanceOf(BliveListener);
  expect(listener.getRoomId()).toBe(123);
  expect(listener.status).toBe(ReconnectListenerStatus.Idle);
  expect(listener.loginState.status).toBe(LoginStatus.Unknown);
  expect(ParserEventStatus.Unknown).toBe('unknown');
});
