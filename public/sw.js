self.addEventListener("push", (event) => {
  const fallback = {
    title: "BAM",
    body: "Your practice session is ready.",
    url: "/student",
    tag: "bam-practice",
  };

  let message = fallback;
  try {
    message = { ...fallback, ...(event.data ? event.data.json() : {}) };
  } catch {
    message = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/apple-touch-icon.png",
      badge: "/favicon.png",
      tag: message.tag,
      renotify: true,
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/student", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const openClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (openClient) {
        if ("navigate" in openClient) await openClient.navigate(targetUrl);
        return openClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
