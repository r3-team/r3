import MyStore from '../../stores/store.js';

export function getPgIndexTitle(id) {
	const ind = MyStore.getters['schema/indexIdMap'][id];
	const out = [];

	for (const a of ind.attributes) {
		const atr = MyStore.getters['schema/attributeIdMap'][a.attributeId];
		out.push(`${atr.name} (${atr.content})`);
	}
	return out.join(' + ');
};
