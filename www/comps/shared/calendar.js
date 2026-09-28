import MyStore from '../../stores/store.js';

// get start date for calendar
export function getCalendarCutOff0(daysShow, date) {

	if (daysShow === 42) // get to first day of current month
		date.setDate(1);

	date.setHours(0, 0, 0);

	// go backwards until we hit the first day of the calendar
	let targetDay = null;
	switch (daysShow) {
		case 5: targetDay = 1; break; // Mo-Fr view, make Monday first day
		case 7:                       // fallthrough, week or month, use first day according to user settings
		case 42: targetDay = MyStore.getters.settings.sundayFirstDow ? 0 : 1; break;
	}

	if (targetDay !== null) {
		for (; date.getDay() !== targetDay; date.setDate(date.getDate() - 1)) { }
	}
	return date;
};

// get end date for calendar
export function getCalendarCutOff1(daysShow, date, dateCutOff0) {
	const d = new Date(dateCutOff0.valueOf());
	d.setDate(d.getDate() + daysShow);
	return d;
};
