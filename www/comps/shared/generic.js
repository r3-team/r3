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

export function openLink(href,blank) {
	window.open(href,blank ? '_blank' : '_self');
};

export function filterIsCorrect(operator,value0,value1) {
	if(operator === 'IS NULL' && value0 === null)
		return true;
	
	if(operator === 'IS NOT NULL' && value0 !== null)
		return true;
	
	switch(operator) {
		case '=':  return value0 == value1; break;
		case '<>': return value0 != value1; break;
		case '<':  return value0 <  value1; break;
		case '>':  return value0 >  value1; break;
		case '<=': return value0 <= value1; break;
		case '>=': return value0 >= value1; break;
		case 'LIKE':  return new RegExp(value0).test(value1);     break;
		case 'ILIKE': return new RegExp(value0,'i').test(value1); break;
	}
	return false;
};