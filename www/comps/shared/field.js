import {getAttributeIcon} from './attribute.js';
import {getItemTitle}     from './builder.js';
import MyStore            from '../../stores/store.js';

export function getFieldIcon(field) {
	switch(field.content) {
		case 'data':
			return getAttributeIcon(
				MyStore.getters['schema/attributeIdMap'][field.attributeId],
				field.outsideIn,
				field.attributeIdNm !== null);
		break;
		case 'button':    return 'circle_play.png'; break;
		case 'calendar':  return field.gantt ? 'gantt.png' : 'calendar.png'; break;
		case 'chart':     return 'chart.png'; break;
		case 'container': return 'layout.png'; break;
		case 'header':    return 'header.png'; break;
		case 'kanban':    return 'kanban.png'; break;
		case 'list':      return 'files_list2.png'; break;
		case 'tabs':      return 'tabs.png'; break;
	}
	return 'noPic.png';
};

export function getFieldTitle(field) {
	switch(field.content) {
		case 'button':    return 'Button';    break;
		case 'chart':     return 'Chart';     break;
		case 'container': return 'Container'; break;
		case 'header':    return 'Label';     break;
		case 'tabs':      return 'Tabs';      break;
		case 'calendar':  return field.gantt ? 'Gantt' : 'Calendar'; break;
		case 'data':      return getItemTitle(field.attributeId,field.index,field.outsideIn,field.attributeIdNm); break;
		case 'kanban':    return field.query.relationId === null ? 'Kanban' : `Kanban: ${MyStore.getters['schema/relationIdMap'][field.query.relationId].name}`; break;
		case 'list':      return field.query.relationId === null ? 'List' : `List: ${MyStore.getters['schema/relationIdMap'][field.query.relationId].name}`; break;
	}
	return '';
};

export function getFieldOverwritesDefault() {
	return { caption:{}, chart:{}, error:{}, order:{} };
};

// field options
export function fieldOptionGet(fieldId,optionName,fallbackValue) {
	const map = MyStore.getters['local/fieldIdMapOption'];
	return map[fieldId] !== undefined && map[fieldId][optionName] !== undefined
		? map[fieldId][optionName] : fallbackValue;
};
export function fieldOptionSet(fieldId,optionName,value) {
	MyStore.commit('local/fieldOptionSet',{
		fieldId:fieldId,
		name:optionName,
		value:value
	});
};