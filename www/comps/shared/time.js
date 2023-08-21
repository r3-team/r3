import {getStringFilled} from './generic.js';

// set both dates to UTC zero to remove issues with DST
export function getDaysBetween(d0,d1) {
	return Math.floor( (getDateAtUtcZero(d1)-getDateAtUtcZero(d0)) / (1000*60*60*24) );
};

// returns date shifted by local timezone offset (added or removed)
export function getDateShifted(dInput,add) {
	let d = new Date(dInput.getTime());
	if(add) d.setMinutes(d.getMinutes()+d.getTimezoneOffset());
	else    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
	return d;
};

export function getDateFullDayToggled(d,wasFullDay) {
	if(!wasFullDay) return getDateAtUtcZero(d);
	return getDateNoUtcZero(d);
};

export function getDateFormat(d,format) {
	format = format.replace('Y',d.getFullYear());
	format = format.replace('y',(d.getFullYear()+"").substring(2));
	format = format.replace('m',getStringFilled(d.getMonth()+1,2,'0'));
	format = format.replace('d',getStringFilled(d.getDate(),2,'0'));
	format = format.replace('H',getStringFilled(d.getHours(),2,'0'));
	format = format.replace('i',getStringFilled(d.getMinutes(),2,'0'));
	format = format.replace('S',getStringFilled(d.getSeconds(),2,'0'));
	return format;
};

export function getDateFormatNoYear(d,format) {
	format = format.replace('Y','');
	format = format.replace('y','');
	format = format.replace(/[\-\/]+$/,'');
	format = format.replace(/^[\-\/]+/,'');
	
	format = format.replace('m',getStringFilled(d.getMonth()+1,2,'0'));
	format = format.replace('d',getStringFilled(d.getDate(),2,'0'));
	format = format.replace('H',getStringFilled(d.getHours(),2,'0'));
	format = format.replace('i',getStringFilled(d.getMinutes(),2,'0'));
	format = format.replace('S',getStringFilled(d.getSeconds(),2,'0'));
	return format;
};

export function getUnixFromDate(d) {
	return Math.floor(d.getTime() / 1000);
};

export function getDateNoUtcZero(dInput) {
	let d = new Date(dInput.getTime());
	
	// dates are stored as UTC zero
	// to convert to datetime, switch to 12:00:00 local time
	d.setHours(12,0,0);
	
	// if this happens to be UTC zero, set to 13:00
	if(isUnixUtcZero(d.getTime() / 1000))
		d.setHours(13,0,0);
	
	return d;
};

export function getDateAtUtcZero(dInput) {
	let d = new Date(dInput.getTime());
	d.setHours(0,0,0);
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d;
};

export function getUtcTimeStringFromUnix(unixTime) {
	if(unixTime === null) return '';
	
	let d = new Date(unixTime * 1000);
	d.setMinutes(d.getMinutes()+d.getTimezoneOffset());
	return `${getStringFilled(d.getHours(),2,'0')}:` +
		`${getStringFilled(d.getMinutes(),2,'0')}:` +
		`${getStringFilled(d.getSeconds(),2,'0')}`;
};

export function isUnixUtcZero(unixTime) {
	return unixTime % 86400 === 0;
};

export function getUnixShifted(unixTime,add) {
	let d = new Date(unixTime*1000);
	return getUnixFromDate(getDateShifted(d,add));
};

export function getDateFromUnix(unixTime) {
	return new Date(unixTime*1000);
};

export function getUnixFormat(unixTime,format) {
	if(unixTime === null) return '';
	return getDateFormat(new Date(unixTime * 1000),format);
};

export function getUnixNowDate() {
	return getUnixFromDate(getDateAtUtcZero(new Date()));
};

export function getUnixNowDatetime() {
	return getUnixFromDate(new Date());
};

export function getUnixNowTime() {
	let n = new Date();
	let d = new Date(0); // unix at 1970-01-01 00:00:00
	d.setHours(
		d.getHours()   + n.getHours(),
		d.getMinutes() + n.getMinutes(),
		d.getSeconds() + n.getSeconds()
	);
	return getUnixFromDate(d);
};