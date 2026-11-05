// One event stream per tab while signed in. EventSource reconnects by itself after drops.
export default defineNuxtPlugin(() => {
  const me = useMe();
  let source: EventSource | null = null;

  function connect() {
    source?.close();
    source = new EventSource("/api/messages/stream");
    source.addEventListener("chat", (msg) => {
      const e = JSON.parse((msg as MessageEvent).data);
      emitChatEvent(e);
      if (e.type !== "typing") void refreshUnread();
    });
    // Back after a drop: catch up on anything missed.
    source.addEventListener("open", () => void refreshUnread());
  }

  watch(() => me.value?.id, (id) => {
    if (id) connect();
    else { source?.close(); source = null; useUnread().value = 0; }
  }, { immediate: true });
});
