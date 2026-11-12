/* Web Push do B&C. O evento sempre produz uma notificação visível. */
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data?.json() || {};
  } catch {
    /* Payload inválido usa aviso genérico. */
  }
  const text = (value, fallback, max) =>
    typeof value === "string" && value.length > 0 ? value.slice(0, max) : fallback;
  event.waitUntil(
    self.registration.showNotification(text(message.title, "Agendamentos", 100), {
      body: text(
        message.body,
        "Há uma atualização no seu agendamento. Abra o aplicativo para conferir.",
        200,
      ),
      tag: text(message.tag, "bc-update", 100),
      data: { url: message.url === "/shop" ? "/shop" : "/app" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url === "/shop" ? "/shop" : "/app";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
