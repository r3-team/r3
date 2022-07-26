import isDropdownUpwards from './shared/layout.js';
import {getStringFilled} from './shared/generic.js';
import {MyCalendarMonth} from './calendar.js';
import {
	getCalendarCutOff0,
	getCalendarCutOff1
} from './shared/calendar.js';
import {
	getDateAtUtcZero,
	getDateShifted,
	getDateFullDayToggled,
	getDateNoUtcZero,
	getUnixFromDate,
	isUnixUtcZero
} from './shared/time.js';
export {MyInputDate as default};

let MyInputDateEntryInput = {
	name:'my-input-date-entry-input',
	template:`<input
		v-model="value"
		@change="$emit('update:modelValue',$event.target.value)"
		@keyup.enter.stop="$emit('update:modelValue',$event.target.value)"
		:disabled="isReadonly"
		:placeholder="caption"
		:style="styles"
	/>`,
	props:{
		caption:   { type:String,  required:true },
		isReadonly:{ type:Boolean, required:true },
		modelValue:{ required:true },
		size:      { type:Number,  required:true }
	},
	emits:['update:modelValue'],
	computed:{
		styles:function() {
			return `width:${this.size}em;`;
		},
		value:{
			get:function() { return this.modelValue; },
			set:function() {}
		}
	}
};

