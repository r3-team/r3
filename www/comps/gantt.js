import MyInputCollection from './inputCollection.js';
import MyForm            from './form.js';
import srcBase64Icon     from './shared/image.js';
import {getCaption}      from './shared/language.js';
import {
	checkDataOptions,
	colorAdjustBg,
	colorMakeContrastFont
} from './shared/generic.js';
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

const MyGanttLineRecord = {
	name:'my-gantt-line-record',
	template:
	`<div class="gantt-line-record"
		@click.ctrl.exact="clickRecord(true)"
		@click.left.exact="clickRecord(false)"
		@click.middle.exact="clickRecord(true)"
		:style="style"
	>
		<div class="record-values"
			:class="{ clickable:hasUpdate, start:date0 >= date0Range, end:date1 <= date1Range }"
			:style="styleBg"
		>
			<template v-for="(v,i) in values">
				<my-value-rich class="context-calendar-gantt"
					v-if="!indexesHidden.includes(i) && v !== null"
					:attribute-id="columns[i].attributeId"
					:basis="columns[i].basis"
					:bold="columns[i].flags.bold"
					:boolAtrIcon="columns[i].flags.boolAtrIcon"
					:display="columns[i].display"
					:italic="columns[i].flags.italic"
					:key="i"
					:length="columns[i].length"
					:monospace="columns[i].flags.monospace"
					:noShrink="columns[i].flags.noShrink"
					:noThousandsSep="columns[i].flags.noThousandsSep"
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
		hasUpdate:    { type:Boolean,required:true },
		indexesHidden:{ type:Array,  required:true }, // hidden column indexes (either it is hidden or used as Gantt group)
		isDays:       { type:Boolean,required:true },
		pxPerSec:     { type:Number, required:true }, // pixel per second on gantt
		row:          { type:Object, required:true },
		values:       { type:Array,  required:true }
	},
	emits:['record-selected'],
	computed:{
		isFullDay() {
			return this.isUnixUtcZero(this.getUnixFromDate(this.date0))
				&& this.isUnixUtcZero(this.getUnixFromDate(this.date1));
		},
		style() {
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
		styleBg(r) {
			if(this.color === null) return '';
			const colorBg   = this.colorAdjustBg(this.color);
			const colorFont = this.colorMakeContrastFont(colorBg);
			return `background-color:${colorBg};color:${colorFont};`
		}
	},
	methods:{
		// externals
		colorAdjustBg,
		colorMakeContrastFont,
		getDateShifted,
		getUnixFromDate,
		isUnixUtcZero,
		
		// actions
		clickRecord(middleClick) {
			if(this.hasUpdate)
				this.$emit('record-selected',this.row,middleClick);
		}
	}
};

const MyGanttLine = {
	name:'my-gantt-line',
	components:{MyGanttLineRecord},
	template:`<div class="gantt-line">
		<my-gantt-line-record
			v-for="(r,i) in records"
			@record-selected="(...args) => $emit('record-selected',...args)"
			:color="r.color"
			:columns="columns"
			:date0="r.date0"
			:date0Range="date0Range"
			:date1="r.date1"
			:date1Range="date1Range"
			:hasUpdate="hasUpdate"
			:indexesHidden="indexesHidden"
			:isDays="isDays"
			:pxPerSec="pxPerSec"
			:key="i+'_'+r.row.indexRecordIds['0']"
			:row="r.row"
			:values="r.values"
		/>
	</div>`,
	props:{
		columns:      { type:Array,  required:true },
		indexesHidden:{ type:Array,  required:true },
		date0Range:   { type:Date,   required:true },
		date1Range:   { type:Date,   required:true },
		hasUpdate:    { type:Boolean,required:true },
		isDays:       { type:Boolean,required:true },
		pxPerSec:     { type:Number, required:true },
		records:      { type:Array,  required:true }
	},
	emits:['record-selected']
};

const MyGantt = {
	name:'my-gantt',
	components:{
		MyGanttLine,
		MyInputCollection
	},
	template:`<div class="gantt" :class="{ isSingleField:isSingleField }" v-if="ready">
		
		<!-- header -->
		<div class="top lower">
			
			<!-- keep div for flex layout -->
			<div class="area nowrap">
				<my-button image="new.png"
					v-if="hasCreate"
					@trigger="$emit('open-form',[],[],false)"
					@trigger-middle="$emit('open-form',[],[],true)"
					:caption="capGen.button.new"
					:captionTitle="capGen.button.newHint"
				/>
				<my-button
					@trigger="$emit('set-login-option','ganttShowGroupLabels',!showGroupLabels)"
					:caption="!isMobile ? capApp.button.ganttShowLabels : ''"
					:captionTitle="capApp.button.ganttShowLabelsHint"
					:image="showGroupLabels ? 'visible1.png' : 'visible0.png'"
				/>
			</div>
			
			<div class="area nowrap">
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
				<my-button image="refresh.png"
					@trigger="get"
					:captionTitle="capGen.button.refresh"
					:naked="true"
				/>

				<my-button
					v-if="!isMobile && stepTypeToggle"
					@trigger="$emit('set-login-option','ganttStepType', stepType === 'days' ? 'hours' : 'days')"
					:captionTitle="capApp.button.ganttToggleHint"
					:image="isDays ? 'clock.png' : 'clock24.png'"
					:naked="true"
				/>
				
				<my-button image="search.png"
					v-if="!isMobile"
					@trigger="$emit('set-login-option','ganttStepZoom',stepZoomDefault)"
					:active="stepZoom !== stepZoomDefault"
					:captionTitle="capGen.button.zoomReset"
					:naked="true"
				/>
				
				<input class="zoom-factor clickable" type="range"
					v-if="!isMobile"
					@change="$emit('set-login-option','ganttStepZoom',parseInt($event.target.value))"
					:max="stepZoomMax"
					:min="stepZoomMin"
					:value="stepZoom"
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
				
				<select class="selector"
					v-if="hasChoices"
					:value="choiceId"
					@change="$emit('set-login-option','choiceId',$event.target.value)"
				>
					<option v-for="c in choices" :value="c.id">
						{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
					</option>
				</select>
				
				<my-button image="calendarDot.png"
					v-if="!isMobile"
					@trigger="scrollToNow"
					:caption="!isMobile ? capApp.now : ''"
					:captionTitle="capApp.nowHint"
				/>
			</div>
		</div>
		
		<!-- gantt content -->
		<div class="gantt-content">
			<div class="gantt-data">
				<div class="gantt-labels" v-if="showGroupLabels">
					<div class="gantt-label-entry"></div>
					<div class="gantt-label-entry"
						v-for="(g,k) in groups"
						:key="k"
						:style="styleLabel(g)"
					>
						<div class="columnBatch ganttGroup" :class="{ vertical:g.vertical }">
							<my-value-rich class="context-calendar-gantt"
								v-for="c in g.columns.filter(v => v.value !== null)"
								:attribute-id="columns[c.index].attributeId"
								:bold="columns[c.index].flags.bold"
								:boolAtrIcon="columns[c.index].flags.boolAtrIcon"
								:display="columns[c.index].display"
								:italic="columns[c.index].flags.italic"
								:key="c.index"
								:length="columns[c.index].length"
								:monospace="columns[c.index].flags.monospace"
								:noShrink="columns[c.index].flags.noShrink"
								:noThousandsSep="columns[c.index].flags.noThousandsSep"
								:value="c.value"
							/>
						</div>
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
								@mousedown.left="clickHeaderItem(i.unixTime,true)"
								@mouseover="hoverHeaderItem(i.unixTime)"
								@mouseup.left="clickHeaderItem(i.unixTime,false)"
								:class="{ clickable:hasCreate, selected:i.unixTime >= unixInput0 && i.unixTime <= unixInput1, today:getUnixFromDate(dateStart) === i.unixTime, weekend:i.isWeekend }"
								:style="'width:'+stepPixels+'px'"
							>
								{{ i.caption }}
							</div>
						</div>
					</div>
					
					<div class="gantt-group" v-for="(g,i) in groups">
						<my-gantt-line
							v-for="(l,li) in g.lines"
							@record-selected="(...args) => $emit('open-form',[args[0]],[],args[1])"
							:class="{ 'show-line':li === g.lines.length-1 }"
							:columns="columns"
							:date0Range="date0"
							:date1Range="date1"
							:hasUpdate="hasUpdate"
							:indexesHidden="group0LabelExpressionIndexes"
							:isDays="isDays"
							:pxPerSec="pxPerSec"
							:key="i+'_'+li"
							:style="styleLine"
							:records="l"
						/>
					</div>
					<div class="nothing-there" v-if="isEmpty">
						{{ capGen.nothingThere }}
					</div>
				</div>
			</div>
			
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
		columns:         { type:Array,   required:true }, // processed list columns
		collections:     { type:Array,   required:true },
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		dataOptions:     { type:Number,  required:false, default:0 },
		fieldId:         { type:String,  required:true },
		filters:         { type:Array,   required:true }, // processed query filters
		formLoading:     { type:Boolean, required:true }, // block GET while form is still loading (avoid redundant GET calls)
		hasOpenForm:     { type:Boolean, required:true },
		iconId:          { required:true },
		indexColor:      { required:true },               // index of attribute that provides record color
		indexDate0:      { type:Number,  required:true }, // index of attribute that provides record date from
		indexDate1:      { type:Number,  required:true }, // index of attribute that provides record date to
		isHidden:        { type:Boolean, required:false, default:false },
		isSingleField:   { type:Boolean, required:false, default:false },
		loginOptions:    { type:Object,  required:true },
		moduleId:        { type:String,  required:true },
		popUpFormInline: { required:false, default:null },
		query:           { type:Object,  required:true },
		stepTypeDefault: { type:String,  required:true },
		stepTypeToggle:  { type:Boolean, required:true },
		usesHotkeys:     { type:Boolean, required:true },
		usesPageHistory: { type:Boolean, required:true }
	},
	emits:['close-inline','open-form','set-args','set-collection-indexes','set-login-option'],
	data() {
		return {
			dateStart:null,
			notScrolled:true,
			groups:[],              // gantt groups, by defined column, each with its lines of records
			headerItems:[],
			headerItemsMeta:[],
			linePixels:30,          // line height in pixels
			page:0,                 // which page we are on (0: default, 1: next, -1: prev)
			ready:false,            // component ready to be used
			resizeTimer:null,
			startDate:0,            // start date (TZ), base for date ranges, set once to keep navigation clear
			stepBase:8,             // base size of step width in pixels, used to multiply with zoom factor
			stepZoomDefault:7,      // zoom reset to
			stepZoomMin:3,
			stepZoomMax:30,
			steps:0,                // available steps, calculated based on field size and zoom factor
			unixInput0:null,        // date input, start
			unixInput1:null,        // date input, end
			unixInputActive:false,
			unixTimeRangeStart:null // for time range input
		};
	},
	computed:{
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
			let batchIndexUsed;
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(i === 0) {
					// get all columns from first used batch index
					batchIndexUsed = s.columns[i].batch;
					out.push(i);
					
					// if no batch index is used, only use first column
					if(batchIndexUsed === null) break;
					
				} else if(s.columns[i].batch === batchIndexUsed) {
					out.push(i);
				}
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
		expressions:    (s) => s.getQueryExpressions(s.columns),
		hasChoices:     (s) => s.choices.length > 1,
		hasColor:       (s) => s.attributeIdColor !== null,
		hasCreate:      (s) => s.checkDataOptions(4,s.dataOptions) && s.query.joins.length !== 0 && s.query.joins[0].applyCreate && s.hasOpenForm,
		hasUpdate:      (s) => s.checkDataOptions(2,s.dataOptions) && s.query.joins.length !== 0 && s.query.joins[0].applyUpdate && s.hasOpenForm,
		isDays:         (s) => s.stepType === 'days',
		isEmpty:        (s) => s.groups.length === 0,
		isHours:        (s) => s.stepType === 'hours',
		joins:          (s) => s.fillRelationRecordIds(s.query.joins),
		stepPixels:     (s) => s.stepBase * s.stepZoom,
		styleHeaderItem:(s) => `width:${s.stepPixels}px;`,

		// login options
		choiceId:       (s) => s.$root.getOrFallback(s.loginOptions,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		stepType:       (s) => s.$root.getOrFallback(s.loginOptions,'ganttStepType',s.stepTypeDefault), // gantt step type (hours, days)
		stepZoom:       (s) => s.$root.getOrFallback(s.loginOptions,'ganttStepZoom',7),                 // zoom factor for step, 7 is default (7*8=56)
		showGroupLabels:(s) => s.$root.getOrFallback(s.loginOptions,'ganttShowGroupLabels',true),
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		appResized:    (s) => s.$store.getters.appResized,
		capApp:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic,
		isMobile:      (s) => s.$store.getters.isMobile,
		settings:      (s) => s.$store.getters.settings
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyForm = MyForm;
	},
	mounted() {
		// setup watchers
		this.$watch('appResized',this.resized);
		this.$watch('formLoading',v => { if(!v) this.get(); });
		this.$watch('isHidden',v => { if(!v) this.$nextTick(() => this.setSteps(true)); });
		this.$watch('popUpFormInline',this.resized);
		this.$watch('stepType',() => {
			this.page = 0;
			this.paramsUpdate(true);
			this.$nextTick(() => this.setSteps(true));
		});
		this.$watch('columns',(valNew,valOld) => {
			if(JSON.stringify(valNew) !== JSON.stringify(valOld)) {
				this.groups = [];
				this.get();
			}
		});
		this.$watch('filters',(valNew,valOld) => {
			if(JSON.stringify(valNew) !== JSON.stringify(valOld))
				this.get();
		});
		this.$watch(() => [this.showGroupLabels,this.stepZoom],() => {
			this.$nextTick(() => this.setSteps(false));
		});
		if(this.usesPageHistory) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals))
					this.paramsUpdated(true);
			});

			// load initial route parameters
			this.paramsUpdated(false);
		}

		if(this.usesHotkeys)
			window.addEventListener('keydown',this.handleHotkeys);

		this.dateStart = this.getDateNowRounded();
		this.ready     = true;
		this.$nextTick(() => this.setSteps(false));
	},
	unmounted() {
		if(this.usesHotkeys)
			window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// external
		checkDataOptions,
		fillRelationRecordIds,
		getCaption,
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
		clickHeaderItem(unix,mousedown) {
			if(!this.hasCreate) return;
			
			this.unixInputActive = mousedown;
			if(mousedown) {
				this.unixInput0 = unix;
				this.unixInput1 = unix;
				return;
			}
			
			if(this.unixInput0 !== null && this.unixInput1 !== null) {
				let attributes = [
					`${this.attributeIdDate0}_${this.isDays ? this.getUnixShifted(this.unixInput0,false) : this.unixInput0}`,
					`${this.attributeIdDate1}_${this.isDays ? this.getUnixShifted(this.unixInput1,false) : this.unixInput1}`
				];
				this.$emit('open-form',[],[`attributes=${attributes.join(',')}`],false);
			}
			this.unixInput0 = null;
			this.unixInput1 = null;
		},
		handleHotkeys(e) {
			switch(e.key) {
				case 'ArrowLeft':  this.pageChange(-1); break;
				case 'ArrowRight': this.pageChange(1);  break;
			}
		},
		hoverHeaderItem(unix) {
			if(!this.unixInputActive) return;
			
			if(unix < this.unixInput0) this.unixInput0 = unix;
			else                       this.unixInput1 = unix;
		},
		pageChange(factor) {
			this.page += factor;
			this.paramsUpdate(true);
			this.get();
		},
		resized() {
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
		
		// page routing
		paramsUpdate(pushHistory) {
			if(this.usesPageHistory)
				this.$emit('set-args',this.page !== 0 ? [`page=${this.page}`] : [],pushHistory);
		},
		paramsUpdated(reloadIfChanged) {
			let params = { page:{ parse:'int', value:0 } };
			this.routeParseParams(params);
			if(this.page !== params.page.value) {
				this.page = params.page.value;

				if(reloadIfChanged)
					this.get();
			}
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
			const stepsNew = Math.floor(
				this.$refs.content.offsetWidth /
				(this.stepBase * this.stepZoom)
			);
			
			if(stepsNew === this.steps && !forceReload)
				return;
			
			this.steps = stepsNew;
			this.get();
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
			if(this.formLoading || this.isHidden)
				return;
			
			this.createHeaderItems();

			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.joins),
				expressions:this.getQueryExpressionsDateRange(
					this.attributeIdDate0,this.indexDate0,
					this.attributeIdDate1,this.indexDate1,
					this.attributeIdColor,this.indexColor
				).concat(this.expressions),
				filters:this.filters.concat(this.getQueryFiltersDateRange(
					true,
					this.attributeIdDate0,this.indexDate0,this.getUnixFromDate(this.date0),
					this.attributeIdDate1,this.indexDate1,this.getUnixFromDate(this.date1)
				)),
				orders:this.query.orders
			},true).then(
				res => {
					// clear existing groups
					this.groups = [];
					
					// parse result rows to gantt groups
					let color            = null;
					let date0            = 0;
					let date1            = 0;
					let groups           = []; // groups 
					let groupBy          = []; // group by criteria (can be identical to label)
					let groupColumns     = []; // group column values
					let groupIndexByName = {}; // map of group indexes, key: group name
					let values           = [];
					
					for(const r of res.payload.rows) {
						groupBy      = [];
						groupColumns = [];
						
						// collect special calendar values first
						date0 = this.getDateFromUnix(r.values[0]);
						date1 = this.getDateFromUnix(r.values[1]);
						
						if(this.hasColor)
							color = r.values[2];
						
						// parse non-calendar expression values
						values = this.hasColor ? r.values.slice(3) : r.values.slice(2);
						
						for(let i = 0, j = values.length; i < j; i++) {
							
							if(!this.group0LabelExpressionIndexes.includes(i))
								continue;
							
							// add non-file attributes as group criteria
							const atr = this.attributeIdMap[this.columns[i].attributeId];
							if(atr.content !== 'files')
								groupBy.push(values[i]);
							
							groupColumns.push({
								index:i,
								value:values[i],
								vertical:this.columns[i].flags.vertical
							});
						}
						let name = groupBy.join(' ');
						
						// add group if not there yet
						if(groupIndexByName[name] === undefined) {
							groupIndexByName[name] = groups.length;
							groups.push({
								lines:[[]], // each line is an array of records
								columns:groupColumns,
								vertical:groupColumns.length === 0 ? false : groupColumns[0].vertical
							});
						}
						
						// check in which line record fits (no overlapping)
						let lineIndex = this.getFreeLineIndex(groups[groupIndexByName[name]].lines,date0,date1);
						if(lineIndex === -1) {
							lineIndex = groups[groupIndexByName[name]].lines.length;
							groups[groupIndexByName[name]].lines.push([]);
						}
						
						groups[groupIndexByName[name]].lines[lineIndex].push({
							color:color,
							date0:date0,
							date1:date1,
							row:r,
							values:values
						});
					}
					this.groups = groups;
					
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