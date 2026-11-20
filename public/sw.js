/* eslint-disable no-restricted-globals */

// Service Worker for Nepali Tales Admin PWA & Web Push Notifications
const CACHE_NAME = "nt-admin-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Background Push Notification Event (fires even when the web app / browser is closed)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: "🔔 Nepali Tales Alert",
      body: event.data.text() || "New order update received.",
    };
  }

  const title = payload.title || "🔔 New Order Received!";
  const options = {
    body: payload.body || "Tap to view in live order queue.",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || ("order-" + (payload.orderNumber || Date.now())),
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 450],
    data: {
      url: payload.url || "/orders",
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      timestamp: payload.timestamp || Date.now(),
    },
    actions: [
      { action: "view", title: "View Order" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Event (User taps notification or an action button)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || "/orders";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If an admin window is already open, focus it and navigate
        for (const client of windowClients) {
          if (client.url && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // If app is not open, open a fresh window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
