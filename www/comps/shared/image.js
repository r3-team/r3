import MyStore from '../../stores/store.js';

export default function srcBase64Icon(iconId,fallbackUrl) {
	if(iconId !== null && MyStore.getters['schema/iconIdMap'][iconId] !== undefined)
		return srcBase64(MyStore.getters['schema/iconIdMap'][iconId].file);
	
	return fallbackUrl;
};

export function srcBase64(file) {
	return `data:image/png;base64,${file}`;
};