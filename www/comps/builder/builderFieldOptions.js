import {
	getDependentModules,
	getItemTitle,
	getItemTitleColumn,
	getItemTitleRelation,
	getValueFromJson,
	setValueInJson
} from '../shared/builder.js';
import {
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeString
} from '../shared/attribute.js';

export {MyBuilderFieldOptions as default};

let MyBuilderFieldOptionsCollection = {
	name:'my-builder-field-options-collection',
	template:`
		<tr>
			<td>{{ capApp.collection }}</td>
			<td>
				<select v-model="collectionId">
					<option :value="null">-</option>
					<optgroup
						v-for="m in getDependentModules(module,modules).filter(v => v.collections.length !== 0)"
						:label="m.name"
					>
						<option v-for="c in m.collections" :value="c.id">
							{{ c.name }}
						</option>
					</optgroup>
				</select>
			</td>
			<td>
				<my-button image="cancel.png"
					@trigger="$emit('remove')"
					:naked="true"
				/>
			</td>
		</tr>
		<tr class="collections-line">
			<td>{{ capApp.collectionColumnDisplay }}</td>
			<td>
				<select v-model="columnIdDisplay" :disabled="collectionId === null">
					<option :value="null">-</option>
					<option v-if="collectionId !== null" v-for="c in collectionIdMap[collectionId].columns" :value="c.id">
						{{ getItemTitleColumn(c) }}
					</option>
				</select>
			</td>
			<td></td>
		</tr>
	`,
	props:{
		module:    { type:Object, required:true },
		modelValue:{ type:Object, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		collectionId:{
			get:function()  { return this.modelValue.collectionId; },
			set:function(v) { this.set('collectionId',v); }
		},
		columnIdDisplay:{
			get:function()  { return this.modelValue.columnIdDisplay; },
			set:function(v) { this.set('columnIdDisplay',v); }
		},
		
		// stores
		modules:        function() { return this.$store.getters['schema/modules']; },
		relationIdMap:  function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap: function() { return this.$store.getters['schema/attributeIdMap']; },
		collectionIdMap:function() { return this.$store.getters['schema/collectionIdMap']; },
		capApp:         function() { return this.$store.getters.captions.builder.form; },
		capGen:         function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDependentModules,
		getItemTitleColumn,
		
		// actions
		set:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderFieldOptionsChartSerie = {
	name:'my-builder-field-options-chart-serie',
	template:`<tr>
		<td colspan="999">
			<div class="line">
				<select v-model="type">
					<option value="bar"    >{{ capApp.serieTypeBar }}</option>
					<option value="line"   >{{ capApp.serieTypeLine }}</option>
					<option value="pie"    >{{ capApp.serieTypePie }}</option>
					<option value="scatter">{{ capApp.serieTypeScatter }}</option>
				</select>
				<select v-model="columnX">
					<option disabled :value="-1">{{ capApp.serieColumnX }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(relationIdMap[attributeIdMap[c.attributeId].relationId],attributeIdMap[c.attributeId],c.index,false,false) }}
					</option>
				</select>
				<select v-model="columnY">
					<option disabled :value="-1">{{ capApp.serieColumnY }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(relationIdMap[attributeIdMap[c.attributeId].relationId],attributeIdMap[c.attributeId],c.index,false,false) }}
					</option>
				</select>
				<select v-model="tooltip">
					<option disabled :value="-1">{{ capApp.serieColumnTooltip }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(relationIdMap[attributeIdMap[c.attributeId].relationId],attributeIdMap[c.attributeId],c.index,false,false) }}
					</option>
				</select>
				<my-button image="cancel.png"
					@trigger="$emit('remove')"
					:cancel="true"
					:naked="true"
				/>
			</div>
		</td>
	</tr>`,
	props:{
		columns:   { type:Array,  required:true },
		modelValue:{ type:Object, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		columnX:{
			get:function()  { return this.get(['encode',this.type === 'pie' ? 'itemName' : 'x'],0); },
			set:function(v) { this.set(['encode',this.type === 'pie' ? 'itemName' : 'x'],v); }
		},
		columnY:{
			get:function()  { return this.get(['encode',this.type === 'pie' ? 'value' : 'y'],0); },
			set:function(v) { this.set(['encode',this.type === 'pie' ? 'value' : 'y'],v); }
		},
		serie:{
			get:function()  { return this.modelValue; },
			set:function(v) { this.$emit('update:modelValue',v); }
		},
		tooltip:{
			get:function()  { return this.get(['encode','tooltip'],0); },
			set:function(v) { this.set(['encode','tooltip'],v); }
		},
		type:{
			get:function()  { return this.get(['type'],'bar'); },
			set:function(v) { this.set(['type'],v); }
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form.chart; }
	},
	methods:{
		// externals
		getItemTitle,
		getValueFromJson,
		setValueInJson,
		
		get:function(nameChain,valueFallback) {
			return this.getValueFromJson(
				JSON.stringify(this.serie),nameChain,valueFallback
			);
		},
		set:function(nameChain,value) {
			let s = JSON.parse(JSON.stringify(this.serie));
			
			// apply encoding fix (differences between serie types)
			if(nameChain.length === 1 && nameChain[0] === 'type') {
				
				if(value === 'pie')
					s.encode = { itemName:-1, tooltip:-1, value:-1 };
				else
					s.encode = { tooltip:-1, x:-1, y:-1 };
			}
			
			this.$emit('update:modelValue',JSON.parse(
				this.setValueInJson(JSON.stringify(s),nameChain,value)
			));
		}
	}
};

let MyBuilderFieldOptionsChart = {
	name:'my-builder-field-options-chart',
	components:{MyBuilderFieldOptionsChartSerie},
	template:`
		<tr>
			<td>{{ capApp.axisType }} X</td>
			<td>
				<select v-model="axisTypeX">
					<option value="category">{{ capApp.axisTypeCategory }}</option>
					<option value="log">{{ capApp.axisTypeLog }}</option>
					<option value="time">{{ capApp.axisTypeTime }}</option>
					<option value="value">{{ capApp.axisTypeValue }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.axisType }} Y</td>
			<td>
				<select v-model="axisTypeY">
					<option value="category">{{ capApp.axisTypeCategory }}</option>
					<option value="log">{{ capApp.axisTypeLog }}</option>
					<option value="time">{{ capApp.axisTypeTime }}</option>
					<option value="value">{{ capApp.axisTypeValue }}</option>
				</select>
			</td>
		</tr>
		
		<!-- chart series -->
		<tr>
			<td>{{ capApp.series }}</td>
			<td class="minimum">
				<my-button image="add.png"
					@trigger="serieAdd"
					:caption="capGen.button.add"
				/>
			</td>
		</tr>
		<my-builder-field-options-chart-serie class="chart-option-serie"
			v-for="(s,i) in series"
			:columns="columns"
			:modelValue="s"
			@remove="serieSet(i,null)"
			@update:modelValue="serieSet(i,$event)"
		/>
		
		<!-- option input -->
		<tr>
			<td colspan="999">
				<p v-html="capApp.help"></p>
				<textarea class="chart-option" spellcheck="false"
					v-model="jsonInput"
					@input="optionInput($event.target.value)"
					:class="{error:jsonBad}"
				/>
			</td>
		</tr>
	`,
	props:{
		columns:   { type:Array,  required:true },
		modelValue:{ type:String, required:true }
	},
	emits:['update:modelValue'],
	data:function() {
		return {
			jsonBad:false,      // JSON validity check failed
			jsonFirstLoad:true, // prettify JSON input on first load
			jsonInput:''        // separated to execute JSON validity checking
		};
	},
	computed:{
		axisTypeX:{
			get:function()  { return this.getValueFromJson(this.option,['xAxis','type'],'category'); },
			set:function(v) { this.option = this.setValueInJson(this.option,['xAxis','type'],v); }
		},
		axisTypeY:{
			get:function()  { return this.getValueFromJson(this.option,['yAxis','type'],'value'); },
			set:function(v) { this.option = this.setValueInJson(this.option,['yAxis','type'],v); }
		},
		series:{
			get:function()  { return this.getValueFromJson(this.option,['series'],[]); },
			set:function(v) {}
		},
		option:{
			get:function()  { return this.modelValue; },
			set:function(v) { this.$emit('update:modelValue',v); }
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.form.chart; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	watch:{
		option:{
			handler:function(v) {
				if(this.jsonFirstLoad) {
					this.jsonInput     = JSON.stringify(JSON.parse(v),null,2);
					this.jsonFirstLoad = false;
					return;
				}
				this.jsonInput = v;
			},
			immediate:true
		}
	},
	methods:{
		// externals
		getValueFromJson,
		setValueInJson,
		
		// actions
		optionInput:function(v) {
			try{
				let o = JSON.parse(v);
				
				this.option  = v;
				this.jsonBad = false;
			}
			catch(e) {
				this.jsonBad = true;
			}
		},
		serieAdd:function() {
			let series = this.getValueFromJson(this.option,['series'],[]);
			series.push({
				type:'bar',
				encode:{
					tooltip:-1,
					x:-1,
					y:-1
				}
			});
			this.option = this.setValueInJson(this.option,['series'],series);
		},
		serieSet:function(i,value) {
			let series = this.getValueFromJson(this.option,['series'],[]);
			
			if(value === null) series.splice(i,1);
			else               series[i] = value;
			
			this.option = this.setValueInJson(this.option,['series'],series);
		}
	}
};

let MyBuilderFieldOptions = {
	name:'my-builder-field-options',
	components:{
		MyBuilderFieldOptionsChart,
		MyBuilderFieldOptionsCollection
	},
	template:`<div class="builder-field-options">
		<table class="fullWidth default-inputs"><tbody>
			<tr>
				<td>{{ capApp.onMobile }}</td>
				<td>
					<my-bool
						@update:modelValue="set('onMobile',$event)"
						:modelValue="field.onMobile"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.state }}</td>
				<td>
					<select
						@input="set('state',$event.target.value)"
						:value="field.state"
					>
						<option value="hidden">{{ capApp.stateHidden }}</option>
						<option value="default">{{ capApp.stateDefault }}</option>
						<option v-if="isData" value="optional">{{ capApp.stateOptional }}</option>
						<option v-if="isData" value="required">{{ capApp.stateRequired }}</option>
						<option v-if="isData || isButton" value="readonly">{{ capApp.stateReadonly }}</option>
					</select>
				</td>
			</tr>
			
			<tr v-if="isHeader">
				<td>{{ capApp.headerSize }}</td>
				<td>
					<select
						@input="setInt('size',$event.target.value,false)"
						:value="field.size"
					>
						<option value="1">h1</option>
						<option value="2">h2</option>
						<option value="3">h3</option>
					</select>
				</td>
			</tr>
			
			<template v-if="isData">
				<tr v-if="!isFiles && !isRelationship">
					<td>{{ capApp.fieldDefault }}</td>
					<td>
						<input
							@input="set('def',$event.target.value)"
							:placeholder="capApp.fieldDefaultHint"
							:value="field.def"
						/>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.fieldMin }}</td>
					<td>
						<input
							@input="setInt('min',$event.target.value,true)"
							:value="field.min"
						/>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.fieldMax }}</td>
					<td>
						<input
							@input="setInt('max',$event.target.value,true)"
							:value="field.max"
						/>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('display',$event.target.value)"
							:value="field.display"
						>
							<option value="default">{{ capApp.option.displayDefault }}</option>
							<option v-if="isInteger" value="datetime">{{ capApp.option.displayDatetime }}</option>
							<option v-if="isInteger" value="date"    >{{ capApp.option.displayDate }}</option>
							<option v-if="isInteger" value="time"    >{{ capApp.option.displayTime }}</option>
							<option v-if="isInteger" value="slider"  >{{ capApp.option.displaySlider }}</option>
							<option v-if="isInteger" value="login"   >{{ capApp.option.displayLogin }}</option>
							<option v-if="isString"  value="textarea">{{ capApp.option.displayTextarea }}</option>
							<option v-if="isString"  value="richtext">{{ capApp.option.displayRichtext }}</option>
							<option v-if="isString"  value="password">{{ capApp.option.displayPassword }}</option>
							<option v-if="isString"  value="color"   >{{ capApp.option.displayColor }}</option>
							<option v-if="isString"  value="email"   >{{ capApp.option.displayEmail }}</option>
							<option v-if="isString"  value="phone"   >{{ capApp.option.displayPhone }}</option>
							<option v-if="isString"  value="url"     >{{ capApp.option.displayUrl }}</option>
							<option v-if="isFiles"   value="gallery" >{{ capApp.option.displayGallery }}</option>
						</select>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.fieldRegexCheck }}</td>
					<td>
						<input
							@input="setNull('regexCheck',$event.target.value)"
							:value="field.regexCheck"
						/>
					</td>
				</tr>
				<tr v-if="isString && field.display === 'richtext'">
					<td>{{ capApp.fieldAttributeIdAltRichtextFiles }}</td>
					<td>
						<select
							@input="set('attributeIdAlt',$event.target.value)"
							:value="field.attributeIdAlt"
						>
							<option :value="null">-</option>
							<option
								v-for="a in relationIdMap[joinsIndexMap[field.index].relationId].attributes.filter(v => isAttributeFiles(v.content))"
								:value="a.id"
							>
								{{ a.name }}
							</option>
						</select>
					</td>
				</tr>
				<tr v-if="isDate || isDatetime">
					<td>{{ capApp.fieldAttributeIdAltDateTo }}</td>
					<td>
						<select
							@input="set('attributeIdAlt',$event.target.value)"
							:value="field.attributeIdAlt"
						>
							<option :value="null">-</option>
							<option
								v-for="a in relationIdMap[joinsIndexMap[field.index].relationId].attributes.filter(v => v.id !== field.attributeId && isAttributeInteger(v.content))"
								:value="a.id"
							>
								{{ a.name }}
							</option>
						</select>
					</td>
				</tr>
				<template v-if="isRelationship">
					<tr>
						<td>{{ capApp.category }}</td>
						<td>
							<my-bool
								@update:modelValue="set('category',$event)"
								:modelValue="field.category"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.filterQuick }}</td>
						<td>
							<my-bool
								@update:modelValue="set('filterQuick',$event)"
								:modelValue="field.filterQuick"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.autoSelect }}</td>
						<td>
						<input
							@input="setInt('autoSelect',$event.target.value,false)"
							:placeholder="capApp.autoSelectHint"
							:value="field.autoSelect"
						/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.fieldDefaultPresetIds }}</td>
						<td>
							<select @change="presetIdAdd($event.target.value)">
								<option value="">-</option>
								<template v-for="p in presetIdMap">
									<option
										v-if="!field.defPresetIds.includes(p.id)"
										:key="p.id"
										:value="p.id"
									>{{ p.name }}</option>
								</template>
							</select>
							
							<my-button image="cancel.png"
								v-for="presetId in field.defPresetIds"
								@trigger="presetIdRemove(presetId)"
								:caption="presetIdMap[presetId].name"
								:key="presetId"
							/>
						</td>
					</tr>
				</template>
			</template>
			
			<template v-if="isCalendar">
				<tr>
					<td>{{ capApp.date0 }}</td>
					<td>
						<select
							@input="setIndexAttribute('date0',$event.target.value)"
							:value="getIndexAttributeId(field.indexDate0,field.attributeIdDate0,false,null)"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="j in field.query.joins"
								:label="j.index+') '+relationIdMap[j.relationId].name"
							>
								<option
									v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeInteger(v.content))"
									:value="getIndexAttributeId(j.index,a.id,false,null)"
								>
									{{ a.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.date1 }}</td>
					<td>
						<select
							@input="setIndexAttribute('date1',$event.target.value)"
							:value="getIndexAttributeId(field.indexDate1,field.attributeIdDate1,false,null)"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="j in field.query.joins"
								:label="j.index+') '+relationIdMap[j.relationId].name"
							>
								<option
									v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeInteger(v.content))"
									:value="getIndexAttributeId(j.index,a.id,false,null)"
								>
									{{ a.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.dateColor }}</td>
					<td>
						<select
							@input="setIndexAttribute('color',$event.target.value)"
							:value="getIndexAttributeId(field.indexColor,field.attributeIdColor,false,null)"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="j in field.query.joins"
								:label="j.index+') '+relationIdMap[j.relationId].name"
							>
								<option
									v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeString(v.content))"
									:value="getIndexAttributeId(j.index,a.id,false,null)"
								>
									{{ a.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.gantt }}</td>
					<td>
						<my-bool
							@update:modelValue="set('gantt',$event)"
							:modelValue="field.gantt"
							:readonly="field.ics"
						/>
					</td>
				</tr>
				<template v-if="field.gantt">
					<tr>
						<td></td>
						<td><i>{{ capApp.ganttNotes }}</i></td>
					</tr>
					<tr>
						<td>{{ capApp.ganttSteps }}</td>
						<td>
							<select
								@input="setNull('ganttSteps',$event.target.value)"
								:value="field.ganttSteps"
							>
								<option value="days" >{{ capApp.option.ganttStepsDays }}</option>
								<option value="hours">{{ capApp.option.ganttStepsHours }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.ganttStepsToggle }}</td>
						<td>
							<my-bool
								@update:modelValue="set('ganttStepsToggle',$event)"
								:modelValue="field.ganttStepsToggle"
							/>
						</td>
					</tr>
				</template>
				<tr>
					<td>{{ capApp.ics }}</td>
					<td>
						<my-bool
							@update:modelValue="set('ics',$event)"
							:modelValue="field.ics"
							:readonly="field.gantt"
						/>
					</td>
				</tr>
				<template v-if="field.ics">
					<tr>
						<td>{{ capApp.dateRange0 }}</td>
						<td>
							<input
								@input="setInt('dateRange0',$event.target.value * 86400,false)"
								:placeholder="capApp.dateRangeHint"
								:value="field.dateRange0 / 86400"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.dateRange1 }}</td>
						<td>
							<input
								@input="setInt('dateRange1',$event.target.value * 86400,false)"
								:placeholder="capApp.dateRangeHint"
								:value="field.dateRange1 / 86400"
							/>
						</td>
					</tr>
				</template>
			</template>
			
			<template v-if="isContainer">
				<tr>
					<td>{{ capApp.fieldSize }}</td>
					<td>
						<input
							v-if="field.basis !== 0"
							@input="setInt('basis',$event.target.value,false)"
							:value="field.basis"
						/>
						<my-button
							v-else
							@trigger="setInt('basis',300,false)"
							:caption="capApp.fieldSize0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexSizeGrow }}</td>
					<td>
						<input
							@input="setInt('grow',$event.target.value,false)"
							:value="field.grow"
						/>
					</td>
				</tr>
				<tr v-if="field.basis !== 0">
					<td>{{ capApp.flexSizeMax }}</td>
					<td>
						<input
							@input="setInt('perMax',$event.target.value,false)"
							:value="field.perMax"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexSizeShrink }}</td>
					<td>
						<input
							@input="setInt('shrink',$event.target.value,false)"
							:value="field.shrink"
						/>
					</td>
				</tr>
				<tr v-if="field.basis !== 0">
					<td>{{ capApp.flexSizeMin }}</td>
					<td>
						<input
							@input="setInt('perMin',$event.target.value,false)"
							:value="field.perMin"
						/>
					</td>
				</tr>
				<tr>
					<td colspan="999"><b>{{ capApp.containerContentLayout }}</b></td>
				</tr>
				<tr>
					<td>{{ capApp.fieldDirection }}</td>
					<td>
						<select
							@input="set('direction',$event.target.value)"
							:value="field.direction"
						>
							<option value="row">row</option>
							<option value="column">column</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexWrap }}</td>
					<td>
						<my-bool
							@update:modelValue="set('wrap',$event)"
							:modelValue="field.wrap"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexJustifyContent }}</td>
					<td>
						<select
							@input="set('justifyContent',$event.target.value)"
							:value="field.justifyContent"
						>
							<option value="flex-start">flex-start</option>
							<option value="flex-end">flex-end</option>
							<option value="center">center</option>
							<option value="space-between">space-between</option>
							<option value="space-around">space-around</option>
							<option value="space-evenly">space-evenly</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexAlignItems }}</td>
					<td>
						<select
							@input="set('alignItems',$event.target.value)"
							:value="field.alignItems"
						>
							<option value="flex-start">flex-start</option>
							<option value="flex-end">flex-end</option>
							<option value="center">center</option>
							<option value="baseline">baseline</option>
							<option value="stretch">stretch</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexAlignContent }}</td>
					<td>
						<select
							@input="set('alignContent',$event.target.value)"
							:value="field.alignContent"
						>
							<option value="flex-start">flex-start</option>
							<option value="flex-end">flex-end</option>
							<option value="center">center</option>
							<option value="space-between">space-between</option>
							<option value="space-around">space-around</option>
							<option value="stretch">stretch</option>
						</select>
					</td>
				</tr>
			</template>
			
			<template v-if="isList">
				<tr>
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('layout',$event.target.value)"
							:value="field.layout"
						>
							<option value="table">table</option>
							<option value="cards">cards</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.limit }}</td>
					<td>
						<input
							@input="setInt('resultLimit',$event.target.value,false)"
							:value="field.resultLimit"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.autoRenew }}</td>
					<td>
						<input
							v-if="field.autoRenew !== null"
							@input="setInt('autoRenew',$event.target.value,true)"
							:placeholder="capApp.autoRenewHint"
							:value="field.autoRenew"
						/>
						<my-button
							v-else
							@trigger="setInt('autoRenew',300,false)"
							:caption="capApp.autoRenew0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.filterQuick }}</td>
					<td>
						<my-bool
							@update:modelValue="set('filterQuick',$event)"
							:modelValue="field.filterQuick"
						/>
					</td>
				</tr>
				<tr>
					<td colspan="3">
						<my-button
							@trigger="showCsv = !showCsv"
							:image="showCsv ? 'triangleDown.png' : 'triangleRight.png'"
							:caption="capApp.csvTitle"
							:naked="true"
						/>
					</td>
				</tr>
				<tr v-if="showCsv">
					<td>{{ capApp.csvImport }}</td>
					<td>
						<my-bool
							@update:modelValue="set('csvImport',$event)"
							:modelValue="field.csvImport"
						/>
					</td>
				</tr>
				<tr v-if="showCsv">
					<td>{{ capApp.csvExport }}</td>
					<td>
						<my-bool
							@update:modelValue="set('csvExport',$event)"
							:modelValue="field.csvExport"
						/>
					</td>
				</tr>
			</template>
			
			<!-- chart options -->
			<my-builder-field-options-chart
				v-if="isChart"
				@update:modelValue="set('chartOption',$event)"
				:columns="field.columns"
				:modelValue="field.chartOption"
			/>
			
			<!-- execute JS function -->
			<template v-if="isButton || isData">
				<tr>
					<td v-if="isButton">{{ capApp.jsFunctionButton }}</td>
					<td v-if="isData">{{ capApp.jsFunctionData }}</td>
					<td>
						<select
							@input="setNull('jsFunctionId',$event.target.value)"
							:value="field.jsFunctionId"
						>
							<option value="">-</option>
							<optgroup
								v-for="mod in getDependentModules(module,modules)"
								:label="mod.name"
							>
								<option
									v-for="fnc in mod.jsFunctions.filter(v => v.formId === null || v.formId === formId)"
									:value="fnc.id"
								>
									{{ fnc.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
			</template>
			
			<!-- open form -->
			<template v-if="isButton || ((isList || isCalendar || isRelationship) && field.query.relationId !== null)">
				<tr>
					<td colspan="2">
						<my-button
							@trigger="showOpenForm = !showOpenForm"
							:caption="capApp.openForm"
							:image="showOpenForm ? 'triangleDown.png' : 'triangleRight.png'"
							:naked="true"
						/>
					</td>
				</tr>
				<tr v-if="showOpenForm">
					<td>{{ capApp.openFormFormIdOpen }}</td>
					<td>
						<select
							@input="setOpenForm('formIdOpen',$event.target.value)"
							:value="isOpenForm ? field.openForm.formIdOpen : ''"
						>
							<option value="">-</option>
							<optgroup
								v-for="mod in getDependentModules(module,modules)"
								:label="mod.name"
							>
								<option v-for="f in mod.forms" :value="f.id">
									{{ f.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
			</template>
			
			<template v-if="isOpenForm && showOpenForm">
				<tr>
					<td>{{ capApp.openFormPopUp }}</td>
					<td>
						<my-bool
							@update:modelValue="setOpenForm('popUp',$event)"
							:modelValue="field.openForm.popUp"
						/>
					</td>
				</tr>
				<tr v-if="field.openForm.popUp">
					<td>{{ capApp.openFormMaxHeight }}</td>
					<td>
						<input
							@input="setOpenForm('maxHeight',$event.target.value)"
							:value="field.openForm.maxHeight"
						/>
					</td>
				</tr>
				<tr v-if="field.openForm.popUp">
					<td>{{ capApp.openFormMaxWidth }}</td>
					<td>
						<input
							@input="setOpenForm('maxWidth',$event.target.value)"
							:value="field.openForm.maxWidth"
						/>
					</td>
				</tr>
				<tr>
					<td colspan="2"><b>{{ capApp.openFormNewRecord }}</b></td>
				</tr>
				<tr>
					<td>{{ capApp.openFormRelationIndex }}</td>
					<td>
						<select
							@input="setOpenForm('relationIndex',$event.target.value)"
							:value="field.openForm.relationIndex"
						>
							<option
								v-for="j in joinsIndexMap"
								:value="j.index"
							>{{ getItemTitleRelation(j.relationId,j.index) }}</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.openFormAttributeApply }}</td>
					<td>
						<select
							@input="setOpenForm('attributeIdApply',$event.target.value)"
							:value="field.openForm.attributeIdApply !== null ? field.openForm.attributeIdApply : ''"
						>
							<option value="">-</option>
							<option
								v-for="a in openFormTargetAttributes"
								:value="a.id"
							>
								{{ relationIdMap[a.relationId].name + '.' + a.name }}
							</option>
						</select>
					</td>
				</tr>
			</template>
			
			<!-- consume collection -->
			<template v-if="isList || isCalendar">
				<tr>
					<td>
						<my-button
							@trigger="showCollections = !showCollections"
							:image="showCollections ? 'triangleDown.png' : 'triangleRight.png'"
							:caption="capApp.collectionTitle"
							:naked="true"
						/>
					</td>
					<td v-if="showCollections" colspan="2">
						<my-button image="add.png"
							@trigger="collectionAdd"
							:caption="capGen.button.add"
							:naked="true"
						/>
					</td>
				</tr>
				<template v-if="showCollections">
					<my-builder-field-options-collection
						v-for="(c,i) in field.collections"
						@remove="collectionRemove(i)"
						@update:modelValue="setCollection(i,$event)"
						:modelValue="c"
						:module="module"
					/>
					<tr v-if="field.collections.length !== 0">
						<td colspan="3">{{ capApp.collectionHint }}</td>
					</tr>
				</template>
			</template>
		</tbody></table>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		dataFields:     { type:Array,   required:true },
		field:          { type:Object,  required:true },
		formId:         { type:String,  required:true },
		joinsIndexMap:  { type:Object,  required:true },
		moduleId:       { type:String,  required:true }
	},
	data:function() {
		return {
			showCollections:false,
			showCsv:false,
			showOpenForm:false
		};
	},
	emits:['set'],
	computed:{
		attribute:function() {
			return !this.isData || typeof this.attributeIdMap[this.field.attributeId] === 'undefined'
				? false : this.attributeIdMap[this.field.attributeId];
		},
		openFormTargetAttributes:function() {
			if(!this.isOpenForm)
				return [];
			
			// parse from which relation the record is applied, based on the chosen relation index
			let recordRelationId = null;
			for(let k in this.joinsIndexMap) {
				
				if(this.joinsIndexMap[k].index === this.field.openForm.relationIndex) {
					recordRelationId = this.joinsIndexMap[k].relationId;
					break;
				}
			}
			if(recordRelationId === null)
				return [];
			
			let form = this.formIdMap[this.field.openForm.formIdOpen];
			let out  = [];
			
			// collect fitting attributes
			for(let i = 0, j = form.query.joins.length; i < j; i++) {
				let r = this.relationIdMap[form.query.joins[i].relationId];
				
				// attributes on relation from target form, in relationship with record relation
				for(let x = 0, y = r.attributes.length; x < y; x++) {
					let a = r.attributes[x];
				
					if(!this.isAttributeRelationship(a.content))
						continue;
					
					if(a.relationshipId === recordRelationId)
						out.push(a);
				}
				
				// attributes on record relation, in relationship with relation from target form
				for(let x = 0, y = this.relationIdMap[recordRelationId].attributes.length; x < y; x++) {
					let a = this.relationIdMap[recordRelationId].attributes[x];
				
					if(!this.isAttributeRelationship(a.content))
						continue;
					
					if(a.relationshipId === r.id)
						out.push(a);
				}
			}
			return out;
		},
		presetIdMap:function() {
			if(!this.isRelationship)
				return {};
			
			let nm = this.field.attributeIdNm !== null;
			let trgAtrId = nm ? this.field.attributeIdNm : this.field.attributeId;
			
			let presets = !this.field.outsideIn || nm
				? this.relationIdMap[this.attributeIdMap[trgAtrId].relationshipId].presets
				: this.relationIdMap[this.attributeIdMap[trgAtrId].relationId].presets
			;
			
			let map = {};
			for(let i = 0, j = presets.length; i < j; i++) {
				map[presets[i].id] = presets[i];
			}
			return map;
		},
		
		// simple states
		hasCaption:    function() { return this.isData || this.isHeader; },
		isButton:      function() { return this.field.content === 'button'; },
		isCalendar:    function() { return this.field.content === 'calendar'; },
		isChart:       function() { return this.field.content === 'chart'; },
		isContainer:   function() { return this.field.content === 'container'; },
		isData:        function() { return this.field.content === 'data'; },
		isDate:        function() { return this.isData && this.field.display === 'date'; },
		isDatetime:    function() { return this.isData && this.field.display === 'datetime'; },
		isHeader:      function() { return this.field.content === 'header'; },
		isList:        function() { return this.field.content === 'list'; },
		isOpenForm:    function() { return typeof this.field.openForm !== 'undefined' && this.field.openForm !== null; },
		isQuery:       function() { return this.isCalendar || this.isChart || this.isList || this.isRelationship },
		isFiles:       function() { return this.isData && this.isAttributeFiles(this.attribute.content); },
		isInteger:     function() { return this.isData && this.isAttributeInteger(this.attribute.content); },
		isRelationship:function() { return this.isData && this.isAttributeRelationship(this.attribute.content); },
		isString:      function() { return this.isData && this.isAttributeString(this.attribute.content); },
		
		// stores
		module:        function() { return this.moduleIdMap[this.moduleId]; },
		modules:       function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		formIdMap:     function() { return this.$store.getters['schema/formIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDependentModules,
		getDetailsFromIndexAttributeId,
		getIndexAttributeId,
		getItemTitleRelation,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRelationship,
		isAttributeString,
		
		// actions
		collectionAdd:function() {
			let v = JSON.parse(JSON.stringify(this.field.collections));
			v.push({
				collectionId:null,
				columnIdDisplay:null
			});
			this.set('collections',v);
		},
		collectionRemove:function(i) {
			let v = JSON.parse(JSON.stringify(this.field.collections));
			v.splice(i,1);
			this.set('collections',v);
		},
		presetIdAdd:function(value) {
			let ids = JSON.parse(JSON.stringify(this.field.defPresetIds));
			
			if(ids.includes(value))
				return;
			
			ids.push(value);
			this.set('defPresetIds',ids);
		},
		presetIdRemove:function(value) {
			let ids = JSON.parse(JSON.stringify(this.field.defPresetIds));
			
			let pos = ids.indexOf(value);
			if(pos === -1)
				return;
			
			ids.splice(pos,1);
			this.set('defPresetIds',ids);
		},
		set:function(name,val) {
			if(name === 'csvImport' && !val) {
				// no CSV import, clear query lookups
				let q = JSON.parse(JSON.stringify(this.field.query));
				q.lookups = [];
				this.$emit('set','query',q);
			}
			if(name === 'gantt') {
				// gantt, set or remove gantt step option
				if(!val) this.$emit('set','ganttSteps',null);
				else     this.$emit('set','ganttSteps','days');
			}
			this.$emit('set',name,val);
		},
		setCollection:function(i,value) {
			let v = JSON.parse(JSON.stringify(this.field.collections));
			v[i] = value;
			this.set('collections',v);
		},
		setIndexAttribute:function(name,indexAttributeId) {
			let values = this.getDetailsFromIndexAttributeId(indexAttributeId);
			
			switch(name) {
				case 'dateTo':
					this.set('attributeIdAlt',values.attributeId);
				break;
				case 'date0':
					this.set('attributeIdDate0',values.attributeId);
					this.set('indexDate0',values.index);
				break;
				case 'date1':
					this.set('attributeIdDate1',values.attributeId);
					this.set('indexDate1',values.index);
				break;
				case 'color':
					this.set('attributeIdColor',values.attributeId);
					this.set('indexColor',values.index);
				break;
			}
		},
		setInt:function(name,val,allowNull) {
			if(val !== '')
				return this.set(name,parseInt(val));
			
			if(allowNull) return this.set(name,null);
			else          return this.set(name,0);
		},
		setNull:function(name,val) {
			this.set(name,val === '' ? null : val);
		},
		setOpenForm:function(name,val) {
			
			// clear if no form is opened
			if(name === 'formIdOpen' && val === '')
				return this.set('openForm',null);
			
			let v = JSON.parse(JSON.stringify(this.field.openForm));
			
			// set initial value if empty
			if(v === null) {
				v = {
					formIdOpen:null,
					attributeIdApply:null,
					relationIndex:0,
					popUp:false,
					maxHeight:0,
					maxWidth:0
				};
			}
			
			// set changed value
			if(['relationIndex','maxHeight','maxWidth'].includes(name))
				val = parseInt(val);
			
			if(name === 'attributeIdApply' && val === '')
				val = null;
			
			if(name === 'formIdOpen')
				v.attributeIdApply = null;
			
			v[name] = val;
			this.set('openForm',v);
		}
	}
};