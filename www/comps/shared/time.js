import {getStringFilled} from './generic.js';

// set both dates to UTC zero to remove issues with DST
export function getDaysBetween(d0,d1) {
	return (getUnixFromDate(getDateAtUtcZero(d1)) - getUnixFromDate(getDateAtUtcZero(d0))) / 86400;
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

export function getUnixFromDate(d) {
	return Math.floor(d.getTime() / 1000);
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

export function applyUnixDateToDatetime(unixDatetime,unixAtUtcMidnight) {
	let dateOld = getDateFromUnix(unixDatetime);
	let dateNew = getDateFromUnix(unixAtUtcMidnight);
	
	// only apply date component to datetime unix
	dateOld.setFullYear(dateNew.getUTCFullYear());
	dateOld.setMonth(dateNew.getUTCMonth());
	dateOld.setDate(dateNew.getUTCDate());
	return getUnixFromDate(dateOld);
};

export function getWeek(dInput) {
	let d = new Date(dInput.valueOf());
	d.setHours(0,0,0,0);
	
	// Thursday in current week decides the year
	d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
	
	// January 4 is always in first week
	let w1 = new Date(d.getFullYear(), 0, 4);
	
	// adjust to Thursday in week 1 and count number of weeks from date to week1
	return 1 + Math.round(
		((d.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7
	);
};

export function getDateFromWeek(week,year) {
	const d        = new Date(year, 0, 1 + (week - 1) * 7);
	const dow      = d.getDay();
	const dIsoWeek = d;
	
	// get the Monday past, and add a week if the day was Friday, Saturday or Sunday
	dIsoWeek.setDate(d.getDate() - dow + 1);
	if(dow > 4)
		dIsoWeek.setDate(dIsoWeek.getDate() + 7);
	
	return dIsoWeek;
};

export function getWeeksInYear(year) {
	let w = getWeek(new Date(year,12,1));
	return w === 1 ? 52 : w;
};