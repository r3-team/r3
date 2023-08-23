import MyCalendarDays     from './calendarDays.js';
import MyCalendarMonth    from './calendarMonth.js';
import {getChoiceFilters} from './shared/form.js';
import {
	getDateFromWeek,
	getUnixFromDate,
	getWeeksInYear,
	getWeek
} from './shared/time.js';
import {
	getCalendarCutOff0,
	getCalendarCutOff1
} from './shared/calendar.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
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
export {MyCalendarDateSelect};

let MyCalendarDateSelect = {
	name:'my-calendar-date-select',
	template:`<my-button image="pagePrev.png"
		@trigger="pageMove(false)"
		:naked="true"
	/>
	<input class="selector date-input" type="text"
		v-if="isMonth || isWeek || isDays"
		v-model="yearInput"
	/>
	<select class="selector date-input"
		v-if="isMonth || isDays"
		v-model="monthInput"
	>
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
	<input class="selector date-input" type="text"
		v-if="isDays"
		v-model="dayInput"
	/>
	<select class="selector"
		v-if="isWeek"
		v-model="weekInput"
	>
		<option v-for="i in weeksInYear" :value="i">
			{{ capApp.option.calendarWeek + ' ' + i }}
		</option>
	</select>
	<my-button image="pageNext.png"
		@trigger="pageMove(true)"
		:naked="true"
	/>`,
	props:{
		daysShow:  { type:Number, required:true },
		modelValue:{ type:Date,   required:true }
	},
	computed:{
		dayInput:{
			get()  { return this.modelValue.getDate(); },
			set(v) {
				let d = new Date(this.modelValue.valueOf());
				d.setDate(v);
				this.$emit('update:modelValue',d);
			}
		},
		monthInput:{
			get()  { return this.modelValue.getMonth(); },
			set(v) {
				let d = new Date(this.modelValue.valueOf());
				
				if(this.isMonth)
					d.setDate(1); // set to 1st to add month correctly
				
				d.setMonth(v);
				this.$emit('update:modelValue',d);
			}
		},
		weekInput:{
			get()  { return this.getWeek(this.modelValue); },
			set(v) {
				let d = new Date(this.modelValue.valueOf());
				d = this.getDateFromWeek(v,d.getFullYear());
				this.$emit('update:modelValue',d);
			}
		},
		yearInput:{
			get()  { return this.modelValue.getFullYear(); },
			set(v) {
				if(v.length !== 4) return;
				
				let d = new Date(this.modelValue.valueOf());
				d.setFullYear(v);
				this.$emit('update:modelValue',d);
			}
		},
		
		// simple
		isDays:     (s) => s.daysShow === 1 || s.daysShow === 3,
		isMonth:    (s) => s.daysShow === 42,
		isWeek:     (s) => s.daysShow === 5 || s.daysShow === 7,
		weeksInYear:(s) => s.isWeek ? s.getWeeksInYear(s.modelValue.getFullYear()) : 0,
		
		// stores
		capApp:(s) => s.$store.getters.captions.calendar
	},
	emits:['update:modelValue'],
	methods:{
		// external
		getDateFromWeek,
		getWeek,
		getWeeksInYear,
		
		// actions
		pageMove(forward) {
			if(this.isMonth)
				return this.monthInput = forward ? this.monthInput + 1 : this.monthInput - 1;
			
			let d = new Date(this.modelValue.valueOf());
			
			// 5-days view (Mo-Fr) moves full week
			let dOffset = this.daysShow !== 5 ? this.daysShow : 7;
			
			d.setDate(d.getDate() + (forward ? dOffset : dOffset - (dOffset * 2)));
			this.$emit('update:modelValue',d);
		}
	}
};

