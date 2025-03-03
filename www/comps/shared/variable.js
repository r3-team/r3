import {
	isAttributeBoolean,
	isAttributeFloat,
	isAttributeInteger,
	isAttributeNumeric
} from './attribute.js';
import MyStore from '../../stores/store.js';

export function variableValueGet(variableId,formValues) {
	const v = MyStore.getters['schema/variableIdMap'][variableId];
	if(v === undefined) {
		console.warn(`cannot get value of unknown variable '${variableId}'`);
		return null;
	}

	// get variable value either from local form values (if form assigned) or global values
	const base = v.formId !== null ? formValues : MyStore.getters.variableIdMapGlobal;

	// if variable value is defined take it ('null' is a valid value to return if its set as such)
	if(base[v.id] !== undefined)
		return base[v.id];

	// otherwise return the variable default value (can also be 'null' if not set)
	if(v.def === null)
		return null;

	if(isAttributeBoolean(v.content)) return v.def === 'true' ? true : false;
	if(isAttributeFloat(v.content))   return parseFloat(v.def);
	if(isAttributeInteger(v.content)) return parseInt(v.def);
	if(isAttributeNumeric(v.content)) return parseFloat(v.def);

	return v.def;
};

export function variableValueSet(variableId,value,formValues) {
	const v = MyStore.getters['schema/variableIdMap'][variableId];
	if(v === undefined) {
		console.warn(`cannot set value of unknown variable '${variableId}'`);
		return null;
	}

	// set variable value either to local form values (if form assigned) or global values
	if(v.formId !== null)
		return formValues[v.id] = value;

	return MyStore.commit('variableStoreValueById',{id:variableId,value:value});
};