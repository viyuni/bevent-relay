import pino, { type Logger } from 'pino';

export const logger = pino({
  name: '@viyuni/bevent-relay',
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
});

export function createRoomLogger(roomId: number): Logger {
  return logger.child({ roomId });
}