let MyCalendarViewSelect = {
	name:'my-calendar-view-select',
	template:`<my-button image="arrowInside.png"
		v-if="ics"
		@trigger="$emit('toggle-ics')"
		:caption="!isMobile ? capApp.button.ics : ''"
		:captionTitle="capApp.button.icsHint"
	/>
	<select 
		@change="$emit('update:modelValue',parseInt($event.target.value))"
		:value="modelValue"
	>
		<option :value="1">{{ capApp.option.days1 }}</option>
		<option :value="3">{{ capApp.option.days3 }}</option>
		<option :value="5">{{ capApp.option.days5 }}</option>
		<option :value="7">{{ capApp.option.days7 }}</option>
		<option :value="42">{{ capApp.option.days42 }}</option>
	</select>`,
	props:{
		ics:       { type:Boolean, required:true },
		modelValue:{ type:Number,  required:true }
	},
	computed:{
		capApp:  (s) => s.$store.getters.captions.calendar,
		isMobile:(s) => s.$store.getters.isMobile
	},
	emits:['toggle-ics','update:modelValue']
};

let MyCalendar = {
	name:'my-calendar',
	components:{
		MyCalendarDays,
		MyCalendarMonth,
		MyCalendarDateSelect,
		MyCalendarViewSelect
	},
	template:`<div class="calendar" :class="{ isSingleField:isSingleField, overflow:!isMonth }" v-if="ready">
		
		<div class="app-sub-window under-header"
			v-if="showIcs"
			@mousedown.self="showIcs = false"
		>
			<div class="contentBox popUp">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/calendar.png" />
						<div class="caption">{{ capApp.button.icsHint }}</div>
					</div>
					<div class="area">
						<my-button image="cancel.png"
							@trigger="showIcs = false"
							:cancel="true"
						/>
					</div>
				</div>
				<div class="content">
					<div v-if="icsToken === ''" class="row gap default-inputs">
						<input v-model="icsTokenName" :placeholder="capApp.icsTokenNameHint" />
						<my-button image="ok.png"
							@trigger="setIcsTokenFixed"
							:caption="capApp.button.icsPublish"
						/>
					</div>
					
					<template v-if="icsToken !== ''">
						<div class="row gap default-inputs">
							<input class="long" :value="icsUrl" readonly />
							<my-button image="copyClipboard.png"
								@trigger="icsCopyToClipboard"
								:captionTitle="capGen.button.copyClipboard"
							/>
						</div>
						<p>{{ capApp.icsDesc }}</p>
					</template>
				</div>
			</div>
		</div>
		
		<my-calendar-days
			v-if="!isMonth"
			@clipboard="$emit('clipboard')"
			@close-inline="$emit('close-inline')"
			@date-selected="dateSelected"
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
			:daysShow="daysShow"
			:fieldId="fieldId"
			:filters="filters"
			:formLoading="formLoading"
			:hasColor="attributeIdColor !== null"
			:hasCreate="hasCreate"
			:hasOpenForm="hasOpenForm"
			:iconId="iconId"
			:popUpFormInline="popUpFormInline"
			:rows="rows"
		>
			<template #date-select>
				<my-calendar-date-select :daysShow="daysShow" :modelValue="date" @update:modelValue="dateSet" />
			</template>
			<template #view-select>
				<my-calendar-view-select :ics="ics" :modelValue="daysShow" @toggle-ics="showIcs = !showIcs" @update:modelValue="daysShowSet" />
			</template>
		</my-calendar-days>
		
		<my-calendar-month
			v-if="isMonth"
			@close-inline="$emit('close-inline')"
			@date-selected="dateSelected"
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
			:hasOpenForm="hasOpenForm"
			:iconId="iconId"
			:popUpFormInline="popUpFormInline"
			:rows="rows"
		>
			<template #date-select>
				<my-calendar-date-select :daysShow="daysShow" :modelValue="date" @update:modelValue="dateSet" />
			</template>
			<template #view-select>
				<my-calendar-view-select :ics="ics" :modelValue="daysShow" @toggle-ics="showIcs = !showIcs" @update:modelValue="daysShowSet" />
			</template>
		</my-calendar-month>
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
		hasOpenForm:     { type:Boolean, required:false, default:false },
		iconId:          { required:false, default:null },
		ics:             { type:Boolean, required:false, default:false },
		indexColor:      { required:true },
		indexDate0:      { type:Number,  required:true },
		indexDate1:      { type:Number,  required:true },
		isHidden:        { type:Boolean, required:false, default:false },
		isSingleField:   { type:Boolean, required:false, default:false },
		popUpFormInline: { required:true },
		query:           { type:Object,  required:true },
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
			daysShow:42,
			ready:false,
			showIcs:false,
			
			// ICS access
			icsToken:'',
			icsTokenName:'',
			
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
		hasCreate:    (s) => s.query.joins.length === 0 ? false : s.query.joins[0].applyCreate && s.hasOpenForm,
		isDays:       (s) => s.daysShow === 1 || s.daysShow === 3,
		isMonth:      (s) => s.daysShow === 42,
		isWeek:       (s) => s.daysShow === 5 || s.daysShow === 7,
		icsUrl:       (s) => `${location.protocol}//${location.host}/ics/download/cal.ics`
			+ `?field_id=${s.fieldId}&login_id=${s.loginId}&token_fixed=${s.icsToken}`,
		
		// start/end date of calendar
		date0:(s) => s.getCalendarCutOff0(s.daysShow,new Date(s.date.valueOf())),
		date1:(s) => s.getCalendarCutOff1(s.daysShow,new Date(s.date.valueOf()),s.date0),
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic,
		loginId:       (s) => s.$store.getters.loginId,
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
		
		this.daysShow = parseInt(this.fieldOptionGet(this.fieldId,'daysShow',42));
		this.ready = true;
	},
	methods:{
		// externals
		fieldOptionGet,
		fieldOptionSet,
		getCalendarCutOff0,
		getCalendarCutOff1,
		getChoiceFilters,
		getDateFromWeek,
		getQueryExpressions,
		getQueryExpressionsDateRange,
		getQueryFiltersDateRange,
		getRelationsJoined,
		getUnixFromDate,
		getWeek,
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
		dateSelected(unix0,unix1,middleClick) {
			let attributes = [
				`${this.attributeIdDate0}_${unix0}`,
				`${this.attributeIdDate1}_${unix1}`
			];
			this.$emit('open-form',[],[`attributes=${attributes.join(',')}`],middleClick);
		},
		daysShowSet(v) {
			this.daysShow = v;
			this.fieldOptionSet(this.fieldId,'daysShow',v);
			this.reloadInside();
		},
		icsCopyToClipboard() {
			navigator.clipboard.writeText(this.icsUrl);
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
				`daysShow=${this.daysShow}`,
				`year=${this.date.getFullYear()}`
			];
			
			if(this.isMonth || this.isDays) args.push(`month=${this.date.getMonth()}`);
			if(this.isWeek)                 args.push(`week=${this.getWeek(this.date)}`);
			if(this.isDays)                 args.push(`day=${this.date.getDate()}`);
			
			if(this.choiceId !== null)
				args.push(`choice=${this.choiceId}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated() {
			let params = {
				choice:  { parse:'string', value:this.choiceIdDefault },
				daysShow:{ parse:'int',    value:this.daysShow },
				day:     { parse:'int',    value:this.date.getDate() },
				month:   { parse:'int',    value:this.date.getMonth() },
				week:    { parse:'int',    value:this.getWeek(this.date) },
				year:    { parse:'int',    value:this.date.getFullYear() }
			};
			this.routeParseParams(params);
			
			if(this.choiceId !== params.choice.value)   this.choiceId = params.choice.value;
			if(this.daysShow !== params.daysShow.value) this.daysShow = params.daysShow.value;
			
			const dateChanges =
				this.date.getFullYear() !== params.year.value
				|| (this.isMonth && this.date.getMonth()    !== params.month.value)
				|| (this.isWeek  && this.getWeek(this.date) !== params.week.value)
				|| (this.isDays && (
					this.date.getDate()     !== params.day.value
					|| this.date.getMonth() !== params.month.value)
			);
			
			if(dateChanges) {
				let d = new Date(this.date.getTime());
				d.setFullYear(params.year.value);
				
				if(this.isDays || this.isMonth) d.setMonth(params.month.value);
				if(this.isDays)                 d.setDate(params.day.value);
				if(this.isWeek)                 d = this.getDateFromWeek(params.week.value,d.getFullYear());
				
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
		},
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