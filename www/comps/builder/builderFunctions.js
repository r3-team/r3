import MyBuilderCaption        from './builderCaption.js';
import {getPgFunctionTemplate} from '../shared/builder.js';
import {getNilUuid}            from '../shared/generic.js';
export {MyBuilderFunctions as default};
export {MyBuilderFunctionPlaceholder};

let MyBuilderFunctionPlaceholder = {
	name:'my-builder-function-placeholder',
	template:`<span class="builder-function-placeholder" :class="{naked:naked}">
		<my-button
			@trigger="$emit('toggle')"
			:caption="displayName"
			:image="selected ? 'radio1.png' : 'radio0.png'"
			:naked="true"
		/>
		<my-button image="question.png"
			v-if="help !== ''"
			@trigger="$emit('show-help',help)"
			:naked="true"
		/>
	</span>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		functionHelp:   { type:String,  required:false, default:'' },
		functionObj:    { type:Object,  required:false, default:null },
		functionType:   { type:String,  required:false, default:'' }, // js/pg
		naked:          { type:Boolean, required:false, default:false },
		name:           { type:String,  required:true },
		selected:       { type:Boolean, required:true }
	},
	emits:['show-help','toggle'],
	computed:{
		displayName:function() {
			if(this.functionObj !== null || this.functionHelp !== '')
				return this.name+'()';
			
			return this.name;
		},
		help:function() {
			// use fixed help text, if given
			if(this.functionHelp !== '')
				return this.functionHelp;
			
			// build proper function help text, if available
			let help = '';
			if(this.functionObj !== null) {
				help = `${this.name}(${this.functionObj.codeArgs}) => ${this.functionObj.codeReturns}`;
				
				// add translated title/description, if available
				let cap = `${this.functionType}FunctionTitle`;
				if(typeof this.functionObj.captions[cap] !== 'undefined'
					&& typeof this.functionObj.captions[cap][this.builderLanguage] !== 'undefined'
					&& this.functionObj.captions[cap][this.builderLanguage] !== '') {
					
					help += `<br /><br />${this.functionObj.captions[cap][this.builderLanguage]}`;
				}
				
				cap = `${this.functionType}FunctionDesc`;
				if(typeof this.functionObj.captions[cap] !== 'undefined'
					&& typeof this.functionObj.captions[cap][this.builderLanguage] !== 'undefined'
					&& this.functionObj.captions[cap][this.builderLanguage] !== '') {
					
					help += `<br /><br />${this.functionObj.captions[cap][this.builderLanguage]}`;
				}
			}
			return help;
		}
	}
};

let MyBuilderJsFunctionItem = {
	name:'my-builder-js-function-item',
	components:{MyBuilderCaption},
	template:`<tbody>
		<tr>
			<td>
				<my-button image="open.png"
					v-if="!isNew"
					@trigger="open"
				/>
			</td>
			<td>
				<input class="long"
					v-model="name"
					:placeholder="isNew ? capApp.new : ''"
				/>
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="showInfo"
					:active="!isNew"
				/>
			</td>
			<td>
				<my-builder-caption
					v-model="captions.jsFunctionTitle"
					:language="builderLanguage"
				/>
			</td>
			<td>
				<input disabled="disabled" :value="capApp.languageJs" />
			</td>
			<td>
				<input class="long"
					v-model="codeArgs"
					:placeholder="capApp.codeArgsHintJs"
				/>
			</td>
			<td>
				<input
					v-model="codeReturns"
					:placeholder="capApp.codeReturnsHintJs"
				/>
			</td>
			<td>
				<select :disabled="!isNew" v-model="formId">
					<option :value="null">-</option>
					<option v-for="f in module.forms" :value="f.id">
						{{ f.name }}
					</option>
				</select>
			</td>
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && name !== ''"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
					/>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String, required:true },
		module:         { type:Object, required:true },
		jsFunction:{
			type:Object,
			required:false,
			default:function() { return {
				id:null,
				formId:null,
				name:'',
				codeArgs:'',
				codeFunction:'',
				codeReturns:'',
				captions:{
					jsFunctionTitle:{},
					jsFunctionDesc:{}
				}
			}}
		}
	},
	data:function() {
		return {
			codeArgs:this.jsFunction.codeArgs,
			codeFunction:this.jsFunction.codeFunction,
			codeReturns:this.jsFunction.codeReturns,
			name:this.jsFunction.name,
			formId:this.jsFunction.formId,
			captions:JSON.parse(JSON.stringify(this.jsFunction.captions))
		};
	},
	computed:{
		hasChanges:function() {
			return this.name         !== this.jsFunction.name
				|| this.formId       !== this.jsFunction.formId
				|| this.codeArgs     !== this.jsFunction.codeArgs
				|| this.codeFunction !== this.jsFunction.codeFunction
				|| this.codeReturns  !== this.jsFunction.codeReturns
				|| JSON.stringify(this.captions)  !== JSON.stringify(this.jsFunction.captions)
			;
		},
		
		// simple states
		isNew:function() { return this.jsFunction.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.function; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// actions
		open:function() {
			this.$router.push('/builder/js-function/'+this.jsFunction.id);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.jsFunction.id,
				captionTop:this.jsFunction.name,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
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
		del:function() {
			ws.send('jsFunction','del',{id:this.jsFunction.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set:function() {
			ws.send('jsFunction','set',{
				id:this.jsFunction.id,
				moduleId:this.module.id,
				formId:this.formId,
				name:this.name,
				codeArgs:this.codeArgs,
				codeFunction:this.codeFunction,
				codeReturns:this.codeReturns,
				captions:this.captions
			},true).then(
				() => {
					if(this.isNew)
						this.name = '';
					
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};

let MyBuilderPgFunctionItemSchedule = {
	name:'my-builder-pg-function-item-schedule',
	template:`<div class="schedule-line">
		
		<my-button image="cancel.png"
			@trigger="$emit('remove')"
			:naked="true"
		/>
		
		<!-- interval at which to run -->
		<span>{{ capApp.runOnce }}</span>
		<div><my-bool v-model="runOnce" /></div>
		
		<template v-if="intervalType !== 'once'">
			<span>{{ capApp.intervalEvery }}</span>
			<input class="short" v-model.number="intervalValue" />
			
			<select class="short" v-model="intervalType">
				<option value="seconds">{{ capApp.option.intervalSeconds }}</option>
				<option value="minutes">{{ capApp.option.intervalMinutes }}</option>
				<option value="hours"  >{{ capApp.option.intervalHours   }}</option>
				<option value="days"   >{{ capApp.option.intervalDays    }}</option>
				<option value="weeks"  >{{ capApp.option.intervalWeeks   }}</option>
				<option value="months" >{{ capApp.option.intervalMonths  }}</option>
				<option value="years"  >{{ capApp.option.intervalYears   }}</option>
			</select>
		</template>
		
		<!-- for weeks/months/years scheduler - on which day to run -->
		<template v-if="['weeks','months','years'].includes(intervalType)">
			<span v-if="intervalType === 'weeks'" >{{ capApp.intervalAtDayForWeeks  }}</span>
			<span v-if="intervalType === 'months'">{{ capApp.intervalAtDayForMonths }}</span>
			<span v-if="intervalType === 'years'" >{{ capApp.intervalAtDayForYears }}</span>
			<input class="short" v-model.number="atDay" placeholder="DD" />
		</template>
		
		<!-- target time, at which hour:minute:second to run -->
		<template v-if="['days','weeks','months','years'].includes(intervalType)">
			<span>{{ capApp.intervalAtTime }}</span>
			<input class="short" placeholder="HH" v-model.number="atHour" />
			<div>:</div>
			<input class="short" placeholder="MM" v-model.number="atMinute" />
			<div>:</div>
			<input class="short" placeholder="SS" v-model.number="atSecond" />
		</template>
	</div>`,
	props:{
		modelValue:{ type:Object, required:true }
	},
	emits:['update:modelValue','remove'],
	computed:{
		// inputs
		atDay:{
			get:function()  { return this.modelValue.atDay; },
			set:function(v) { this.update('atDay',v); }
		},
		atHour:{
			get:function()  { return this.modelValue.atHour; },
			set:function(v) { this.update('atHour',v); }
		},
		atMinute:{
			get:function()  { return this.modelValue.atMinute; },
			set:function(v) { this.update('atMinute',v); }
		},
		atSecond:{
			get:function()  { return this.modelValue.atSecond; },
			set:function(v) { this.update('atSecond',v); }
		},
		intervalType:{
			get:function()  { return this.modelValue.intervalType; },
			set:function(v) { this.update('intervalType',v); }
		},
		intervalValue:{
			get:function()  { return this.modelValue.intervalValue; },
			set:function(v) { this.update('intervalValue',v); }
		},
		runOnce:{
			get:function()  { return this.intervalType === 'once'; },
			set:function(v) {
				if(v) this.update('intervalType','once');
				else  this.update('intervalType','days');
			}
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.function; }
	},
	methods:{
		update:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderPgFunctionItem = {
	name:'my-builder-pg-function-item',
	components:{
		MyBuilderCaption,
		MyBuilderPgFunctionItemSchedule
	},
	template:`<tbody>
		<tr>
			<td>
				<my-button image="open.png"
					v-if="!isNew"
					@trigger="open"
				/>
			</td>
			<td>
				<input class="long"
					v-model="name"
					:placeholder="isNew ? capApp.new : ''"
				/>
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="showInfo"
					:active="!isNew"
				/>
			</td>
			<td>
				<my-builder-caption
					v-model="captions.pgFunctionTitle"
					:language="builderLanguage"
				/>
			</td>
			<td>
				<input disabled="disabled" :value="capApp.languagePg" />
			</td>
			<td>
				<my-bool v-model="isTrigger" :readonly="!isNew" />
			</td>
			<td>
				<input class="long"
					v-model="codeArgs"
					:disabled="isTrigger"
					:placeholder="capApp.codeArgsHintPg"
				/>
			</td>
			<td>
				<input
					v-model="codeReturns"
					:placeholder="capApp.codeReturnsHintPg"
					:disabled="isTrigger"
				/>
			</td>
			<td>
				<my-button
					@trigger="showSchedules = !showSchedules"
					:active="!isTrigger"
					:caption="capApp.schedulesItem.replace('{CNT}',schedules.length)"
				/>
			</td>
			<td>
				<my-bool v-model="isFrontendExec" :readonly="isTrigger" />
			</td>
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
					/>
				</div>
			</td>
		</tr>
		
		<tr v-if="showSchedules">
			<td colspan="999">
				<div class="builder-sub-container">
					<my-builder-pg-function-item-schedule
						v-for="(s,i) in schedules"
						v-model="schedules[i]"
						@remove="schedules.splice(i,1)"
						:key="i"
					/>
					
					<div>
						<my-button image="add.png"
							@trigger="addSchedule"
							:caption="capApp.button.addSchedule"
						/>
					</div>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String, required:true },
		moduleId:       { type:String, required:true },
		pgFunction:{
			type:Object,
			required:false,
			default:function() { return {
				id:null,
				name:'',
				codeArgs:'',
				codeFunction:'',
				codeReturns:'',
				isFrontendExec:false,
				isTrigger:false,
				schedules:[],
				captions:{
					pgFunctionTitle:{},
					pgFunctionDesc:{}
				}
			}}
		}
	},
	data:function() {
		return {
			codeArgs:this.pgFunction.codeArgs,
			codeFunction:this.pgFunction.codeFunction,
			codeReturns:this.pgFunction.codeReturns,
			name:this.pgFunction.name,
			isFrontendExec:this.pgFunction.isFrontendExec,
			isTrigger:this.pgFunction.isTrigger,
			schedules:JSON.parse(JSON.stringify(this.pgFunction.schedules)),
			captions:JSON.parse(JSON.stringify(this.pgFunction.captions)),
			
			// states
			showSchedules:false
		};
	},
	computed:{
		hasChanges:function() {
			return this.name           !== this.pgFunction.name
				|| this.codeArgs       !== this.pgFunction.codeArgs
				|| this.codeReturns    !== this.pgFunction.codeReturns
				|| this.isFrontendExec !== this.pgFunction.isFrontendExec
				|| this.isTrigger      !== this.pgFunction.isTrigger
				|| JSON.stringify(this.schedules) !== JSON.stringify(this.pgFunction.schedules)
				|| JSON.stringify(this.captions)  !== JSON.stringify(this.pgFunction.captions)
			;
		},
		
		// simple states
		isNew:function() { return this.pgFunction.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.function; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getNilUuid,
		getPgFunctionTemplate,
	
		// actions
		addSchedule:function() {
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
		open:function() {
			this.$router.push('/builder/pg-function/'+this.pgFunction.id);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.pgFunction.id,
				captionTop:this.pgFunction.name,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
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
		del:function() {
			ws.send('pgFunction','del',{id:this.pgFunction.id},true).then(
				() => this.$root.schemaReload(this.moduleId),
				this.$root.genericError
			);
		},
		set:function() {
			if(this.codeFunction === '')
				this.codeFunction = this.getPgFunctionTemplate();
			
			ws.send('pgFunction','set',{
				id:this.pgFunction.id,
				moduleId:this.moduleId,
				name:this.name,
				codeArgs:this.codeArgs,
				codeFunction:this.codeFunction,
				codeReturns:this.codeReturns,
				isFrontendExec:this.isFrontendExec,
				isTrigger:this.isTrigger,
				schedules:this.schedules,
				captions:this.captions
			},true).then(
				() => {
					if(this.isNew)
						this.name = '';
					
					this.$root.schemaReload(this.moduleId);
				},
				this.$root.genericError
			);
		}
	}
};

let MyBuilderFunctions = {
	name:'my-builder-functions',
	components:{
		MyBuilderJsFunctionItem,
		MyBuilderPgFunctionItem
	},
	template:`<div class="contentBox grow builder-functions">
		
		<div class="top lower">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content no-padding" v-if="module">
		
			<!-- PG functions -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showPg = !showPg">
					<img class="icon" :src="displayArrow(showPg)" />
					<h1>{{ capApp.titlePg.replace('{CNT}',module.pgFunctions.length) }}</h1>
				</div>
				
				<table class="default-inputs" v-if="showPg">
					<thead>
						<tr>
							<th>{{ capGen.button.open }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.id }}</th>
							<th>{{ capGen.title }}</th>
							<th>{{ capApp.language }}</th>
							<th>{{ capApp.isTrigger }}</th>
							<th>{{ capApp.codeArgs }}</th>
							<th>{{ capApp.codeReturns }}</th>
							<th>{{ capApp.schedules }}</th>
							<th>{{ capApp.isFrontendExec }}</th>
							<th></th>
						</tr>
					</thead>
					
					<!-- new record -->
					<my-builder-pg-function-item
						:builderLanguage="builderLanguage"
						:moduleId="module.id"
					/>
					
					<!-- existing records -->
					<my-builder-pg-function-item
						v-for="fnc in module.pgFunctions"
						:builderLanguage="builderLanguage"
						:key="fnc.id"
						:moduleId="module.id"
						:pgFunction="fnc"
					/>
				</table>
			</div>
			
			<!-- JS functions -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showJs = !showJs">
					<img class="icon" :src="displayArrow(showJs)" />
					<h1>{{ capApp.titleJs.replace('{CNT}',module.jsFunctions.length) }}</h1>
				</div>
				
				<table class="default-inputs" v-if="showJs">
					<thead>
						<tr>
							<th>{{ capGen.button.open }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.id }}</th>
							<th>{{ capGen.title }}</th>
							<th>{{ capApp.language }}</th>
							<th>{{ capApp.codeArgs }}</th>
							<th>{{ capApp.codeReturns }}</th>
							<th>{{ capApp.form }}</th>
							<th></th>
						</tr>
					</thead>
					
					<!-- new record -->
					<my-builder-js-function-item
						:builderLanguage="builderLanguage"
						:module="module"
					/>
					
					<!-- existing records -->
					<my-builder-js-function-item
						v-for="fnc in module.jsFunctions"
						:builderLanguage="builderLanguage"
						:key="fnc.id"
						:module="module"
						:jsFunction="fnc"
					/>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	data:function() {
		return {
			showJs:true,
			showPg:true
		};
	},
	computed:{
		module:function() {
			return typeof this.moduleIdMap[this.id] === 'undefined'
				? false : this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.function; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// presentation
		displayArrow:function(state) {
			return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
		}
	}
};