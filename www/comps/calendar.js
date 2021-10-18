import MyValueRich       from './valueRich.js';
import {srcBase64}       from './shared/image.js';
import {getCaption}      from './shared/language.js';
import {getStringFilled} from './shared/generic.js';
import {
	getCalendarCutOff0,
	getCalendarCutOff1
} from './shared/calendar.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
import {
	getChoiceFilters,
	getColumnIndexesHidden
} from './shared/form.js';
import {
	getDateAtUtcZero,
	getDaysBetween,
	getUnixFromDate,
	isUnixUtcZero
} from './shared/time.js';
import {
	getQueryExpressions,
	getQueryExpressionsDateRange,
	getQueryFiltersDateRange,
	getRelationsJoined
} from './shared/query.js';
import {
	routeChangeFieldReload,
	routeParseParams
} from './shared/router.js';
export {MyCalendar as default};
export {MyCalendarMonth};

let MyCalendarMonth = {
	name:'my-calendar-month',
	components:{MyValueRich},
	template:`<div class="month">
		
		<!-- header -->
		<div class="top lower">
			
			<!-- keep div for flex layout -->
			<div class="area nowrap">
				<my-button image="new.png"
					v-if="hasCreate"
					@trigger="clickRecord(0,false)"
					@trigger-middle="clickRecord(0,true)"
					:caption="!isMobile ? capGen.button.new : ''"
					:captionTitle="capGen.button.newHint"
					:darkBg="true"
				/>
			</div>
		
			<div class="area nowrap navigation default-inputs">
				<img class="icon"
					v-if="iconId !== null"
					:src="srcBase64(iconIdMap[iconId].file)"
				/>
				<my-button image="pagePrev.png"
					@trigger="monthInput -= 1"
					:darkBg="true"
					:naked="true"
				/>
				<input class="selector date-input" type="text"
					v-model="yearInput"
				/>
				<select class="selector date-input" v-model="monthInput">
					<option value="0">01</option>
					<option value="1">02</option>
					<option value="2">03</option>
					<option value="3">04</option>
					<option value="4">05</option>
					<option value="5">06</option>
					<option value="6">07</option>
					<option value="7">08</option>
					<option value="8">09</option>
					<option value="9">10</option>
					<option value="10">11</option>
					<option value="11">12</option>
				</select>
				<my-button image="pageNext.png"
					@trigger="monthInput += 1"
					:darkBg="true"
					:naked="true"
				/>
			</div>
			
			<div class="area nowrap">
				<select class="selector"
					v-if="hasChoices"
					v-model="choiceIdInput"
				>
					<option v-for="c in choices" :value="c.id">
						{{ getCaption(c.captions.queryChoiceTitle,c.name) }}
					</option>
				</select>
				
				<my-button image="arrowInside.png"
					v-if="ics"
					@trigger="showIcs = !showIcs"
					:caption="!isMobile ? capApp.button.ics : ''"
					:captionTitle="capApp.button.icsHint"
					:darkBg="true"
				/>
				
				<my-button image="calendar.png"
					@trigger="goToToday()"
					:caption="!isMobile && !isInput ? capApp.today : ''"
					:captionTitle="capApp.todayHint"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<!-- optional headers -->
		<div class="header-optional ics default-inputs" v-if="showIcs">
		
			<template v-if="icsToken !== ''">
				<input :value="icsUrl" />
				<p>{{ capApp.icsDesc }}</p>
			</template>
			
			<my-button image="ok.png"
				@trigger="setIcsTokenFixed"
				:active="icsToken === ''"
				:caption="capApp.button.icsPublish"
			/>
		</div>
		
		<!-- week day header -->
		<div class="days">
			<div class="item" v-for="day in 7">{{ getWeekDayCaption(day-1) }}</div>
		</div>
		
		<!-- weeks -->
		<div class="week"
			v-for="week in 6"
		>
			<!-- days -->
			<div class="day"
				v-for="day in 7"
				@click.exact="clickDay(((week-1)*7)+day-1,false)"
				@click.shift="clickDay(((week-1)*7)+day-1,true)"
				:class="getDayClasses(((week-1)*7)+day-1,day)"
			>
				<h1 class="noHighlight">{{ getDayNumber(((week-1)*7)+day-1) }}</h1>
			
				<!-- full day events -->
				<div class="event"
					@click.stop="clickRecord(e.recordId,false)"
					@click.middle.stop="clickRecord(e.recordId,true)"
					v-for="e in eventsByDay[((week-1)*7)+day-1].events.filter(v => v.fullDay || v.placeholder)"
					:class="{ first:e.entryFirst, last:e.entryLast, placeholder:e.placeholder, clickable:rowSelect }"
				>
					<template v-if="!e.placeholder">
						<!-- border line -->
						<div class="background"
							:style="getColor('border-bottom-color',e.color)"
						></div>
						
						<!-- caption -->
						<span class="values"
							v-if="day === 1 || e.entryFirst"
							:style="getFullDayTextStyles(day,e)"
						>
							<my-value-rich class="context-calendar"
								v-for="(v,vi) in e.values"
								:attribute-id="columns[vi].attributeId"
								:basis="columns[vi].basis"
								:display="columns[vi].display"
								:key="vi"
								:length="columns[vi].length"
								:value="v"
							/>
						</span>
						
						<!-- ending beam -->
						<div class="ending-beam"
							v-if="e.entryLast"
							:style="getColor('background-color',e.color)"
						></div>
					</template>
				</div>
				
				<!-- partial day events -->
				<div class="part"
					@click.stop="clickRecord(e.recordId,false)"
					@click.middle.stop="clickRecord(e.recordId,true)"
					v-for="e in eventsByDay[((week-1)*7)+day-1].events.filter(v => !v.fullDay && !v.placeholder)"
					:class="{ clickable:rowSelect }"
				>
					<span :style="getColor('background-color',e.color)">
						{{ getPartCaption(e.date0) }}
					</span>
					
					<my-value-rich class="context-calendar"
						v-for="(v,vi) in e.values"
						:attribute-id="columns[vi].attributeId"
						:basis="columns[vi].basis"
						:display="columns[vi].display"
						:key="vi"
						:length="columns[vi].length"
						:wrap="true"
						:value="v"
					/>
				</div>
			</div>
		</div>
		
	</div>`,
	props:{
		choiceId:   { required:false, default:null },
		choices:    { type:Array,   required:false, default:() => [] },
		columns:    { type:Array,   required:false, default:() => [] },
		date:       { type:Date,    required:true },                    // selected date to work around
		date0:      { type:Date,    required:true },                    // start date of calendar
		date1:      { type:Date,    required:true },                    // end date of calendar
		dateSelect0:{ required:false, default:null },
		dateSelect1:{ required:false, default:null },
		iconId:     { required:false, default:null },
		fieldId:    { type:String,  required:false, default:'' },
		filters:    { type:Array,   required:false, default:() => [] },
		formLoading:{ type:Boolean, required:false, default:false },
		ics:        { type:Boolean, required:false, default:false },
		inputTime:  { type:Boolean, required:false, default:false },
		isInput:    { type:Boolean, required:false, default:false },
		hasColor:   { type:Boolean, required:false, default:false },    // color attribute exists
		hasCreate:  { type:Boolean, required:false, default:false },    // has action for creating new record
		rows:       { type:Array,   required:false, default:() => [] },
		rowSelect:  { type:Boolean, required:false, default:false }
	},
	emits:['day-selected','record-selected','set-choice-id','set-date'],
	data:function() {
		return {
			icsToken:'',
			showIcs:false
		};
	},
	computed:{
		// inputs
		choiceIdInput:{
			get:function()  { return this.choiceId; },
			set:function(v) { this.$emit('set-choice-id',v); }
		},
		monthInput:{
			get:function() { return this.date.getMonth(); },
			set:function(v) {
				let d = new Date(this.date.valueOf());
				d.setDate(1); // set to 1st to add month correctly
				d.setMonth(v);
				this.$emit('set-date',d);
			}
		},
		yearInput:{
			get:function() { return this.date.getFullYear(); },
			set:function(v) {
				if(v.length !== 4) return;
				
				let d = new Date(this.date.valueOf());
				d.setFullYear(v);
				this.$emit('set-date',d);
			}
		},
		
		// event values arrive sorted by start date
		// they are processed for display on each day of the calendar
		eventsByDay:function() {
			let days = [];
			
			for(let i = 0; i < 42; i++) {
				days.push({ events:[] });
			}
			
			// each row is one event (partial day, full day or spanning multiple days)
			for(let i = 0, j = this.rows.length; i < j; i++) {
				
				let ev = {
					color:this.hasColor ? this.rows[i].values[2] : null,
					date0:this.rows[i].values[0],
					date1:this.rows[i].values[1],
					entryFirst:true,
					entryLast:false,
					fullDay:false,
					fullDaysLeft:0,
					indexRecordIds:this.rows[i].indexRecordIds,
					placeholder:false,
					recordId:this.rows[i].indexRecordIds['0'],
					values:[]
				};
				
				// add non-hidden values
				let values = this.hasColor ? this.rows[i].values.slice(3) : this.rows[i].values.slice(2);
				for(let i = 0, j = values.length; i < j; i++) {
					
					if(!this.columnIndexesHidden.includes(i))
						ev.values.push(values[i]);
				}
				
				// check for full day event (stored as UTC zero)
				// add timezone offset to display correctly on calendar
				// because DST can be different for each date, we must use their individual offsets
				if(this.isUnixUtcZero(ev.date0) && this.isUnixUtcZero(ev.date1)) {
					ev.date0 += new Date(ev.date0 * 1000).getTimezoneOffset() * 60;
					ev.date1 += new Date(ev.date1 * 1000).getTimezoneOffset() * 60;
					ev.fullDay = true;
					ev.fullDaysLeft = ((ev.date1 - ev.date0) / 86400)+1;
				}
				
				// calculate position from start of calendar
				let dEvent = new Date(ev.date0 * 1000);
				dEvent.setHours(0,0,0); // use midnight
				
				let fullDaysLeft  = ev.fullDaysLeft;
				let daysFromStart = this.getDaysBetween(this.date0,dEvent)+1;
				
				// show first event only if within calendar bounds
				// store position in case we have a multi day event
				let eventPosition;
				
				if(this.dayOffsetWithinBounds(daysFromStart)) {
					eventPosition = days[daysFromStart].events.length;
					days[daysFromStart].events.push(ev);
				}
				else {
					// if event started outside of calendar bounds, use position from first day
					eventPosition = days[0].events.length;
				}
				
				// event is less than 1 day, is only shown once
				if(!ev.fullDay)
					continue;
				
				// place following days
				while(true) {
					
					// check if event reaches into next day
					dEvent.setDate(dEvent.getDate()+1);
					if(dEvent.getTime() / 1000 > ev.date1)
						break;
					
					// get to next day
					daysFromStart++;
					fullDaysLeft--;
					
					// event is outside of bounds, skip
					if(!this.dayOffsetWithinBounds(daysFromStart))
						continue;
					
					// reset event position if it reaches into next week
					if(daysFromStart !== 0 && daysFromStart % 7 === 0)
						eventPosition = days[daysFromStart].events.length;
					
					// add placeholder events to fill empty line space
					while(days[daysFromStart].events.length < eventPosition) {
						days[daysFromStart].events.push({
							placeholder:true
						});
					}
					
					let evNext = JSON.parse(JSON.stringify(ev));
					evNext.entryFirst = false;
					evNext.fullDaysLeft = fullDaysLeft;
					days[daysFromStart].events.push(evNext);
				}
				
				// retroactively mark last day
				if(this.dayOffsetWithinBounds(daysFromStart))
					days[daysFromStart].events[days[daysFromStart].events.length-1].entryLast = true;
			}
			return days;
		},
		
		// helpers
		columnIndexesHidden:function() {
			return this.getColumnIndexesHidden(this.columns);
		},
		daysBefore:function() {
			let d = new Date(this.date.valueOf());
			d.setDate(1);
			return this.getDaysBetween(this.date0,d);
		},
		icsUrl:function() {
			return `${location.protocol}//${location.host}/ics/download/cal.ics`
				+ `?field_id=${this.fieldId}&login_id=${this.loginId}&token_fixed=${this.icsToken}`;
		},
		
		// simple
		daysAfter: function() { return this.date1.getDate(); },
		month:     function() { return this.date.getMonth(); }, // active month (0-11)
		hasChoices:function() { return this.choices.length > 1; },
		
		// stores
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		iconIdMap:     function() { return this.$store.getters['schema/iconIdMap']; },
		capApp:        function() { return this.$store.getters.captions.calendar; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		loginId:       function() { return this.$store.getters.loginId; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getCaption,
		getColumnIndexesHidden,
		getDateAtUtcZero,
		getDaysBetween,
		getStringFilled,
		getUnixFromDate,
		isUnixUtcZero,
		srcBase64,
		
		// actions
		clickDay:function(dayOffset,shift) {
			if(!this.rowSelect) return;
			
			let d = new Date(this.date0.valueOf());
			d.setDate(d.getDate() + dayOffset);
			
			// dates are stored as UTC zero
			this.$emit('day-selected',this.getDateAtUtcZero(d),shift);
		},
		clickRecord:function(recordId,middleClick) {
			if(this.rowSelect)
				this.$emit('record-selected',recordId,null,middleClick);
		},
		goToToday:function() {
			// switch to current month if not there (to show 'today')
			let now = new Date();
			if(now.getMonth() !== this.date.getMonth()
				|| now.getFullYear() !== this.date.getFullYear()) {
				
				return this.$emit('set-date',now);
			}
			
			// if already on current month, select 'today'
			this.$emit('day-selected',this.getDateAtUtcZero(now),false);
		},
		
		// presentation
		dayOffsetWithinBounds:function(day) {
			// currently, calendar is always 42 days
			return day >= 0 && day <= 41;
		},
		getPartCaption:function(date0) {
			let d = new Date(date0 * 1000);
			let h = this.getStringFilled(d.getHours(),2,"0");
			let m = this.getStringFilled(d.getMinutes(),2,"0");
			return `${h}:${m}`;
		},
		getColor:function(styleName,color) {
			if(color !== null) return `${styleName}:#${color};`;
			return '';
		},
		getDayClasses:function(dayOffset,day) {
			let cls = {};
			
			if(this.rowSelect)
				cls.clickable = true;
			
			// today
			let now = new Date();
			cls.today = now.getMonth() === this.date.getMonth()
				&& now.getFullYear() === this.date.getFullYear()
				&& now.getDate() === dayOffset-this.daysBefore+1;
			
			// weekend day?
			if((this.settings.sundayFirstDow && (day === 1 || day === 7))
				|| (!this.settings.sundayFirstDow && (day === 6 || day === 7))) {
				
				cls.weekend = true;
			}
			
			// day outside of current month?
			if(dayOffset < this.daysBefore || dayOffset >= (42-this.daysAfter))
				cls.outside = true;
			
			// day selected
			if(this.dateSelect0 !== null && this.dateSelect1 !== null) {
				
				let d = new Date(this.date0.valueOf());
				d.setDate(d.getDate() + dayOffset);
				
				// compare at UTC zero to remove DST issue
				d         = this.getDateAtUtcZero(d);
				let dSel0 = this.getDateAtUtcZero(this.dateSelect0);
				let dSel1 = this.getDateAtUtcZero(this.dateSelect1);
				
				if(d.valueOf() >= dSel0.valueOf() && d.valueOf() <= dSel1.valueOf())
					cls.selected = true;
			}
			return cls;
		},
		getFullDayTextStyles:function(dayInWeek,event) {
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
		getDayNumber:function(dayOffset) {
			let d = new Date(this.date0.valueOf());
			d.setDate(d.getDate()+(dayOffset));
			return d.getDate();
		},
		getWeekDayCaption:function(dayOffset) {
			
			if(!this.settings.sundayFirstDow) {
				dayOffset++;
				
				if(dayOffset === 7)
					dayOffset = 0;
			}
			
			if(this.isMobile || this.isInput)
				return this.capApp['weekDayShort'+dayOffset];
			
			return this.capApp['weekDay'+dayOffset];
		},
		
		// backend calls
		setIcsTokenFixed:function() {
			let trans = new wsHub.transaction();
			trans.add('login','setTokenFixed',{
				context:'ics'
			},this.setIcsTokenFixedOk);
			trans.send(this.handleError);
		},
		setIcsTokenFixedOk:function(res) {
			this.icsToken = res.payload.tokenFixed;
		}
	}
};

let MyCalendar = {
	name:'my-calendar',
	components:{MyCalendarMonth},
	template:`<div class="calendar" v-if="ready">
		<my-calendar-month class="shade"
			v-if="view === 'month'"
			@day-selected="daySelected"
			@record-selected="(...args) => $emit('record-selected',...args)"
			@set-choice-id="choiceIdSet"
			@set-date="dateSet"
			:choice-id="choiceId"
			:choices="choices"
			:columns="columns"
			:date="date"
			:date0="date0"
			:date1="date1"
			:date-select0="dateSelect0"
			:date-select1="dateSelect1"
			:field-id="fieldId"
			:filters="filters"
			:formLoading="formLoading"
			:has-color="attributeIdColor !== null"
			:has-create="hasCreate"
			:icon-id="iconId"
			:ics="ics"
			:rows="rows"
			:row-select="rowSelect"
		/>
	</div>`,
	props:{
		attributeIdColor:{ required:true },
		attributeIdDate0:{ type:String,  required:true },
		attributeIdDate1:{ type:String,  required:true },
		choices:         { type:Array,   required:false, default:() => [] },
		columns:         { type:Array,   required:true },
		fieldId:         { type:String,  required:false, default:'' },
		filters:         { type:Array,   required:true },
		formLoading:     { type:Boolean, required:false, default:false },
		handleError:     { type:Function,required:true },
		iconId:          { required:false,default:null },
		ics:             { type:Boolean, required:false, default:false },
		indexColor:      { required:true },
		indexDate0:      { type:Number,  required:true },
		indexDate1:      { type:Number,  required:true },
		isFullPage:      { type:Boolean, required:true },
		query:           { type:Object,  required:true },
		rowSelect:       { type:Boolean, required:false, default:false }
	},
	emits:['record-selected','set-args'],
	data:function() {
		return {
			// calendar state
			choiceId:null,
			date:null,        // date base that the calendar moves around (by default now(), at 00:00:00)
			dateSelect0:null, // for date range selection, start date
			dateSelect1:null, // for date range selection, end date
			ready:false,
			view:'month',
			
			// calendar data
			rows:[]
		};
	},
	computed:{
		choiceIdDefault:function() {
			// default is user field option, fallback is first choice in list
			return this.fieldOptionGet(
				this.fieldId,'choiceId',
				this.choices.length === 0 ? null : this.choices[0].id
			);
		},
		expressions:function() {
			// special date range expressions + regular column expressions
			return this.getQueryExpressionsDateRange(
				this.attributeIdDate0,this.indexDate0,
				this.attributeIdDate1,this.indexDate1,
				this.attributeIdColor,this.indexColor
			).concat(this.getQueryExpressions(this.columns));
		},
		hasCreate:function() {
			if(this.query.joins.length === 0) return false;
			return this.query.joins[0].applyCreate && this.rowSelect;
		},
		
		// simple
		choiceFilters:function() { return this.getChoiceFilters(this.choices,this.choiceId); },
		
		// start/end date of calendar
		date0:function() { return this.getCalendarCutOff0(this.view,new Date(this.date.valueOf())) },
		date1:function() { return this.getCalendarCutOff1(this.view,new Date(this.date.valueOf()),this.date0) },
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.calendar; },
		settings:      function() { return this.$store.getters.settings; }
	},
	mounted:function() {
		this.date = new Date();
		this.date.setHours(0,0,0);
		
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(!val) this.reloadOutside();
		});
		this.$watch(() => [this.choices,this.columns,this.filters],(newVals, oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.reloadOutside();
			}
		});
		if(this.isFullPage) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals)) {
					this.paramsUpdated();
					this.reloadOutside();
				}
			});
		}
		
		// if fullpage: set initial states via route parameters
		if(this.isFullPage) {
			this.paramsUpdated();     // load existing parameters from route query
			this.paramsUpdate(false); // overwrite parameters (in case defaults are set)
		} else {
			this.choiceId = this.choiceIdDefault;
		}
		
		this.ready = true;
	},
	methods:{
		// externals
		fieldOptionGet,
		fieldOptionSet,
		getCalendarCutOff0,
		getCalendarCutOff1,
		getChoiceFilters,
		getDaysBetween,
		getQueryExpressions,
		getQueryExpressionsDateRange,
		getQueryFiltersDateRange,
		getRelationsJoined,
		getUnixFromDate,
		routeChangeFieldReload,
		routeParseParams,
		
		// actions
		choiceIdSet:function(choiceId) {
			if(choiceId === this.choiceId) return;
			
			this.fieldOptionSet(this.fieldId,'choiceId',choiceId);
			this.choiceId = choiceId;
			this.reloadInside();
		},
		dateSet:function(d) {
			if(d !== this.date) {
				d.setHours(0,0,0);
				this.date = d;
				this.reloadInside();
			}
		},
		daySelected:function(d,shift) {
			if(!shift) {
				this.dateSelect0 = d;
				this.dateSelect1 = d;
			}
			else {
				if(this.dateSelect0 === null)
					this.dateSelect0 = d;
				
				this.dateSelect1 = d;
			}
			
			let attributes = [
				`${this.attributeIdDate0}_${this.getUnixFromDate(this.dateSelect0)}`,
				`${this.attributeIdDate1}_${this.getUnixFromDate(this.dateSelect1)}`
			];
			this.$emit('record-selected',0,[`attributes=${attributes.join(',')}`],false);
		},
		
		// reloads
		reloadOutside:function() {
			this.get();
		},
		reloadInside:function() {
			// reload full page calendar by updating route parameters
			// enables browser history for fullpage list navigation
			if(this.isFullPage)
				return this.paramsUpdate(true);
			
			this.get();
		},
		
		// page routing
		paramsUpdate:function(pushHistory) {
			let args = [
				`month=${this.date.getMonth()}`,
				`year=${this.date.getFullYear()}`
			];
			
			if(this.choiceId !== null)
				args.push(`choice=${this.choiceId}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated:function() {
			let params = {
				choice:{ parse:'string', value:this.choiceIdDefault },
				month: { parse:'int',    value:this.date.getMonth() },
				year:  { parse:'int',    value:this.date.getFullYear() }
			};
			
			this.routeParseParams(params);
			
			if(this.choiceId !== params['choice'].value)
				this.choiceId = params['choice'].value;
			
			if(this.date.getMonth() !== params['month'].value
				|| this.date.getFullYear() !== params['year'].value) {
				
				let d = new Date(this.date.getTime());
				d.setMonth(params['month'].value);
				d.setFullYear(params['year'].value);
				this.date = d;
			}
		},
		
		// backend calls
		get:function() {
			if(this.query.relationId === null)
				return;
			
			let dateStart = this.getUnixFromDate(this.date0);
			let dateEnd   = this.getUnixFromDate(this.date1);
			
			// when switching date, empty rows
			// otherwise data from wrong month is shown on calendar
			this.rows = [];
			
			// expand date ranges by timezone offset
			// reason: dates are stored as UTC 00:00:00 (timezone removed when stored)
			// January 1.  00:00:00 GMT-3 would start UTC 03:00:00
			// January 31. 00:00:00 GMT+2 would end   UTC 22:00:00 (prev. day)
			let sec = new Date().getTimezoneOffset()*60;
			if(sec < 0) dateEnd   -= sec;
			else        dateStart -= sec;
			
			// sort by start date
			let orders = [{
				attributeId:this.attributeIdDate0,
				index:this.indexDate0,
				ascending:true
			}];
			
			// additional query sorting
			for(let i = 0, j = this.query.orders.length; i < j; i++) {
				orders.push(this.query.orders[i]);
			}
			
			let trans = new wsHub.transactionBlocking();
			trans.add('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.query.joins),
				expressions:this.expressions,
				filters:this.filters.concat(this.getQueryFiltersDateRange(
					this.attributeIdDate0,this.indexDate0,dateStart,
					this.attributeIdDate1,this.indexDate1,dateEnd
				)).concat(this.choiceFilters),
				orders:orders
			},this.getOk);
			trans.send(this.handleError);
		},
		getOk:function(res,req) {
			this.rows = res.payload.rows;
		}
	}
};