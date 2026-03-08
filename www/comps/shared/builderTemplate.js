import {getUuidV4} from './crypto.js';
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
		query:getTemplateQuery(),
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
		query:getTemplateQuery(),
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
		query:getTemplateQuery(),
		hidden:false,
		onMobile:true,
		styles:['wrap'],
		captions:{
			columnTitle:{}
		}
	};
};
export function getTemplateDoc(moduleId,language,name) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		author:'',
		language:language,
		name:name,
		comment:null,
		filename:'MyFile.pdf',
		font:{
			align:'LM',
			boolFalse:'no',
			boolTrue:'yes',
			color:null,
			dateFormat:'Y-m-d',
			family:'Roboto',
			lineFactor:1,
			numberSepDec:'.',
			numberSepTho:',',
			size:11,
			style:''
		},
		query:getTemplateQuery(),
		pages:[getTemplateDocPage()],
		states:[],
		sets:[],
		captions:{
			docTitle:{}
		}
	};
};
export function getTemplateDocColumn(attributeId,attributeIndex,subQuery) {
	return {
		id:getUuidV4(),
		attributeId:attributeId,
		attributeIndex:attributeIndex,
		aggregator:null,
		aggregatorRow:null,
		distincted:false,
		groupBy:false,
		length:0,
		query:getTemplateQuery(),
		sizeX:0,
		subQuery:subQuery,
		textPostfix:'',
		textPrefix:'',
		setsBody:[],
		setsFooter:[],
		setsHeader:[],
		captions:{
			docColumnTitle:{}
		}
	};
};
export function getTemplateDocField(content,attributeIndex,attributeId) {
	if(attributeIndex === undefined) attributeIndex = 0;
	if(attributeId    === undefined) attributeId    = null;

	const getBorderTemplate = () => { return { cell:false, color:null, draw:'', size:0, styleCap:'butt', styleJoin:'miter' }; };
	const getMarginTemplate = () => { return { t:0, r:0, b:0, l:0 }; };

	let f = {
		id:getUuidV4(),
		content:content,
		posX:0,
		posY:0,
		sizeX:0,
		sizeY:9,
		sets:[],
		state:true,
		border:getBorderTemplate()
	};
	switch(content) {
		case 'dragDropPreview': break; // for drag&drop
		case 'data':
			f.attributeId    = attributeId;
			f.attributeIndex = attributeIndex;
			f.length         = 0;
			f.textPostfix    = '';
			f.textPrefix     = '';
		break;
		case 'flow':     // fallthrough
        case 'flowBody':
			f.direction = 'column';
			f.fields    = [];
			f.gap       = 0;
			f.padding   = getMarginTemplate();
			f.shrinkY   = false;
		break;
		case 'grid':       // fallthrough
        case 'gridFooter': // fallthrough
        case 'gridHeader':
			f.fields   = [];
			f.shrinkY  = false;
			f.sizeSnap = 3;
			f.sizeY    = 25;
		break;
		case 'list':
			f.bodyBorder           = getBorderTemplate();
			f.BodyRowColorFillEven = null;
			f.BodyRowColorFillOdd  = null;
			f.bodyRowSizeY         = 0;
			f.headerBorder         = getBorderTemplate();
			f.HeaderRowColorFill   = null;
			f.headerRowRepeat      = false;
			f.headerRowShow        = true;
			f.footerBorder         = getBorderTemplate();
			f.footerRowColorFill   = null;

			f.columns = [];
			f.query   = getTemplateQuery();
			f.padding = getMarginTemplate();
		break;
		case 'text':
			f.captions = {
				docFieldText:{}
			}
		break;
	}
	return f;
};
export function getTemplateDocPage() {
	return {
		id:getUuidV4(),
		fieldFlow:getTemplateDocField('flowBody'),
		size:'A4',
		orientation:'portrait',
		margin:{t:24,r:15,b:12,l:15},
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
		sets:[],
		state:true
	};
};
export function getTemplateDocSet(target) {
	return {
		attributeId:null,
		attributeIndex:null,
		target:target,
		value:null
	};
};
export function getTemplateDocState() {
	return {
		id:getUuidV4(),
		description:'',
		conditions:[],
		effects:[]
	};
};
export function getTemplateDocStateCondition() {
	return {
		connector:'AND',
		operator:'=',
		position:0,
		side0:getTemplateDocStateConditionSide(),
		side1:getTemplateDocStateConditionSide()
	};
};
export function getTemplateDocStateConditionSide() {
	return {
		brackets:0,
		content:'value',
		attributeId:null,
		attributeIndex:0,
		presetId:null,
		value:''
	};
};
export function getTemplateDocStateEffect() {
	return {
		docFieldId:null,
		docPageId:null,
		newState:true
	};
};
export function getTemplateFieldButton() {
	return {
		id:getUuidV4(),
		iconId:null,
		jsFunctionId:null,
		content:'button',
		state:'default',
		flags:[],
		openDoc:null,
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
		query:getTemplateQuery(),
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
		field.query         = getTemplateQuery();
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
		query:getTemplateQuery(),
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
		query:getTemplateQuery(),
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
		query:getTemplateQuery()
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
		query:getTemplateQuery(),
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
		query:getTemplateQuery(),
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
		recordTitle:true,
		query:getTemplateQuery(),
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
export function getTemplateFormAction() {
	return {
		id:getUuidV4(),
		color:null,
		iconId:null,
		jsFunctionId:null,
		openDoc:null,
		openForm:null,
		state:'default',
		captions:{
			formActionTitle:{}
		}
	};
};
export function getTemplateFormState() {
	return {
		id:getUuidV4(),
		description:'',
		conditions:[],
		effects:[]
	};
};
export function getTemplateJsFunction(moduleId,formId,name) {
	return {
		id:getUuidV4(),
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
export function getTemplateLoginForm(moduleId) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		attributeIdLogin:null,
		attributeIdLookup:null,
		formId:null,
		name:'',
		captions:{
			loginFormTitle:{}
		}
	};
};
export function getTemplateMenu() {
	return {
		id:getUuidV4(),
		formId:null,
		iconId:null,
		menus:[],
		showChildren:false,
		color:null,
		collections:[],
		captions:{
			menuTitle:{}
		}
	};
};
export function getTemplateMenuTab(moduleId) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		iconId:null,
		menus:[],
		captions:{
			menuTabTitle:{}
		}
	};
};
export function getTemplateModule(name) {
	return {
		id:getUuidV4(),
		parentId:null,
		formId:null,
		iconId:null,
		articleIdsHelp:[],
		name:name,
		color1:'217A4D',
		dependsOn:[],
		languageMain:'en_us',
		languages:['en_us'],
		position:0,
		releaseBuild:0,
		releaseBuildApp:0,
		releaseDate:0,
		releaseLogCategories:['Added','Improved','Fixed'],
		releases:[{build:0,buildApp:0,dateCreated:0,logs:[]}],
		startForms:[],
		captions:{
			moduleTitle:{}
		}
	};
};
export function getTemplateOpenDoc() {
	return {
		docIdOpen:null,
		fieldIdAddTo:null,
		relationIndexOpen:0
	};
};
export function getTemplateOpenForm(forcePopUp) {
	return {
		attributeIdApply:null,
		formIdOpen:null,
		relationIndexApply:-1,
		relationIndexOpen:-1,
		popUpType:forcePopUp ? 'float' : null,
		maxHeight:1000,
		maxWidth:1200
	};
};
export function getTemplatePgFunction(moduleId,name,template,isTrigger) {
	return {
		id:getUuidV4(),
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
export function getTemplatePgFunctionSchedule() {
	return {
		id:getUuidV4(),
		atSecond:0,
		atMinute:0,
		atHour:12,
		atDay:1,
		intervalType:'days',
		intervalValue:3
	};
};
export function getTemplatePgIndex(relationId) {
	return {
		id:getUuidV4(),
		relationId:relationId,
		attributeIdDict:null,
		autoFki:false,
		method:'BTREE',
		noDuplicates:false,
		primaryKey:false,
		attributes:[]
	};
};
export function getTemplatePgTrigger(moduleId,relationId,pgFunctionId) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		relationId:relationId,
		pgFunctionId:pgFunctionId,
		fires:'BEFORE',
		onDelete:false,
		onInsert:true,
		onUpdate:false,
		isConstraint:false,
		isDeferrable:false,
		isDeferred:false,
		perRow:true,
		codeCondition:null
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
export function getTemplatePresetValue(atrId,presetIdRefer,protec,value) {
	return {
		id:getUuidV4(),
		attributeId:atrId,
		presetIdRefer:presetIdRefer,
		protected:protec,
		value:value
	};
};
export function getTemplateQuery() {
	return {
		id:getUuidV4(),
		relationId:null,
		fixedLimit:0,
		joins:[],
		filters:[],
		orders:[],
		lookups:[],
		choices:[]
	};
};
export function getTemplateQueryChoice() {
	return {
		id:getUuidV4(),
		name:'',
		filters:[],
		captions:{
			queryChoiceTitle:{}
		}
	};
};
export function getTemplateQueryFilter() {
	return {
		connector:'AND',
		operator:'=',
		index:0,
		side0:{
			attributeId:null,
			attributeIndex:0,
			attributeNested:0,
			brackets:0,
			collectionId:null,
			columnId:null,
			content:'attribute',
			fieldId:null,
			ftsDict:null,
			query:null,
			queryAggregator:null,
			presetId:null,
			roleId:null,
			value:''
		},
		side1:{
			attributeId:null,
			attributeIndex:0,
			attributeNested:0,
			brackets:0,
			collectionId:null,
			columnId:null,
			content:'value',
			fieldId:null,
			ftsDict:null,
			query:null,
			queryAggregator:null,
			presetId:null,
			roleId:null,
			value:''
		}
	};
};
export function getTemplateRelation(moduleId,name,encryption) {
	return {
		id:getUuidV4(),
		moduleId:moduleId,
		name:name,
		comment:null,
		attributes:[],
		attributeIdsTitle:[],
		encryption:encryption,
		retentionCount:null,
		retentionDays:null,
		policies:[],
		captions:{
			relationTitle:{}
		}
	};
};
export function getTemplateRelationPolicy() {
	return {
		roleId:null,
		pgFunctionIdExcl:null,
		pgFunctionIdIncl:null,
		actionDelete:false,
		actionSelect:false,
		actionUpdate:false
	};
};
export function getTemplateReleaseLog(category) {
	return {
		category,
		content:'',
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
		query:getTemplateQuery(),
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
		name:name,
		size:1
	};
};