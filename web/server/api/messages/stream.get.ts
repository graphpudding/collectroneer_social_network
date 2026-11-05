// Server-sent events for the signed-in user: message, update, read, typing (ids only).
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const stream = createEventStream(event);
  const unsubscribe = await subscribeChat((e) => {
    if (!e.to.includes(me.id)) return;
    const { to: _to, ...data } = e;
    void stream.push({ event: "chat", data: JSON.stringify(data) });
  });
  // Keeps proxies from closing an idle connection.
  const ping = setInterval(() => void stream.push({ event: "ping", data: "" }), 25_000);
  stream.onClosed(async () => {
    clearInterval(ping);
    unsubscribe();
    await stream.close();
  });
  return stream.send();
});
