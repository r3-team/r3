import {
	isAttributeRelationship,
	isAttributeRelationship11
} from './attribute.js';
import MyStore from '../../stores/store.js';

export function getDependentModules(moduleSource,modulesAll) {
	let out = [];
	for(let i = 0, j = modulesAll.length; i < j; i++) {
		let m = modulesAll[i];
		
		if(moduleSource.id !== m.id && !moduleSource.dependsOn.includes(m.id))
			continue;
		
		out.push(m);
	}
	return out;
};

export function getValueFromJson(inputJson,nameChain,valueFallback) {
	let o = JSON.parse(inputJson);
	for(let i = 0, j = nameChain.length; i < j; i++) {
		
		if(typeof o[nameChain[i]] === 'undefined')
			return valueFallback;
		
		o = o[nameChain[i]];
	}
	return o;
};

export function setValueInJson(inputJson,nameChain,value) {
	let o = JSON.parse(inputJson);
	let s = o;
	
	for(let i = 0, j = nameChain.length; i < j; i++) {
		
		if(i+1 === j) {
			// last element reached, set value and break out
			s[nameChain[i]] = value;
			break;
		}
		
		if(typeof s[nameChain[i]] === 'undefined')
			s[nameChain[i]] = {};
		
		s = s[nameChain[i]];
	}
	return JSON.stringify(o,null,2);
};

export function getItemTitle(relation,attribute,index,outsideIn,attributeNm) {
	let isRel = isAttributeRelationship(attribute.content);
	
	if(!isRel)     return `${index}) ${relation.name}.${attribute.name}`;
	if(!outsideIn) return `${index}) [${attribute.content}] ${relation.name}.${attribute.name}`;
	
	if(attributeNm !== false)
		return `${index}) [n:m] ${relation.name}.${attribute.name} -> ${attributeNm.name}`;
	
	let relCap = isAttributeRelationship11(attribute.content) ? '1:1' : '1:n';
	
	return `${index}) [${relCap}] ${relation.name}.${attribute.name}`;
	
};

export function getItemTitleNoRelationship(relation,attribute,index) {
	return `${index}) ${relation.name}.${attribute.name}`;
};

export function getItemTitleColumn(column) {
	let a = MyStore.getters['schema/attributeIdMap'][column.attributeId];
	let r = MyStore.getters['schema/relationIdMap'][a.relationId];
	return getItemTitle(r,a,column.index,false,false);
};

export function getItemTitleRelation(relationId,index) {
	return `${index}) ${MyStore.getters['schema/relationIdMap'][relationId].name}`;
};

export function getPgFunctionTemplate() {
	return '$BODY$\nDECLARE\nBEGIN\n\tRETURN NEW;\nEND;\n$BODY$';
};