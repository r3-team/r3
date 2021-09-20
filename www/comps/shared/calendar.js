import MyStore          from '../../stores/store.js';
import {getDaysBetween} from './time.js';

// get start date for calendar
export function getCalendarCutOff0(view,date) {
	switch(view) {
		case 'month': // first sunday/monday visible in a month view
			date.setDate(1);
			date.setHours(0,0,0);
			
			// go backwards until we hit the first day of the calendar
			let targetDay = MyStore.getters.settings.sundayFirstDow ? 0 : 1;
			for(; date.getDay() !== targetDay; date.setDate(date.getDate()-1)) {}
		break;
	}
	return date;
};

// get end date for calendar
export function getCalendarCutOff1(view,date,dateCutOff0) {
	switch(view) {
		case 'month': // last day visible in a month view with 6 weeks
		
			// jump to next month and select date=0 (last day of prev. month)
			
			// set date to 1st of active month
			// otherwise setMonth+1 adds 2 months on 31. if next month has only 30 days
			date.setDate(1);
			date.setMonth(date.getMonth()+1);
			date.setDate(0);         // set to last day of prev. month
			date.setHours(23,59,59); // set last second of day (to get all events within date)
			
			// go forwards until we hit the last day of the calendar
			let targetDay = MyStore.getters.settings.sundayFirstDow ? 6 : 0;
			for(; date.getDay() !== targetDay; date.setDate(date.getDate()+1)) {}
			
			// add week(s) until calendar is always 6 weeks long (42 days)
			for(; getDaysBetween(dateCutOff0,date)+1 < 42; date.setDate(date.getDate()+7)) {}
		break;
	}
	return date;
};