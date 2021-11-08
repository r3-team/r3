import MyStore from '../../stores/store.js';

export function fieldOptionGet(fieldId,optionName,fallbackValue) {
	let map = MyStore.getters['local/fieldIdMapOption'];
	
	if(typeof map[fieldId] === 'undefined' || typeof map[fieldId][optionName] === 'undefined')
		return fallbackValue;
	
	return map[fieldId][optionName];
};

export function fieldOptionSet(fieldId,optionName,value) {
	MyStore.commit('local/fieldOptionSet',{
		fieldId:fieldId,
		name:optionName,
		value:value
	});
};