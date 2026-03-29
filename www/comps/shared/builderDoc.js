import {getAttributeIcon} from './attribute.js';
import MyStore from '../../stores/store.js';

export function getDocEntityMapRef(doc) {
	let refs      = { field:{}, page:{} };
	let ctrFields = 0; // unique reference number for each field
	let ctrPages  = 0; // unique reference number for each page
	const parents = ['flow','flowBody','grid','gridFooter','gridHeader'];

	const collectFromField = field => {
		if(field.content === MyStore.getters.constants.dragFieldContent)
			return;

		refs.field[field.id] = ctrFields++;

		if(!parents.includes(field.content))
			return;

		for(const f of field.fields) {
			collectFromField(f);
		}
	};

	for(const p of doc.pages) {
		refs.page[p.id] = ctrPages++;

		if(p.header.active && p.header.docPageIdInherit === null)
			collectFromField(p.header.fieldGrid);

		collectFromField(p.fieldFlow);

		if(p.footer.active && p.footer.docPageIdInherit === null)
			collectFromField(p.footer.fieldGrid);
	}
	return refs;
};

export function getDocColumnIcon(column) {
	if(column.subQuery) return 'database.png';
	
	const atr = MyStore.getters['schema/attributeIdMap'][column.attributeId];
	return `${getAttributeIcon(atr.content,atr.contentUse,false,false)}`;
};

export function getDocColumnTitle(c) {
	if(c.subQuery)
		return 'SubQuery';

	const atr = MyStore.getters['schema/attributeIdMap'][c.attributeId];
	const rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
	return `${c.attributeIndex} ${rel.name}.${atr.name}`
};

export function getDocFieldIcon(field) {
	switch(field.content) {
		case 'data':
			const atr = MyStore.getters['schema/attributeIdMap'][field.attributeId];
			return getAttributeIcon(atr.content,atr.contentUse,false,false);
		break;
		case 'flowBody': // fallthrough
		case 'flow': return 'layout.png'; break;
		case 'gridFooter': // fallthrough
		case 'gridHeader': // fallthrough
		case 'grid': return 'dots.png'; break;
		case 'list': return 'files_list2.png'; break;
		case 'text': return 'code.png'; break;
	}
	return 'noPic.png';
};

export function getDocFieldTitle(field) {

	const capApp = MyStore.getters.captions.builder.doc.field;
	const capGen = MyStore.getters.captions.generic;
	let   parts  = [];
	
	if(field.content === 'data') {
		const atr = MyStore.getters['schema/attributeIdMap'][field.attributeId];
		const rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
		parts.push(`${field.attributeIndex} ${rel.name}.${atr.name}`);
	}

	switch(field.content) {
		case 'flow':       // fallthrough
		case 'flowBody':   parts.push(capApp.content.flow); break;
		case 'grid':       // fallthrough
		case 'gridFooter': // fallthrough
		case 'gridHeader': parts.push(capApp.content.grid); break;
		case 'list':       parts.push(capGen.list);         break;
		case 'text':       parts.push(capApp.content.text); break;
	}
	return parts.join(' ');
};