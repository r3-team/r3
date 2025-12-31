import {getUuidV4}        from './crypto.js';
import {getNilUuid}       from './generic.js';
import {getQueryTemplate} from './query.js';

export function getTemplateApi(moduleId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		name:name,
		comment:null,
		columns:[],
		query:getQueryTemplate(),
		hasDelete:false,
		hasGet:true,
		hasPost:false,
		limitDef:100,
		limitMax:1000,
		verboseDef:true,
		version:1
	};
};

export function getTemplateCollection(moduleId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		iconId:null,
		name:name,
		columns:[],
		query:getQueryTemplate(),
		inHeader:[]
	};
};

export function getTemplateDoc(moduleId,name) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		name:name,
		comment:null,
		font:{
			align:'L',
			boolFalse:'no',
			boolTrue:'yes',
			color:'',
			dateFormat:'Y-m-d',
			family:'Roboto',
			lineFactor:1,
			numberSepDec:'.',
			numberSepTho:',',
			size:11,
			style:''
		},
		query:getQueryTemplate(),
		pages:[getTemplateDocPage()],
		states:[],
		set:[],
		captions:{
			docTitle:{}
		}
	};
};

export function getTemplateDocPage() {
	return {
		id:getUuidV4(),
		fieldFlow:getTemplateDocField('flowBody'),
		size:'A4',
		orientation:'portrait',
		margin:{t:5,r:3,b:5,l:3},
		footer:{
			active:false,
			docPageIdInherit:null,
			fieldGrid:getTemplateDocField('gridFooter')
		},
		header:{
			active:false,
			docPageIdInherit:null,
			fieldGrid:getTemplateDocField('gridHeader')
		},
		set:[],
		state:true
	};
};

export function getTemplateDocField(content) {
	const getBorderTemplate = () => { return { cell:false, color:'', draw:'', size:0}; };
	const getMarginTemplate = () => { return { t:0, r:0, b:0, l:0 }; };

	let f = {
		id:getUuidV4(),
		content:content,
		posX:0,
		posY:0,
		sizeX:0,
		sizeY:0,
		set:[],
		state:true,
		border:getBorderTemplate()
	};
	switch(content) {
		case 'data':
			f.attributeId    = null;
			f.attributeIndex = 0;
		break;
		case 'flow':     // fallthrough
        case 'flowBody':
			f.fields  = [];
			f.gap     = 1;
			f.padding = getMarginTemplate();
		break;
		case 'grid':       // fallthrough
        case 'gridFooter': // fallthrough
        case 'gridHeader':
			f.fields = [];
			f.shrink = false;
		break;
		case 'list':
			f.bodyBorder        = getBorderTemplate();
			f.BodyColorFillEven = null;
			f.BodyColorFillOdd  = null;
			f.headerBorder      = getBorderTemplate();
			f.HeaderColorFill   = null;
			f.headerRepeat      = false;
			f.footerBorder      = getBorderTemplate();
			f.footerColorFill   = null;

			f.columns = [];
			f.query   = getQueryTemplate();
			f.padding = getMarginTemplate();
		break;
		case 'text':
			f.value = '';
		break;
	}
	return f;
};