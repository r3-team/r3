
import MyStore from '../../stores/store.js';
import { getAttributeIcon } from './attribute.js';
import { getItemTitle } from './builder.js';

export function getFieldIcon(field) {
	switch (field.content) {
		case 'data':
			{
				const atr = MyStore.getters['schema/attributeIdMap'][field.attributeId];
				return getAttributeIcon(
					atr.content,
					atr.contentUse,
					field.outsideIn,
					field.attributeIdNm !== null);
			}
		case 'button': return 'circle_play.png';
		case 'calendar': return field.gantt ? 'gantt.png' : 'calendar.png';
		case 'chart': return 'chart.png';
		case 'container': return 'layout.png';
		case 'header': return 'header.png';
		case 'kanban': return 'kanban.png';
		case 'list': return 'files_list2.png';
		case 'map': return 'map.png';
		case 'tabs': return 'tabs.png';
		case 'variable': return 'variable.png';
	}
	return 'noPic.png';
};

export function getFieldTitle(field) {
	switch (field.content) {
		case 'button': return 'Button';
		case 'chart': return 'Chart';
		case 'container': return 'Container';
		case 'header': return 'Label';
		case 'tabs': return 'Tabs';
		case 'map': return 'Map';
		case 'calendar': return field.gantt ? 'Gantt' : 'Calendar';
		case 'data': return getItemTitle(field.attributeId, field.index, field.outsideIn, field.attributeIdNm);
		case 'kanban': return field.query === null || field.query.relationId === null ? 'Kanban' : `Kanban: ${MyStore.getters['schema/relationIdMap'][field.query.relationId].name}`;
		case 'list': return field.query === null || field.query.relationId === null ? 'List' : `List: ${MyStore.getters['schema/relationIdMap'][field.query.relationId].name}`;
		case 'variable': return field.variableId === null ? 'Variable' : `Variable: ${MyStore.getters['schema/variableIdMap'][field.variableId].name}`;
	}
	return '';
};

export function getFieldOverwriteDefault() {
	return { caption: {}, chart: {}, error: {}, order: {} };
};

export function getFieldProcessedDefault() {
	return { choices: {}, columns: {}, filters: {}, filtersInput: {} };
};
