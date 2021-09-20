// service worker
// updated when build number changes
// attempts to fulfill from cache first, if not possible, gets resource from network and
const appCacheName = 'REPLACE_BY_BUILD'; // update this name to update worker cache
const appCacheBase = [
	'/',
	'/index.html',
	'/manifest.json',
	'/scripts_REPLACE_BY_BUILD.js',
	'/styles_REPLACE_BY_BUILD.css',
	'/websocket_REPLACE_BY_BUILD.js'
];

// install new service worker
self.addEventListener('install', event => {
	
	// fetch and cache all base resources, others are fetched and cached on request
	event.waitUntil(
		caches.open(appCacheName).then(cache => {
			cache.addAll(appCacheBase);
		})
	);
	
	// immediately install new worker, this triggers page reload in scripts.js
	event.waitUntil(self.skipWaiting());
});

// request to fetch resource
self.addEventListener('fetch', event => {
	
	// respond with cached resource or fetch it first
	event.respondWith(
		caches.open(appCacheName).then(cache => {
			return caches.match(event.request).then(res => {
				return res || fetch(event.request).then(res => {
					if(res.status === 200) {
						
						// special case: schema cache (as in 'schema_1630272350.json')
						// if new one comes in, existing versions are deleted
						if(/schema_\d+\.json/.test(event.request.url)) {
							cache.matchAll().then(function(response) {
								response.forEach(function(element,index,array) {
									
									if(/schema_\d+\.json/.test(element.url))
										cache.delete(element.url);
								});
							});
						}
						
						// add fetched resource to cache
						cache.put(event.request,res.clone());
					}
					return res;
				});
			});
		})
	);
});

// activate a new worker (when replacing previous one)
self.addEventListener('activate', event => {
	
	// remove old caches
	let cacheAllowlist = [appCacheName];
	event.waitUntil(
		caches.keys().then(cacheNames => {
			return Promise.all(
				cacheNames.map(cacheName => {
					if(cacheAllowlist.indexOf(cacheName) === -1)
						return caches.delete(cacheName);
				})
			);
		})
	);
});