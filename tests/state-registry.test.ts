import { expect, test, vi } from 'vite-plus/test';

import {
  BliveListener,
  type ListenerDependencies,
  type ListenerWebSocket,
} from '../src/core/listener.ts';
import {
  getListenerState,
  getListenerStates,
  getRoomListenerStates,
} from '../src/core/state-registry.ts';
import { LoginStatus, ReconnectListenerStatus } from '../src/core/types/index.ts';

class FakeWebSocket implements ListenerWebSocket {
  addListener() {}
  close() {}
}

function createDependencies(): ListenerDependencies {
  return {
    fetchNavInfo: async () => ({ isLogin: true, mid: 10001 }),
    fetchDanmuInfo: async () => ({ token: 'token' }),
    sendDanmu: async () => ({ accepted: true }),
    createWebSocket: () => new FakeWebSocket(),
  };
}

test('publishes lifecycle, login and heartbeat state for external inspection', async () => {
  const listener = new BliveListener(
    { roomId: 9001, loginCheck: { interval: false } },
    createDependencies(),
  );

  expect(listener.id).toMatch(/^[0-9A-Za-z_-]{8}$/);
  expect(listener.state).toMatchObject({
    instanceId: listener.id,
    roomId: 9001,
    status: ReconnectListenerStatus.Idle,
    retryCount: 0,
    loginInvalidSince: null,
    lastHeartbeat: null,
    lastError: null,
  });
  expect(getListenerStates().some((state) => state.instanceId === listener.id)).toBe(true);
  expect(getRoomListenerStates(9001).map((state) => state.instanceId)).toContain(listener.id);

  await listener.start();
  expect(getListenerState(listener.id)).toMatchObject({
    status: ReconnectListenerStatus.Connected,
    loginState: { status: LoginStatus.LoggedIn, uid: 10001 },
  });
  expect(getListenerState(listener.id)?.connectedAt).toEqual(expect.any(Number));

  const heartbeat = await listener.sendHeartbeat();
  expect(getListenerState(listener.id)?.lastHeartbeat).toMatchObject({
    id: heartbeat.id,
    success: true,
  });

  listener.stop();
  expect(getListenerState(listener.id)).toMatchObject({
    status: ReconnectListenerStatus.Stopped,
    stoppedAt: expect.any(Number),
  });

  listener.dispose();
  expect(listener.state).toBeUndefined();
  expect(getListenerState(listener.id)).toBeUndefined();
  await expect(listener.start()).rejects.toThrow('disposed');
});

test('returns snapshot copies that cannot mutate global state', () => {
  const listener = new BliveListener({ roomId: 9002 }, createDependencies());
  const snapshot = getListenerState(listener.id)!;
  snapshot.loginState.status = LoginStatus.LoggedOut;

  expect(getListenerState(listener.id)?.loginState.status).toBe(LoginStatus.Unknown);
  listener.dispose();
});

test('records a serializable last error in the global snapshot', async () => {
  const deps = createDependencies();
  deps.fetchDanmuInfo = vi.fn(async () => {
    throw new TypeError('danmu unavailable');
  });
  const listener = new BliveListener({ roomId: 9003 }, deps);

  await expect(listener.start()).rejects.toThrow('danmu unavailable');
  expect(getListenerState(listener.id)).toMatchObject({
    status: ReconnectListenerStatus.Failed,
    lastError: {
      name: 'TypeError',
      message: 'danmu unavailable',
      at: expect.any(Number),
    },
  });
  listener.dispose();
});
