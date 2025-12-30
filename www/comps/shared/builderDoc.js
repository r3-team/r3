import {getQueryTemplate} from './query.js';

export function getDocPageTemplate() {
	return {
		fieldFlow:getDocFieldTemplate('flowBody'),
		size:'A4',
		orientation:'portrait',
		margin:{t:5,r:3,b:5,l:3},
		footer:{
			active:false,
			docPageIdInherit:null,
			fieldGrid:getDocFieldTemplate('gridFooter')
		},
		header:{
			active:false,
			docPageIdInherit:null,
			fieldGrid:getDocFieldTemplate('gridHeader')
		},
		set:[],
		state:true
	};
};

export function getDocFieldTemplate(content) {
	const getBorderTemplate = () => { return { cell:false, color:'', draw:'', size:0}; };
	const getMarginTemplate = () => { return { t:0, r:0, b:0, l:0 }; };

	let f = {
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