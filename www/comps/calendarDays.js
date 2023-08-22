import MyInputCollection        from './inputCollection.js';
import MyForm                   from './form.js';
import MyValueRich              from './valueRich.js';
import {getColumnBatches}       from './shared/column.js';
import {getColumnIndexesHidden} from './shared/form.js';
import {srcBase64}              from './shared/image.js';
import {getCaption}             from './shared/language.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
import {
	colorAdjustBg,
	colorMakeContrastFont,
	getStringFilled
} from './shared/generic.js';
import {
	getDateAtUtcZero,
	getDateFormat,
	getDateFormatNoYear,
	getUnixFromDate,
	isUnixUtcZero
} from './shared/time.js';
export {MyCalendarDays as default};

let MyCalendarDaysEvent = {
	name:'my-calendar-days-event',
	components:{ MyValueRich },
	template:`<div class="eventWrap"
		@click="$emit('click')"
		@click.middle="$emit('click-middle')"
		:style="style"
	>
		<div class="event clickable shade" :style="styleCard">
			<div class="batch" v-for="b in columnBatches" :class="{ vertical:b.vertical }">
				<my-value-rich
					v-for="ind in b.columnIndexes.filter(v => values[v] !== null)"
					@clipboard="$emit('clipboard')"
					:attributeId="columns[ind].attributeId"
					:basis="columns[ind].basis"
					:bold="columns[ind].styles.includes('bold')"
					:clipboard="columns[ind].clipboard"
					:display="columns[ind].display"
					:italic="columns[ind].styles.includes('italic')"
					:key="ind"
					:length="columns[ind].length"
					:value="values[ind]"
					:wrap="columns[ind].wrap"
				/>
			</div>
		</div>
	</div>`,
	props:{
		columns:      { type:Array,  required:true },
		columnBatches:{ type:Array,  required:true },
		row:          { type:Object, required:true },
		style:        { type:String, required:true },
		styleCard:    { type:String, required:true },
		values:       { type:Array,  required:true }
	},
	emits:['click','click-middle','clipboard']
};

