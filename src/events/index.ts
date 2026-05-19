import type { EntryEffect } from './entry-effect.ts';
import type { Gift } from './gift.ts';
import type { Guard } from './guard.ts';
import type { LikeClick } from './like-click.ts';
import type { LikesUpdate } from './likes-update.ts';
import type { LiveCutoff } from './live-cutoff.ts';
import type { LiveEnd } from './live-end.ts';
import type { LiveStart } from './live-start.ts';
import type { LiveWarning } from './live-warning.ts';
import type { Message } from './message.ts';
import type { SuperChatDelete } from './super-chat-delete.ts';
import type { SuperChat } from './super-chat.ts';

export * from './common.ts';
export * from './gift.ts';
export * from './guard.ts';
export * from './message.ts';
export * from './client-request.ts';
export * from './live-start.ts';
export * from './live-end.ts';
export * from './live-cutoff.ts';
export * from './live-warning.ts';
export * from './likes-update.ts';
export * from './like-click.ts';
export * from './entry-effect.ts';

export type {
  Message,
  Gift,
  Guard,
  SuperChat,
  SuperChatDelete,
  LiveStart,
  LiveEnd,
  LiveCutoff,
  LiveWarning,
  LikesUpdate,
  LikeClick,
  EntryEffect,
};

export type ViyuniEvent =
  | Message
  | Guard
  | Gift
  | SuperChat
  | SuperChatDelete
  | LiveStart
  | LiveEnd
  | LiveCutoff
  | LiveWarning
  | LikesUpdate
  | LikeClick
  | EntryEffect;
