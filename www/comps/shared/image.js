import MyStore from '../../stores/store.js';

export function srcBase64(b64) {
	return `data:image/png;base64,${b64}`;
};

export default function srcBase64Icon(iconId,fallbackUrl) {
	if(iconId !== null && MyStore.getters['schema/iconIdMap'][iconId] !== undefined)
		return srcBase64(MyStore.getters['schema/iconIdMap'][iconId].file);
	
	return fallbackUrl;
};

export function srcBase64NoExt(b64) {
	var imageType = 'image';

	// check magic bytes for image type
	if     (b64.startsWith('iVBORw0KGgo')) imageType = 'image/png';
	else if(b64.startsWith('/9j/'))        imageType = 'image/jpeg';
	else if(b64.startsWith('UklGR'))       imageType = 'image/webp';

	return `data:${imageType};base64,${b64}`;
};