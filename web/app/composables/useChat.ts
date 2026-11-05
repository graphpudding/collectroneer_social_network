import type { ChatEvent } from "#shared/chat";

/** Unread messages across conversations (header badge). */
export const useUnread = () => useState<number>("chat-unread", () => 0);

type Handler = (e: ChatEvent) => void;
const handlers = new Set<Handler>();

/** Listen to chat events (message, update, read, typing) while the component lives. */
export function onChatEvent(fn: Handler) {
  handlers.add(fn);
  onBeforeUnmount(() => handlers.delete(fn));
}

export function emitChatEvent(e: ChatEvent) {
  for (const h of handlers) h(e);
}

export async function refreshUnread() {
  const r = await $fetch<{ unread: number }>("/api/messages/unread").catch(() => ({ unread: 0 }));
  useUnread().value = r.unread;
}
