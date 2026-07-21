import type { ListenerStateSnapshot } from './types';

const listenerStates = new Map<string, ListenerStateSnapshot>();

function cloneSnapshot(state: ListenerStateSnapshot): ListenerStateSnapshot {
  return {
    ...state,
    loginState: { ...state.loginState },
    lastHeartbeat: state.lastHeartbeat ? { ...state.lastHeartbeat } : null,
    lastError: state.lastError ? { ...state.lastError } : null,
  };
}

export function registerListenerState(state: ListenerStateSnapshot) {
  listenerStates.set(state.instanceId, cloneSnapshot(state));
}

export function updateListenerState(
  instanceId: string,
  patch: Partial<Omit<ListenerStateSnapshot, 'instanceId' | 'roomId' | 'createdAt'>>,
) {
  const current = listenerStates.get(instanceId);
  if (!current) return;
  listenerStates.set(instanceId, {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  });
}

export function unregisterListenerState(instanceId: string) {
  listenerStates.delete(instanceId);
}

/** 按实例 ID 获取状态快照。返回值是副本，可安全用于外部检测。 */
export function getListenerState(instanceId: string): ListenerStateSnapshot | undefined {
  const state = listenerStates.get(instanceId);
  return state ? cloneSnapshot(state) : undefined;
}

/** 获取当前进程中所有尚未 dispose 的 Listener 状态快照。 */
export function getListenerStates(): ListenerStateSnapshot[] {
  return Array.from(listenerStates.values(), cloneSnapshot);
}

/** 获取指定房间的全部 Listener 状态；同一房间允许存在多个实例。 */
export function getRoomListenerStates(roomId: number): ListenerStateSnapshot[] {
  return Array.from(listenerStates.values())
    .filter((state) => state.roomId === roomId)
    .map(cloneSnapshot);
}
