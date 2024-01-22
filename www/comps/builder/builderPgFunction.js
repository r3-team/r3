import MyBuilderCaption    from './builderCaption.js';
import MyBuilderPgTriggers from './builderPgTriggers.js';
import MyTabs              from '../tabs.js';
import {
	copyValueDialog,
	getNilUuid,
	textAddTab
} from '../shared/generic.js';
import {
	getDependentModules,
	getFunctionHelp
} from '../shared/builder.js';
export {MyBuilderPgFunction as default};

let MyBuilderPgFunctionItemSchedule = {
	name:'my-builder-pg-function-item-schedule',
	template:`<div class="schedule">
		
		<div class="line">
			<!-- interval at which to run -->
			<select class="dynamic" v-model="runOnce" :disabled="readonly">
				<optgroup :label="capApp.runType">
					<option :value="true">{{ capApp.runOnce }}</option>
					<option :value="false">{{ capApp.runRegular }}</option>
				</optgroup>
			</select>
			
			<template v-if="intervalType !== 'once'">
				<span>{{ capApp.intervalEvery }}</span>
				<input class="dynamic" v-model.number="intervalValue" :disabled="readonly" />
				
				<select class="dynamic" v-model="intervalType" :disabled="readonly">
					<option value="seconds">{{ capApp.option.intervalSeconds }}</option>
					<option value="minutes">{{ capApp.option.intervalMinutes }}</option>
					<option value="hours"  >{{ capApp.option.intervalHours   }}</option>
					<option value="days"   >{{ capApp.option.intervalDays    }}</option>
					<option value="weeks"  >{{ capApp.option.intervalWeeks   }}</option>
					<option value="months" >{{ capApp.option.intervalMonths  }}</option>
					<option value="years"  >{{ capApp.option.intervalYears   }}</option>
				</select>
			</template>
		</div>
		
		<div class="line">
			<!-- for weeks/months/years scheduler - on which day to run -->
			<template v-if="['weeks','months','years'].includes(intervalType)">
				<span v-if="intervalType === 'weeks'" >{{ capApp.intervalAtDayForWeeks  }}</span>
				<span v-if="intervalType === 'months'">{{ capApp.intervalAtDayForMonths }}</span>
				<span v-if="intervalType === 'years'" >{{ capApp.intervalAtDayForYears }}</span>
				<input class="short" v-model.number="atDay" :disabled="readonly" placeholder="DD" />
			</template>
			
			<!-- target time, at which hour:minute:second to run -->
			<template v-if="['days','weeks','months','years'].includes(intervalType)">
				<span>{{ capApp.intervalAtTime }}</span>
				<input class="dynamic" placeholder="HH" :disabled="readonly" v-model.number="atHour" />
				<div>:</div>
				<input class="dynamic" placeholder="MM" :disabled="readonly" v-model.number="atMinute" />
				<div>:</div>
				<input class="dynamic" placeholder="SS" :disabled="readonly" v-model.number="atSecond" />
			</template>
			
			<my-button image="delete.png"
				@trigger="$emit('remove')"
				:active="!readonly"
				:naked="true"
			/>
		</div>
	</div>`,
	props:{
		modelValue:{ type:Object,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		// inputs
		atDay:{
			get()  { return this.modelValue.atDay; },
			set(v) { this.update('atDay',v); }
		},
		atHour:{
			get()  { return this.modelValue.atHour; },
			set(v) { this.update('atHour',v); }
		},
		atMinute:{
			get()  { return this.modelValue.atMinute; },
			set(v) { this.update('atMinute',v); }
		},
		atSecond:{
			get()  { return this.modelValue.atSecond; },
			set(v) { this.update('atSecond',v); }
		},
		intervalType:{
			get()  { return this.modelValue.intervalType; },
			set(v) { this.update('intervalType',v); }
		},
		intervalValue:{
			get()  { return this.modelValue.intervalValue; },
			set(v) { this.update('intervalValue',v); }
		},
		runOnce:{
			get()  { return this.intervalType === 'once'; },
			set(v) {
				if(v) this.update('intervalType','once');
				else  this.update('intervalType','days');
			}
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.function
	},
	methods:{
		update(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderPgFunction = {
	name:'my-builder-pg-function',
	components:{
		MyBuilderCaption,
		MyBuilderPgFunctionItemSchedule,
		MyBuilderPgTriggers,
		MyTabs
	},
	template:`<div class="builder-function">
		<div class="contentBox left" v-if="pgFunction">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/codeDatabase.png" />
					<h1 class="title">{{ capApp.titlePgOne.replace('{NAME}',name) }}</h1>
				</div>
				<div class="area">
					<my-builder-caption
						v-model="captions.pgFunctionTitle"
						:contentName="capGen.title"
						:language="builderLanguage"
						:longInput="true"
					/>
				</div>
				<div class="area">
					<my-button
						@trigger="showSidebar = !showSidebar"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area nowrap">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && !readonly"
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="visible1.png"
						@trigger="copyValueDialog(name,id,id)"
						:caption="capGen.id"
					/>
					<my-button
						@trigger="showPreview = !showPreview"
						:caption="capGen.preview"
						:image="showPreview ? 'checkbox1.png' : 'checkbox0.png'"
					/>
					<my-button image="delete.png"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content no-padding function-details default-inputs">
				
				<!-- function body input -->
				<textarea class="input"
					v-if="!showPreview"
					v-model="codeFunction"
					@click="insertEntity"
					@keydown.tab.prevent="codeFunction = textAddTab($event)"
					:disabled="readonly"
					:placeholder="capApp.code"
				></textarea>
				
				<!-- function body preview -->
				<textarea class="input" disabled="disabled"
					v-if="showPreview"
					v-model="preview"
				></textarea>
			</div>
		</div>
		
		<!-- sidebar -->
		<div class="contentBox sidebar right" v-if="pgFunction && showSidebar">
			<div class="top lower">
				<div class="area nowrap">
					<h1 class="title">{{ capGen.settings }}</h1>
				</div>
			</div>
			
			<my-tabs
				v-model="tabTarget"
				:entries="tabs.keys"
				:entriesIcon="tabs.icons"
				:entriesText="tabs.labels"
			/>
			
			<div class="content padding default-inputs">
				
				<template v-if="tabTarget === 'content'">
					<div class="row gap">
						<my-button
							v-if="isTrigger"
							@trigger="addNew = !addNew"
							:active="!readonly"
							:caption="capApp.button.addNew"
							:image="addNew ? 'checkbox1.png' : 'checkbox0.png'"
						/>
						<my-button
							v-if="isTrigger"
							@trigger="addOld = !addOld"
							:active="!readonly"
							:caption="capApp.button.addOld"
							:image="addOld ? 'checkbox1.png' : 'checkbox0.png'"
						/>
					</div>
					<br />
					
					<div class="message" v-html="capApp.entityInput"></div>
					
					<!-- module data -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderRelation = !showHolderRelation"
							:caption="capApp.placeholderRelations"
							:images="[showHolderRelation ? 'triangleDown.png' : 'triangleRight.png','database.png']"
							:large="true"
							:naked="true"
						/>
						<div class="row centered gap">
							<template v-if="showHolderRelation">
								<input class="short" v-model="holderRelationText" :placeholder="capGen.threeDots" :title="capGen.button.filter" />
								<select class="dynamic" v-model="holderRelationModuleId">
									<option v-for="m in modulesData" :value="m.id">{{ m.name }}</option>
								</select>
							</template>
							<my-button image="question.png"
								@trigger="showHelp(capApp.placeholderRelations,capApp.placeholderRelationsHelp)"
							/>
						</div>
					</div>
					<div class="entities" v-if="showHolderRelation">
						<template v-for="mod in modulesData.filter(v => holderRelationModuleId === null || holderRelationModuleId === v.id)">
							<div class="entity" v-for="rel in mod.relations.filter(v => holderRelationText === '' || v.name.toLowerCase().includes(holderRelationText.toLowerCase()))">
								<div class="entity-title">
									<div class="row centered grow">
										<my-button
											@trigger="toggleRelationShow(rel.id)"
											:image="holderRelationIdsOpen.includes(rel.id) ? 'triangleDown.png' : 'triangleRight.png'"
											:naked="true"
										/>
										<my-button
											@trigger="selectEntity('relation',rel.id)"
											:adjusts="true"
											:caption="rel.name"
											:captionTitle="rel.name"
											:image="radioIcon('relation',rel.id)"
											:naked="true"
										/>
									</div>
									<router-link :key="rel.id" :to="'/builder/relation/'+rel.id">
										<my-button image="open.png" :captionTitle="capGen.button.open" :naked="true" />
									</router-link>
								</div>
								<div class="entity-children" v-if="holderRelationIdsOpen.includes(rel.id)">
									<div class="entity-title" v-for="atr in rel.attributes">
										<my-button
											@trigger="selectEntity('attribute',atr.id)"
											:caption="atr.name + (atr.nullable ? '' : '*')"
											:captionTitle="titleAttribute(atr)"
											:image="radioIcon('attribute',atr.id)"
											:naked="true"
										/>
									</div>
								</div>
							</div>
						</template>
					</div>
					
					<!-- module functions -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderFncModule = !showHolderFncModule"
							:caption="capApp.placeholderFncBackend"
							:images="[showHolderFncModule ? 'triangleDown.png' : 'triangleRight.png','codeDatabase.png']"
							:large="true"
							:naked="true"
						/>
						<div class="row centered gap">
							<template v-if="showHolderFncModule">
								<input class="short" v-model="holderFunctionText" :placeholder="capGen.threeDots" :title="capGen.button.filter" />
								<select class="dynamic" v-model="holderFunctionModuleId">
									<option v-for="m in modulesFnc" :value="m.id">{{ m.name }}</option>
								</select>
							</template>
							<my-button image="question.png"
								@trigger="showHelp(capApp.placeholderFncBackend,capApp.placeholderFncBackendHelp)"
							/>
						</div>
					</div>
					<div class="entities" v-if="showHolderFncModule">
						<template v-for="mod in modulesFnc.filter(v => holderFunctionModuleId === null || holderFunctionModuleId === v.id)">
							<div class="entity" v-for="fnc in mod.pgFunctions.filter(v => !v.isTrigger && (holderFunctionText === '' || v.name.toLowerCase().includes(holderFunctionText.toLowerCase())))">
								<div class="entity-title">
									<my-button
										@trigger="selectEntity('pgFunction',fnc.id)"
										:adjusts="true"
										:caption="fnc.name"
										:captionTitle="fnc.name"
										:image="radioIcon('pgFunction',fnc.id)"
										:naked="true"
									/>
									
									<div class="row centered">
										<my-button image="question.png"
											@trigger="showHelp(fnc.name+'()',getFunctionHelp('pg',fnc,builderLanguage))"
											:active="getFunctionHelp('pg',fnc,builderLanguage) !== ''"
											:captionTitle="capGen.help"
											:naked="true"
										/>
										<router-link :key="fnc.id" :to="'/builder/pg-function/'+fnc.id">
											<my-button image="open.png" :captionTitle="capGen.button.open" :naked="true" />
										</router-link>
									</div>
								</div>
							</div>
						</template>
					</div>
					
					<!-- instance functions -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderFncInstance = !showHolderFncInstance"
							:caption="capApp.placeholderFncInstance"
							:images="[showHolderFncInstance ? 'triangleDown.png' : 'triangleRight.png','server.png']"
							:large="true"
							:naked="true"
						/>
						<my-button image="question.png"
							@trigger="showHelp(capApp.placeholderFncInstance,capApp.placeholderFncInstanceHelp)"
						/>
					</div>
					<div class="entities" v-if="showHolderFncInstance">
						<div class="entity" v-for="fnc in instanceFunctionIds">
							<div class="entity-title">
								<my-button
									@trigger="selectEntity('instanceFunction',fnc)"
									:adjusts="true"
									:caption="fnc"
									:captionTitle="fnc"
									:image="radioIcon('instanceFunction',fnc)"
									:naked="true"
								/>
								<my-button image="question.png"
									@trigger="showHelp(fnc+'()',capApp.helpPg[fnc])"
									:captionTitle="capGen.help"
									:naked="true"
								/>
							</div>
						</div>
					</div>
				</template>
				
				<template v-if="tabTarget === 'exec'">
					<table class="generic-table-vertical tight fullWidth">
						<tr v-if="execArgInputs.length > 0">
							<td>{{ capApp.codeArgs }}</td>
							<td>
								<div class="column gap">
									<input class="long"
										v-model="execArgs[i]"
										v-for="(a,i) in execArgInputs"
										:disabled="readonly"
										:placeholder="a.trim()"
									/>
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.execResponse }}</td>
							<td><textarea class="long response" v-model="execResponse" disabled></textarea></td>
						</tr>
					</table>
					<my-button image="settingsPlay.png"
						@trigger="exec"
						:active="!readonly"
						:caption="capApp.exec"
					/>
				</template>
				
				<template v-if="tabTarget === 'properties'">
					<table class="generic-table-vertical tight fullWidth">
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="name" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<my-builder-caption
									v-model="captions.pgFunctionTitle"
									:language="builderLanguage"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.description }}</td>
							<td>
								<my-builder-caption
									v-model="captions.pgFunctionDesc"
									:language="builderLanguage"
									:multiLine="true"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr v-if="!isTrigger">
							<td>{{ capApp.codeArgs }}</td>
							<td><textarea v-model="codeArgs" @keyup="resetExec" :disabled="isTrigger || readonly" placeholder="-"></textarea></td>
						</tr>
						<tr>
							<td>{{ capApp.codeReturns }}</td>
							<td><input v-model="codeReturns" :disabled="isTrigger || readonly" placeholder="-" /></td>
						</tr>
						<tr v-if="isTrigger">
							<td>{{ capApp.triggers }}</td>
							<td>
								<my-builder-pg-triggers
									:contextEntity="'pgFunction'"
									:contextId="id"
									:readonly="readonly"
									:singleColumn="true"
								/>
							</td>
						</tr>
						<tr v-if="!isTrigger">
							<td>{{ capApp.isFrontendExec }}</td>
							<td><my-bool v-model="isFrontendExec" :readonly="isTrigger || readonly" /></td>
						</tr>
						<tr v-if="!isTrigger">
							<td>
								<div class="column">
									<span>{{ capApp.schedules }}</span>
									<my-button image="add.png"
										@trigger="addSchedule"
										:active="!readonly"
										:caption="capGen.button.add"
										:naked="true"
									/>
								</div>
							</td>
							<td>
								<my-builder-pg-function-item-schedule
									v-for="(s,i) in schedules"
									v-model="schedules[i]"
									@remove="schedules.splice(i,1)"
									:key="i"
									:readonly="readonly"
								/>
							</td>
						</tr>
					</table>
				</template>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	watch:{
		pgFunction:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		
		// set defaults
		this.holderRelationModuleId = this.module.id;
		this.holderFunctionModuleId = this.module.id;
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	data() {
		return {
			// inputs
			name:'',
			captions:{},
			codeArgs:'',
			codeFunction:'',
			codeReturns:'',
			isFrontendExec:false,
			isTrigger:false,
			schedules:[],
			
			// execution
			execArgs:[],
			execResponse:'',
			
			// states
			addNew:false,
			addOld:false,
			entity:'relation', // selected placeholder entity (relation, attribute, pgFunction, instanceFunction)
			entityId:null,
			holderFunctionModuleId:null, // module filter for backend functions
			holderFunctionText:'',       // text filter for backend functions
			holderRelationModuleId:null, // module filter for relations
			holderRelationIdsOpen:[],    // opened relation placeholders (shows attributes)
			holderRelationText:'',       // text filter for module relations
			instanceFunctionIds:[
				'abort_show_message','clean_up_e2ee_keys','file_link',
				'files_get','get_name','get_login_id','get_login_language_code',
				'get_preset_record_id','get_public_hostname','get_role_ids',
				'has_role','has_role_any','log_error','log_info','log_warning',
				'mail_delete','mail_delete_after_attach','mail_get_next',
				'mail_send','rest_call','update_collection'
			],
			showHolderFncInstance:false,
			showHolderFncModule:false,
			showHolderRelation:false,
			showPreview:false,
			showSidebar:true,
			tabTarget:'content'
		};
	},
	computed:{
		execArgInputs:(s) => s.codeArgs.trim() === '' ? [] : s.codeArgs.split(','),
		hasChanges:(s) => s.name !== s.pgFunction.name
			|| s.codeArgs        !== s.pgFunction.codeArgs
			|| s.codeFunction    !== s.placeholdersSet(s.pgFunction.codeFunction)
			|| s.codeReturns     !== s.pgFunction.codeReturns
			|| s.isFrontendExec  !== s.pgFunction.isFrontendExec
			|| JSON.stringify(s.schedules) !== JSON.stringify(s.pgFunction.schedules)
			|| JSON.stringify(s.captions)  !== JSON.stringify(s.pgFunction.captions),
		modulesData:(s) => s.getDependentModules(s.module).filter(v => v.relations.length   !== 0),
		modulesFnc: (s) => s.getDependentModules(s.module).filter(v => v.pgFunctions.length !== 0),
		tabs:(s) => {
			let out = {
				icons:['images/code.png','images/edit.png'],
				keys:['content','properties'],
				labels:[s.capApp.placeholders,s.capGen.properties]
			};
			if(!s.isTrigger) {
				out.icons.splice(1,0,'images/settingsPlay.png');
				out.keys.splice(1,0,'exec');
				out.labels.splice(1,0,s.capApp.exec);
			}
			return out;
		},
		triggers:(s) => {
			let out = [];
			for(const relId in s.relationIdMap) {
				const rel = s.relationIdMap[relId];
				
				for(const trg of rel.triggers) {
					if(trg.pgFunctionId === s.id)
						out.push(trg);
				}
			}
			return out;
		},
		
		// simple
		module:    (s) => s.pgFunction === false ? false : s.moduleIdMap[s.pgFunction.moduleId],
		pgFunction:(s) => typeof s.pgFunctionIdMap[s.id] === 'undefined' ? false : s.pgFunctionIdMap[s.id],
		preview:   (s) => !s.showPreview ? '' : s.placeholdersUnset(true),
		
		// stores
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		moduleNameMap:  (s) => s.$store.getters['schema/moduleNameMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap: (s) => s.$store.getters['schema/attributeIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.function,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		getFunctionHelp,
		getNilUuid,
		textAddTab,
		
		// presentation
		radioIcon(entity,id) {
			return this.entity === entity && this.entityId === id
				? 'radio1.png' : 'radio0.png';
		},
		titleAttribute(atr) {
			return atr.nullable ? atr.name : this.capApp.attributeNotNull.replace('{ATR}',atr.name);
		},
		
		// actions
		addSchedule() {
			this.schedules.push({
				id:this.getNilUuid(),
				atSecond:0,
				atMinute:0,
				atHour:12,
				atDay:1,
				intervalType:'days',
				intervalValue:3
			});
		},
		insertEntity(evt) {
			if(this.entityId === null)
				return;
			
			let field = evt.target;
			let text  = '';
			let mod, rel, atr, fnc;
			
			// build unique placeholder name
			// relation:    {module_name}.[relation_name]
			// pg function: {module_name}.[function_name]()
			// attribute:   (module_name.relation_name.attribute_name)
			switch(this.entity) {
				case 'relation':
					rel  = this.relationIdMap[this.entityId];
					mod  = this.moduleIdMap[rel.moduleId];
					text = `{${mod.name}}.[${rel.name}]`;
				break;
				case 'pgFunction':
					fnc  = this.pgFunctionIdMap[this.entityId];
					mod  = this.moduleIdMap[fnc.moduleId];
					text = `{${mod.name}}.[${fnc.name}]()`;
				break;
				case 'attribute':
					atr  = this.attributeIdMap[this.entityId];
					rel  = this.relationIdMap[atr.relationId];
					mod  = this.moduleIdMap[rel.moduleId];
					text = `(${mod.name}.${rel.name}.${atr.name})`;
					
					if(this.addNew) text = 'NEW.'+text;
					if(this.addOld) text = 'OLD.'+text;
				break;
				case 'instanceFunction':
					text = `instance.${this.entityId}()`;
				break;
			}
			
			if(field.selectionStart || field.selectionStart === '0') {
				
				let startPos = field.selectionStart;
				let endPos   = field.selectionEnd;
				
				field.value = field.value.substring(0,startPos)
					+ text
					+ field.value.substring(endPos, field.value.length);
				
				field.selectionStart = startPos + text.length;
				field.selectionEnd   = startPos + text.length;
			}
			else {
				field.value += text;
			}
			this.codeFunction = field.value;
			this.entityId = null;
		},
		reset() {
			this.name           = this.pgFunction.name;
			this.captions       = JSON.parse(JSON.stringify(this.pgFunction.captions));
			this.codeArgs       = this.pgFunction.codeArgs;
			this.codeFunction   = this.placeholdersSet(this.pgFunction.codeFunction);
			this.codeReturns    = this.pgFunction.codeReturns;
			this.isFrontendExec = this.pgFunction.isFrontendExec;
			this.isTrigger      = this.pgFunction.isTrigger;
			this.schedules      = JSON.parse(JSON.stringify(this.pgFunction.schedules));
			this.addNew         = false;
			this.addOld         = false;
			
			if(this.isTrigger && this.tabTarget === 'exec')
				this.tabTarget = 'content';
			
			this.resetExec();
		},
		resetExec() {
			this.execArgs     = [];
			this.execResponse = '';
			
			for(let a of this.execArgInputs) {
				this.execArgs.push('');
			}
		},
		selectEntity(entity,id) {
			if(entity === this.entity && id === this.entityId)
				return this.entityId = null;
			
			this.entity   = entity;
			this.entityId = id;
		},
		showHelp(top,text) {
			this.$store.commit('dialog',{
				captionTop:top,
				captionBody:text,
				image:'question.png'
			});
		},
		toggleRelationShow(relationId) {
			let pos = this.holderRelationIdsOpen.indexOf(relationId);
			if(pos === -1) this.holderRelationIdsOpen.push(relationId);
			else           this.holderRelationIdsOpen.splice(pos,1);
		},
		
		// placeholders are used for storing entities via ID instead of name (which can change)
		// attribute reference: (module.relation.attribute) <-> (ATR_ID)
		// relation  reference: {module}[relation]          <-> {MOD_ID}[REL_ID]
		// function  reference: {module}[function](...      <-> {MOD_ID}[FNC_IC](...
		placeholdersSet(body) {
			let that = this;
			
			// replace attributes with placeholders
			// stored in function text as: (ATR_ID)
			body = body.replace(/\(([a-z0-9\-]{36})\)/g,function(match,id) {
				let atr = that.attributeIdMap[id];
				let rel = that.relationIdMap[atr.relationId];
				let mod = that.moduleIdMap[rel.moduleId];
				return `(${mod.name}.${rel.name}.${atr.name})`;
			});
			
			// replace functions with placeholders
			// stored in function text as: [FNC_ID](...
			body = body.replace(/\[([a-z0-9\-]{36})\]\(/g,function(match,id) {
				return `[${that.pgFunctionIdMap[id].name}](`;
			});
			
			// replace relations with placeholders
			// stored in function text as: [REL_ID]
			body = body.replace(/\[([a-z0-9\-]{36})\]/g,function(match,id) {
				return `[${that.relationIdMap[id].name}]`;
			});
			
			// replace modules with placeholders
			// stored in function text as: {MOD_ID}
			body = body.replace(/\{([a-z0-9\-]{36})\}/g,function(match,id) {
				return `{${that.moduleIdMap[id].name}}`;
			});
			return body;
		},
		placeholdersUnset(previewMode) {
			let that = this;
			let body = this.codeFunction;
			
			// replace attribute placeholders
			// stored as: (module.relation.attribute)
			let pat = /\(([a-z][a-z0-9\_]+)\.([a-z][a-z0-9\_]+)\.([a-z][a-z0-9\_]+)\)/g;
			body = body.replace(pat,function(match,modName,relName,atrName) {
				
				// resolve module by name
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				
				// resolve relation by name
				let rel = false;
				for(let i = 0, j = mod.relations.length; i < j; i++) {
					if(mod.relations[i].name !== relName)
						continue;
					
					rel = mod.relations[i];
					break;
				}
				if(rel === false)
					return match;
				
				// resolve attribute by name
				let atr = false;
				for(let i = 0, j = rel.attributes.length; i < j; i++) {
					if(rel.attributes[i].name !== atrName)
						continue;
					
					atr = rel.attributes[i];
					break;
				}
				if(atr === false)
					return match;
				
				// replace placeholder
				if(previewMode)
					return atr.name;
				
				return `(${atr.id})`;
			});
			
			// replace function placeholders
			// stored as: {module}[function](...
			pat = /\{([a-z][a-z0-9\_]+)\}\.\[([a-z][a-z0-9\_]+)\]\(/g;
			body = body.replace(pat,function(match,modName,fncName) {
				
				// resolve module by name
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				
				// resolve function by name
				let fnc = false;
				for(let i = 0, j = mod.pgFunctions.length; i < j; i++) {
					if(mod.pgFunctions[i].name !== fncName)
						continue;
					
					fnc = mod.pgFunctions[i];
					break;
				}
				if(fnc === false)
					return match;
				
				// replace placeholder
				if(previewMode)
					return `${mod.name}.${fnc.name}(`;
				
				return `{${mod.id}}.[${fnc.id}](`;
			});
			
			// replace relation placeholders
			// stored as: {module}[relation]
			pat = /\{([a-z][a-z0-9\_]+)\}\.\[([a-z][a-z0-9\_]+)\]/g;
			body = body.replace(pat,function(match,modName,relName) {
				
				// resolve module by name
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				
				// resolve relation by name
				let rel = false;
				for(let i = 0, j = mod.relations.length; i < j; i++) {
					if(mod.relations[i].name !== relName)
						continue;
					
					rel = mod.relations[i];
					break;
				}
				if(rel === false)
					return match;
				
				// replace placeholder
				if(previewMode)
					return `${mod.name}.${rel.name}`;
				
				return `{${mod.id}}.[${rel.id}]`;
			});
			return body;
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('pgFunction','del',{id:this.pgFunction.id},true).then(
				() => {
					this.$root.schemaReload(this.pgFunction.moduleId);
					this.$router.push('/builder/pg-functions/'+this.pgFunction.moduleId);
				},
				this.$root.genericError
			);
		},
		exec() {
			ws.send('pgFunction','execAny',{
				id:this.pgFunction.id,
				args:this.execArgs
			},true).then(
				res => this.execResponse = res.payload,
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('pgFunction','set',{
					id:this.pgFunction.id,
					moduleId:this.pgFunction.moduleId,
					isTrigger:this.pgFunction.isTrigger,
					
					// changable
					name:this.name,
					codeArgs:this.codeArgs,
					codeFunction:this.placeholdersUnset(false),
					codeReturns:this.codeReturns,
					isFrontendExec:this.isFrontendExec,
					schedules:this.schedules,
					captions:this.captions
				}),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};