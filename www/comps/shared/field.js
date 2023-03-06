import {getAttributeIcon} from './attribute.js';
import MyStore            from '../../stores/store.js';

export function getFieldIcon(field) {
	switch(field.content) {
		case 'button':    return 'circle_play.png'; break;
		case 'calendar':  return 'calendar.png'; break;
		case 'chart':     return 'chart.png'; break;
		case 'container': return 'layout.png'; break;
		case 'data':      return getAttributeIcon(MyStore.getters['schema/attributeIdMap'][field.attributeId]); break;
		case 'header':    return 'header.png'; break;
		case 'list':      return 'files_list2.png'; break;
		case 'tabs':      return 'tabs.png'; break;
	}
	return 'noPic.png';
};

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