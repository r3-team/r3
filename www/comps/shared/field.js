import {getAttributeIcon} from './attribute.js';
import {getItemTitle}     from './builder.js';
import MyStore            from '../../stores/store.js';

export function getFieldIcon(field) {
	switch(field.content) {
		case 'data':
			const atr = MyStore.getters['schema/attributeIdMap'][field.attributeId];
			return getAttributeIcon(
				atr.content,
				atr.contentUse,
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
		case 'variable':  return 'variable.png'; break;
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
		case 'kanban':    return field.query.relationId === null ? 'Kanban'   : `Kanban: ${MyStore.getters['schema/relationIdMap'][field.query.relationId].name}`; break;
		case 'list':      return field.query.relationId === null ? 'List'     : `List: ${MyStore.getters['schema/relationIdMap'][field.query.relationId].name}`;   break;
		case 'variable':  return field.variableId       === null ? 'Variable' : `Variable: ${MyStore.getters['schema/variableIdMap'][field.variableId].name}`;     break;
	}
	return '';
};

export function getFieldOverwritesDefault() {
	return { caption:{}, chart:{}, error:{}, order:{} };
};

// locally stored field options
export function fieldOptionGet(favoriteId,fieldId,name,fallbackValue) {
	const isMobile = MyStore.getters.isMobile;
	const base     = isMobile ? MyStore.getters['local/loginOptionsMobile'] : MyStore.getters['local/loginOptions'];

	if(favoriteId !== null)
		return base.favoriteIdMap[favoriteId]?.fieldIdMap[fieldId]?.[name] !== undefined
			? JSON.parse(JSON.stringify(base.favoriteIdMap[favoriteId].fieldIdMap[fieldId][name]))
			: fallbackValue;

	return base.fieldIdMap[fieldId]?.[name] !== undefined
		? JSON.parse(JSON.stringify(base.fieldIdMap[fieldId][name]))
		: fallbackValue;
};
export function fieldOptionSet(favoriteId,fieldId,name,value) {
	const isMobile = MyStore.getters.isMobile;
	const isNoAuth = MyStore.getters.isNoAuth;
	MyStore.commit('local/loginOption',{favoriteId,fieldId,isMobile,isNoAuth,name,value});
};