let MyInputDateEntry = {
	name:'my-input-date-entry',
	components:{MyInputDateEntryInput},
	template:`<div class="entry date-inputs">
		
		<span v-if="captionPrefix !== ''" class="prefix">
			{{ captionPrefix }}
		</span>
	
		<!-- mobile date inputs -->
		<div class="mobile-inputs" v-if="isMobile">
			<input step="1" type="datetime-local" v-if="isDate && isTime" v-model="valueDatetimeInput" :disabled="isReadonly" />
			<input step="1" type="date" v-if="isDate && !isTime" v-model="valueDateInput" :disabled="isReadonly" />
			<input step="1" type="time" v-if="!isDate && isTime" v-model="valueTimeInput" :disabled="isReadonly" />
		</div>
		
		<!-- non-mobile date inputs -->
		<template v-if="!isMobile && isDate">
			
			<!-- year, month, day - ordered by user setting -->
			<template v-for="i in 5">
				<my-input-date-entry-input
					v-if="i % 2 !== 0"
					@update:modelValue="parseInput(getInputType(i-1),$event)"
					:caption="getInputCaption(i-1)"
					:isReadonly="isReadonly"
					:modelValue="getInputValue(i-1)"
					:size="getInputSize(i-1)"
				/>
				<span v-if="i === 1 || i === 3">{{ inputSeparatorSymbol }}</span>
			</template>
		</template>
		
		<!-- non-mobile time inputs -->
		<template v-if="!isMobile && isTime">
			<span v-if="isDate" class="time-separator"></span>
			
			<my-input-date-entry-input
				@update:modelValue="parseInput('H',$event)"
				:caption="capApp.inputHour"
				:isReadonly="isReadonly"
				:modelValue="hour"
				:size="2"
			/>
			<span>:</span>
			<my-input-date-entry-input
				@update:modelValue="parseInput('M',$event)"
				:caption="capApp.inputMinute"
				:isReadonly="isReadonly"
				:modelValue="minute"
				:size="2"
			/>
			<span>:</span>
			<my-input-date-entry-input
				@update:modelValue="parseInput('S',$event)"
				:caption="capApp.inputSecond"
				:isReadonly="isReadonly"
				:modelValue="second"
				:size="2"
			/>
		</template>
	</div>`,
	props:{
		captionPrefix:{ type:String,  required:false, default:'' },
		isDate:       { type:Boolean, required:false, default:false },
		isTime:       { type:Boolean, required:false, default:false },
		isReadonly:   { type:Boolean, required:false, default:false },
		modelValue:   { required:true }
	},
	emits:['update:modelValue'],
	watch:{
		modelValue:{
			handler:	function(v) {
				// fill input fields if value changed
				if(v === null) {
					this.year   = '';
					this.month  = '';
					this.day    = '';
					this.hour   = '';
					this.minute = '';
					this.second = '';
					return;
				}
				let d = new Date(v * 1000);
				
				// time is handled without zones as UTC
				if(this.isTimeOnly)
					d = this.getDateShifted(d,true);
				
				this.year   = d.getFullYear();
				this.month  = this.getStringFilled(d.getMonth()+1,2,'0');
				this.day    = this.getStringFilled(d.getDate(),2,'0');
				this.hour   = this.getStringFilled(d.getHours(),2,'0');
				this.minute = this.getStringFilled(d.getMinutes(),2,'0');
				this.second = this.getStringFilled(d.getSeconds(),2,'0');
			},
			immediate:true
		}
	},
	data:function() {
		return {
			year:'', month:'',  day:'',
			hour:'', minute:'', second:''
		};
	},
	computed:{
		isTimeOnly:function() {
			return !this.isDate && this.isTime;
		},
		inputSeparatorSymbol:function() {
			if(this.settings.dateFormat.indexOf('/') !== -1)
				return '/';
				
			if(this.settings.dateFormat.indexOf('.') !== -1)
				return '.';
			
			return '-';
		},
		
		/* alternative inputs for mobile devices */
		/* uses datetime-local for native datetime inputs on mobile devices */
		/* works reliably with format 2019-12-31T12:12:00 */
		valueDatetimeInput:{
			get:function() {
				return this.modelValue !== null
					? `${this.year}-${this.month}-${this.day}T${this.hour}:${this.minute}:${this.second}`
					: '';
			},
			set:function(v) {
				let d = new Date(v);
				if(!isNaN(d.getTime()))
					this.$emit('update:modelValue',d.getTime() / 1000);
			}
		},
		valueDateInput:{
			get:function() {
				return this.modelValue !== null
					? `${this.year}-${this.month}-${this.day}`
					: '';
			},
			set:function(v) {
				let d = new Date(v);
				if(!isNaN(d.getTime()))
					this.$emit('update:modelValue',d.getTime() / 1000);
			}
		},
		valueTimeInput:{
			get:function() {
				return this.modelValue !== null
					? `${this.hour}:${this.minute}:${this.second}`
					: '';
			},
			set:function(v) {
				let m = v.match(/^(\d+)\:(\d+)\:(\d+)$/);
				if(m !== null && m.length === 4)
					return this.$emit('update:modelValue',
						(parseInt(m[1]) * 60 * 60) + (parseInt(m[2]) * 60) + parseInt(m[3])
					);
				
				// iOS fix: Safari mobile ignores input steps and shows only hours/minutes
				m = v.match(/^(\d+)\:(\d+)$/);
				if(m !== null && m.length === 3)
					return this.$emit('update:modelValue',
						(parseInt(m[1]) * 60 * 60) + (parseInt(m[2]) * 60)
					);
			}
		},
		
		// stores
		capApp:  function() { return this.$store.getters.captions.input.date; },
		isMobile:function() { return this.$store.getters.isMobile; },
		settings:function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getDateAtUtcZero,
		getDateShifted,
		getStringFilled,
		
		parseInput:function(name,input) {
			let d;
			let p = parseInt(input);
			if(isNaN(p)) return;
			
			if(this.modelValue !== null) {
				// valid value, parse from unix time
				d = new Date(this.modelValue * 1000);
			}
			else {
				if(!this.isTime) {
					// date is not set, apply current date and time to UTC midnight
					d = this.getDateAtUtcZero(new Date());
				}
				else {
					// time is not set, apply UTC zero
					d = new Date(0);
				}
			}
			
			// apply date input value
			switch(name) {
				case 'Y': d.setFullYear(p); break;
				case 'm': d.setMonth(p-1);  break;
				case 'd': d.setDate(p);     break;
				case 'H': d.setHours(p);    break;
				case 'M': d.setMinutes(p);  break;
				case 'S': d.setSeconds(p);  break;
			}
			
			if(this.isTimeOnly) {
				if(name === 'H')
					d = this.getDateShifted(d,false);
				
				// if value > 24 is entered for hour input, date rolls over to next day
				// time values are only allowed to go to 23:59:59 (86399)
				if(Math.floor(d.getTime() / 1000) > 86399)
					d = new Date(86399000);
			}
			
			this.$emit('update:modelValue',Math.floor(d.getTime() / 1000));
		},
		getInputCaption:function(position) {
			switch(this.getInputType(position)) {
				case 'Y': return this.capApp.inputYear;  break;
				case 'm': return this.capApp.inputMonth; break;
				case 'd': return this.capApp.inputDay;   break;
			}
		},
		getInputSize:function(position) {
			return this.getInputType(position) === 'Y' ? 4 : 2;
		},
		getInputType:function(position) {
			return this.settings.dateFormat.substr(position,1);
		},
		getInputValue:function(position) {
			switch(this.getInputType(position)) {
				case 'Y': return this.year;   break;
				case 'm': return this.month;  break;
				case 'd': return this.day;    break;
				case 'H': return this.hour;   break;
				case 'M': return this.minute; break;
			}
		}
	}
};

