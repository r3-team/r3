import {getUuidV4}        from './crypto.js';
import {getNilUuid}       from './generic.js';
import {getQueryTemplate} from './query.js';
import {
	isAttributeBoolean,
	isAttributeRelationship
} from './attribute.js';
import {
	getTemplateArgs,
	getTemplateFnc,
	getTemplateReturn
} from './templates.js';

export function getTemplateApi(moduleId,name) {
	return {
		id:getUuidV4(),
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
export function getTemplateArticle(moduleId) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		name:'',
		captions:{
			articleTitle:{},
			articleBody:{}
		}
	};
};
export function getTemplateAttribute(moduleId,relationId) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		relationId:relationId,
		relationshipId:null,
		iconId:null,
		content:'text',
		contentUse:'default',
		length:0,
		lengthFract:0,
		name:'',
		nullable:true,
		encrypted:false,
		def:'',
		onUpdate:'NO ACTION',
		onDelete:'NO ACTION',
		captions:{
			attributeTitle:{}
		}
	};
};
export function getTemplateClientEvent(moduleId) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		action:'callJsFunction',
		arguments:[],
		event:'onHotkey',
		hotkeyModifier1:'CTRL',
		hotkeyModifier2:null,
		hotkeyChar:null,
		jsFunctionId:null,
		pgFunctionId:null,
		captions:{
			clientEventTitle:{}
		}
	};
};
export function getTemplateCollection(moduleId,name) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		iconId:null,
		name:name,
		columns:[],
		query:getQueryTemplate(),
		inHeader:[]
	};
};
export function getTemplateCollectionConsumer() {
	return {
		id:getUuidV4(),
		collectionId:null,
		columnIdDisplay:null,
		flags:[],
		onMobile:false,
		openForm:null
	};
};
export function getTemplateColumn(attributeId,index,subQuery) {
	return {
		id:getUuidV4(),
		attributeId:attributeId,
		index:index,
		batch:null,
		basis:0,
		length:0,
		display:'default',
		groupBy:false,
		aggregator:null,
		distincted:false,
		subQuery:subQuery,
		query:getQueryTemplate(),
		hidden:false,
		onMobile:true,
		styles:['wrap'],
		captions:{
			columnTitle:{}
		}
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
export function getTemplateFieldButton() {
	return {
		id:getUuidV4(),
		iconId:null,
		jsFunctionId:null,
		content:'button',
		state:'default',
		flags:[],
		openForm:null,
		onMobile:true,
		captions:{
			fieldTitle:{}
		}
	};
};
export function getTemplateFieldCalendar() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'calendar',
		state:'default',
		flags:[],
		onMobile:true,
		attributeIdDate0:null,
		attributeIdDate1:null,
		attributeIdColor:null,
		indexDate0:null,
		indexDate1:null,
		indexColor:null,
		gantt:false,
		ganttSteps:null,
		ics:false,
		dateRange0:0,
		dateRange1:0,
		days:42,
		daysToggle:true,
		openForm:null,
		query:getQueryTemplate(),
		columns:[],
		collections:[]
	};
};
export function getTemplateFieldContainer() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'container',
		state:'default',
		flags:[],
		onMobile:true,
		fields:[],
		direction:'column',
		justifyContent:'flex-start',
		alignItems:'stretch',
		alignContent:'stretch',
		wrap:false,
		grow:1,
		shrink:0,
		basis:0,
		perMin:50,
		perMax:150
	};
};
export function getTemplateFieldData(index,attribute,outsideIn,attributeIdNm) {
	let field = {
		id:getUuidV4(),
		iconId:null,
		content:'data',
		state:'default',
		flags:[],
		onMobile:true,
		attributeId:attribute.id,
		attributeIdAlt:null, // altern. attribute (used for date period)
		index:index,
		presentation:'',
		display:'default',
		def:'',
		defCollection:null,
		min:null,
		max:null,
		regexCheck:null,
		jsFunctionId:null,
		captions:{
			fieldTitle:{},
			fieldHelp:{}
		},
		
		// legacy
		collectionIdDef:null,
		columnIdDef:null
	};
	if(isAttributeBoolean(attribute.content))
		field.def = 'true';

	if(isAttributeRelationship(attribute.content)) {
		field.attributeIdNm = attributeIdNm;
		field.columns       = [];
		field.query         = getQueryTemplate();
		field.filterQuick   = false;
		field.outsideIn     = outsideIn;
		field.defPresetIds  = [];
		field.openForm      = null;
	}
	return field;
};
export function getTemplateFieldGantt() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'calendar',
		state:'default',
		flags:[],
		onMobile:true,
		attributeIdDate0:null,
		attributeIdDate1:null,
		attributeIdColor:null,
		indexDate0:null,
		indexDate1:null,
		indexColor:null,
		gantt:true,
		ganttSteps:'days',
		ics:false,
		dateRange0:0,
		dateRange1:0,
		days:42,
		daysToggle:true,
		openForm:null,
		query:getQueryTemplate(),
		columns:[],
		collections:[]
	};
};
export function getTemplateFieldChart() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'chart',
		state:'default',
		flags:[],
		onMobile:true,
		chartOption:JSON.stringify({
			dataset:{
				source:['filled by app'],
				sourceHeader:false
			},
			legend: {
				orient:'vertical',
				left:'left',
				type:'scroll'
			},
			series:[],
			toolbox:{
				feature:{
					saveAsImage:{ show:true }
				}
			},
			tooltip:{
				trigger:'item'
			},
			xAxis:{
				position:'bottom',
				type:'category'
			},
			yAxis:{
				position:'left',
				type:'value'
			}
		},null,2),
		query:getQueryTemplate(),
		columns:[],
		captions:{
			fieldTitle:{}
		}
	};
};
export function getTemplateFieldHeader() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'header',
		state:'default',
		flags:[],
		onMobile:true,
		size:2,
		captions:{
			fieldTitle:{}
		}
	};
};
export function getTemplateFieldKanban() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'kanban',
		state:'default',
		flags:[],
		onMobile:true,
		columns:[],
		collections:[],
		relationIndexData:null,
		relationIndexAxisX:null,
		relationIndexAxisY:null,
		attributeIdSort:null,
		openForm:null,
		query:getQueryTemplate()
	};
};
export function getTemplateFieldList() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'list',
		state:'default',
		flags:[],
		onMobile:true,
		columns:[],
		collections:[],
		autoRenew:null,
		csvExport:false,
		csvImport:false,
		filterQuick:false,
		layout:'table',
		openForm:null,
		openFormBulk:null,
		captions:{
			fieldTitle:{}
		},
		query:getQueryTemplate(),
		resultLimit:50
	};
};
export function getTemplateFieldTabs() {
	return {
		id:getUuidV4(),
		iconId:null,
		content:'tabs',
		state:'default',
		flags:[],
		onMobile:true,
		captions:{
			fieldTitle:{}
		},
		tabs:[getTemplateTab()]
	};
};
export function getTemplateFieldVariable() {
	return {
		id:getUuidV4(),
		variableId:null,
		jsFunctionId:null,
		iconId:null,
		content:'variable',
		columns:[],
		query:getQueryTemplate(),
		state:'default',
		flags:[],
		onMobile:true,
		captions:{
			fieldTitle:{},
			fieldHelp:{}
		}
	};
};
export function getTemplateForm(moduleId,name) {
	return {
		id:getUuidV4(),
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
		codeArgs:getTemplateArgs(template),
		codeFunction:getTemplateFnc(template,isTrigger),
		codeReturns:getTemplateReturn(isTrigger),
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
export function getTemplatePreset(relationId) {
	return {
		id:getUuidV4(),
		name:'',
		relationId:relationId,
		protected:true,
		values:[]
	};
};
export function getTemplateRelation(moduleId,name,encryption) {
	return {
		id:getUuidV4(),
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
		id:getUuidV4(),
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
		id:getUuidV4(),
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
export function getTemplateTab() {
	return {
		id:getUuidV4(),
		contentCounter:false,
		state:'default',
		fields:[],
		captions:{
			tabTitle:{}
		}
	};
};
export function getTemplateVariable(moduleId,formId,name) {
	return {
		id:getUuidV4(),
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
		id:getUuidV4(),
		moduleId:moduleId,
		formId:null,
		size:1,
		name:name
	};
};