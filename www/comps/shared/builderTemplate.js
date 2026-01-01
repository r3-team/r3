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
export function getTemplateForm(moduleId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		fieldIdFocus:null,
		presetIdOpen:null,
		iconId:null,
		name:name,
		noDataActions:false,
		query:getQueryTemplate(),
		fields:[],
		functions:[],
		states:[],
		actions:[],
		articleIdsHelp:[],
		captions:{
			formTitle:{}
		}
	};
};
export function getTemplateJsFunction(moduleId,formId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		formId:formId,
		name:name,
		codeArgs:'',
		codeFunction:'',
		codeReturns:'',
		isClientEventExec:false,
		captions:{
			jsFunctionTitle:{},
			jsFunctionDesc:{}
		}
	};
};
export function getTemplateModule(name) {
	return {
		id:getNilUuid(),
		parentId:null,
		formId:null,
		iconId:null,
		name:name,
		color1:'217A4D',
		position:0,
		releaseBuild:0,
		releaseBuildApp:0,
		releaseDate:0,
		languageMain:'en_us',
		languages:['en_us'],
		dependsOn:[],
		startForms:[],
		articleIdsHelp:[],
		captions:{
			moduleTitle:{}
		}
	};
};
export function getTemplatePgFunction(moduleId,name,template,isTrigger) {
	return  {
		id:getNilUuid(),
		moduleId:moduleId,
		name:name,
		codeArgs:this.getTemplateArgs(template),
		codeFunction:this.getTemplateFnc(template,isTrigger),
		codeReturns:this.getTemplateReturn(isTrigger),
		isFrontendExec:false,
		isLoginSync:template === 'loginSync',
		isTrigger:isTrigger,
		volatility:'VOLATILE',
		schedules:[],
		captions:{
			pgFunctionTitle:{},
			pgFunctionDesc:{}
		}
	};
};
export function getTemplateRelation(moduleId,name,encryption) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		name:name,
		comment:null,
		encryption:encryption,
		retentionCount:null,
		retentionDays:null,
		policies:[]
	};
};
export function getTemplateRole(moduleId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		content:'user',
		name:name,
		assignable:true,
		captions:{},
		childrenIds:[],
		accessApis:{},
		accessAttributes:{},
		accessClientEvents:{},
		accessCollections:{},
		accessMenus:{},
		accessRelations:{}
	};
};
export function getTemplateSearchBar(moduleId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		iconId:null,
		name:name,
		columns:[],
		query:getQueryTemplate(),
		openForm:null,
		captions:{
			searchBarTitle:{}
		}
	};
};
export function getTemplateVariable(moduleId,formId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		formId:formId,
		name:name,
		comment:null,
		content:'text',
		contentUse:'default'
	};
};
export function getTemplateWidget(moduleId,name) {
	return {
		id:getNilUuid(),
		moduleId:moduleId,
		formId:null,
		size:1,
		name:name
	};
};