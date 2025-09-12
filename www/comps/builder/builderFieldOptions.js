import MyBuilderCaption                from './builderCaption.js';
import MyBuilderCollectionInput        from './builderCollectionInput.js';
import MyBuilderIconInput              from './builderIconInput.js';
import MyBuilderOpenFormInput          from './builderOpenFormInput.js';
import MyCodeEditor                    from '../codeEditor.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import {getJoinIndexMap}               from '../shared/query.js';
import {
	getNilUuid,
	getRandomInt,
	openLink
} from '../shared/generic.js';
import {
	getDependentModules,
	getItemTitle,
	getItemTitlePath,
	getValueFromJson,
	setValueInJson
} from '../shared/builder.js';
import {
	getAttributeIcon,
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRegconfig,
	isAttributeRelationship,
	isAttributeString
} from '../shared/attribute.js';

export {MyBuilderFieldOptions as default};

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
						{{ getItemTitle(c.attributeId,c.index,false,null) }}
					</option>
				</select>
				<select v-model="columnY">
					<option disabled :value="-1">{{ capApp.serieColumnY }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(c.attributeId,c.index,false,null) }}
					</option>
				</select>
				<select v-model="tooltip">
					<option disabled :value="-1">{{ capApp.serieColumnTooltip }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(c.attributeId,c.index,false,null) }}
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
			get()  { return this.get(['encode',this.type === 'pie' ? 'itemName' : 'x'],0); },
			set(v) { this.set(['encode',this.type === 'pie' ? 'itemName' : 'x'],v); }
		},
		columnY:{
			get()  { return this.get(['encode',this.type === 'pie' ? 'value' : 'y'],0); },
			set(v) { this.set(['encode',this.type === 'pie' ? 'value' : 'y'],v); }
		},
		serie:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		tooltip:{
			get()  { return this.get(['encode','tooltip'],0); },
			set(v) { this.set(['encode','tooltip'],v); }
		},
		type:{
			get()  { return this.get(['type'],'bar'); },
			set(v) { this.set(['type'],v); }
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form.chart
	},
	methods:{
		// externals
		getItemTitle,
		getValueFromJson,
		setValueInJson,
		
		get(nameChain,valueFallback) {
			return this.getValueFromJson(
				JSON.stringify(this.serie),nameChain,valueFallback
			);
		},
		set(nameChain,value) {
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
	components:{
		MyBuilderFieldOptionsChartSerie,
		MyCodeEditor
	},
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
				<div class="chart-option" :class="{error:jsonBad}">
					<my-code-editor mode="json"
						@update:modelValue="optionInput($event)"
						:modelValue="jsonInput"
					/>
				</div>
			</td>
		</tr>
	`,
	props:{
		columns:   { type:Array,  required:true },
		modelValue:{ type:String, required:true }
	},
	emits:['update:modelValue'],
	data() {
		return {
			jsonBad:false,      // JSON validity check failed
			jsonFirstLoad:true, // prettify JSON input on first load
			jsonInput:''        // separated to execute JSON validity checking
		};
	},
	computed:{
		axisTypeX:{
			get()  { return this.getValueFromJson(this.option,['xAxis','type'],'category'); },
			set(v) { this.option = this.setValueInJson(this.option,['xAxis','type'],v); }
		},
		axisTypeY:{
			get()  { return this.getValueFromJson(this.option,['yAxis','type'],'value'); },
			set(v) { this.option = this.setValueInJson(this.option,['yAxis','type'],v); }
		},
		series:{
			get()  { return this.getValueFromJson(this.option,['series'],[]); },
			set(v) {}
		},
		option:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.form.chart,
		capGen:(s) => s.$store.getters.captions.generic
	},
	watch:{
		option:{
			handler(v) {
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
		optionInput(v) {
			try{
				let o = JSON.parse(v);
				
				this.option  = v;
				this.jsonBad = false;
			}
			catch(e) {
				this.jsonBad = true;
			}
		},
		serieAdd() {
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
		serieSet(i,value) {
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
		MyBuilderCaption,
		MyBuilderCollectionInput,
		MyBuilderFieldOptionsChart,
		MyBuilderIconInput,
		MyBuilderOpenFormInput
	},
	template:`<div class="builder-field-options">
		<table class="generic-table-vertical default-inputs">
			<tbody>
				<tr v-if="isButton || isChart || isData || isList || isTabs || (isHeader && !field.richtext)">
					<td>{{ capGen.title }}</td>
					<td>
						<my-builder-caption
							@update:modelValue="field.captions.fieldTitle = $event;set('captions',field.captions)"
							:language="builderLanguage"
							:modelValue="field.captions.fieldTitle"
						/>
					</td>
				</tr>
				<tr v-if="isData">
					<td>{{ capApp.fieldHelp }}</td>
					<td>
						<my-builder-caption
							@update:modelValue="field.captions.fieldHelp = $event;set('captions',field.captions)"
							:language="builderLanguage"
							:modelValue="field.captions.fieldHelp"
							:multiLine="true"
						/>
					</td>
				</tr>
				<tr v-if="!isChart && !isContainer && (!isHeader || !field.richtext)">
					<td>{{ capGen.icon }}</td>
					<td>
						<my-builder-icon-input
							@input="set('iconId',$event)"
							:icon-id-selected="field.iconId"
							:module="module"
							:title="capGen.icon"
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
				<tr>
					<td>{{ capGen.visibility }}</td>
					<td>
						<div class="row gap wrap">
							<my-button-check
								@update:modelValue="set('onMobile',$event)"
								:caption="capApp.onMobile"
								:modelValue="field.onMobile"
							/>
						</div>
					</td>
				</tr>
				
				<template v-if="isHeader">
					<tr>
						<td>{{ capApp.headerRichtext }}</td>
						<td>
							<my-bool
								@update:modelValue="set('richtext',$event)"
								:modelValue="field.richtext"
							/>
						</td>
					</tr>
					<tr v-if="field.richtext">
						<td colspan="2">
							<div class="headerRichtext">
								<my-builder-caption
									@update:modelValue="field.captions.fieldTitle = $event;set('captions',field.captions)"
									:language="builderLanguage"
									:modelValue="field.captions.fieldTitle"
									:richtext="true"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="!field.richtext">
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
				</template>
				
				<template v-if="isData && !isVariable">
					<tr>
						<td>{{ capGen.attribute }}</td>
						<td>
							<div class="row centered gap">
								<input disabled="disabled"
									:title="getItemTitlePath(field.attributeId)"
									:value="getItemTitle(field.attributeId,field.index,field.outsideIn,field.attributeIdNm)"
								/>
								<my-button
									:active="false"
									:image="getAttributeIcon(attribute.content,attribute.contentUse,field.outsideIn,field.attributeIdNm !== null)"
									:naked="true"
								/>
								<my-button image="open.png"
									@trigger="openAttribute(attribute.relationId,false)"
									@trigger-middle="openAttribute(attribute.relationId,true)"
									:caption="capGen.open"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="!isDrawing && !isRelationship && !isRegconfig">
						<td>{{ capApp.fieldMin }}</td>
						<td>
							<input
								@input="setInt('min',$event.target.value,true)"
								:value="field.min"
							/>
						</td>
					</tr>
					<tr v-if="!isDrawing && !isRelationship && !isRegconfig">
						<td>{{ capApp.fieldMax }}</td>
						<td>
							<input
								@input="setInt('max',$event.target.value,true)"
								:value="field.max"
							/>
						</td>
					</tr>
					<tr v-if="!isRelationship && displayOptions.length > 1">
						<td>{{ capApp.display }}</td>
						<td>
							<select
								@input="set('display',$event.target.value)"
								:value="field.display"
							>
								<option v-for="o in displayOptions" :value="o">{{ capApp.option.display[o] }}</option>
							</select>
						</td>
					</tr>
					<tr v-if="!isDrawing && !isRelationship">
						<td>{{ capApp.fieldRegexCheck }}</td>
						<td>
							<input
								@input="setNull('regexCheck',$event.target.value)"
								:value="field.regexCheck"
							/>
						</td>
					</tr>
					
					<!-- default values -->
					<tr v-if="!isFiles && !isDrawing && !isRelationship">
						<td>{{ capApp.fieldDefault }}</td>
						<td>
							<div class="column gap">
								<select
									v-if="systemDefaults.length !== 0"
									@input="set('def',$event.target.value)"
									:value="systemDefaultUsed ? field.def : ''"
								>
									<option value="">[{{ capApp.systemDefaults.fixed }}]</option>
									<option v-for="d in systemDefaults" :value="d">{{ capApp.systemDefaults[d] }}</option>
								</select>
								<input
									v-if="!systemDefaultUsed"
									@input="set('def',$event.target.value)"
									:value="field.def"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="!isFiles && !isDrawing && field.def === ''">
						<td>{{ capApp.collectionIdDef }}</td>
						<td>
							<my-builder-collection-input
								@update:consumer="set('defCollection',$event)"
								:allowFormOpen="false"
								:allowRemove="false"
								:consumer="field.defCollection"
								:fixedCollection="false"
								:flagsEnable="[]"
								:module="module"
								:readonly="false"
								:showOnMobile="false"
							/>
						</td>
					</tr>
					<tr v-if="isRelationship">
						<td>{{ capApp.fieldDefaultPresetIds }}</td>
						<td>
							<div class="column gap">
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
								
								<div class="row gap wrap" v-if="field.defPresetIds.length !== 0">
									<my-button image="cancel.png"
										v-for="presetId in field.defPresetIds"
										@trigger="presetIdRemove(presetId)"
										:caption="presetIdMap[presetId].name"
										:key="presetId"
									/>
								</div>
							</div>
						</td>
					</tr>
					
					<!-- alternative field inputs -->
					<tr v-if="isString && attribute.contentUse === 'richtext'">
						<td>{{ capApp.fieldAttributeIdAltRichtextFiles }}</td>
						<td>
							<select
								@input="setNull('attributeIdAlt',$event.target.value)"
								:value="field.attributeIdAlt"
							>
								<option value="">-</option>
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
								@input="setNull('attributeIdAlt',$event.target.value)"
								:value="field.attributeIdAlt"
							>
								<option value="">-</option>
								<option
									v-for="a in relationIdMap[joinsIndexMap[field.index].relationId].attributes.filter(v => v.id !== field.attributeId && v.contentUse === attribute.contentUse)"
									:value="a.id"
								>
									{{ a.name }}
								</option>
							</select>
						</td>
					</tr>
					
					<!-- relationship inputs -->
					<template v-if="isRelationship">
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
					</template>
				</template>

				<!-- general field options -->
				<tr v-if="isData && !isFiles && !isDate && !isDatetime && !isTime">
					<td>{{ capGen.options }}</td>
					<td>
						<div class="row gap wrap">
							<template v-if="!isRelationship">
								<my-button-check
									v-if="!isDrawing"
									@update:modelValue="setFlags('clipboard',$event)"
									:caption="capGen.clipboard"
									:modelValue="field.flags.includes('clipboard')"
								/>
								<my-button-check
									v-if="!isDrawing"
									@update:modelValue="setFlags('monospace',$event)"
									:caption="capGen.monospace"
									:modelValue="field.flags.includes('monospace')"
								/>
								<my-button-check
									v-if="isIFrame || isBarcode || isDrawing"
									@update:modelValue="setFlags('hideInputs',$event)"
									:caption="capApp.fieldFlags.hideInputs"
									:modelValue="field.flags.includes('hideInputs')"
								/>
							</template>
							<template v-if="isRelationship">
								<my-button-check
									@update:modelValue="setFlags('relCategory',$event)"
									:active="!field.flags.includes('relFlow')"
									:caption="capApp.fieldFlags.relCategory"
									:modelValue="field.flags.includes('relCategory')"
								/>
								<my-button-check
									@update:modelValue="setFlags('relFlow',$event)"
									:active="!field.flags.includes('relCategory') && !isRelationship1N"
									:caption="capApp.fieldFlags.relFlow"
									:modelValue="field.flags.includes('relFlow')"
								/>
								<my-button-check
									v-if="!isVariable"
									@update:modelValue="set('filterQuick',$event)"
									:caption="capApp.filterQuick"
									:modelValue="field.filterQuick"
								/>
							</template>
						</div>
					</td>
				</tr>

				<tr v-if="isData && !isFiles && !isDrawing && !isRelationship && !isDate && !isDatetime && !isTime && !isIFrame">
					<td>{{ capGen.alignment }}</td>
					<td>
						<select v-model="alignment">
							<option value="def">{{ capGen.alignmentHor.left }}</option>
							<option value="end">{{ capGen.alignmentHor.right }}</option>
						</select>
					</td>
				</tr>
				
				<template v-if="isCalendar">
					<tr>
						<td>{{ capApp.date0 }}</td>
						<td>
							<select
								@input="setIndexAttribute('date0',$event.target.value)"
								:value="getIndexAttributeId(field.indexDate0,field.attributeIdDate0,false,null)"
							>
								<option :value="getIndexAttributeId(null,null,false,null)">-</option>
								<optgroup
									v-for="j in field.query.joins"
									:label="j.index+' '+relationIdMap[j.relationId].name"
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
								<option :value="getIndexAttributeId(null,null,false,null)">-</option>
								<optgroup
									v-for="j in field.query.joins"
									:label="j.index+' '+relationIdMap[j.relationId].name"
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
								<option :value="getIndexAttributeId(null,null,false,null)">-</option>
								<optgroup
									v-for="j in field.query.joins"
									:label="j.index+' '+relationIdMap[j.relationId].name"
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
					<template v-if="!field.gantt">
						<tr>
							<td>{{ capApp.days }}</td>
							<td>
								<select
									@input="setInt('days',$event.target.value,false)"
									:value="field.days"
								>
									<option :value="1" >{{ capCal.option.days1  }}</option>
									<option :value="3" >{{ capCal.option.days3  }}</option>
									<option :value="5" >{{ capCal.option.days5  }}</option>
									<option :value="7" >{{ capCal.option.days7  }}</option>
									<option :value="42">{{ capCal.option.days42 }}</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.daysToggle }}</td>
							<td>
								<my-bool
									@update:modelValue="set('daysToggle',$event)"
									:modelValue="field.daysToggle"
								/>
							</td>
						</tr>
					</template>
					<template v-if="field.gantt">
						<tr>
							<td>{{ capApp.gantt }}</td>
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
					<tr v-if="!field.gantt">
						<td>{{ capApp.ics }}</td>
						<td>
							<my-bool
								@update:modelValue="set('ics',$event)"
								:modelValue="field.ics"
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
							<div class="row gap" v-if="field.basis !== 0">
								<input class="short"
									@input="setInt('basis',$event.target.value,false)"
									:value="field.basis"
								/>
								<my-button image="add.png"
									@trigger="setInt('basis',field.basis+50,false)"
								/>
								<my-button image="remove.png"
									@trigger="setInt('basis',field.basis-50,false)"
									:active="field.basis >= 50"
								/>
							</div>
							<my-button
								v-if="field.basis === 0"
								@trigger="setInt('basis',300,false)"
								:caption="capApp.fieldSize0"
								:naked="true"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.flexSizeGrow }}</td>
						<td>
							<div class="row gap">
								<input class="short"
									@input="setInt('grow',$event.target.value,false)"
									:value="field.grow"
								/>
								<my-button image="add.png"
									@trigger="setInt('grow',field.grow+1,false)"
								/>
								<my-button image="remove.png"
									@trigger="setInt('grow',field.grow-1,false)"
									:active="field.grow > 0"
								/>
							</div>
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
							<div class="row gap">
								<input class="short"
									@input="setInt('shrink',$event.target.value,false)"
									:value="field.shrink"
								/>
								<my-button image="add.png"
									@trigger="setInt('shrink',field.shrink+1,false)"
								/>
								<my-button image="remove.png"
									@trigger="setInt('shrink',field.shrink-1,false)"
									:active="field.shrink > 0"
								/>
							</div>
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
						<td colspan="2"><b>{{ capApp.containerContent }}</b></td>
					</tr>
					<tr>
						<td>{{ capApp.fieldDirection }}</td>
						<td>
							<div class="row gap">
								<select
									@input="set('direction',$event.target.value)"
									:value="field.direction"
								>
									<option value="row">row</option>
									<option value="column">column</option>
								</select>
								<my-button
									@trigger="set('direction',field.direction === 'row' ? 'column' : 'row' )"
									:captionTitle="capApp.fieldDirection+': '+field.direction"
									:image="field.direction === 'row' ? 'flexRow.png' : 'flexColumn.png'"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.flexWrap }}</td>
						<td>
							<div class="row gap">
								<my-bool
									@update:modelValue="set('wrap',$event)"
									:modelValue="field.wrap"
								/>
								<my-button
									:active="false"
									:captionTitle="capApp.flexWrap+': '+field.wrap"
									:image="field.wrap ? 'wrap1.png' : 'wrap0.png'"
									:naked="true"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.flexJustifyContent }}</td>
						<td>
							<div class="row gap">
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
								<my-button
									:active="false"
									:captionTitle="capApp.flexJustifyContentHint"
									:image="field.direction === 'row' ? 'axisX.png' : 'axisY.png'"
									:naked="true"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.flexAlignItems }}</td>
						<td>
							<div class="row gap">
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
								<my-button
									:active="false"
									:captionTitle="capApp.flexAlignItemsHint"
									:image="field.direction === 'row' ? 'axisY.png' : 'axisX.png'"
									:naked="true"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.flexAlignContent }}</td>
						<td>
							<div class="row gap">
								<select
									@input="set('alignContent',$event.target.value)"
									:disabled="!field.wrap"
									:value="field.alignContent"
								>
									<option value="flex-start">flex-start</option>
									<option value="flex-end">flex-end</option>
									<option value="center">center</option>
									<option value="space-between">space-between</option>
									<option value="space-around">space-around</option>
									<option value="space-evenly">space-evenly</option>
									<option value="stretch">stretch</option>
								</select>
								<my-button
									:active="false"
									:captionTitle="capApp.flexAlignContentHint"
									:image="field.direction === 'row' ? 'axisXAlign.png' : 'axisYAlign.png'"
									:naked="true"
								/>
							</div>
						</td>
					</tr>
				</template>
				
				<template v-if="isTabs">
					<tr>
						<td>
							<div class="column">
								<span>{{ capApp.tabs }}</span>
								<my-button image="add.png"
									@trigger="tabAdd(i)"
									:caption="capGen.button.add"
									:naked="true"
								/>
							</div>
						</td>
						<td>
							<div class="column">
								<table>
									<thead>
										<tr>
											<th colspan="2"></th>
											<th>{{ capGen.title }}</th>
											<th :title="capApp.tabContentCounterHint">{{ capApp.tabContentCounter }}</th>
											<th colspan="2">{{ capGen.status }}</th>
										</tr>
									</thead>
									<draggable handle=".dragAnchor" group="tabs" itemKey="id" animation="100" tag="tbody"
										:fallbackOnBody="true"
										:list="field.tabs"
									>
										<template #item="{element,index}">
											<tr>
												<td><img class="action dragAnchor" src="images/drag.png" /></td>
												<td>T{{ typeof entityIdMapRef.tab[element.id] !== 'undefined' ? entityIdMapRef.tab[element.id] : '' }}</td>
												<td>
													<my-builder-caption
														@update:modelValue="element.captions.tabTitle = $event;set('tabs',field.tabs)"
														:language="builderLanguage"
														:modelValue="element.captions.tabTitle"
													/>
												</td>
												<td>
													<my-bool
														@update:modelValue="element.contentCounter = $event;set('tabs',field.tabs)"
														:modelValue="element.contentCounter"
													/>
												</td>
												<td>
													<select class="short"
														@input="element.state = $event.target.value;set('tabs',field.tabs)"
														:value="element.state"
													>
														<option value="hidden">{{ capApp.stateHidden }}</option>
														<option value="default">{{ capApp.stateDefault }}</option>
													</select>
												</td>
												<td>
													<my-button image="cancel.png"
														@trigger="field.tabs.splice(index,1);set('tabs',field.tabs)"
														:active="field.tabs.length > 1"
														:naked="true"
													/>
												</td>
											</tr>
										</template>
									</draggable>
								</table>
							</div>
						</td>
					</tr>
				</template>
				
				<template v-if="isKanban">
					<tr v-if="field.query.relationId !== null">
						<td>{{ capApp.kanban.relationIndexData }}</td>
						<td>
							<div class="row gap">
								<select
									@input="setInt('relationIndexData',$event.target.value,true)"
									:value="field.relationIndexData === null ? '' : field.relationIndexData"
								>
									<option value="">-</option>
									<option
										v-for="j in field.query.joins"
										:value="j.index"
									>{{ j.index+' '+relationIdMap[j.relationId].name }}</option>
								</select>
								<my-button image="question.png"
									@trigger="showHelp(capApp.kanban.relationIndexDataHelp)"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="field.relationIndexData !== null">
						<td>{{ capApp.kanban.relationIndexAxisX }}</td>
						<td>
							<div class="row gap">
								<select
									@input="setInt('relationIndexAxisX',$event.target.value,true)"
									:value="field.relationIndexAxisX === null ? '' : field.relationIndexAxisX"
								>
									<option value="">-</option>
									<option
										v-for="j in joinsKanbanAxis.filter(v => v.index !== field.relationIndexAxisY)"
										:value="j.index"
									>{{ j.index+' '+relationIdMap[j.relationId].name }}</option>
								</select>
								<my-button image="question.png"
									@trigger="showHelp(capApp.kanban.relationIndexAxisXHelp)"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="field.relationIndexData !== null">
						<td>{{ capApp.kanban.relationIndexAxisY }}</td>
						<td>
							<div class="row gap">
								<select
									@input="setInt('relationIndexAxisY',$event.target.value,true)"
									:value="field.relationIndexAxisY === null ? '' : field.relationIndexAxisY"
								>
									<option value="">-</option>
									<option
										v-for="j in joinsKanbanAxis.filter(v => v.index !== field.relationIndexAxisX)"
										:value="j.index"
									>{{ j.index+' '+relationIdMap[j.relationId].name }}</option>
								</select>
								<my-button image="question.png"
									@trigger="showHelp(capApp.kanban.relationIndexAxisYHelp)"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="field.relationIndexData !== null">
						<td v-html="capApp.kanban.attributeIdSort"></td>
						<td>
							<div class="row gap">
								<select
									@input="setNull('attributeIdSort',$event.target.value)"
									:value="field.attributeIdSort === null ? '' : field.attributeIdSort"
								>
									<option value="">-</option>
									<optgroup v-for="j in field.query.joins.filter(v => v.index === field.relationIndexData)"
										:label="j.index+' '+relationIdMap[j.relationId].name"
									>
										<option
											v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeInteger(v.content) && v.name !== 'id')"
											:value="a.id"
										>
											{{ a.name }}
										</option>
									</optgroup>
								</select>
								<my-button image="question.png"
									@trigger="showHelp(capApp.kanban.attributeIdSortHelp)"
								/>
							</div>
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
						<td>{{ capApp.csvImport }}</td>
						<td>
							<my-bool
								@update:modelValue="set('csvImport',$event)"
								:modelValue="field.csvImport"
							/>
						</td>
					</tr>
					<tr>
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

				<!-- variable -->
				<tr v-if="isVariable">
					<td>{{ capGen.variable }}</td>
					<td>
						<div class="row gap">
							<select
								@input="setNull('variableId',$event.target.value)"
								:value="field.variableId"
							>
								<option value="">-</option>
								<option v-for="v in module.variables.filter(v => v.formId === formId)" :value="v.id">
									{{ v.name }}
								</option>
								<option v-for="v in module.variables.filter(v => v.formId === null)" :value="v.id">
									{{ '[' + capGen.global + '] ' + v.name }}
								</option>
							</select>
							<my-button
								v-if="field.variableId !== null"
								:active="false"
								:image="getAttributeIcon(variableIdMap[field.variableId].content,variableIdMap[field.variableId].contentUse,false,false)"
								:naked="true"
							/>
							<my-button image="add.png"
								v-if="field.variableId === null"
								@trigger="$emit('createNew','variable',{formId:formId})"
								:captionTitle="capGen.button.new"
							/>
							<my-button image="open.png"
								v-if="field.variableId !== null"
								@trigger="$router.push('/builder/variables/'+moduleId+'?variableIdEdit='+field.variableId)"
								:captionTitle="capGen.button.open"
							/>
						</div>
					</td>
				</tr>
				
				<!-- execute JS function -->
				<tr v-if="isButton || isData">
					<td v-if="isButton">{{ capApp.jsFunctionButton }}</td>
					<td v-if="isData">{{ capApp.jsFunctionData }}</td>
					<td>
						<div class="row gap">
							<select
								@input="setNull('jsFunctionId',$event.target.value)"
								:value="field.jsFunctionId"
							>
								<option value="">-</option>
								<option v-for="fnc in module.jsFunctions.filter(v => v.formId === formId)" :value="fnc.id">
									{{ fnc.name }}
								</option>
								<option v-for="fnc in module.jsFunctions.filter(v => v.formId === null)" :value="fnc.id">
									{{ '[' + capGen.global + '] ' + fnc.name }}
								</option>
								<optgroup
									v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.jsFunctions.length !== 0)"
									:label="mod.name"
								>
									<option v-for="fnc in mod.jsFunctions.filter(v => v.formId === null)" :value="fnc.id">
										{{ '[' + capGen.global + '] ' + fnc.name }}
									</option>
								</optgroup>
							</select>
							<my-button image="add.png"
								v-if="field.jsFunctionId === null"
								@trigger="$emit('createNew','jsFunction',{formId:formId})"
								:captionTitle="capGen.button.new"
							/>
							<my-button image="open.png"
								v-if="field.jsFunctionId !== null"
								@trigger="$router.push('/builder/js-function/'+field.jsFunctionId)"
								:captionTitle="capGen.button.open"
							/>
						</div>
					</td>
				</tr>
				
				<!-- open form & open form bulk -->
				<tr v-if="hasOpenForm">
					<td>{{ capApp.openForm }}</td>
					<td>
						<my-builder-open-form-input
							@update:openForm="set('openForm',$event)"
							:allowAllForms="isButton"
							:allowNewRecords="true"
							:allowPopUpInline="isCalendar || isKanban || isList"
							:joinsIndexMap="joinsIndexMap"
							:joinsIndexMapField="joinsIndexMapField"
							:module="module"
							:openForm="field.openForm"
						/>
					</td>
				</tr>
				<tr v-if="isList && field.query.relationId !== null">
					<td v-html="capApp.openFormBulk"></td>
					<td>
						<my-builder-open-form-input
							@update:openForm="set('openFormBulk',$event)"
							:allowAllForms="false"
							:allowNewRecords="false"
							:allowPopUpInline="true"
							:forcePopUp="true"
							:joinsIndexMap="joinsIndexMap"
							:joinsIndexMapField="joinsIndexMapField"
							:module="module"
							:openForm="field.openFormBulk"
						/>
					</td>
				</tr>
				
				<!-- consume collection -->
				<template v-if="isList || isCalendar || isKanban">
					<tr>
						<td>
							<div class="column">
								<span>{{ capApp.collectionTitle }}</span>
								<my-button image="add.png"
									@trigger="collectionAdd"
									:caption="capGen.button.add"
									:naked="true"
								/>
							</div>
						</td>
						<td>
							<div class="builder-field-options-collection-label">
								<my-builder-collection-input
									v-for="(c,i) in field.collections"
									@remove="collectionRemove(i)"
									@update:consumer="setCollection(i,$event)"
									:allowFormOpen="false"
									:allowRemove="true"
									:consumer="c"
									:fixedCollection="false"
									:flagsEnable="['multiValue']"
									:module="module"
									:readonly="false"
									:showOnMobile="false"
								/>
								<span v-if="field.collections.length !== 0">{{ capApp.collectionHint }}</span>
							</div>
						</td>
					</tr>
				</template>
			</tbody>
		</table>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		dataFields:     { type:Array,  required:true },
		entityIdMapRef: { type:Object, required:true },
		field:          { type:Object, required:true },
		formId:         { type:String, required:true },
		joinsIndexMap:  { type:Object, required:true },
		moduleId:       { type:String, required:true }
	},
	emits:['createNew','set'],
	computed:{
		displayOptions:(s) => {
			let out = ['default'];
			if(s.isInteger && s.isDisplayDefault) out.push('rating','slider','login');
			if(s.isString  && s.isDisplayDefault) out.push('password','email','phone','url');
			if(s.isFiles)                         out.push('gallery');
			return out;
		},
		joinsIndexMapField:(s) => {
			return s.isQuery ? s.getJoinIndexMap(s.field.query.joins) : {};
		},
		joinsKanbanAxis:(s) => {
			if(!s.isKanban || s.field.relationIndexData === null)
				return [];

			const joinData = s.joinsIndexMapField[s.field.relationIndexData];
			return s.field.query.joins.filter(v => v.indexFrom === joinData.index || v.index === joinData.indexFrom);
		},
		presetIdMap:(s) => {
			if(!s.isRelationship)
				return {};
			
			let nm = s.field.attributeIdNm !== null;
			let trgAtrId = nm ? s.field.attributeIdNm : s.field.attributeId;
			
			let presets = !s.field.outsideIn || nm
				? s.relationIdMap[s.attributeIdMap[trgAtrId].relationshipId].presets
				: s.relationIdMap[s.attributeIdMap[trgAtrId].relationId].presets;
			
			let map = {};
			for(let i = 0, j = presets.length; i < j; i++) {
				map[presets[i].id] = presets[i];
			}
			return map;
		},
		systemDefaults:(s) => {
			if(s.isRichtext || s.isBarcode || s.isIFrame) return [];
			if(s.isDate)     return ['{CURR_DATE}'];
			if(s.isDatetime) return ['{CURR_DATETIME}'];
			if(s.isTime)     return ['{CURR_TIME}'];
			if(s.isString)   return ['{CURR_DATE_YYYY}','{CURR_DATE_MM}','{CURR_DATE_DD}'];
			if(s.isBoolean)  return ['true','false'];
			return [];
		},

		// inputs
		alignment:{
			get()  {
				if(this.field.flags.includes('alignEnd')) return 'end';
				return 'def';
			},
			set(v) {
				let flags = JSON.parse(JSON.stringify(this.field.flags));
				if(v !== 'end' &&  flags.includes('alignEnd')) flags.splice(flags.indexOf('alignEnd'),1);
				if(v === 'end' && !flags.includes('alignEnd')) flags.push('alignEnd');
				this.field.flags = flags;
			}
		},
		
		// simple states
		content:          (s) => s.isVariable ? 'data' : s.field.content,
		contentData:      (s) => s.isData && !s.isVariable ? s.attribute.content    : s.variable.content,
		contentUse:       (s) => s.isData && !s.isVariable ? s.attribute.contentUse : s.variable.contentUse,
		hasCaption:       (s) => s.isData || s.isHeader,
		hasOpenForm:      (s) => !s.isVariable && (s.isButton || ((s.isList || s.isCalendar || s.isKanban || s.isRelationship) && s.field.query.relationId !== null)),
		isBarcode:        (s) => s.isData && s.contentUse === 'barcode',
		isBoolean:        (s) => s.isData && s.isAttributeBoolean(s.contentData),
		isButton:         (s) => s.content === 'button',
		isCalendar:       (s) => s.content === 'calendar',
		isChart:          (s) => s.content === 'chart',
		isContainer:      (s) => s.content === 'container',
		isData:           (s) => s.content === 'data',
		isDate:           (s) => s.isData && s.contentUse === 'date',
		isDatetime:       (s) => s.isData && s.contentUse === 'datetime',
		isDisplayDefault: (s) => s.isData && s.contentUse === 'default',
		isDrawing:        (s) => s.isData && s.contentUse === 'drawing',
		isFiles:          (s) => s.isData && s.isAttributeFiles(s.contentData),
		isHeader:         (s) => s.content === 'header',
		isIFrame:         (s) => s.isData && s.contentUse === 'iframe',
		isInteger:        (s) => s.isData && s.isAttributeInteger(s.contentData),
		isList:           (s) => s.content === 'list',
		isKanban:         (s) => s.content === 'kanban',
		isQuery:          (s) => s.isCalendar || s.isChart || s.isKanban || s.isList || s.isRelationship,
		isTabs:           (s) => s.content === 'tabs',
		isRegconfig:      (s) => s.isData && s.isAttributeRegconfig(s.contentData),
		isRelationship:   (s) => s.isData && s.isAttributeRelationship(s.contentData),
		isRelationship1N: (s) => s.isRelationship && (s.contentData === '1:n' || (s.field.outsideIn === true && s.contentData === 'n:1')),
		isRichtext:       (s) => s.isData && s.contentUse === 'richtext',
		isString:         (s) => s.isData && s.isAttributeString(s.contentData),
		isTime:           (s) => s.isData && s.contentUse === 'time',
		isVariable:       (s) => s.field.content === 'variable',
		systemDefaultUsed:(s) => s.systemDefaults.includes(s.field.def),
		
		// stores
		attribute:     (s) => !s.isData || s.attributeIdMap[s.field.attributeId] === undefined ? false : s.attributeIdMap[s.field.attributeId],
		module:        (s) => s.moduleIdMap[s.moduleId],
		variable:      (s) => !s.isVariable || s.variableIdMap[s.field.variableId] === undefined ? false : s.variableIdMap[s.field.variableId],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     (s) => s.$store.getters['schema/formIdMap'],
		variableIdMap: (s) => s.$store.getters['schema/variableIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form,
		capCal:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getAttributeIcon,
		getCollectionConsumerTemplate,
		getDependentModules,
		getDetailsFromIndexAttributeId,
		getIndexAttributeId,
		getItemTitle,
		getItemTitlePath,
		getJoinIndexMap,
		getNilUuid,
		getRandomInt,
		isAttributeBoolean,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRegconfig,
		isAttributeRelationship,
		isAttributeString,
		openLink,
		
		// actions
		collectionAdd() {
			let v = JSON.parse(JSON.stringify(this.field.collections));
			v.push(this.getCollectionConsumerTemplate());
			this.set('collections',v);
		},
		collectionRemove(i) {
			let v = JSON.parse(JSON.stringify(this.field.collections));
			v.splice(i,1);
			this.set('collections',v);
		},
		openAttribute(relationId,middle) {
			if(!middle) this.$router.push('/builder/relation/'+relationId);
			else        this.openLink('#/builder/relation/'+relationId,true);
		},
		presetIdAdd(value) {
			let ids = JSON.parse(JSON.stringify(this.field.defPresetIds));
			
			if(ids.includes(value))
				return;
			
			ids.push(value);
			this.set('defPresetIds',ids);
		},
		presetIdRemove(value) {
			let ids = JSON.parse(JSON.stringify(this.field.defPresetIds));
			
			let pos = ids.indexOf(value);
			if(pos === -1)
				return;
			
			ids.splice(pos,1);
			this.set('defPresetIds',ids);
		},
		set(name,val) {
			if(name === 'csvImport' && !val) {
				// no CSV import, clear query lookups
				let q = JSON.parse(JSON.stringify(this.field.query));
				q.lookups = [];
				this.$emit('set','query',q);
			}
			if(name === 'relationIndexData') {
				this.$emit('set','attributeIdSort',null);
				this.$emit('set','relationIndexAxisX',null);
				this.$emit('set','relationIndexAxisY',null);
			}
			this.$emit('set',name,val);
		},
		setCollection(i,value) {
			let v = JSON.parse(JSON.stringify(this.field.collections));
			v[i] = value;
			this.set('collections',v);
		},
		setFlags(name,state) {
			const pos = this.field.flags.indexOf(name);
			if(state  && pos === -1) this.field.flags.push(name);
			if(!state && pos !== -1) this.field.flags.splice(pos,1);
		},
		setIndexAttribute(name,indexAttributeId) {
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
		setInt(name,val,allowNull) {
			if(val !== '')
				return this.set(name,parseInt(val));
			
			if(allowNull) return this.set(name,null);
			else          return this.set(name,0);
		},
		setNull(name,val) {
			this.set(name,val === '' ? null : val);
		},
		showHelp(help) {
			this.$store.commit('dialog',{
				captionBody:help,
				captionTop:this.capGen.contextHelp,
				image:'question.png'
			});
		},
		tabAdd(i) {
			let v = JSON.parse(JSON.stringify(this.field.tabs));
			v.push({
				id:'new_tab' + this.getRandomInt(1,99999),
				contentCounter:false,
				state:'default',
				fields:[],
				captions:{
					tabTitle:{}
				}
			});
			this.set('tabs',v);
		}
	}
};