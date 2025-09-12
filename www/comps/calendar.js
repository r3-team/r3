import MyCalendarDays     from './calendarDays.js';
import MyCalendarMonth    from './calendarMonth.js';
import MyForm             from './form.js';
import MyInputCollection  from './inputCollection.js';
import {checkDataOptions} from './shared/generic.js';
import {srcBase64}        from './shared/image.js';
import {getCaption}       from './shared/language.js';
import {
	getDateAtUtcZero,
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

const MyCalendarDateSelect = {
	name:'my-calendar-date-select',
	template:`<div class="calendar-select row gap">
		<my-button image="pagePrev.png"
			@trigger="pageMove(false)"
			:naked="true"
		/>
		<input class="selector date-input medium" type="text"
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
		<input class="selector date-input short" type="text"
			v-if="isDays"
			v-model="dayInput"
		/>
		<select class="selector date-input"
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
		/>
	</div>`,
	props:{
		daysShow:  { type:Number,  required:true },
		modelValue:{ type:Date,    required:true },
		useHotkeys:{ type:Boolean, required:false, default:false }
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
	mounted() {
		if(this.useHotkeys)
			window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		if(this.useHotkeys)
			window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// external
		getDateFromWeek,
		getWeek,
		getWeeksInYear,
		
		// actions
		handleHotkeys(e) {
			switch(e.key) {
				case 'ArrowLeft':  this.pageMove(false); break;
				case 'ArrowRight': this.pageMove(true);  break;
			}
		},
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

const MyCalendar = {
	name:'my-calendar',
	components:{
		MyCalendarDays,
		MyCalendarMonth,
		MyCalendarDateSelect,
		MyInputCollection
	},
	template:`<div class="calendar" :class="{ isSingleField:isSingleField, overflow:!isMonth }" v-if="ready">
		
		<div class="app-sub-window under-header"
			v-if="showIcs"
			@mousedown.self="showIcs = false"
		>
			<div class="contentBox float">
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
				<div class="content column gap default-inputs">
					<input
						v-model="icsTokenName"
						v-focus
						:disabled="icsToken !== ''"
						:placeholder="capApp.icsTokenNameHint"
					/>
					<div v-if="icsToken === ''">
						<my-button image="ok.png"
							@trigger="setIcsTokenFixed"
							:caption="capApp.button.icsPublish"
						/>
					</div>
					
					<template v-if="icsToken !== ''">
						<div class="row gap">
							<input readonly :value="icsUrl" />
							<my-button image="copyClipboard.png"
								@trigger="icsCopyToClipboard"
								:captionTitle="capGen.button.copyClipboard"
							/>
						</div>
						<span>{{ capApp.icsDesc }}</span>
					</template>
				</div>
			</div>
		</div>
		
		<!-- header -->
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="new.png"
					v-if="hasCreate"
					@trigger="$emit('open-form',[],[],false)"
					@trigger-middle="$emit('open-form',[],[],true)"
					:caption="isMobile ? '' : capGen.button.new"
					:captionTitle="capGen.button.newHint"
				/>
			</div>
			
			<div class="area nowrap default-inputs">
				<img class="icon"
					v-if="iconId !== null"
					:src="srcBase64(iconIdMap[iconId].file)"
				/>
				<my-calendar-date-select
					:daysShow="daysShow"
					:modelValue="date"
					:useHotkeys="isSingleField"
					@update:modelValue="dateSet"
				/>
			</div>
			
			<div class="area nowrap default-inputs">
				
				<template v-if="!isMobile && !isMonth">
					<my-button image="search.png"
						@trigger="$emit('set-login-option','zoom',zoomDefault)"
						:active="zoom !== zoomDefault"
						:captionTitle="capGen.button.zoomReset"
						:naked="true"
					/>
					<input class="zoomSlider" type="range" min="2" max="8"
						@change="$emit('set-login-option','zoom',parseInt($event.target.value))"
						:value="zoom"
					/>
				</template>
				
				<my-button image="refresh.png"
					v-if="!isMobile"
					@trigger="get"
					:captionTitle="capGen.button.refresh"
					:naked="true"
				/>
				
				<my-input-collection class="selector"
					v-for="c in collections"
					@update:modelValue="$emit('set-collection-indexes',c.collectionId,$event)"
					:collectionId="c.collectionId"
					:columnIdDisplay="c.columnIdDisplay"
					:key="c.collectionId"
					:modelValue="collectionIdMapIndexes[c.collectionId]"
					:multiValue="c.flags.includes('multiValue')"
					:previewCount="isMobile ? 0 : 2"
				/>
				
				<select class="selector" v-if="hasChoices" :value="choiceId" @change="$emit('set-login-option','choiceId',$event.target.value)">
					<option v-for="c in choices" :value="c.id">
						{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
					</option>
				</select>
				
				<select
					v-if="daysShowToggle"
					@change="$emit('set-login-option','daysShow',parseInt($event.target.value))"
					:value="daysShow"
				>
					<option :value="1">{{ capApp.option.days1 }}</option>
					<option :value="3">{{ capApp.option.days3 }}</option>
					<option :value="5">{{ capApp.option.days5 }}</option>
					<option :value="7">{{ capApp.option.days7 }}</option>
					<option :value="42">{{ capApp.option.days42 }}</option>
				</select>
				<my-button image="arrowInside.png"
					v-if="ics"
					@trigger="showIcs = !showIcs"
					:caption="!isMobile ? capApp.button.ics : ''"
					:captionTitle="capApp.button.icsHint"
				/>
				<my-button image="calendarDot.png"
					v-if="!isMobile"
					@trigger="goToToday"
					:caption="!isMobile ? capApp.today : ''"
					:captionTitle="capApp.todayHint"
				/>
			</div>
		</div>
		
		<div class="calendar-content">
			<my-calendar-days class="scroll"
				v-if="!isMonth"
				@clipboard="$emit('clipboard')"
				@date-selected="dateSelected"
				@open-form="(...args) => $emit('open-form',...args)"
				:columns="columns"
				:date="date"
				:date0="date0"
				:date1="date1"
				:daysShow="daysShow"
				:hasColor="attributeIdColor !== null"
				:hasCreate="hasCreate"
				:hasUpdate="hasUpdate"
				:isRange="true"
				:rows="rows"
				:zoom="zoom"
			/>
			<my-calendar-month class="scroll"
				v-if="isMonth"
				@date-selected="dateSelected"
				@open-form="(...args) => $emit('open-form',...args)"
				:columns="columns"
				:date="date"
				:date0="date0"
				:date1="date1"
				:dateSelect0="dateSelect0"
				:dateSelect1="dateSelect1"
				:hasColor="attributeIdColor !== null"
				:hasCreate="hasCreate"
				:hasUpdate="hasUpdate"
				:isRange="true"
				:rows="rows"
			/>
			
			<!-- inline form -->
			<my-form class="inline"
				v-if="popUpFormInline !== null"
				@close="$emit('close-inline')"
				@record-deleted="get"
				@record-updated="get"
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
		attributeIdColor:{ required:true },
		attributeIdDate0:{ type:String,  required:true },
		attributeIdDate1:{ type:String,  required:true },
		choices:         { type:Array,   required:false, default:() => [] },
		columns:         { type:Array,   required:true },
		collections:     { type:Array,   required:true },
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		dataOptions:     { type:Number,  required:false, default:0 },
		daysShowDef:     { type:Number,  required:true },
		daysShowToggle:  { type:Boolean, required:true },
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
		loadWhileHidden: { type:Boolean, required:false, default:false },
		loginOptions:    { type:Object,  required:true },
		moduleId:        { type:String,  required:true },
		popUpFormInline: { required:true },
		query:           { type:Object,  required:true },
		usesPageHistory: { type:Boolean, required:true }
	},
	emits:['close-inline','open-form','record-count-change','set-args','set-collection-indexes','set-login-option'],
	data() {
		return {
			// calendar state
			date:null,        // date base that the calendar moves around (by default now(), at 00:00:00)
			dateSelect0:null, // for date range selection, start date
			dateSelect1:null, // for date range selection, end date
			ready:false,
			showIcs:false,
			zoomDefault:5,
			
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
		
		// simple
		hasChoices:(s) => s.choices.length > 1,
		hasCreate: (s) => s.checkDataOptions(4,s.dataOptions) && s.query.joins.length !== 0 && s.query.joins[0].applyCreate && s.hasOpenForm,
		hasUpdate: (s) => s.checkDataOptions(2,s.dataOptions) && s.query.joins.length !== 0 && s.query.joins[0].applyUpdate && s.hasOpenForm,
		isDays:    (s) => s.daysShow === 1 || s.daysShow === 3,
		isMonth:   (s) => s.daysShow === 42,
		isWeek:    (s) => s.daysShow === 5 || s.daysShow === 7,
		icsUrl:    (s) => `${location.protocol}//${location.host}/ics/download/cal.ics?field_id=${s.fieldId}&login_id=${s.loginId}&token_fixed=${s.icsToken}`,
		
		// start/end date of calendar
		date0:(s) => s.getCalendarCutOff0(s.daysShow,new Date(s.date.valueOf())),
		date1:(s) => s.getCalendarCutOff1(s.daysShow,new Date(s.date.valueOf()),s.date0),

		// login options
		choiceId:(s) => s.$root.getOrFallback(s.loginOptions,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		daysShow:(s) => !s.daysShowToggle ? s.daysShowDef : s.$root.getOrFallback(s.loginOptions,'daysShow',s.daysShowDef),
		zoom:    (s) => s.$root.getOrFallback(s.loginOptions,'zoom',s.zoomDefault),
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
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
	mounted() {
		// initialize dates (most occur before initial paramsUpdated())
		this.date = new Date();
		this.date.setHours(0,0,0);

		// setup watchers
		this.$watch('formLoading',v => { if(!v) this.get(); });
		this.$watch('isHidden',v => { if(!v) this.get(); });
		this.$watch('columns',(valOld,valNew) => {
			if(JSON.stringify(valOld) !== JSON.stringify(valNew)) {
				this.rows = [];
				this.get();
			}
		});
		this.$watch(() => [this.choices,this.daysShow,this.filters],(newVals, oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.get();
			}
		});
		if(this.usesPageHistory) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals))
					this.paramsUpdated(true);
			});

			// load initial route parameters
			this.paramsUpdated(false);
		}
		this.ready = true;
	},
	methods:{
		// externals
		checkDataOptions,
		getCalendarCutOff0,
		getCalendarCutOff1,
		getCaption,
		getDateAtUtcZero,
		getDateFromWeek,
		getQueryExpressions,
		getQueryExpressionsDateRange,
		getQueryFiltersDateRange,
		getRelationsJoined,
		getUnixFromDate,
		getWeek,
		routeChangeFieldReload,
		routeParseParams,
		srcBase64,
		
		// actions
		dateSet(d) {
			if(d !== this.date) {
				d.setHours(0,0,0);
				this.date = d;
				this.paramsUpdate(true);
				this.get();
			}
		},
		dateSelected(unix0,unix1,middleClick) {
			let attributes = [
				`${this.attributeIdDate0}_${unix0}`,
				`${this.attributeIdDate1}_${unix1}`
			];
			this.$emit('open-form',[],[`attributes=${attributes.join(',')}`],middleClick);
		},
		goToToday() {
			let now = new Date();
			if(!this.isMonth) {
				if(now < this.date0 || now > this.date1)
					return this.dateSet(now);
				
			} else {
				if(now.getMonth() !== this.date.getMonth()
					|| now.getFullYear() !== this.date.getFullYear()) {
					
					return this.dateSet(now);
				}
			}
			
			// if today is already visible, open 'today'
			if(this.hasCreate) {
				const u = this.getUnixFromDate(this.getDateAtUtcZero(now));
				this.dateSelected(u,u,false);
			}
		},
		icsCopyToClipboard() {
			navigator.clipboard.writeText(this.icsUrl);
		},
		
		// page routing
		paramsUpdate(pushHistory) {
			if(!this.usesPageHistory) return;

			let args = [ `daysShow=${this.daysShow}`, `year=${this.date.getFullYear()}` ];
			
			if(this.isMonth || this.isDays) args.push(`month=${this.date.getMonth()}`);
			if(this.isWeek)                 args.push(`week=${this.getWeek(this.date)}`);
			if(this.isDays)                 args.push(`day=${this.date.getDate()}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated(reloadIfChanged) {
			let params = {
				day:  { parse:'int', value:this.date.getDate() },
				month:{ parse:'int', value:this.date.getMonth() },
				week: { parse:'int', value:this.getWeek(this.date) },
				year: { parse:'int', value:this.date.getFullYear() }
			};
			this.routeParseParams(params);
			
			let d = new Date(this.date.getTime());
			d.setFullYear(params.year.value);
			
			if(this.isDays || this.isMonth) d.setMonth(params.month.value);
			if(this.isDays)                 d.setDate(params.day.value);
			if(this.isWeek)                 d = this.getDateFromWeek(params.week.value,d.getFullYear());

			if(d.getTime() !== this.date.getTime()) {
				this.date = d;
				
				if(reloadIfChanged)
					this.get();
			}
		},
		
		// backend calls
		get() {
			if(this.query.relationId === null || (this.isHidden && !this.loadWhileHidden))
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
					false,
					this.attributeIdDate0,this.indexDate0,dateStart,
					this.attributeIdDate1,this.indexDate1,dateEnd
				)),
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