let MyInputDate = {
	name:'my-input-date',
	components:{
		MyCalendarMonth,
		MyInputDateEntry
	},
	template:`<div class="input-date"
		@blur="$emit('blurred')"
		@focus="$emit('focused')"
		@keyup.esc="escaped"
		v-click-outside="escaped"
	>
		<div class="content-wrap">
			
			<div class="entries">
				<my-input-date-entry
					v-model="unixFromInput"
					:caption-prefix="isRange ? capApp.dateFrom : ''"
					:isDate="isDate"
					:isTime="isTime && !fullDay"
					:isReadonly="isReadonly"
				/>
				
				<my-input-date-entry
					v-if="isRange"
					v-model="unixToInput"
					:caption-prefix="capApp.dateTo"
					:isDate="isDate"
					:isTime="isTime && !fullDay"
					:isReadonly="isReadonly"
				/>
			</div>
			
			<div v-if="!isReadonly" class="actions">
				<!-- full day selector -->
				<my-button
					v-if="isDate && isTime && isRange"
					@trigger="toggleFullDayRange"
					:captionTitle="capApp.fullDayHint"
					:image="fullDay ? 'clockOff.png' : 'clock.png'"
					:naked="true"
				/>
				
				<!-- set null -->
				<my-button image="cancel.png"
					v-if="unixFrom !== null || unixTo !== null"
					@trigger="setNull()"
					:naked="true"
				/>
				
				<!-- toggle calendar -->
				<my-button image="calendar.png"
					v-if="isDate"
					@trigger="toggleCalendar"
					:naked="true"
				/>
			</div>
		</div>
		
		<div class="calendar-wrap calendar"
			v-if="showCalendar"
			:class="{ upwards:showUpwards }"
		>
			<my-calendar-month
				@set-date="date = $event"
				@day-selected="dateSet"
				:class="{ upwards:showUpwards }"
				:date="date"
				:date0="date0"
				:date1="date1"
				:dateSelect0="dateSelect0"
				:dateSelect1="dateSelect1"
				:inputTime="isTime"
				:isInput="true"
				:rowSelect="true"
			/>
		</div>
	</div>`,
	props:{
		isDate:    { type:Boolean, required:false, default:false },
		isTime:    { type:Boolean, required:false, default:false },
		isRange:   { type:Boolean, required:false, default:false },
		isReadonly:{ type:Boolean, required:false, default:false },
		unixFrom:  { required:true },
		unixTo:    { required:false, default:null }
	},
	emits:['blurred','focused','set-unix-from','set-unix-to'],
	data:function() {
		return {
			calendarFresh:false, // new calendar opened, new date range selection
			date:new Date(),     // date to control calendar navigation
			dateSelect0:null,    // for date range selection, start date
			dateSelect1:null,    // for date range selection, end date
			showUpwards:false,   // show calendar dropdown above input
			showCalendar:false
		};
	},
	computed:{
		// full day events start and end at 00:00:00 UTC
		// if used in datetime context, they can only be used in date range,
		//  otherwise regular datetime value can appear as full day event
		fullDay:function() {
			
			// pure dates are always full day
			if(this.isDate && !this.isTime)
				return true;
			
			// pure times are never full day
			if(!this.isDate && this.isTime)
				return false;
			
			// if not pure date, a range is required to allow for full day events
			// otherwise we cannot separate regular from full day events
			if(!this.isRange)
				return false;
			
			// full day if start and end date are not set or UTC 00:00:00
			return (this.unixFrom === null || this.isUnixUtcZero(this.unixFrom))
				&& (this.unixTo   === null || this.isUnixUtcZero(this.unixTo));
		},
		
		// date|time inputs
		unixFromInput:{
			get:function()  { return this.unixFrom; },
			set:function(v) { this.$emit('set-unix-from',v); }
		},
		unixToInput:{
			get:function()  { return this.unixTo; },
			set:function(v) {
				// if to unix is smaller, set to from
				if(v !== null && v < this.unixFromInput)
					v = this.unixFromInput;
				
				this.$emit('set-unix-to',v);
			}
		},
		
		// start/end date of calendar (month input)
		date0:function() { return this.getCalendarCutOff0('month',new Date(this.date.valueOf())) },
		date1:function() { return this.getCalendarCutOff1('month',new Date(this.date.valueOf()),this.date0) },
		
		// stores
		capApp:function() { return this.$store.getters.captions.input.date; }
	},
	methods:{
		// externals
		getCalendarCutOff0,
		getCalendarCutOff1,
		getDateAtUtcZero,
		getDateFullDayToggled,
		getDateNoUtcZero,
		getDateShifted,
		getUnixFromDate,
		isDropdownUpwards,
		isUnixUtcZero,
		
		// events
		escaped:function() {
			this.showCalendar = false;
		},
		focused:function() {
			if(!this.isReadonly && !this.showCalendar)
				this.showCalendar = true;
		},
		updateDropdownDirection:function() {
			let headersPx  = 200; // rough height in px of all headers (menu/form) combined
			let calPx      = 320; // rough height in px of calendar input
			this.showUpwards = this.isDropdownUpwards(this.$el,calPx,headersPx);
		},
		
		// actions
		toggleCalendar:function() {
			if(!this.showCalendar) {
				
				// reset date range selection
				if(this.isRange) {
					this.dateSelect0 = this.unixFrom !== null ? new Date(this.unixFrom * 1000) : null;
					this.dateSelect1 = this.unixTo   !== null ? new Date(this.unixTo   * 1000) : null;
				}
				else {
					// no range, use start date for range start/end
					this.dateSelect0 = this.unixFrom !== null ? new Date(this.unixFrom * 1000) : null;
					this.dateSelect1 = this.unixFrom !== null ? new Date(this.unixFrom * 1000) : null;
				}
				this.calendarFresh = true;
				
				// fresh selection, start calendar in month of start date
				if(this.unixFrom !== null) {
					this.date = new Date(this.unixFrom * 1000);
				}
				else {
					// if start date is empty, set to now
					this.date = new Date();
					
					if(this.fullDay)
						this.date = this.getDateAtUtcZero(this.date);
				}
				
				// decide dropdown direction
				this.updateDropdownDirection();
			}
			this.showCalendar = !this.showCalendar;
		},
		toggleFullDayRange:function() {
			// if range is empty, set both dates to a datetime today
			if(this.unixFrom === null && this.unixTo === null) {
				let unix = this.getUnixFromDate(this.getDateNoUtcZero(new Date()));
				this.unixFromInput = unix;
				this.unixToInput   = unix;
				return;
			}
			
			// toggle dates (if set) between date / datetime
			// emit change (instead of setting unixInput)
			// otherwise timing issue exists: unixToInput < unixFromInput
			if(this.unixFrom !== null)
				this.$emit('set-unix-from',this.getUnixFromDate(this.getDateFullDayToggled(
					new Date(this.unixFrom*1000),this.fullDay)));
			
			if(this.unixTo !== null)
				this.$emit('set-unix-to',this.getUnixFromDate(this.getDateFullDayToggled(
					new Date(this.unixTo*1000),this.fullDay)));
		},
		dateSet:function(dSet,shift) {
			let that = this;
			let apply = function(d,fullDay,unixOld) {
				if(!fullDay) {
					if(unixOld !== null) {
						// keep previous time component
						let dOld = new Date(unixOld * 1000);
						d.setHours(
							dOld.getHours(),
							dOld.getMinutes(),
							dOld.getSeconds()
						);
					}
					else {
						// dates are always UTC zero
						// add offset to make it local zero
						d = that.getDateShifted(d,true);
					}
				}
				return Math.floor(d.getTime() / 1000);
			};
			
			// first date of range or only date
			if(!this.isRange || this.calendarFresh || this.dateSelect0 === null) {
				this.dateSelect0 = dSet;
				this.dateSelect1 = dSet;
				
				this.unixFromInput = apply(dSet,this.fullDay,this.unixFrom);
				this.calendarFresh = false;
				
				if(!this.isRange)
					this.showCalendar = false;
				
				return;
			}
			
			// set second date of range
			this.dateSelect1  = dSet;
			this.unixToInput  = apply(dSet,this.fullDay,this.unixTo);
			this.showCalendar = false;
		},
		setNull:function() {
			this.unixFromInput = null;
			this.unixToInput   = null;
			this.showCalendar  = false;
		}
	}
};