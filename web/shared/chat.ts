// Direct messages (db/migrations/*_chat.sql).
import type { PublicUser } from "./account";
import type { CopyStatus } from "./collection";

export const MESSAGE_MAX = 4000;

export type ChatUser = PublicUser & { id: string };

/** A copy shown as a card in the thread. */
export type ChatItem = {
  id: string;
  model: string;
  status: CopyStatus | "wanted";
  owner: string;
  thumbUrl: string | null;
  /** Public copy page, when the copy is public. */
  path: string | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string | null;
  attachment: { thumbUrl: string; fullUrl: string; width: number; height: number } | null;
  item: ChatItem | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
};

export type ConversationSummary = {
  id: string;
  other: ChatUser;
  last: { preview: string; mine: boolean; at: string } | null;
  unread: number;
  archived: boolean;
};

export type ConversationDetail = {
  id: string;
  other: ChatUser;
  item: ChatItem | null;
  messages: ChatMessage[];
  /** Older messages exist before the first one returned. */
  hasMore: boolean;
  /** When the other person last read the thread (read receipts). */
  otherReadAt: string | null;
  /** Either side blocked the other: no sending. */
  blocked: "me" | "them" | null;
  archived: boolean;
};

/** Pushed over /api/messages/stream. Ids only; the client fetches what changed. */
export type ChatEvent = {
  type: "message" | "update" | "read" | "typing";
  conversationId: string;
  from: string;
};
