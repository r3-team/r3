import MyInputCollection from './inputCollection.js';
import MyForm            from './form.js';
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
	components:{
		MyInputCollection,
		MyValueRich
	},
	template:`<div class="month">
		
		<!-- header -->
		<div class="top lower">
			
			<!-- keep div for flex layout -->
			<div class="area nowrap">
				<my-button image="new.png"
					v-if="hasCreate"
					@trigger="$emit('open-form',[],[],false)"
					@trigger-middle="$emit('open-form',[],[],true)"
					:caption="!isMobile ? capGen.button.new : ''"
					:captionTitle="capGen.button.newHint"
				/>
			</div>
		
			<div class="area nowrap default-inputs">
				<img class="icon"
					v-if="iconId !== null"
					:src="srcBase64(iconIdMap[iconId].file)"
				/>
				<my-button image="pagePrev.png"
					@trigger="monthInput -= 1"
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
					:naked="true"
				/>
			</div>
			
			<div class="area nowrap default-inputs">
				<my-input-collection class="selector"
					v-for="c in collections"
					@update:modelValue="$emit('set-collection-indexes',c.collectionId,$event)"
					:collectionId="c.collectionId"
					:columnIdDisplay="c.columnIdDisplay"
					:key="c.collectionId"
					:modelValue="collectionIdMapIndexes[c.collectionId]"
					:multiValue="c.multiValue"
				/>
				
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
				/>
				
				<my-button image="calendar.png"
					@trigger="goToToday()"
					:caption="!isMobile && !isInput ? capApp.today : ''"
					:captionTitle="capApp.todayHint"
				/>
			</div>
		</div>
		
		<!-- optional headers -->
		<div class="header-optional ics default-inputs" v-if="showIcs">
			
			<div v-if="icsToken === ''" class="row gap">
				<input v-model="icsTokenName" :placeholder="capApp.icsTokenNameHint" />
				<my-button image="ok.png"
					@trigger="setIcsTokenFixed"
					:caption="capApp.button.icsPublish"
				/>
			</div>
			
			<template v-if="icsToken !== ''">
				<div class="row gap">
					<input :value="icsUrl" readonly />
					<my-button image="copyClipboard.png"
						@trigger="icsCopyToClipboard"
						:captionTitle="capGen.button.copyClipboard"
					/>
				</div>
				<p>{{ capApp.icsDesc }}</p>
			</template>
		</div>
		
		<div class="resultsWrap">
			<div class="results">
				<!-- week day header -->
				<div class="days">
					<div class="item" v-for="day in 7">{{ getWeekDayCaption(day-1) }}</div>
				</div>
				
				<!-- weeks -->
				<div class="week" v-for="week in 6">
					
					<!-- days -->
					<div class="day"
						v-for="day in 7"
						@click.exact="clickDay(((week-1)*7)+day-1,false,false)"
						@click.shift="clickDay(((week-1)*7)+day-1,true,false)"
						@click.middle.exact="clickDay(((week-1)*7)+day-1,false,true)"
						@click.middle.shift="clickDay(((week-1)*7)+day-1,true,true)"
						:class="getDayClasses(((week-1)*7)+day-1,day)"
					>
						<h1 class="noHighlight">{{ getDayNumber(((week-1)*7)+day-1) }}</h1>
						
						<!-- full day events -->
						<div class="event"
							@click="clickRecord($event,e.recordId,e.placeholder,false)"
							@click.middle="clickRecord($event,e.recordId,e.placeholder,true)"
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
									<template v-for="(v,i) in e.values">
										<my-value-rich class="context-calendar"
											v-if="v !== null"
											:attributeId="columns[i].attributeId"
											:basis="columns[i].basis"
											:bold="columns[i].styles.includes('bold')"
											:display="columns[i].display"
											:italic="columns[i].styles.includes('italic')"
											:key="i"
											:length="columns[i].length"
											:value="v"
										/>
									</template>
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
							@click="clickRecord($event,e.recordId,false,false)"
							@click.middle="clickRecord($event,e.recordId,false,true)"
							v-for="e in eventsByDay[((week-1)*7)+day-1].events.filter(v => !v.fullDay && !v.placeholder)"
							:class="{ clickable:rowSelect }"
						>
							<span :style="getColor('background-color',e.color)">
								{{ getPartCaption(e.date0) }}
							</span>
							
							<template v-for="(v,i) in e.values">
								<my-value-rich class="context-calendar"
									v-if="v !== null"
									:attributeId="columns[i].attributeId"
									:basis="columns[i].basis"
									:bold="columns[i].styles.includes('bold')"
									:display="columns[i].display"
									:italic="columns[i].styles.includes('italic')"
									:key="i"
									:length="columns[i].length"
									:wrap="true"
									:value="v"
								/>
							</template>
						</div>
					</div>
				</div>
			</div>
			
			<!-- inline form -->
			<my-form
				v-if="popUpFormInline !== null"
				@close="$emit('close-inline')"
				@record-deleted="$emit('reload')"
				@record-updated="$emit('reload')"
				@records-open="popUpFormInline.recordIds = $event"
				:attributeIdMapDef="popUpFormInline.attributeIdMapDef"
				:formId="popUpFormInline.formId"
				:hasHelp="false"
				:hasLog="false"
				:isPopUp="true"
				:isPopUpFloating="false"
				:moduleId="popUpFormInline.moduleId"
				:recordIds="popUpFormInline.recordIds"
				:style="popUpFormInline.style"
			/>
		</div>
	</div>`,
	props:{
		choiceId:   { required:false, default:null },
		choices:    { type:Array,   required:false, default:() => [] },
		columns:    { type:Array,   required:false, default:() => [] },
		collections:{ type:Array,   required:false, default:() => [] },
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
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
		popUpFormInline:{ required:false, default:null },
		rows:       { type:Array,   required:false, default:() => [] },
		rowSelect:  { type:Boolean, required:false, default:false }
	},
	emits:[
		'close-inline','day-selected','open-form','reload',
		'set-choice-id','set-collection-indexes','set-date'
	],
	data() {
		return {
			icsToken:'',
			icsTokenName:'',
			showIcs:false
		};
	},
	computed:{
		// inputs
		choiceIdInput:{
			get()  { return this.choiceId; },
			set(v) { this.$emit('set-choice-id',v); }
		},
		monthInput:{
			get() { return this.date.getMonth(); },
			set(v) {
				let d = new Date(this.date.valueOf());
				d.setDate(1); // set to 1st to add month correctly
				d.setMonth(v);
				this.$emit('set-date',d);
			}
		},
		yearInput:{
			get() { return this.date.getFullYear(); },
			set(v) {
				if(v.length !== 4) return;
				
				let d = new Date(this.date.valueOf());
				d.setFullYear(v);
				this.$emit('set-date',d);
			}
		},
		
		// event values arrive sorted by start date
		// they are processed for display on each day of the calendar
		eventsByDay:(s) => {
			let days = [];
			
			for(let i = 0; i < 42; i++) {
				days.push({ events:[] });
			}
			
			// each row is one event (partial day, full day or spanning multiple days)
			for(let i = 0, j = s.rows.length; i < j; i++) {
				
				let ev = {
					color:s.hasColor ? s.rows[i].values[2] : null,
					date0:s.rows[i].values[0],
					date1:s.rows[i].values[1],
					entryFirst:true,
					entryLast:false,
					fullDay:false,
					fullDaysLeft:0,
					indexRecordIds:s.rows[i].indexRecordIds,
					placeholder:false,
					recordId:s.rows[i].indexRecordIds['0'],
					values:[]
				};
				
				// add non-hidden values
				let values = s.hasColor ? s.rows[i].values.slice(3) : s.rows[i].values.slice(2);
				for(let x = 0, y = values.length; x < y; x++) {
					if(!s.columnIndexesHidden.includes(x))
						ev.values.push(values[x]);
				}
				
				// check for full day event (stored as UTC zero)
				// add timezone offset to display correctly on calendar
				// because DST can be different for each date, we must use their individual offsets
				if(s.isUnixUtcZero(ev.date0) && s.isUnixUtcZero(ev.date1)) {
					ev.date0 += new Date(ev.date0 * 1000).getTimezoneOffset() * 60;
					ev.date1 += new Date(ev.date1 * 1000).getTimezoneOffset() * 60;
					ev.fullDay = true;
					ev.fullDaysLeft = ((ev.date1 - ev.date0) / 86400)+1;
				}
				
				// calculate position from start of calendar
				let dEvent = new Date(ev.date0 * 1000);
				dEvent.setHours(0,0,0); // use midnight
				
				let fullDaysLeft  = ev.fullDaysLeft;
				let daysFromStart = s.getDaysBetween(s.date0,dEvent)+1;
				
				// show first event only if within calendar bounds
				// store position in case we have a multi day event
				let eventPosition;
				
				if(s.dayOffsetWithinBounds(daysFromStart)) {
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
					if(!s.dayOffsetWithinBounds(daysFromStart))
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
		icsUrl:(s) => `${location.protocol}//${location.host}/ics/download/cal.ics`
			+ `?field_id=${s.fieldId}&login_id=${s.loginId}&token_fixed=${s.icsToken}`,
		
		// simple
		columnIndexesHidden:(s) => s.getColumnIndexesHidden(s.columns),
		daysAfter:          (s) => s.date1.getDate(),
		month:              (s) => s.date.getMonth(), // active month (0-11)
		hasChoices:         (s) => s.choices.length > 1,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		capApp:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic,
		isMobile:      (s) => s.$store.getters.isMobile,
		loginId:       (s) => s.$store.getters.loginId,
		settings:      (s) => s.$store.getters.settings
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyForm = MyForm;
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
		clickDay(dayOffset,shift,middleClick) {
			if(!this.rowSelect) return;
			
			let d = new Date(this.date0.valueOf());
			d.setDate(d.getDate() + dayOffset);
			
			// dates are stored as UTC zero
			this.$emit('day-selected',this.getDateAtUtcZero(d),shift,middleClick);
		},
		clickRecord(event,recordId,placeholder,middleClick) {
			if(placeholder) return;
			
			// block clickDay() event (placeholders must bubble)
			event.stopPropagation();
			
			if(this.rowSelect)
				this.$emit('open-form',(typeof recordId === 'undefined' ? [] : [recordId]),[],middleClick);
		},
		goToToday() {
			// switch to current month if not there (to show 'today')
			let now = new Date();
			if(now.getMonth() !== this.date.getMonth()
				|| now.getFullYear() !== this.date.getFullYear()) {
				
				return this.$emit('set-date',now);
			}
			
			// if already on current month, select 'today'
			if(this.rowSelect)
				this.$emit('day-selected',this.getDateAtUtcZero(now),false,false);
		},
		icsCopyToClipboard() {
			navigator.clipboard.writeText(this.icsUrl);
		},
		
		// presentation
		dayOffsetWithinBounds(day) {
			// currently, calendar is always 42 days
			return day >= 0 && day <= 41;
		},
		getPartCaption(date0) {
			let d = new Date(date0 * 1000);
			let h = this.getStringFilled(d.getHours(),2,"0");
			let m = this.getStringFilled(d.getMinutes(),2,"0");
			return `${h}:${m}`;
		},
		getColor(styleName,color) {
			if(color !== null) return `${styleName}:#${color};`;
			return '';
		},
		getDayClasses(dayOffset,day) {
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
		},
		
		// backend calls
		setIcsTokenFixed() {
			ws.send('login','setTokenFixed',{
				name:this.icsTokenName,
				context:'ics'
			},true).then(
				res => this.icsToken = res.payload.tokenFixed,
				this.$root.genericError
			);
		}
	}
};

let MyCalendar = {
	name:'my-calendar',
	components:{MyCalendarMonth},
	template:`<div class="calendar" :class="{ isSingleField:isSingleField }" v-if="ready">
		<my-calendar-month
			v-if="view === 'month'"
			@close-inline="$emit('close-inline')"
			@day-selected="daySelected"
			@open-form="(...args) => $emit('open-form',...args)"
			@reload="get"
			@set-choice-id="choiceIdSet"
			@set-collection-indexes="(...args) => $emit('set-collection-indexes',...args)"
			@set-date="dateSet"
			:choiceId="choiceId"
			:choices="choices"
			:columns="columns"
			:collections="collections"
			:collectionIdMapIndexes="collectionIdMapIndexes"
			:date="date"
			:date0="date0"
			:date1="date1"
			:dateSelect0="dateSelect0"
			:dateSelect1="dateSelect1"
			:fieldId="fieldId"
			:filters="filters"
			:formLoading="formLoading"
			:hasColor="attributeIdColor !== null"
			:hasCreate="hasCreate"
			:iconId="iconId"
			:ics="ics"
			:popUpFormInline="popUpFormInline"
			:rows="rows"
			:rowSelect="rowSelect"
		/>
	</div>`,
	props:{
		attributeIdColor:{ required:true },
		attributeIdDate0:{ type:String,  required:true },
		attributeIdDate1:{ type:String,  required:true },
		choices:         { type:Array,   required:false, default:() => [] },
		columns:         { type:Array,   required:true },
		collections:     { type:Array,   required:true },
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		fieldId:         { type:String,  required:false, default:'' },
		filters:         { type:Array,   required:true },
		formLoading:     { type:Boolean, required:false, default:false },
		iconId:          { required:false,default:null },
		ics:             { type:Boolean, required:false, default:false },
		indexColor:      { required:true },
		indexDate0:      { type:Number,  required:true },
		indexDate1:      { type:Number,  required:true },
		isHidden:        { type:Boolean, required:false, default:false },
		isSingleField:   { type:Boolean, required:false, default:false },
		popUpFormInline: { required:true },
		query:           { type:Object,  required:true },
		rowSelect:       { type:Boolean, required:false, default:false },
		usesPageHistory: { type:Boolean, required:true }
	},
	emits:['close-inline','open-form','record-count-change','set-args','set-collection-indexes'],
	data() {
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
		// special date range expressions + regular column expressions
		expressions:(s) => s.getQueryExpressionsDateRange(
			s.attributeIdDate0,s.indexDate0,
			s.attributeIdDate1,s.indexDate1,
			s.attributeIdColor,s.indexColor
		).concat(s.getQueryExpressions(s.columns)),
		
		// default is user field option, fallback is first choice in list
		choiceIdDefault:(s) => s.fieldOptionGet(s.fieldId,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		
		// simple
		choiceFilters:(s) => s.getChoiceFilters(s.choices,s.choiceId),
		hasCreate:    (s) => s.query.joins.length === 0 ? false : s.query.joins[0].applyCreate && s.rowSelect,
		
		// start/end date of calendar
		date0:(s) => s.getCalendarCutOff0(s.view,new Date(s.date.valueOf())),
		date1:(s) => s.getCalendarCutOff1(s.view,new Date(s.date.valueOf()),s.date0),
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.calendar,
		settings:      (s) => s.$store.getters.settings
	},
	mounted() {
		this.date = new Date();
		this.date.setHours(0,0,0);
		
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(!val) this.reloadOutside();
		});
		this.$watch('isHidden',(val) => {
			if(!val) this.reloadOutside();
		});
		this.$watch(() => [this.choices,this.columns,this.filters],(newVals, oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.reloadOutside();
			}
		});
		if(this.usesPageHistory) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals)) {
					this.paramsUpdated();
					this.reloadOutside();
				}
			});
		}
		
		if(this.usesPageHistory) {
			// set initial states via route parameters
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
		choiceIdSet(choiceId) {
			if(choiceId === this.choiceId) return;
			
			this.fieldOptionSet(this.fieldId,'choiceId',choiceId);
			this.choiceId = choiceId;
			this.reloadInside();
		},
		dateSet(d) {
			if(d !== this.date) {
				d.setHours(0,0,0);
				this.date = d;
				this.reloadInside();
			}
		},
		daySelected(d,shift,middleClick) {
			if(!shift) {
				this.dateSelect0 = d;
				this.dateSelect1 = d;
			}
			else {
				if(this.dateSelect0 === null)
					return this.dateSelect0 = d;
				
				this.dateSelect1 = d;
			}
			
			let attributes = [
				`${this.attributeIdDate0}_${this.getUnixFromDate(this.dateSelect0)}`,
				`${this.attributeIdDate1}_${this.getUnixFromDate(this.dateSelect1)}`
			];
			this.$emit('open-form',[],[`attributes=${attributes.join(',')}`],middleClick);
			this.dateSelect0 = null;
			this.dateSelect1 = null;
		},
		
		// reloads
		reloadOutside() {
			this.get();
		},
		reloadInside() {
			// reload full page calendar by updating route parameters
			// enables browser history for fullpage navigation
			if(this.usesPageHistory)
				return this.paramsUpdate(true);
			
			this.get();
		},
		
		// page routing
		paramsUpdate(pushHistory) {
			let args = [
				`month=${this.date.getMonth()}`,
				`year=${this.date.getFullYear()}`
			];
			
			if(this.choiceId !== null)
				args.push(`choice=${this.choiceId}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated() {
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
		get() {
			if(this.query.relationId === null || this.isHidden)
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
			
			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.query.joins),
				expressions:this.expressions,
				filters:this.filters.concat(this.getQueryFiltersDateRange(
					this.attributeIdDate0,this.indexDate0,dateStart,
					this.attributeIdDate1,this.indexDate1,dateEnd
				)).concat(this.choiceFilters),
				orders:orders
			},true).then(
				res => {
					this.rows = res.payload.rows;
					this.$emit('record-count-change',this.rows.length);
				},
				this.$root.genericError
			);
		}
	}
};