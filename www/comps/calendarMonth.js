import MyValueRich              from './valueRich.js';
import {
	colorAdjustBg,
	colorMakeContrastFont,
	getStringFilled
} from './shared/generic.js';
import {
	getDateAtUtcZero,
	getDaysBetween,
	getUnixFromDate,
	isUnixUtcZero
} from './shared/time.js';
export {MyCalendarMonth as default};

let MyCalendarMonth = {
	name:'my-calendar-month',
	components:{MyValueRich},
	template:`<div class="calendar-month">
		
		<!-- week day header -->
		<div class="days">
			<div class="item" v-for="day in 7">{{ getWeekDayCaption(day-1) }}</div>
		</div>
		
		<!-- weeks -->
		<div class="week" v-for="week in 6">
			
			<!-- days -->
			<div class="day"
				v-for="day in 7"
				@mousedown.left="clickDay(eventsByDay[((week-1)*7)+day-1].unix,true)"
				@mouseover="hoverDay(eventsByDay[((week-1)*7)+day-1].unix)"
				@mouseup.left="clickDay(eventsByDay[((week-1)*7)+day-1].unix,false)"
				:class="getDayClasses(((week-1)*7)+day-1,day)"
			>
				<h1 class="noHighlight">{{ getDayNumber(((week-1)*7)+day-1) }}</h1>
				
				<!-- full day events -->
				<div class="event"
					@click.ctrl.exact="clickRecord($event,e.row,true)"
					@click.left.exact="clickRecord($event,e.row,false)"
					@click.middle.exact="clickRecord($event,e.row,true)"
					@mouseup.left="stopBubbleIfRecord($event,!e.placeholder)"
					v-for="e in eventsByDay[((week-1)*7)+day-1].events.filter(v => v.fullDay || v.placeholder)"
					:class="{ first:e.entryFirst, last:e.entryLast, placeholder:e.placeholder, clickable:hasUpdate }"
					:style="e.style"
				>
					<div class="values-wrap" v-if="!e.placeholder" :style="getFullDayTextStyles(day,e)">
						<span class="values" v-if="day === 1 || e.entryFirst">
							<template v-for="(v,i) in e.values">
								<my-value-rich class="context-calendar"
									v-if="v !== null"
									:attributeId="columns[i].attributeId"
									:basis="columns[i].basis"
									:bold="columns[i].flags.bold"
									:boolAtrIcon="columns[i].flags.boolAtrIcon"
									:display="columns[i].display"
									:italic="columns[i].flags.italic"
									:key="i"
									:length="columns[i].length"
									:monospace="columns[i].flags.monospace"
									:value="v"
								/>
							</template>
						</span>
					</div>
				</div>
				
				<!-- partial day events -->
				<div class="part"
					@click.ctrl.exact="clickRecord($event,e.row,true)"
					@click.left.exact="clickRecord($event,e.row,false)"
					@click.middle.exact="clickRecord($event,e.row,true)"
					@mouseup.left="stopBubbleIfRecord($event,true)"
					v-for="e in eventsByDay[((week-1)*7)+day-1].events.filter(v => !v.fullDay && !v.placeholder)"
					:class="{ clickable:hasUpdate }"
				>
					<span :style="e.style">{{ getPartCaption(e.unix0) }}</span>
					
					<template v-for="(v,i) in e.values">
						<my-value-rich class="context-calendar"
							v-if="v !== null"
							:attributeId="columns[i].attributeId"
							:basis="columns[i].basis"
							:bold="columns[i].flags.bold"
							:boolAtrIcon="columns[i].flags.boolAtrIcon"
							:display="columns[i].display"
							:italic="columns[i].flags.italic"
							:key="i"
							:length="columns[i].length"
							:monospace="columns[i].flags.monospace"
							:wrap="true"
							:value="v"
						/>
					</template>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		columns:    { type:Array,   required:false, default:() => [] },
		date:       { type:Date,    required:true },                    // selected date to work around
		date0:      { type:Date,    required:true },                    // start date of calendar
		date1:      { type:Date,    required:true },                    // end date of calendar
		dateSelect0:{ required:false, default:null },
		dateSelect1:{ required:false, default:null },
		isInput:    { type:Boolean, required:false, default:false },
		isRange:    { type:Boolean, required:false, default:false },
		hasColor:   { type:Boolean, required:false, default:false },    // color attribute exists
		hasCreate:  { type:Boolean, required:false, default:false },
		hasUpdate:  { type:Boolean, required:false, default:false },
		rows:       { type:Array,   required:false, default:() => [] }
	},
	emits:['date-selected','open-form'],
	data() {
		return {
			unixInputActive:false,
			unixInput0:null,
			unixInput1:null
		};
	},
	computed:{
		// event values arrive sorted by start date
		// they are processed for display on each day of the calendar
		eventsByDay:(s) => {
			let days = [];
			for(let i = 0; i < 42; i++) {
				days.push({
					events:[],
					unix:s.getUnixFromDate(s.getDateAtUtcZero(s.date0)) + (i * 86400)
				});
			}
			
			const getFullDayPosInDay = function(events) {
				let cnt = 0;
				for(let e of events) {
					if(e.fullDay) cnt++;
				}
				return cnt;
			};
			
			// each row is one event (partial day, full day or spanning multiple days)
			for(let i = 0, j = s.rows.length; i < j; i++) {
				
				const colorThere = s.hasColor && s.rows[i].values[2] !== null;
				const colorBg    = colorThere ? s.colorAdjustBg(s.rows[i].values[2]) : null;
				const colorFont  = colorThere ? s.colorMakeContrastFont(colorBg) : null;
				
				let ev = {
					entryFirst:true,
					entryLast:false,
					fullDay:false,
					fullDaysLeft:0,
					placeholder:false,
					row:s.rows[i],
					style:colorBg === null ? '' : `background-color:${colorBg};color:${colorFont};`,
					unix0:s.rows[i].values[0],
					unix1:s.rows[i].values[1],
					values:[]
				};
				
				// add non-hidden values
				let values = s.hasColor ? s.rows[i].values.slice(3) : s.rows[i].values.slice(2);
				for(let x = 0, y = values.length; x < y; x++) {
					ev.values.push(values[x]);
				}
				
				// check for full day event (stored as UTC zero)
				// add timezone offset to display correctly on calendar
				// because DST can be different for each date, we must use their individual offsets
				if(s.isUnixUtcZero(ev.unix0) && s.isUnixUtcZero(ev.unix1)) {
					ev.unix0 += new Date(ev.unix0 * 1000).getTimezoneOffset() * 60;
					ev.unix1 += new Date(ev.unix1 * 1000).getTimezoneOffset() * 60;
					ev.fullDay = true;
					ev.fullDaysLeft = ((ev.unix1 - ev.unix0) / 86400)+1;
				}
				
				// calculate position from start of calendar
				let dEvent = new Date(ev.unix0 * 1000);
				dEvent.setHours(0,0,0); // use midnight
				
				let daysFromStart = s.getDaysBetween(s.date0,dEvent);
				
				// show first event only if within calendar bounds
				// store position in case we have a multi day event
				let eventPosition;
				
				if(s.dayOffsetWithinBounds(daysFromStart)) {
					eventPosition = getFullDayPosInDay(days[daysFromStart].events);
					days[daysFromStart].events.push(ev);
				}
				else {
					// if event started outside of calendar bounds, use position from first day
					eventPosition = getFullDayPosInDay(days[0].events);
				}
				
				// event is less than 1 day, is only shown once
				if(!ev.fullDay)
					continue;
				
				// place following days
				let fullDaysLeft  = ev.fullDaysLeft;
				while(true) {
					
					// check if event reaches into next day
					dEvent.setDate(dEvent.getDate()+1);
					if(dEvent.getTime() / 1000 > ev.unix1)
						break;
					
					// get to next day
					daysFromStart++;
					fullDaysLeft--;
					
					// event is outside of bounds, skip
					if(!s.dayOffsetWithinBounds(daysFromStart))
						continue;
					
					// reset event position if it reaches into next week
					if(daysFromStart !== 0 && daysFromStart % 7 === 0)
						eventPosition = getFullDayPosInDay(days[daysFromStart].events);
					
					// add placeholder events to fill empty line space
					while(days[daysFromStart].events.length < eventPosition) {
						days[daysFromStart].events.push({
							fullDay:true,
							placeholder:true
						});
					}
					
					let evNext = JSON.parse(JSON.stringify(ev));
					evNext.entryFirst = false;
					evNext.fullDaysLeft = fullDaysLeft;
					days[daysFromStart].events.push(evNext);
				}
				
				// retroactively mark last day
				if(s.dayOffsetWithinBounds(daysFromStart))
					days[daysFromStart].events[days[daysFromStart].events.length-1].entryLast = true;
			}
			return days;
		},
		
		// helpers
		daysBefore:(s) => {
			let d = new Date(s.date.valueOf());
			d.setDate(1);
			return s.getDaysBetween(s.date0,d);
		},
		
		// simple
		daysAfter:     (s) => s.date1.getDate(),
		daysSelectable:(s) => s.hasCreate || s.isInput,
		month:         (s) => s.date.getMonth(), // active month (0-11)
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic,
		isMobile:      (s) => s.$store.getters.isMobile,
		settings:      (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		colorAdjustBg,
		colorMakeContrastFont,
		getDateAtUtcZero,
		getDaysBetween,
		getStringFilled,
		getUnixFromDate,
		isUnixUtcZero,
		
		// actions
		clickDay(unix,mousedown) {
			if(!this.daysSelectable) return;
			
			this.unixInputActive = mousedown;
			if(mousedown) {
				this.unixInput0 = unix;
				this.unixInput1 = unix;
				return;
			}
			
			if(this.unixInput0 !== null && this.unixInput1 !== null)
				this.$emit('date-selected',this.unixInput0,this.unixInput1,false);
			
			this.unixInput0 = null;
			this.unixInput1 = null;
		},
		clickRecord(event,row,middleClick) {
			if(this.hasUpdate)
				this.$emit('open-form',[row],[],middleClick);
		},
		hoverDay(unix) {
			if(!this.isRange || !this.unixInputActive) return;
			
			if(unix < this.unixInput0) this.unixInput0 = unix;
			else                       this.unixInput1 = unix;
		},
		stopBubbleIfRecord(event,isRecord) {
			if(isRecord) event.stopPropagation();
		},
		
		// presentation
		dayOffsetWithinBounds(day) {
			// currently, calendar is always 42 days
			return day >= 0 && day <= 41;
		},
		getPartCaption(unix0) {
			let d = new Date(unix0 * 1000);
			let h = this.getStringFilled(d.getHours(),2,"0");
			let m = this.getStringFilled(d.getMinutes(),2,"0");
			return `${h}:${m}`;
		},
		getDayClasses(dayOffset,day) {
			let cls = {};
			
			if(this.daysSelectable)
				cls.clickable = true;
			
			// today
			let now = new Date();
			cls.today = now.getMonth() === this.date.getMonth()
				&& now.getFullYear()   === this.date.getFullYear()
				&& now.getDate()       === dayOffset-this.daysBefore+1;
			
			// weekend day?
			if((this.settings.sundayFirstDow && (day === 1 || day === 7))
				|| (!this.settings.sundayFirstDow && (day === 6 || day === 7))) {
				
				cls.weekend = true;
			}
			
			// day outside of current month?
			if(dayOffset < this.daysBefore || dayOffset >= (42-this.daysAfter+1))
				cls.outside = true;
			
			// day used as active input
			if(this.unixInput0 !== null && this.unixInput1 !== null) {
				let dDay = new Date(this.date0.valueOf());
				dDay.setDate(dDay.getDate() + dayOffset);
				dDay = this.getDateAtUtcZero(dDay);
				
				let unix = this.getUnixFromDate(dDay);
				if(unix >= this.unixInput0 && unix <= this.unixInput1)
					cls.selected = true;
			}
			
			// day selected
			if(!this.unixInputActive && this.dateSelect0 !== null && this.dateSelect1 !== null) {
				let dDay = new Date(this.date0.valueOf());
				dDay.setDate(dDay.getDate() + dayOffset);
				
				// use calendar day at UTC zero
				dDay = this.getDateAtUtcZero(dDay);
				
				// date selections are UTC zero, can be compared directly
				// datetime selections are not UTC zero, must be converted (also to remove DST issues)
				let dSelIsFullDay = this.isUnixUtcZero(this.getUnixFromDate(this.dateSelect0))
					&& this.isUnixUtcZero(this.getUnixFromDate(this.dateSelect1));
				
				let dSel0 = dSelIsFullDay ? this.dateSelect0 : this.getDateAtUtcZero(this.dateSelect0);
				let dSel1 = dSelIsFullDay ? this.dateSelect1 : this.getDateAtUtcZero(this.dateSelect1);
				
				if(dDay.valueOf() >= dSel0.valueOf() && dDay.valueOf() <= dSel1.valueOf())
					cls.selected = true;
			}
			return cls;
		},
		getFullDayTextStyles(dayInWeek,event) {
			// get maximum length of full day text
			// can span multiple days, if event has multiple days
			let days = event.fullDaysLeft;
			
			// week has 7 days, event can start on any of these days
			// can show text only until last day of week
			let maxDaysAvailable = 7 - dayInWeek + 1;
			
			if(maxDaysAvailable < days)
				days = maxDaysAvailable;
			
			// remove 10% for right padding
			return `max-width:${(days*100)-10}%;`;
		},
		getDayNumber(dayOffset) {
			let d = new Date(this.date0.valueOf());
			d.setDate(d.getDate()+(dayOffset));
			return d.getDate();
		},
		getWeekDayCaption(dayOffset) {
			if(!this.settings.sundayFirstDow) {
				dayOffset++;
				
				if(dayOffset === 7)
					dayOffset = 0;
			}
			
			if(this.isMobile || this.isInput)
				return this.capApp['weekDayShort'+dayOffset];
			
			return this.capApp['weekDay'+dayOffset];
		}
	}
};