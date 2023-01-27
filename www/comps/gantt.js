import MyInputCollection from './inputCollection.js';
import MyValueRich       from './valueRich.js';
import srcBase64Icon     from './shared/image.js';
import {getCaption}      from './shared/language.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
import {
	getChoiceFilters,
	getColumnIndexesHidden
} from './shared/form.js';
import {
	getDateFormat,
	getDateFromUnix,
	getDateShifted,
	getUnixFromDate,
	getUnixShifted,
	isUnixUtcZero
} from './shared/time.js';
import {
	fillRelationRecordIds,
	getQueryExpressions,
	getQueryExpressionsDateRange,
	getQueryFiltersDateRange,
	getRelationsJoined
} from './shared/query.js';
import {
	routeChangeFieldReload,
	routeParseParams
} from './shared/router.js';
export {MyGantt as default};

let MyGanttLineRecord = {
	name:'my-gantt-line-record',
	components:{MyValueRich},
	template:
	`<div class="gantt-line-record"
		@click="clickRecord(false)"
		@click.middle="clickRecord(true)"
		:class="{ clickable:rowSelect }"
		:style="style"
	>
		<div class="record-line start"
			v-if="date0 >= date0Range"
			:style="styleBg"
		></div>
		<div class="record-line middle"
			:style="styleBg"
		></div>
		<div class="record-line end"
			v-if="date1 <= date1Range"
			:style="styleBg"
		></div>
		<div class="record-values">
			<template v-for="(v,i) in values">
				<my-value-rich class="context-calendar-gantt"
					v-if="!indexesHidden.includes(i) && v !== null"
					:attribute-id="columns[i].attributeId"
					:basis="columns[i].basis"
					:display="columns[i].display"
					:key="i"
					:length="columns[i].length"
					:value="v"
				/>
			</template>
		</div>
	</div>`,
	props:{
		color:        { required:true },
		columns:      { type:Array,  required:true },
		date0:        { type:Date,   required:true }, // start date of record
		date0Range:   { type:Date,   required:true }, // start date of gantt range
		date1:        { type:Date,   required:true }, // end date of record
		date1Range:   { type:Date,   required:true }, // end date of gantt range
		indexesHidden:{ type:Array,  required:true }, // hidden column indexes (either it is hidden or used as Gantt group)
		isDays:       { type:Boolean,required:true },
		pxPerSec:     { type:Number, required:true }, // pixel per second on gantt
		recordId:     { type:Number, required:true },
		rowSelect:    { type:Boolean,required:true },
		values:       { type:Array,  required:true }
	},
	emits:['record-selected'],
	computed:{
		isFullDay:function() {
			return this.isUnixUtcZero(this.getUnixFromDate(this.date0))
				&& this.isUnixUtcZero(this.getUnixFromDate(this.date1));
		},
		style:function() {
			let d0 = new Date(this.date0.getTime());
			let d1 = new Date(this.date1.getTime());
			
			// apply offset fix for UTC date values
			if(this.isFullDay) {
				d0 = this.getDateShifted(d0,true);
				d1 = this.getDateShifted(d1,true);
				d1.setDate(d1.getDate()+1);
			}
			
			// limit record date to gantt presentation range
			if(this.date0Range > d0) d0 = this.date0Range;
			if(this.date1Range < d1) d1 = this.date1Range;
			
			// calculate width and offset to gantt start
			let secOffset = (d0 - this.date0Range) / 1000;
			let secWidth  = (d1 - d0) / 1000;
			
			// correction for DST change in day mode
			if(this.isDays) {
				let secDst0 = this.date0Range.getTimezoneOffset()*60;
				let secDst1 = d0.getTimezoneOffset()*60;
				secOffset += secDst0 - secDst1;
			}
			
			let offset = secOffset * this.pxPerSec;
			let width  = secWidth  * this.pxPerSec;
			
			if(width < 1)
				return 'display:none';
			
			// max-width is overwritten by CSS if hovered over (show full entry)
			return [`min-width:${width}px`,`max-width:${width}px`,`left:${offset}px`].join(';');
		},
		styleBg:function(r) {
			return this.color === null
				? '' : `background-color:#${this.color};`;
		}
	},
	methods:{
		// externals
		getDateShifted,
		getUnixFromDate,
		isUnixUtcZero,
		
		// actions
		clickRecord:function(middleClick) {
			if(this.rowSelect)
				this.$emit('record-selected',this.recordId,[],middleClick);
		}
	}
};

