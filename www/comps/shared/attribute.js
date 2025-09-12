import MyStore from '../../stores/store.js';

const attributeContentNames = {
	decimal:['numeric','real','double precision'],
	float:['real','double precision'],
	integer:['integer','bigint'],
	relationship:['1:1','n:1','1:n'],
	text:['varchar','text']
};
const attributeUseNoTextSearch = ['color','drawing','datetime','date','time'];
const removeInvalidHrefChars   = s => s.replace(/[#=@?:;\/\\&]/g,'');

export function getIndexAttributeId(index,attributeId,outsideIn,attributeIdNm) {
	// creates unique attribute ID, based on relation index
	//  and whether attribute comes from original relation index or via relationship
	// used to ascertain whether attribute has already been used
	// usually, attributes can only be used once (on a form for example)
	//  if relationship exists that is a self reference, attribute can exist twice
	if(index         === null) index         = 'null';
	if(attributeId   === null) attributeId   = 'null';
	if(attributeIdNm === null) attributeIdNm = 'null';
	
	return [
		index,
		attributeId,
		outsideIn ? 'rel' : 'org',
		attributeIdNm
	].join('_');
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

export function getAttributeFileHref(attributeId,id,name,token) {
	return `/data/download/${removeInvalidHrefChars(name)}?attribute_id=${attributeId}&file_id=${id}&token=${token}`;
};
export function getAttributeFileThumbHref(attributeId,id,name,version,token) {
	// thumbnails are only available for the latest file version, version getter only serves as cache denial
	return `/data/download/thumb/${removeInvalidHrefChars(name)}?attribute_id=${attributeId}&file_id=${id}&version=${version}&token=${token}`;
};
export function getAttributeFileVersionHref(attributeId,id,name,version,token) {
	return `/data/download/${removeInvalidHrefChars(name)}?attribute_id=${attributeId}&file_id=${id}&version=${version}&token=${token}`;
};

export function getValueFromQuery(content,queryValue) {
	if(isAttributeInteger(content) || isAttributeRelationship(content))
		return parseInt(queryValue);
	
	if(isAttributeDecimal(content))
		return parseFloat(queryValue);
	
	return queryValue;
};

export function getAttributeValueFromString(content,value) {
	if(isAttributeBoolean(content))        return value === 'true' || value === 'TRUE';
	if(isAttributeInteger(content))        return parseInt(value);
	if(isAttributeDecimal(content))        return parseFloat(value);
	if(isAttributeRelationship11(content)) return parseInt(value);
	if(isAttributeRelationshipN1(content)) return JSON.parse(value);
	if(isAttributeRelationship1N(content)) return JSON.parse(value);
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
export function getGetterFromAttributeValues(attributeIdMap) {
	let out = [];
	for(const k in attributeIdMap) {
		out.push(`${k}_${attributeIdMap[k]}`);
	}
	return out.length === 0 ? [] : [`attributes=${out.join(',')}`];
};

export function getAttributeIcon(content,contentUse,outsideIn,isNm) {
	if(isAttributeString(content)) {
		switch(contentUse) {
			case 'default':  return 'text.png';       break;
			case 'richtext': return 'text_rich.png';  break;
			case 'textarea': return 'text_lines.png'; break;
			case 'color':    return 'colors.png';     break;
			case 'drawing':  return 'drawing.png';    break;
			case 'iframe':   return 'iframe.png';     break;
			case 'barcode':  return 'barcode.png';    break;
		}
	}
	if(isAttributeInteger(content)) {
		switch(contentUse) {
			case 'datetime': return 'calendarTime.png'; break;
			case 'date':     return 'calendar.png';     break;
			case 'time':     return 'clock.png';        break;
			default:         return 'numbers.png';      break;
		}
	}
	if(isAttributeBoolean(content))        return 'bool.png';
	if(isAttributeUuid(content))           return 'uuid.png';
	if(isAttributeFloat(content))          return 'numbers_float.png';
	if(isAttributeNumeric(content))        return 'numbers_decimal.png';
	if(isAttributeFiles(content))          return 'files.png';
	if(isAttributeRegconfig(content))      return 'languages.png';
	if(isAttributeRelationship11(content)) return 'link1.png';
	if(isAttributeRelationship1N(content)) return 'link2.png';
	
	if(isAttributeRelationshipN1(content)) {
		if(isNm) return 'link4.png';
		
		return outsideIn ? 'link2.png' : 'link3.png';
	}
	return 'noPic.png';
};

export function getAttributeContentUse(content,use) {

	if(isAttributeString(content)) {
		switch(use) {
			case 'barcode':  return 'barcode';  break;
			case 'color':    return 'color';    break;
			case 'drawing':  return 'drawing';  break;
			case 'iframe':   return 'iframe';   break;
			case 'richtext': return 'richtext'; break;
			case 'textarea': return 'textarea'; break;
			case 'default':  return 'text';     break;
		}
	}

	if(isAttributeInteger(content)) {
		switch(use) {
			case 'date':     return 'date';     break;
			case 'datetime': return 'datetime'; break;
			case 'default':  return 'number';   break;
			case 'time':     return 'time';     break;
		}
	}

	if(isAttributeBoolean(content))        return 'boolean';
	if(isAttributeNumeric(content))        return 'decimal';
	if(isAttributeFiles(content))          return 'files';
	if(isAttributeFloat(content))          return 'float';
	if(isAttributeRegconfig(content))      return 'regconfig';
	if(isAttributeUuid(content))           return 'uuid';
	if(isAttributeRelationship11(content)) return 'relationship11';
	if(isAttributeRelationshipN1(content)) return 'relationshipN1';
	if(isAttributeRelationship1N(content)) return 'relationship1N';
	
	return 'text';
}
export function getAttributeContentsByUse(usedFor,length,largeNumbers) {
	switch(usedFor) {
		// default uses
		case 'text':           return { content:length === 0 ? 'text'   : 'varchar',       contentUse:'default' }; break;
		case 'number':         return { content:largeNumbers ? 'bigint' : 'integer',       contentUse:'default' }; break;
		case 'boolean':        return { content:'boolean',                                 contentUse:'default' }; break;
		case 'decimal':        return { content:'numeric',                                 contentUse:'default' }; break;
		case 'files':          return { content:'files',                                   contentUse:'default' }; break;
		case 'float':          return { content:largeNumbers ? 'double precision': 'real', contentUse:'default' }; break;
		case 'regconfig':      return { content:'regconfig',                               contentUse:'default' }; break;
		case 'uuid':           return { content:'uuid',                                    contentUse:'default' }; break;
		case 'relationship11': return { content:'1:1',                                     contentUse:'default' }; break;
		case 'relationshipN1': return { content:'n:1',                                     contentUse:'default' }; break;
		case 'relationship1N': return { content:'1:n',                                     contentUse:'default' }; break;

		// special uses: strings
		case 'barcode':  return { content:'text',                            contentUse:'barcode' };  break;
		case 'color':    return { content:'varchar',                         contentUse:'color' };    break;
		case 'drawing':  return { content:'text',                            contentUse:'drawing' };  break;
		case 'iframe':   return { content:'text',                            contentUse:'iframe' };   break;
		case 'richtext': return { content:length === 0 ? 'text' : 'varchar', contentUse:'richtext' }; break;
		case 'textarea': return { content:length === 0 ? 'text' : 'varchar', contentUse:'textarea' }; break;

		// special uses: integers
		case 'date':     return { content:largeNumbers ? 'bigint' : 'integer', contentUse:'date' };     break;
		case 'datetime': return { content:largeNumbers ? 'bigint' : 'integer', contentUse:'datetime' }; break;
		case 'time':     return { content:'integer',                           contentUse:'time' };     break;
	}
	return { content:'text', contentUse:'default' };
}

export function isAttributeBoolean(content)            { return content === 'boolean'; };
export function isAttributeDecimal(content)            { return attributeContentNames.decimal.includes(content); };
export function isAttributeFiles(content)              { return content === 'files'; };
export function isAttributeFloat(content)              { return attributeContentNames.float.includes(content); };
export function isAttributeInteger(content)            { return attributeContentNames.integer.includes(content); };
export function isAttributeNumeric(content)            { return content === 'numeric'; };
export function isAttributeRegconfig(content)          { return content === 'regconfig'; };
export function isAttributeString(content)             { return attributeContentNames.text.includes(content); };
export function isAttributeUuid(content)               { return content === 'uuid'; };
export function isAttributeWithLength(content)         { return isAttributeFiles(content) || isAttributeString(content) }
export function isAttributeRelationship(content)       { return attributeContentNames.relationship.includes(content); };
export function isAttributeRelationship11(content)     { return content === '1:1'; };
export function isAttributeRelationshipN1(content)     { return content === 'n:1'; };
export function isAttributeRelationship1N(content)     { return content === '1:n'; };
export function isAttributeTextSearchable(content,use) {
	return !isAttributeBoolean(content) && !isAttributeFiles(content) && !attributeUseNoTextSearch.includes(use);
};