// Lets the pet's calls show up as system notifications (some browsers only allow them from a service worker),
// and brings its tab forward when one is tapped. Nothing is cached.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const tab = list.find(c => new URL(c.url).pathname.startsWith(new URL(self.registration.scope).pathname));
    return tab ? tab.focus() : self.clients.openWindow(self.registration.scope);
  }));
});
