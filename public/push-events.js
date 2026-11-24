const receiptPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const outboxName = "toques-push-v1";

async function sendClick(url) {
  const response = await fetch(url, { method: "POST", credentials: "omit", cache: "no-store" });
  return response.ok;
}

async function saveClick(receipt) {
  const url = new URL("/avisos/abertura/push?t=" + receipt, self.location.origin).href;
  let outbox;
  try {
    outbox = await caches.open(outboxName);
    await outbox.put(url, new Response(""));
  } catch { /* Ainda tenta enviar se o armazenamento estiver indisponível. */ }
  try {
    if (await sendClick(url)) await outbox?.delete(url);
  } catch { /* O próximo acesso repete apenas toques já realizados. */ }
}

async function retryClicks() {
  if (!(await caches.has(outboxName))) return;
  const outbox = await caches.open(outboxName);
  for (const request of await outbox.keys()) {
    try {
      if (await sendClick(request.url)) await outbox.delete(request.url);
    } catch { return; }
  }
}

self.addEventListener("message", event => {
  if (event.data === "retomar-toques-push") event.waitUntil(retryClicks());
});

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
      ...(message.shop_icon === true ? { icon: "/identidade/icone?dominio=" + encodeURIComponent(new URL(self.location.origin).hostname) } : {}),
      tag: receiptPattern.test(message.receipt) ? "bc-open-" + message.receipt : text(message.tag, "bc-update", 100),
      data: { receipt: message.receipt, url: message.url === "/shop" ? "/shop" : "/app" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  const { data, tag } = event.notification;
  const receipt = data?.receipt || (tag?.startsWith("bc-open-") ? tag.slice(8) : "");
  const path = data?.url === "/shop" ? "/shop" : "/app";
  event.notification.close();
  if (receiptPattern.test(receipt)) event.waitUntil(saveClick(receipt));
  const target = new URL(path, self.location.origin);
  // O fragmento chega somente ao app aberto pelo toque, inclusive se o worker for suspenso.
  if (receiptPattern.test(receipt)) target.hash = "bc-toque=" + receipt;
  const url = target.href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          try {
            await client.navigate(url);
            await client.focus();
            return;
          } catch { /* A janela pode ter sido encerrada pelo sistema. */ }
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
