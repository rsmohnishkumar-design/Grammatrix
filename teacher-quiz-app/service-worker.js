// Exists to satisfy the "installable PWA" criteria some browsers check
// for, AND to receive push notifications while the app isn't open at
// all (that's the one thing a page's own JS can never do — a closed
// tab/app runs no JS, but the service worker keeps running in the
// background for exactly this). Deliberately does NOT cache app
// assets: this app talks to live Firestore data and this project has
// already hit real stale-cache bugs before, so caching the app shell
// here would risk serving old JS/CSS after every update.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally not calling event.respondWith — every request goes
  // straight to the network, same as if there were no service worker.
});

// Same project as js/firebase-config.js — a service worker can't use a
// <script src> tag, so the SDK and this app's own config are pulled in
// with importScripts instead.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBedj7OF9N1mwQmQytLoOUi8_yjFGPzplo",
  authDomain: "quizzify-91005.firebaseapp.com",
  projectId: "quizzify-91005",
  storageBucket: "quizzify-91005.firebasestorage.app",
  messagingSenderId: "675521594929",
  appId: "1:675521594929:web:31b101969a8c10d6da7710",
});

if (firebase.messaging.isSupported()) {
  const messaging = firebase.messaging();

  // Fires only when the app has no open/focused tab — a foreground push
  // is instead handled by js/push.js's onMessage, since a visible tab
  // should update in place rather than pop a redundant banner.
  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || "Testify";
    const body = (payload.notification && payload.notification.body) || "";
    self.registration.showNotification(title, {
      body,
      icon: "icons/apple-touch-icon.png",
      data: payload.data || {},
    });

    const badgeCount = payload.data && payload.data.badgeCount;
    if (badgeCount !== undefined && self.navigator && self.navigator.setAppBadge) {
      self.navigator.setAppBadge(Number(badgeCount) || 0).catch(() => {});
    }
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      if (list.length) return list[0].focus();
      return clients.openWindow("/");
    })
  );
});
