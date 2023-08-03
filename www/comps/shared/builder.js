import {isAttributeRelationship} from './attribute.js';
import MyStore                   from '../../stores/store.js';

export function getFieldHasQuery(field) {
	return ['calendar','chart','kanban','list'].includes(field.content)
		? true : field.content === 'data' && isAttributeRelationship(
			MyStore.getters['schema/attributeIdMap'][field.attributeId].content
		);
};

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

export function getFunctionHelp(functionPrefix,functionObj,builderLanguage) {
	let help = `${functionObj.name}(${functionObj.codeArgs}) => ${functionObj.codeReturns}`;
	
	// add translated title/description, if available
	let cap = `${functionPrefix}FunctionTitle`;
	if(typeof functionObj.captions[cap] !== 'undefined'
		&& typeof functionObj.captions[cap][builderLanguage] !== 'undefined'
		&& functionObj.captions[cap][builderLanguage] !== '') {
		
		help += `<br /><br />${functionObj.captions[cap][builderLanguage]}`;
	}
	
	cap = `${functionPrefix}FunctionDesc`;
	if(typeof functionObj.captions[cap] !== 'undefined'
		&& typeof functionObj.captions[cap][builderLanguage] !== 'undefined'
		&& functionObj.captions[cap][builderLanguage] !== '') {
		
		help += `<br /><br />${functionObj.captions[cap][builderLanguage]}`;
	}
	return help;
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

export function getItemTitle(attributeId,index,outsideIn,attributeIdNm) {
	let atr = MyStore.getters['schema/attributeIdMap'][attributeId];
	let rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
	
	if(isAttributeRelationship(atr.content) && typeof attributeIdNm !== 'undefined' && attributeIdNm !== null) {
		let atrNm = MyStore.getters['schema/attributeIdMap'][attributeIdNm];
		return `${index} ${rel.name}.${atr.name} -> ${atrNm.name}`;
	}
	return `${index} ${rel.name}.${atr.name}`;
};

export function getItemTitlePath(attributeId) {
	let atr = MyStore.getters['schema/attributeIdMap'][attributeId];
	let rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
	let mod = MyStore.getters['schema/moduleIdMap'][rel.moduleId];
	return `${mod.name}.${rel.name}.${atr.name}`;
};

export function getItemTitleNoRelationship(attributeId,index) {
	let atr = MyStore.getters['schema/attributeIdMap'][attributeId];
	let rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
	return `${index}) ${rel.name}.${atr.name}`;
};

export function getItemTitleColumn(column,withTitle) {
	let name;
	if(column.subQuery) name = `SubQuery`;
	else                name = getItemTitle(column.attributeId,column.index,false,null);
	
	if(withTitle && typeof column.captions.columnTitle[MyStore.getters.settings.languageCode] !== 'undefined')
		name = `${name} (${column.captions.columnTitle[MyStore.getters.settings.languageCode]})`;
	
	return name;
};

export function getItemTitleRelation(relationId,index) {
	return `${index} ${MyStore.getters['schema/relationIdMap'][relationId].name}`;
};