import tinycolor from '../../externals/tinycolor2.js';
import MyStore   from '../../stores/store.js';

export function colorAdjustBgHeader(colorRgb) {
	let c = tinycolor(colorRgb);
	
	if(MyStore.getters.settings.dark)
		c.darken(14).desaturate(12);
	else
		c.darken(5).desaturate(6);
	
	return c.toString();
};

export function colorAdjustBg(colorRgb) {
	// adjust background color in dark mode
	let c = tinycolor(colorRgb);
	if(MyStore.getters.settings.dark)
		c.darken(20).desaturate(20);
	
	return c.toString();
};

export function colorMakeContrastFont(colorRbgBg) {
	// create contrast font color from background color
	let c = tinycolor(colorRbgBg);
	
	if(MyStore.getters.settings.dark) {
		// dark mode always uses bright fonts
		c.lighten(40);
	} else {
		// bright mode uses light fonts on dark backgrounds and the other way around
		if(c.isDark()) c.lighten(40);
		else           c.darken(65);
	}
	return c.toString();
};

export function colorIsDark(colorRbg) {
	return tinycolor(colorRbg).isDark();
};

export function copyValueDialog(captionTop,captionBody,copyClipboardValue) {
	let copy = function() {
		navigator.clipboard.writeText(copyClipboardValue);
	};
	
	MyStore.commit('dialog',{
		captionBody:captionBody,
		captionTop:captionTop,
		buttons:[{
			caption:MyStore.getters.captions.generic.button.copyClipboard,
			exec:copy,
			image:'copyClipboard.png'
		}]
	});
};

export function getBuildFromVersion(fullVersion) {
	let m = fullVersion.match(/\d+\.\d+\.\d+\.(\d+)/);
	
	if(m.length !== 2)
		return false;
	
	return parseInt(m[1]);
};

export function getLinkMeta(display,value) {
	switch(display) {
		case 'email': return { image:'mail.png',  blank:false, href:'mailto:'+value }; break;
		case 'phone': return { image:'phone.png', blank:false, href:'tel:'+value };    break;
		case 'url':   return { image:'link.png',  blank:true,  href:value };           break;
	}
	return false;
};

export function getNilUuid() {
	return '00000000-0000-0000-0000-000000000000';
};

export function isIdNilUuid(id) {
	return id === getNilUuid();
};

export function getRandomInt(min,max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export function getSizeReadable(size) {
	// size is always in kilobytes
	if(size < 1)
		return '<1 Kb';
	
	if(size < 1024)
		return size + ' Kb';
	
	if(size < 1048576)
		return (size / 1024).toFixed(2) + ' Mb';
	
	if(size < 1073741824)
		return (size / 1048576).toFixed(2) + ' Gb';
	
	return (size / 1073741824).toFixed(2) + ' Tb';
};

export function getLineBreaksParsedToHtml(input) {
	return input.replace(/(?:\r\n|\r|\n)/g, '<br />');
};

export function getHtmlStripped(input) {
	let d = new DOMParser().parseFromString(input,'text/html');
	return d.body.textContent || '';
};

export function getStringFilled(val,length,char) {
	val = val.toString();
	
	while(val.length < length)
		val = char + val;
	
	return val;
};

export function objectDeepMerge(target,...sources) {
	if(!sources.length)
		return target;
	
	const isObject = item => (item && typeof item === 'object' && !Array.isArray(item));
	const source   = sources.shift();
	
	if(isObject(target) && isObject(source)) {
		for(const k in source) {
			if(isObject(source[k])) {
				if(!target[k])
					Object.assign(target, { [k]:{} });
				
				objectDeepMerge(target[k], source[k]);
			}
			else {
				Object.assign(target, { [k]:source[k] });
			}
		}
	}
	return objectDeepMerge(target, ...sources);
};

export function openLink(href,blank) {
	window.open(href,blank ? '_blank' : '_self');
};

export function filterIsCorrect(operator,value0,value1) {
	switch(operator) {
		case 'IS NULL':     return value0 === null;  break;
		case 'IS NOT NULL': return value0 !== null;  break;
		case '=':           return value0 == value1; break;
		case '<>':          return value0 != value1; break;
		case '<':           return value0 <  value1; break;
		case '>':           return value0 >  value1; break;
		case '<=':          return value0 <= value1; break;
		case '>=':          return value0 >= value1; break;
		case 'LIKE':        return new RegExp(value0).test(value1); break;
		case 'ILIKE':       return new RegExp(value0,'i').test(value1); break;
	}
	
	// subset operators
	if(['= ANY','<> ALL'].includes(operator)) {
		
		//  = ANY: value0 must be any value of value1 set
		// <> ALL: value0 must not be any value of value1 set
		const isAny = operator === '= ANY';
		
		if(value1 === null || value1.length === 0)
			return isAny ? false : true;
		
		for(const v of value1) {
			if(v == value0)
				return isAny ? true : false;
		}
		return isAny ? false : true;
	}
	
	// array operators
	if(['<@','@>','&&'].includes(operator)) {
		if(value0 === null || value0.length === 0 || value1 === null || value1.length === 0)
			return false;
		
		const isOverlapOp = operator === '&&';
		
		// with @> operator, value0 (left side) must contain all values of value1 (right side)
		// with && operator, any single value must be in both arrays (does not matter which side)
		const arr0 = operator === '@>' ? value0 : value1;
		const arr1 = operator === '@>' ? value1 : value0;
		
		for(const v1 of arr1) {
			let found = false;
			
			for(const v0 of arr0) {
				// value types are inferred
				if(v0 == v1) {
					
					// if overlap operator: any match is enough
					if(isOverlapOp)
						return true;
					
					found = true;
					break;
				}
			}
			
			// non-overlap operator and value is not found, no match
			if(!isOverlapOp && !found)
				return false;
		}
		
		// if overlap operator:  if no values matched so far, no array match
		// non overlap operator: if all values matched so far, array match
		return isOverlapOp ? false : true;
	}
	return false;
};

export function filterOperatorIsSingleValue(operator) {
	return !['= ANY','<> ALL','@>','<@','&&'].includes(operator);
};

export function openDataImageAsNewTag(data) {
	if(data === '')
		return;

	var newTab = window.open();
	newTab.document.write(`<!DOCTYPE html><body><img src="${data}" style="width:100%;max-width:450px;"></body>`);
	newTab.document.close();
};