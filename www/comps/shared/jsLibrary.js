import MyStore from '../../stores/store.js';

const jsLibrariesLoaded = {};

export function jsLibraryLoad(url) {
	return new Promise((resolve, reject) => {
		if (jsLibrariesLoaded[url] !== undefined)
			return resolve();

		const script = document.createElement('script');
		script.src = url;
		script.onerror = reject;
		script.onload = () => {
			resolve();
			jsLibrariesLoaded[url] = true;
		};
		document.head.appendChild(script);
	});
};

export function jsLibraryLoadNoCache(url) {
	return jsLibraryLoad(`${url}?${MyStore.getters['local/appVersionBuild']}`);
};

export async function jsLibrariesLoad(urls) {
	try {
		for (const u of urls) {
			await jsLibraryLoad(u);
		}
	} catch (err) {
		throw new Error(err);
	}
};
export async function jsLibrariesLoadNoCache(urls) {
	try {
		for (const u of urls) {
			await jsLibraryLoadNoCache(u);
		}
	} catch (err) {
		throw new Error(err);
	}
};
