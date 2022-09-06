import MyStore from '../../stores/store.js';

let attributeContentNames = {
	decimal:['numeric','real','double precision'],
	float:['real','double precision'],
	integer:['integer','bigint'],
	relationship:['1:1','n:1'],
	text:['varchar','text']
};

export function getIndexAttributeId(index,attributeId,outsideIn,attributeIdNm) {
	// creates unique attribute ID, based on relation index
	//  and whether attribute comes from original relation index or via relationship
	// used to ascertain whether attribute has already been used
	// usually, attributes can only be used once (on a form for example)
	//  if relationship exists that is a self reference, attribute can exist twice
	if(attributeId === null)   attributeId   = 'null';
	if(attributeIdNm === null) attributeIdNm = 'null';
	
	return [
		index,
		attributeId,
		outsideIn ? 'rel' : 'org',
		attributeIdNm].join('_')
	;
};

export function getIndexAttributeIdByField(f,altAttribute) {
	return getIndexAttributeId(
		f.index,
		!altAttribute ? f.attributeId : f.attributeIdAlt,
		f.outsideIn === true,
		typeof f.attributeIdNm !== 'undefined' ? f.attributeIdNm : null
	);
};

export function getIndexAttributeIdsByJoins(joins) {
	let out = [];
	for(let i = 0, j = joins.length; i < j; i++) {
		let rel  = MyStore.getters['schema/relationIdMap'][joins[i].relationId];
		
		for(let x = 0, y = rel.attributes.length; x < y; x++) {
			out.push(joins[i].index+'_'+rel.attributes[x].id);
		}
	}
	return out;
};

export function getDetailsFromIndexAttributeId(indexAttributeId) {
	if(indexAttributeId === null) return {
		index:null,
		attributeId:null,
		outsideIn:false,
		attributeIdNm:null
	};
	
	let d = indexAttributeId.split('_');
	return {
		index:d[0] === 'null' ? null : parseInt(d[0]),
		attributeId:d[1] === 'null' ? null : d[1],
		outsideIn:d[2] === 'rel',
		attributeIdNm:d[3] === 'null' ? null : d[3]
	};
};

export function getAttributeFileHref(attributeId,fileId,fileName,token) {
	return `/data/download/${fileName}?attribute_id=${attributeId}&file_id=${fileId}&token=${token}`;
};

export function getAttributeFileHrefThumb(attributeId,fileId,fileName,token) {
	return `/data/download/thumb/${fileName}?attribute_id=${attributeId}&file_id=${fileId}&token=${token}`;
};

export function getValueFromQuery(content,queryValue) {
	if(isAttributeInteger(content) || isAttributeRelationship(content))
		return parseInt(queryValue);
	
	if(isAttributeDecimal(content))
		return parseFloat(queryValue);
	
	return queryValue;
};

export function getAttributeValueFromString(content,value) {
	if(isAttributeBoolean(content))
		return value === 'true' || value === 'TRUE';
	
	if(isAttributeInteger(content))
		return parseInt(value);
	
	if(isAttributeDecimal(content))
		return parseFloat(value);
	
	if(isAttributeRelationship11(content))
		return parseInt(value);
	
	if(isAttributeRelationshipN1(content))
		return JSON.parse(value);
	
	return value;
};

// example: '7b9fecdc-d8c8-43b3-805a-3b276003c81_3,859a48cb-4358-4fd4-be1a-265d86930922_12'
// (contains two attributes with one value each)
export function getAttributeValuesFromGetter(getter) {
	let map  = {};
	let atrs = getter.split(',');
	
	for(let i = 0, j = atrs.length; i < j; i++) {
		
		let parts = atrs[i].split('_');
		if(parts.length !== 2)
			continue;
		
		let atrId = parts[0];
		let value = parts[1];
		
		if(typeof MyStore.getters['schema/attributeIdMap'][atrId] !== 'undefined')
			map[atrId] = getValueFromQuery(
				MyStore.getters['schema/attributeIdMap'][atrId].content,value);
	}
	return map;
};

export function isAttributeBoolean(content) { return content === 'boolean'; };
export function isAttributeDecimal(content) { return attributeContentNames.decimal.includes(content); };
export function isAttributeFiles(content)   { return content === 'files'; };
export function isAttributeFloat(content)   { return attributeContentNames.float.includes(content); };
export function isAttributeInteger(content) { return attributeContentNames.integer.includes(content); };
export function isAttributeNumeric(content) { return content === 'numeric'; };
export function isAttributeString(content)  { return attributeContentNames.text.includes(content); };
export function isAttributeRelationship(content)   { return attributeContentNames.relationship.includes(content); };
export function isAttributeRelationship11(content) { return content === '1:1'; };
export function isAttributeRelationshipN1(content) { return content === 'n:1'; };
export function isAttributeValueEqual(v1,v2) {
	// stringify values to (naively) compare arrays as well
	return JSON.stringify(v1) === JSON.stringify(v2);
};