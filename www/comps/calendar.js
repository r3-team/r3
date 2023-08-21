import MyCalendarDays     from './calendarDays.js';
import MyCalendarMonth    from './calendarMonth.js';
import {getChoiceFilters} from './shared/form.js';
import {getUnixFromDate}  from './shared/time.js';
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

let MyCalendarViewSelect = {
	name:'my-calendar-view-select',
	template:`<select 
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
		modelValue:{ type:Number, required:true }
	},
	computed:{
		capApp:(s) => s.$store.getters.captions.calendar
	},
	emits:['update:modelValue','updated']
};
let MyCalendar = {
	name:'my-calendar',
	components:{
		MyCalendarDays,
		MyCalendarMonth,
		MyCalendarViewSelect
	},
	template:`<div class="calendar" :class="{ isSingleField:isSingleField, overflow:!showsMonth }" v-if="ready">
		<my-calendar-days
			v-if="!showsMonth"
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
			:ics="ics"
			:popUpFormInline="popUpFormInline"
			:rows="rows"
		>
			<template #days-view>
				<my-calendar-view-select v-model="daysShow" @update:modelValue="daysShowChanged" />
			</template>
		</my-calendar-days>
		
		<my-calendar-month
			v-if="showsMonth"
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
			:ics="ics"
			:popUpFormInline="popUpFormInline"
			:rows="rows"
		>
			<template #days-view>
				<my-calendar-view-select v-model="daysShow" @update:modelValue="daysShowChanged" />
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
		iconId:          { required:false,default:null },
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
			ready:false,
			daysShow:42,
			
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
		showsMonth:   (s) => s.daysShow === 42,
		
		// start/end date of calendar
		date0:(s) => s.getCalendarCutOff0(s.daysShow,new Date(s.date.valueOf())),
		date1:(s) => s.getCalendarCutOff1(s.daysShow,new Date(s.date.valueOf()),s.date0),
		
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
		dateSelected(unix0,unix1,middleClick) {
			let attributes = [
				`${this.attributeIdDate0}_${unix0}`,
				`${this.attributeIdDate1}_${unix1}`
			];
			this.$emit('open-form',[],[`attributes=${attributes.join(',')}`],middleClick);
		},
		daysShowChanged(v) {
			this.fieldOptionSet(this.fieldId,'daysShow',v);
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