let MyCalendarDays = {
	name:'my-calendar-days',
	components:{
		MyCalendarDaysEvent,
		MyInputCollection
	},
	template:`<div class="calendar-days">
		
		<!-- header -->
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="new.png"
					v-if="hasCreate"
					@trigger="$emit('open-form',[],[],false)"
					@trigger-middle="$emit('open-form',[],[],true)"
					:caption="capGen.button.new"
					:captionTitle="capGen.button.newHint"
				/>
			</div>
			
			<div class="area nowrap default-inputs">
				<img class="icon"
					v-if="iconId !== null"
					:src="srcBase64(iconIdMap[iconId].file)"
				/>
				<slot name="date-select" />
			</div>
			
			<div class="area wrap default-inputs">
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
				
				<my-button image="search.png"
					@trigger="zoom = zoomDefault"
					:active="zoom !== zoomDefault"
					:captionTitle="capGen.button.zoomReset"
					:naked="true"
				/>
				<input class="zoomSlider" type="range" min="3" max="7"
					v-model="zoom"
					@change="fieldOptionSet(fieldId,'zoom',$event.target.value);"
				>
				
				<slot name="view-select" />
				
				<my-button image="calendar.png"
					v-if="!isMobile"
					@trigger="goToToday()"
					:caption="!isMobile ? capApp.today : ''"
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
				<div class="days full">
					<div class="labels fullDay">
						<div class="header"></div>
						<span v-if="events.fullDays.length !== 0"
							:style="events.fullDaysHeight"
						>{{ capApp.fullDay }}</span>
					</div>
					<div v-for="d in events.fullDays" class="day" :class="{ weekend:d.weekend }">
						<div class="header">{{ d.caption }}</div>
						<div class="events-full" :style="events.fullDaysHeight">
							<my-calendar-days-event class="full"
								v-for="ei in d.eventIndexes"
								@click="$emit('open-form',[events.fullDaysEvents[ei].row],[],false)"
								@click-middle="$emit('open-form',[events.fullDaysEvents[ei].row],[],true)"
								@clipboard="$emit('clipboard')"
								:columns="columns"
								:columnBatches="columnBatches"
								:row="events.fullDaysEvents[ei].row"
								:style="events.fullDaysEvents[ei].style"
								:styleCard="events.fullDaysEvents[ei].styleCard"
								:values="events.fullDaysEvents[ei].values"
							/>
						</div>
					</div>
				</div>
				<div class="days">
					<div class="labels">
						<span v-for="i in 24" :style="heightHourStyle" :ref="refHourLabel + i">
							{{ getStringFilled(i-1,2,'0')+':00' }}
						</span>
					</div>
					<div class="day" v-for="(d,i) in events.partDays" :class="{ weekend:d.weekend }">
					
						<div class="hourInput clickable"
							v-for="h in d.hours"
							@mousedown.left="clickHour(h,true)"
							@mouseover="hoverHour(h)"
							@mouseup.left="clickHour(h,false)"
							:class="{ active:h >= hoursInput0 && h <= hoursInput1 }"
							:style="heightHourStyle"
						></div>
					
						<my-calendar-days-event
							v-for="e in d.events"
							@click="$emit('open-form',[e.row],[],false)"
							@click-middle="$emit('open-form',[e.row],[],true)"
							@clipboard="$emit('clipboard')"
							:columns="columns"
							:columnBatches="columnBatches"
							:row="e.row"
							:style="e.style"
							:styleCard="e.styleCard"
							:values="e.values"
						/>
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
		choiceId:   { required:true, default:null },
		choices:    { type:Array,   required:true },
		columns:    { type:Array,   required:true },
		collections:{ type:Array,   required:true },
		collectionIdMapIndexes:{ type:Object, required:true },
		date:       { type:Date,    required:true }, // selected date to work around
		date0:      { type:Date,    required:true }, // start date of calendar
		date1:      { type:Date,    required:true }, // end date of calendar
		daysShow:   { type:Number,  required:true },
		iconId:     { required:true, default:null },
		fieldId:    { type:String,  required:true },
		filters:    { type:Array,   required:true },
		formLoading:{ type:Boolean, required:true },
		ics:        { type:Boolean, required:true },
		hasColor:   { type:Boolean, required:true }, // color attribute exists
		hasCreate:  { type:Boolean, required:true }, // has action for creating new record
		hasOpenForm:{ type:Boolean, required:true },
		popUpFormInline:{ required:false, default:null },
		rows:       { type:Array,   required:true }
	},
	emits:[
		'clipboard','close-inline','date-selected','open-form','reload',
		'set-choice-id','set-collection-indexes','set-date'
	],
	data() {
		return {
			hoursInput0:null,       // hours being hovered over for event input, start
			hoursInput1:null,       // hours being hovered over for event input, end
			hoursInputActive:false, // activated on first mousedown over an empty hour input
			icsToken:'',
			icsTokenName:'',
			refHourLabel:'hourLabel',
			showIcs:false,
			zoom:5,
			zoomDefault:5
		};
	},
	computed:{
		// inputs
		choiceIdInput:{
			get()  { return this.choiceId; },
			set(v) { this.$emit('set-choice-id',v); }
		},
		
		events:(s) => {
			const unix0Cal    = Math.floor(s.date0.getTime() / 1000); // unix start of calendar
			const unix0CalDay = Math.floor(s.date0.getTime() / 1000) - s.date0.getTimezoneOffset()*60;
			const dayLabel    = s.isMobile ? 'weekDayShort' : 'weekDay';
			let events = {
				fullDays:[],        // 1 day per column in calendar
				fullDaysEvents:[],  // full day events
				fullDaysLanes:[[]], // full day event lanes (event indexes per lane, to calculate overlaps)
				fullDaysHeight:'',  // total height of all full day events
				partDays:[]         // partial day events (each day has their own event blocks/lanes to manage)
			};
			
			for(let i = 0; i < s.daysShow; i++) {
				let d = new Date(s.date0.getTime());
				d.setDate(d.getDate() + i);
				
				events.fullDays.push({
					caption:`${s.capApp[dayLabel+d.getDay()]}, ${s.getDateFormatNoYear(d,s.settings.dateFormat)}`,
					eventIndexes:[],
					weekend:[0,6].includes(d.getDay())
				});
				
				let hours = [];
				for(let x = 0; x < 24; x++) {
					hours.push(unix0Cal + (i * 86400) + (x * 3600));
				}
				
				events.partDays.push({
					blocks:[], // blocks of event lanes, used to separate events with overlapping times
					events:[],
					hours:hours,
					weekend:[0,6].includes(d.getDay())
				});
			}
			
			// each row is one event (partial day, full day or spanning multiple days)
			for(const row of s.rows) {
				let ev = {
					row:row,
					style:'',
					styleCard:'',
					unix0:row.values[0],
					unix1:row.values[1],
					values:[]
				};
				
				if(s.hasColor && row.values[2] !== null) {
					const bg   = s.colorAdjustBg(row.values[2],s.settings.dark);
					const font = s.colorMakeContrastFont(bg);
					ev.styleCard = `background-color:${bg};color:${font};`;
				}
				
				// add non-hidden values
				const values = s.hasColor ? row.values.slice(3) : row.values.slice(2);
				for(let x = 0, y = values.length; x < y; x++) {
					if(!s.columnIndexesHidden.includes(x))
						ev.values.push(values[x]);
				}
				
				// check for full day event (stored as UTC zero)
				const isFullDay = s.isUnixUtcZero(ev.unix0) && s.isUnixUtcZero(ev.unix1);
				
				if(isFullDay) {
					let unix0EvCal = ev.unix0 < unix0CalDay ? unix0CalDay : ev.unix0; // start of event within calendar
					let eventDays  = ((ev.unix1 - unix0EvCal) / 86400) + 1;           // event day count from start of calendar
					let dayIndex   = Math.floor((unix0EvCal - unix0CalDay) / 86400);  // day in which event starts
					
					// cut off event length, if it goes over calendar
					if(dayIndex + eventDays > s.daysShow)
						eventDays = s.daysShow - dayIndex;
					
					if(dayIndex < 0 || dayIndex >= events.fullDays.length)
						continue;
					
					const eventIndexNew = events.fullDaysEvents.length;
					events.fullDays[dayIndex].eventIndexes.push(eventIndexNew);
					events.fullDaysEvents.push(ev);
					
					const laneIndex = s.addToFreeLane(
						events.fullDaysLanes,events.fullDaysEvents,ev,eventIndexNew,true);
					
					ev.style =
						`width:${100 * eventDays}%;`+
						`height:${s.heightHourPxFull}px;`+
						`top:${s.heightHourPxFull * laneIndex}px;`
					
					continue;
				}
				
				// partial day event
				// like Monday 19:00, until Tuesday 03:00
				const processEvent = function(evPart) {
					if(evPart.unix0 < unix0Cal)
						evPart.unix0 = unix0Cal;
					
					const d0 = new Date(evPart.unix0 * 1000);
					const d1 = new Date(evPart.unix1 * 1000);
					
					const hoursStart  = d0.getHours() + (d0.getMinutes() / 60);
					const hoursLength = (d1.getTime() - d0.getTime()) / 1000 / 3600;
					const intoNextDay = hoursStart + hoursLength > 24;
					
					const hoursLengthThisDay = !intoNextDay
						? hoursLength : hoursLength - (hoursStart + hoursLength - 24);
					
					evPart.style = 
						`height:${hoursLengthThisDay * s.heightHourPx}px;`+
						`top:${hoursStart * s.heightHourPx}px;`;
					
					// add event to correct day
					const dayIndex = evPart.unix0 < unix0Cal ? 0 : Math.floor((evPart.unix0 - unix0Cal) / 86400);
					
					if(dayIndex < 0 || dayIndex >= events.partDays.length)
						return;
					
					// add event
					const day           = events.partDays[dayIndex];
					const eventIndexNew = day.events.length;
					day.events.push(evPart);
					
					// check if a block with overlapping time already exists
					let blockFound = false;
					
					for(let block of day.blocks) {
						if(evPart.unix0 >= block.unix1 || block.unix0 >= evPart.unix1)
							continue;
						
						// add event to next free lane
						s.addToFreeLane(block.lanes,day.events,evPart,eventIndexNew,false);
						
						// if events did fit in block, extend block time range
						if(block.unix0 > evPart.unix0) block.unix0 = evPart.unix0;
						if(block.unix1 < evPart.unix1) block.unix1 = evPart.unix1;
						blockFound = true;
						break;
					}
					
					if(!blockFound) {
						// no block found, create new one and add event to first lane
						day.blocks.push({
							lanes:[[eventIndexNew]],
							unix0:evPart.unix0,
							unix1:evPart.unix1
						});
					}
					
					// if event goes into next day, duplicate event entry for next day
					if(intoNextDay) {
						let evPartCopy = JSON.parse(JSON.stringify(evPart));
						evPartCopy.unix0 += hoursLengthThisDay * 3600; // set to 00:00
						processEvent(evPartCopy);
					}
				};
				processEvent(ev);
			}
			
			// calculate total full day event height
			events.fullDaysHeight = `height:${events.fullDaysLanes.length * s.heightHourPxFull}px;`;
			
			// calculate part day event widths and positions
			for(let day of events.partDays) {
				for(let block of day.blocks) {
					const laneCount = block.lanes.length;
					
					for(let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
						for(let eventIndex of block.lanes[laneIndex]) {
							
							// check if adjacent lanes have free space for current event to take
							const ev = day.events[eventIndex];
							let lanesAvailable = 1;
							for(let laneIndexNext = laneIndex + 1; laneIndexNext < laneCount; laneIndexNext++) {
								let eventsOverlap = false;
								for(let i of block.lanes[laneIndexNext]) {
									if(ev.unix0 < day.events[i].unix1 && day.events[i].unix0 < ev.unix1) {
										eventsOverlap = true;
										break;
									}
								}
								
								// no need to check further lanes if current one already overlaps
								if(eventsOverlap)
									break;
								
								lanesAvailable++;
							}
							const percLane  = 100 / laneCount;
							const percWidth = percLane * lanesAvailable;
							const percLeft  = laneIndex * (100 / laneCount);
							
							day.events[eventIndex].style += `width:${ percWidth }%;left:${ percLeft }%;`;
						}
					}
				}
			}
			return events;
		},
		
		// helpers
		icsUrl:(s) => `${location.protocol}//${location.host}/ics/download/cal.ics`
			+ `?field_id=${s.fieldId}&login_id=${s.loginId}&token_fixed=${s.icsToken}`,
		
		// simple
		columnBatches:      (s) => s.getColumnBatches(s.columns,[],false),
		columnIndexesHidden:(s) => s.getColumnIndexesHidden(s.columns),
		hasChoices:         (s) => s.choices.length > 1,
		heightHourPx:       (s) => 12 * s.zoom,
		heightHourPxFull:   (s) => 8 * s.zoom,
		heightHourStyle:    (s) => `height:${s.heightHourPx}px;`,
		
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
	mounted() {
		// scroll to 07:00
		const el = this.$refs[this.refHourLabel + 8];
		
		if(typeof el !== 'undefined')
			el[0].scrollIntoView();
		
		// load field options
		this.zoom = this.fieldOptionGet(this.fieldId,'zoom',this.zoomDefault);
	},
	methods:{
		// externals
		colorAdjustBg,
		colorMakeContrastFont,
		fieldOptionGet,
		fieldOptionSet,
		getCaption,
		getColumnBatches,
		getColumnIndexesHidden,
		getDateAtUtcZero,
		getDateFormat,
		getDateFormatNoYear,
		getStringFilled,
		getUnixFromDate,
		isUnixUtcZero,
		srcBase64,
		
		// actions
		clickHour(hourInput,mousedown) {
			this.hoursInputActive = mousedown;
			if(mousedown) {
				this.hoursInput0 = hourInput;
				this.hoursInput1 = hourInput;
				return;
			}
			
			if(this.hoursInput0 !== null && this.hoursInput1 !== null)
				this.$emit('date-selected',this.hoursInput0,this.hoursInput1+3600,false);
			
			this.hoursInput0 = null;
			this.hoursInput1 = null;
		},
		goToToday() {
			let now = new Date();
			if(now < this.date0 || now > this.date1)
				return this.$emit('set-date',now);
			
			if(this.hasOpenForm)
				this.$emit('date-selected',this.getDateAtUtcZero(now),false,false);
		},
		hoverHour(hourInput) {
			if(!this.hoursInputActive) return;
			
			if(hourInput < this.hoursInput0)
				this.hoursInput0 = hourInput;
			else
				this.hoursInput1 = hourInput;
		},
		icsCopyToClipboard() {
			navigator.clipboard.writeText(this.icsUrl);
		},
		
		// processing
		addToFreeLane(lanes,events,event,eventIndexNew,touchMatch) {
			let laneIndex = 0;
			while(true) {
				let eventsOverlap = false;
				
				// check whether event can fit in current lane (no overlaps)
				for(let eventIndex of lanes[laneIndex]) {
					const ev = events[eventIndex];
					if(
						(!touchMatch && event.unix0 <  ev.unix1 && ev.unix0 <  event.unix1) ||
						(touchMatch  && event.unix0 <= ev.unix1 && ev.unix0 <= event.unix1)
					) {
						eventsOverlap = true;
						break;
					}
				}
				
				if(eventsOverlap) {
					laneIndex++;
					
					if(lanes.length <= laneIndex)
						lanes.push([]);
				} else {
					lanes[laneIndex].push(eventIndexNew);
					break;
				}
			}
			return laneIndex;
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