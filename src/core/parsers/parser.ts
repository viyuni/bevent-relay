import type { Cmd } from '../../events/index.ts';

export interface ParseResult {
  cmd: Cmd;
  id: string;
}

export interface EventParseOptions<Result extends ParseResult, Message = unknown> {
  cmd: Cmd;
  parser(cmd: Cmd, message: Message, roomId: number, eventListenerUid: number): Result;
}

export function defineEventParser<Result extends ParseResult, Message = unknown>(
  options: EventParseOptions<Result, Message>,
) {
  return options;
}
