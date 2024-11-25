// service worker
// updated when build number changes
// attempts to fulfill from cache first, if not possible, gets resource from network
const appCacheName = 'REPLACE_BY_BUILD'; // update this name to update worker cache
const appCacheBase = [
	'/',
	'/index.html',
	'/manifest.json',
	'/scripts.js?build=REPLACE_BY_BUILD',
	'/styles.css?build=REPLACE_BY_BUILD',
	'/websocket.js?build=REPLACE_BY_BUILD'
];
const appCacheModuleFileRegex = /schema\.json\?module_id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

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

	// service worker cannot handle POST
	// it also breaks POST progress (on things like uploads) if worker attempts to handle POST
	if(event.request.method === 'POST')
		return;

	// respond with cached resource or fetch it first
	event.respondWith(
		caches.open(appCacheName).then(cache => {
			return caches.match(event.request).then(res => {
				return res || fetch(event.request).then(res => {
					if(res.status === 200) {
						// special case: module schema cache (as in 'schema.json?module_id=36954b7c-807f-4a29-988c-f3945172da71&date=1702894325')
						// if new one comes in, existing versions are deleted
						const rgxMatches = appCacheModuleFileRegex.exec(event.request.url);
						if(rgxMatches !== null && rgxMatches.length === 2) {
							cache.matchAll().then(response => {
								response.forEach((element,index,array) => {
									if(element.url.includes(`schema.json?module_id=${rgxMatches[1]}`))
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
	event.waitUntil(
		caches.keys().then(cacheNames => {
			return Promise.all(
				cacheNames.map(name => {
					if(name !== appCacheName)
						return caches.delete(name);
				})
			);
		})
	);
});