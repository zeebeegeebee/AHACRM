const CACHE_NAME = 'customer-mgr-v1';
const MAX_CACHE_SIZE = 45 * 1024 * 1024; // 45MB for iOS safety
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/db.js',
  '/assets/icons/icon-192x192.png', 
  '/assets/icons/icon-512x512.png',
  '/fallback.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache)
          .catch(err => {
            console.error('Failed to cache some resources:', err);
            // Even if some files fail, continue with installation
            return Promise.resolve();
          });
      })
      .then(() => {
        console.log('All resources cached');
        return self.skipWaiting(); // Force the SW to become active
      })
  );
});

// Clean up cache to stay under iOS limits
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (!cacheWhitelist.includes(cacheName)) {
                console.log('Deleting old cache:', cacheName);
                return caches.delete(cacheName);
              }
          })
        );
      })
      .then(() => {
        console.log('Claiming clients');
        return self.clients.claim(); // Take control of all pages immediately
      })
    );
  });

self.addEventListener('fetch', event => {
    // Skip non-GET requests on iOS
    if (event.request.method !== 'GET'|| !event.request.url.startsWith('http')) return;

    // Skip large files from being cached (images, videos, etc.)
    const dontCache = [
        /\.jpg$/, /\.jpeg$/, /\.png$/, /\.gif$/, /\.mp4$/, /\.mov$/,
        /\.pdf$/, /\.zip$/, /\.rar$/, /\.avi$/, /\.mp3$/
    ];

    const shouldNotCache = dontCache.some(regex => 
        event.request.url.match(regex)
      );

    event.respondWith(
        fetch(event.request)
      .then(response => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Only cache if it's not a large file and not in the exclusion list
        if (!shouldNotCache) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache)
                .catch(err => {
                  console.error('Failed to cache:', event.request.url, err);
                });
            });
        }

        return response;
      })
      .catch(() => {
        // Network request failed, try the cache
        return caches.match(event.request)
          .then(response => {
            // Return cached response or fallback
            return response || caches.match('/fallback.html');
          });
      })
    );
});

// Push notification event handler
self.addEventListener('push', event => {
    if (!event.data) return;
  
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('Push data not JSON:', e);
      data = {
        title: 'New Notification',
        body: event.data.text() || 'You have new updates',
        icon: '/assets/icons/icon-192x192.png'
      };
    }
  
    const options = {
      body: data.body,
      icon: data.icon || '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      data: data.url ? { url: data.url } : null
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
  
  // Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.notification.data && event.notification.data.url) {
      event.waitUntil(
        clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        }).then(windowClients => {
          // Focus on existing window if found
          for (let client of windowClients) {
            if (client.url === event.notification.data.url && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Otherwise open new window
          if (clients.openWindow) {
            return clients.openWindow(event.notification.data.url);
          }
        })
      );
    }
  });