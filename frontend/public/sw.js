const CACHE_NAME = 'beammeup-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event: cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        // Graceful failure if assets aren't available yet
        console.log('Initial cache population skipped (app not fully built yet)');
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: cache-first strategy for static assets, network-first for dynamic
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin and API requests
  if (url.origin !== location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  // For GET requests, try cache first, fall back to network
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            // Clone the response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return response;
          })
          .catch(() => {
            // Return offline fallback if available
            return caches.match('/index.html');
          });
      })
    );
  }
});

// Handle notifications from the server (for admin alerts)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let notificationData = {
    title: 'BeamMeUp',
    body: 'Server notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };

  try {
    const data = event.data.json();
    notificationData = { ...notificationData, ...data };
  } catch (e) {
    notificationData.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag || 'beammeup-notification',
      requireInteraction: notificationData.requireInteraction || false,
      data: notificationData.data || {},
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