let MyGanttLine = {
	name:'my-gantt-line',
	components:{MyGanttLineRecord},
	template:`<div class="gantt-line">
		<my-gantt-line-record
			v-for="(r,i) in records"
			@record-selected="(...args) => $emit('record-selected',...args)"
			:color="r.color"
			:columns="columns"
			:date0="r.date0"
			:date0-range="date0Range"
			:date1="r.date1"
			:date1-range="date1Range"
			:indexes-hidden="indexesHidden"
			:is-days="isDays"
			:px-per-sec="pxPerSec"
			:key="i+'_'+r.id"
			:record-id="r.id"
			:row-select="rowSelect"
			:values="r.values"
		/>
	</div>`,
	props:{
		columns:      { type:Array,  required:true },
		indexesHidden:{ type:Array,  required:true },
		date0Range:   { type:Date,   required:true },
		date1Range:   { type:Date,   required:true },
		isDays:       { type:Boolean,required:true },
		pxPerSec:     { type:Number, required:true },
		records:      { type:Array,  required:true },
		rowSelect:    { type:Boolean,required:true }
	},
	emits:['record-selected']
};

let MyGantt = {
	name:'my-gantt',
	components:{
		MyGanttLine,
		MyInputCollection,
		MyValueRich
	},
	template:`<div class="gantt shade" v-if="ready">
		
		<!-- header -->
		<div class="top lower">
			
			<!-- keep div for flex layout -->
			<div class="area nowrap">
				<my-button image="new.png"
					v-if="hasCreate"
					@trigger="$emit('open-form',0,[],false)"
					@trigger-middle="$emit('open-form',0,[],true)"
					:caption="!isMobile ? capGen.button.new : ''"
					:captionTitle="capGen.button.newHint"
				/>
				<my-button
					@trigger="showGroupLabels = !showGroupLabels"
					:caption="!isMobile ? capApp.button.ganttShowLabels : ''"
					:captionTitle="capApp.button.ganttShowLabelsHint"
					:image="showGroupLabels ? 'visible1.png' : 'visible0.png'"
				/>
			</div>
			
			<div class="area nowrap navigation default-inputs">
				<img class="icon"
					v-if="iconId !== null"
					:src="srcBase64Icon(iconId)"
				/>
				<my-button image="pagePrev.png"
					@trigger="pageChange(-1)"
					:naked="true"
				/>
				
				<div class="date-range-label">
					{{ dateRangeLabel }}
				</div>
				
				<my-button image="pageNext.png"
					@trigger="pageChange(1)"
					:naked="true"
				/>
			</div>
			
			<div class="area nowrap default-inputs">
				<my-button
					v-if="stepTypeToggle"
					@trigger="toggleStepType"
					:captionTitle="capApp.button.ganttToggleHint"
					:image="isDays ? 'clock.png' : 'clock24.png'"
					:naked="true"
					:tight="true"
				/>
				
				<my-button image="search.png"
					v-if="!isMobile"
					@trigger="stepZoom = stepZoomDefault"
					:captionTitle="capApp.button.zoomResetHint"
					:naked="true"
					:tight="true"
				/>
				
				<input class="zoom-factor clickable" type="range" min="3" max="12"
					v-if="!isMobile"
					v-model="stepZoom"
				/>
				
				<my-input-collection class="selector"
					v-for="c in collections"
					@update:indexes="$emit('set-collection-indexes',c.collectionId,$event)"
					:collectionId="c.collectionId"
					:columnIdDisplay="c.columnIdDisplay"
					:key="c.collectionId"
					:multiValue="c.multiValue"
				/>
				
				<select class="selector"
					v-if="hasChoices"
					v-model="choiceId"
					@change="choiceIdSet($event.target.value)"
				>
					<option v-for="c in choices" :value="c.id">
						{{ getCaption(c.captions.queryChoiceTitle,c.name) }}
					</option>
				</select>
				
				<my-button image="calendar.png"
					v-if="!isMobile"
					@trigger="scrollToNow"
					:caption="!isMobile ? capApp.now : ''"
					:captionTitle="capApp.nowHint"
				/>
			</div>
		</div>
		
		<!-- gantt content -->
		<div class="gantt-content">
			<div class="gantt-labels" v-if="showGroupLabels">
				<div class="gantt-label-entry"></div>
				<div class="gantt-label-entry gantt-group"
					v-for="(g,k) in groups"
					:key="k"
					:style="styleLabel(g)"
				>
					<my-value-rich class="context-calendar-gantt"
						v-for="c in g.columns.filter(v => !columnIndexesHidden.includes(v.index) && v.value !== null)"
						:attribute-id="columns[c.index].attributeId"
						:display="columns[c.index].display"
						:key="c.index"
						:length="columns[c.index].length"
						:value="c.value"
					/>
				</div>
			</div>
			
			<div class="gantt-lines" ref="content">
				<div class="gantt-headers">
					
					<!-- header meta line: shows groupings of step entities (hours->days, days->months) -->
					<div class="gantt-header">
						<div class="gantt-header-item"
							v-for="i in headerItemsMeta"
							:style="'width:'+stepPixels*i.steps+'px'"
						>
							{{ displayHeaderMetaItem(i.value) }}
						</div>
					</div>
					
					<!-- header line: shows step entities (hours, days, ...) -->
					<div class="gantt-header lower">
						<div class="gantt-header-item lower"
							v-for="i in headerItems"
							@click.exact="clickHeaderItem(i.unixTime,false,false)"
							@click.shift="clickHeaderItem(i.unixTime,true,false)"
							@click.middle.exact="clickHeaderItem(i.unixTime,false,true)"
							@click.middle.shift="clickHeaderItem(i.unixTime,true,true)"
							:class="{ clickable:hasCreate, today:getUnixFromDate(dateStart) === i.unixTime, weekend:i.isWeekend }"
							:style="'width:'+stepPixels+'px'"
						>
							{{ i.caption }}
						</div>
					</div>
				</div>
				
				<div class="gantt-group" v-for="(g,i) in groups">
					<my-gantt-line
						v-for="(l,li) in g.lines"
						@record-selected="(...args) => $emit('record-selected',...args)"
						:class="{ 'show-line':li === g.lines.length-1 }"
						:columns="columns"
						:date0-range="date0"
						:date1-range="date1"
						:indexes-hidden="columnIndexesHidden.concat(group0LabelExpressionIndexes)"
						:is-days="isDays"
						:px-per-sec="pxPerSec"
						:key="i+'_'+li"
						:row-select="rowSelect"
						:style="styleLine"
						:records="l"
					/>
				</div>
				<div class="nothing-there" v-if="isEmpty">
					{{ capGen.nothingThere }}
				</div>
			</div>
		</div>
	</div>`,
	props:{
		attributeIdColor:{ required:true },
		attributeIdDate0:{ type:String,  required:true },
		attributeIdDate1:{ type:String,  required:true },
		choices:         { type:Array,   required:false, default:() => [] },
		columns:         { type:Array,   required:true }, // processed list columns
		collections:     { type:Array,   required:true },
		fieldId:         { type:String,  required:true },
		filters:         { type:Array,   required:true }, // processed query filters
		formLoading:     { type:Boolean, required:true }, // block GET while form is still loading (avoid redundant GET calls)
		iconId:          { required:true },
		indexColor:      { required:true },               // index of attribute that provides record color
		indexDate0:      { type:Number,  required:true }, // index of attribute that provides record date from
		indexDate1:      { type:Number,  required:true }, // index of attribute that provides record date to
		isHiddenInTab:   { type:Boolean, required:false, default:false }, // Gantt is in a non-visible tab-field
		query:           { type:Object,  required:true },
		rowSelect:       { type:Boolean, required:true },
		stepTypeDefault: { type:String,  required:true },
		stepTypeToggle:  { type:Boolean, required:true },
		usesPageHistory: { type:Boolean, required:true }
	},
	emits:['open-form','record-selected','set-args','set-collection-indexes'],
	data() {
		return {
			choiceId:null,
			dateStart:null,
			notScrolled:true,
			groups:[],        // gantt groups, by defined column, each with its lines of records
			headerItems:[],
			headerItemsMeta:[],
			linePixels:30,    // line height in pixels
			page:0,           // which page we are on (0: default, 1: next, -1: prev)
			ready:false,      // component ready to be used
			resizeTimer:null,
			showGroupLabels:true,
			startDate:0,      // start date (TZ), base for date ranges, set once to keep navigation clear
			stepBase:8,       // base size of step width in pixels, used to multiply with zoom factor
			stepType:'days',  // gantt step type (hours, days)
			stepZoom:7,       // zoom factor for step, 7 is default (7*8=56)
			stepZoomDefault:7,// zoom reset to
			steps:0,          // available steps, calculated based on field size and zoom factor
			unixTimeRangeStart:null // for time range input
		};
	},
	computed:{
		// default is user field option, fallback is first choice in list
		choiceIdDefault:(s) => s.fieldOptionGet(
			s.fieldId,'choiceId',
			s.choices.length === 0 ? null : s.choices[0].id
		),
		
		// unix date range points, 0=gantt start, 1=gantt end
		date0:(s) => {
			let d = new Date(s.dateStart.getTime());
			// start 3 steps before page start point
			switch(s.stepType) {
				case 'days':  d.setDate(d.getDate()   - 3 + (s.page*s.steps)); break;
				case 'hours': d.setHours(d.getHours() - 3 + (s.page*s.steps)); break;
			}
			return d;
		},
		date1:(s) => {
			let d = new Date(s.dateStart.getTime());
			switch(s.stepType) {
				case 'days':  d.setDate(d.getDate()   + s.steps - 3 + (s.page*s.steps)); break;
				case 'hours': d.setHours(d.getHours() + s.steps - 3 + (s.page*s.steps)); break;
			}
			return d;
		},
		
		dateRangeLabel:(s) => {
			let d0 = new Date(s.date0.getTime());
			let d1 = new Date(s.date1.getTime());
			let format = s.isDays ? s.settings.dateFormat : s.settings.dateFormat+' H:i';
			if(s.isDays) {
				d1.setDate(d1.getDate()-1);
				return s.isMobile ? s.getDateFormat(d0,format)
					: s.getDateFormat(d0,format) + ' - ' +s.getDateFormat(d1,format);
			}
			if(s.isHours) {
				if(s.isMobile)
					return s.getDateFormat(d0,format);
				
				if(d0.getDate() === d1.getDate())
					return s.getDateFormat(d0,format) + '-' +s.getDateFormat(d1,'H:i');
				
				return s.getDateFormat(d0,format) + ' - ' +s.getDateFormat(d1,format);
			}
			return '';
		},
		
		// records in gantt are always grouped (basically 1 calendar line per group)
		//  currently only 1 group level exists (group 0), more could be added to allow nesting
		//  group 0 label expression indexes define, which expression index(es) hold grouping label value(s)
		group0LabelExpressionIndexes:(s) => {
			let out = [];
			
			// get columns with batch 1 (fixed definition)
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(s.columns[i].batch === 1)
					out.push(i);
			}
			return out;
		},
		
		// presentation
		pxPerSec:(s) => {
			if     (s.isHours) return s.stepPixels / 3600;
			else if(s.isDays)  return s.stepPixels / 86400;
			return 0.0;
		},
		styleLine:(s) => {
			return [
				`max-width:${s.stepPixels * s.steps}px`,
				`background-size:${s.stepPixels}px ${s.linePixels}px`
			].join(';');
		},
		
		// simple
		choiceFilters:      (s) => s.getChoiceFilters(s.choices,s.choiceId),
		columnIndexesHidden:(s) => s.getColumnIndexesHidden(s.columns),
		expressions:        (s) => s.getQueryExpressions(s.columns),
		hasChoices:         (s) => s.choices.length > 1,
		hasColor:           (s) => s.attributeIdColor !== null,
		hasCreate:          (s) => s.query.joins.length === 0 ? false : s.query.joins[0].applyCreate && s.rowSelect,
		isDays:             (s) => s.stepType === 'days',
		isEmpty:            (s) => s.groups.length === 0,
		isHours:            (s) => s.stepType === 'hours',
		joins:              (s) => s.fillRelationRecordIds(s.query.joins),
		stepPixels:         (s) => s.stepBase * s.stepZoom,
		styleHeaderItem:    (s) => `width:${s.stepPixels}px;`,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		isMobile:      (s) => s.$store.getters.isMobile,
		capApp:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings
	},
	created() {
		window.addEventListener('resize',this.resize);
	},
	mounted() {
		this.stepType  = this.stepTypeDefault;
		this.dateStart = this.getDateNowRounded();
		
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(!val) this.reloadOutside();
		});
		this.$watch('isHiddenInTab',(val) => {
			// if field is hidden, steps cannot be calculated
			if(!val) this.$nextTick(() => this.setSteps(true));
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
		
		// setup watchers for presentation changes
		this.$watch(() => [this.showGroupLabels,this.stepZoom],() => {
			this.fieldOptionSet(this.fieldId,'ganttShowGroupLabels',this.showGroupLabels);
			this.fieldOptionSet(this.fieldId,'ganttStepZoom',this.stepZoom);
			this.$nextTick(() => this.setSteps(false));
		});
		
		if(this.usesPageHistory) {
			// set initial states via route parameters
			this.paramsUpdated();     // load existing parameters from route query
			this.paramsUpdate(false); // overwrite parameters (in case defaults are set)
		} else {
			this.choiceId = this.choiceIdDefault;
		}
		
		// initial field options
		this.showGroupLabels = this.fieldOptionGet(this.fieldId,'ganttShowGroupLabels',this.showGroupLabels);
		this.stepZoom        = this.fieldOptionGet(this.fieldId,'ganttStepZoom',this.stepZoom);
		
		this.ready = true;
		this.$nextTick(() => this.setSteps(false));
	},
	unmounted() {
		window.removeEventListener('resize',this.resize);
	},
	methods:{
		// external
		fieldOptionGet,
		fieldOptionSet,
		fillRelationRecordIds,
		getCaption,
		getChoiceFilters,
		getColumnIndexesHidden,
		getDateFormat,
		getDateFromUnix,
		getQueryExpressions,
		getQueryExpressionsDateRange,
		getQueryFiltersDateRange,
		getRelationsJoined,
		getUnixFromDate,
		getUnixShifted,
		routeChangeFieldReload,
		routeParseParams,
		srcBase64Icon,
		
		createHeaderItems() {
			let that = this;
			this.headerItems     = [];
			this.headerItemsMeta = [];
			
			let addMeta = function(steps,value) {
				that.headerItemsMeta.push({
					steps:steps,
					value:value
				});
			};
			let add = function(d) {
				let caption;
				if(that.isHours) caption = d.getHours();
				if(that.isDays)  caption = `${d.getDate()}.`;
				
				that.headerItems.push({
					caption:caption,
					isWeekend:d.getDay() === 0 || d.getDay() === 6,
					unixTime:that.getUnixFromDate(d)
				});
			};
			
			// create one header item for each date step
			// create one meta header item for each meta switch (new day/new month)
			let stepsTaken = 0;
			let d = new Date(this.date0.getTime());
			for(; d < this.date1;) {
				stepsTaken++;
				add(d);
				
				if(this.isDays) {
					d.setDate(d.getDate()+1);
					
					// next month meta item
					if(d.getDate() === 1) {
						let dCopy = new Date(d.getTime());
						dCopy.setDate(dCopy.getDate() - 1);
						
						addMeta(stepsTaken,dCopy.getMonth());
						stepsTaken = 0;
					}
				}
				else if(this.isHours) {
					d.setHours(d.getHours()+1);
					
					// next day meta item
					if(d.getHours() === 0) {
						let dCopy = new Date(d.getTime());
						dCopy.setHours(dCopy.getHours() - 1);
						
						addMeta(stepsTaken,dCopy.getDate());
						stepsTaken = 0;
					}
				}
			}
			
			// add last meta header item
			if(stepsTaken !== 0) {
				switch(this.stepType) {
					case 'hours': addMeta(stepsTaken,d.getDate());  break;
					case 'days':  addMeta(stepsTaken,d.getMonth()); break;
				}
			}
		},
		
		// actions
		choiceIdSet(choiceId) {
			this.fieldOptionSet(this.fieldId,'choiceId',choiceId);
			this.choiceId = choiceId;
			this.reloadInside();
		},
		clickHeaderItem(unixTime,shift,middleClick) {
			if(!this.hasCreate) return;
			
			if(this.isDays)
				unixTime = this.getUnixShifted(unixTime,false);
			
			if(this.unixTimeRangeStart === null) {
				this.unixTimeRangeStart = unixTime;
				
				if(shift) return;
			}
			
			let attributes = [
				`${this.attributeIdDate0}_${this.unixTimeRangeStart}`,
				`${this.attributeIdDate1}_${unixTime}`
			];
			this.$emit('open-form',0,[`attributes=${attributes.join(',')}`],middleClick);
			this.unixTimeRangeStart = null;
		},
		pageChange(factor) {
			this.page += factor;
			this.reloadInside();
		},
		resize() {
			clearTimeout(this.resizeTimer);
			this.resizeTimer = setTimeout(() => this.setSteps(false),150);
		},
		scrollToNow() {
			if(this.page !== 0)
				return this.pageChange(this.page-(this.page*2));
			
			let d = this.getDateNowRounded();
			let secFromStart = (d-this.date0) / 1000;
			
			// target a couple of steps before now for better overview
			if(this.isHours) secFromStart -= 3600  * 3; // 3 hours
			if(this.isDays)  secFromStart -= 86400 * 3; // 3 days
			
			this.$refs.content.scrollLeft = this.pxPerSec * secFromStart;
		},
		toggleStepType() {
			switch(this.stepType) {
				case 'hours': this.stepType = 'days';  break;
				case 'days':  this.stepType = 'hours'; break;
			}
			this.reloadInside();
		},
		
		// reloads
		reloadOutside() {
			this.createHeaderItems();
			this.get();
		},
		reloadInside() {
			// reload full page gantt by updating route parameters
			// enables browser history for fullpage list navigation
			if(this.usesPageHistory)
				return this.paramsUpdate(true);
			
			this.createHeaderItems();
			this.get();
		},
		
		// page routing
		paramsUpdate(pushHistory) {
			let args = [
				`page=${this.page}`,
				`type=${this.stepType}`
			];
			
			if(this.choiceId !== null)
				args.push(`choice=${this.choiceId}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated() {
			let params = {
				choice:{ parse:'string', value:this.choiceIdDefault },
				page:  { parse:'int',    value:0 },
				type:  { parse:'string', value:this.stepTypeDefault }
			};
			
			this.routeParseParams(params);
			this.page     = params['page'].value;
			this.stepType = params['type'].value;
			
			if(this.choiceId !== params['choice'].value)
				this.choiceId = params['choice'].value;
		},
		
		// presentation
		displayHeaderMetaItem(value) {
			if(this.isHours) // add days as: 12., 13., ...
				return `${value}.`;
			
			if(this.isDays) // add month as: January, ...
				return this.capApp['month'+value];
		},
		setSteps(forceReload) {
			// get count of steps that fit within Gantt content
			let stepsNew = Math.floor(
				this.$refs.content.offsetWidth /
				(this.stepBase * this.stepZoom)
			);
			
			if(stepsNew === this.steps && !forceReload)
				return;
			
			this.steps = stepsNew;
			this.reloadOutside();
		},
		styleLabel(group) {
			return `height:${group.lines.length*this.linePixels}px;`;
		},
		
		// helpers
		getDateNowRounded() {
			let d = new Date();
			
			// round point in times depending on the gantt step type
			if(this.isHours || this.isDays) {
				d.setMinutes(0);
				d.setSeconds(0);
				d.setMilliseconds(0);
			}
			
			if(this.isDays)
				d.setHours(0);
			
			return d;
		},
		getFreeLineIndex(lines,date0,date1) {
			let index;
			
			for(let i = 0, j = lines.length; i < j; i++) {
				index = i;
				
				for(let x = 0, y = lines[i].length; x < y; x++) {
					let r = lines[i][x];
					
					if(date0 <= r.date1 && r.date0 <= date1) {
						// another record´s date range overlaps, line is not suitable
						index = -1;
						break;
					}
				}
				
				if(index !== -1)
					return index;
			}
			return index;
		},
		
		// backend calls
		get() {
			if(this.formLoading || this.isHiddenInTab)
				return;
			
			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.joins),
				expressions:this.getQueryExpressionsDateRange(
					this.attributeIdDate0,this.indexDate0,
					this.attributeIdDate1,this.indexDate1,
					this.attributeIdColor,this.indexColor
				).concat(this.expressions),
				filters:this.filters.concat(this.getQueryFiltersDateRange(
					this.attributeIdDate0,
					this.indexDate0,
					this.getUnixFromDate(this.date0),
					this.attributeIdDate1,
					this.indexDate1,
					this.getUnixFromDate(this.date1)
				)).concat(this.choiceFilters),
				orders:this.query.orders
			},true).then(
				res => {
					// clear existing groups
					this.groups = [];
					
					// parse result rows to gantt groups
					let color    = null;
					let date0    = 0;
					let date1    = 0;
					let groupBy  = []; // group by criteria (can be identical to label)
					let groupMap = {}; // map of all groups, key: groupBy
					let groupColumns = []; // group column values
					let values   = [];
					
					for(let i = 0, j = res.payload.rows.length; i < j; i++) {
						let r = res.payload.rows[i];
						groupBy      = [];
						groupColumns = [];
						
						// collect special calendar values first
						date0 = this.getDateFromUnix(r.values[0]);
						date1 = this.getDateFromUnix(r.values[1]);
						
						if(this.hasColor)
							color = r.values[2];
						
						// parse non-calendar expression values
						values = this.hasColor ? r.values.slice(3) : r.values.slice(2);
						
						for(let x = 0, y = values.length; x < y; x++) {
							
							if(!this.group0LabelExpressionIndexes.includes(x))
								continue;
							
							// add non-file attributes as group criteria
							let atr = this.attributeIdMap[this.columns[x].attributeId];
							if(atr.content !== 'files')
								groupBy.push(values[x]);
							
							groupColumns.push({
								index:x,
								value:values[x]
							});
						}
						let groupName = groupBy.join(' ');
						
						// add group if not there yet
						if(typeof groupMap[groupName] === 'undefined') {
							groupMap[groupName] = {
								lines:[[]], // each line is an array of records
								columns:groupColumns
							};
						}
						
						// check in which line record fits (no overlapping)
						let lineIndex = this.getFreeLineIndex(groupMap[groupName].lines,date0,date1);
						
						if(lineIndex === -1) {
							lineIndex = groupMap[groupName].lines.length;
							groupMap[groupName].lines.push([]);
						}
						
						groupMap[groupName].lines[lineIndex].push({
							id:r.indexRecordIds['0'],
							color:color,
							date0:date0,
							date1:date1,
							values:values
						});
					}
					
					// store groups, sorted by group by criteria
					let keysSorted = Object.keys(groupMap).sort();
					for(let i = 0, j = keysSorted.length; i < j; i++) {
						this.groups.push(groupMap[keysSorted[i]]);
					}
					
					if(this.notScrolled) {
						this.notScrolled = false;
						
						if(this.page === 0)
							this.scrollToNow();
					}
				},
				this.$root.genericError
			);
		}
	}
};