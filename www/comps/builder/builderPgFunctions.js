import MyBuilderCaption        from './builderCaption.js';
import {getPgFunctionTemplate} from '../shared/builder.js';
import {getNilUuid}            from '../shared/generic.js';
export {MyBuilderPgFunctions as default};

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
		capApp:function() { return this.$store.getters.captions.builder.pgFunction; }
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
				<my-button
					@trigger="showSchedules = !showSchedules"
					:caption="capApp.schedulesItem.replace('{CNT}',schedules.length)"
				/>
			</td>
			<td>
				<input class="long"
					v-model="codeArgs"
					:disabled="!isNew"
					:placeholder="capApp.codeArgsHint"
				/>
			</td>
			<td>
				<input
					v-model="codeReturns"
					:disabled="!isNew"
					:placeholder="capApp.codeReturnsHint"
				/>
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
				codeReturns:'trigger',
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
			schedules:JSON.parse(JSON.stringify(this.pgFunction.schedules)),
			captions:JSON.parse(JSON.stringify(this.pgFunction.captions)),
			
			// states
			showSchedules:false
		};
	},
	computed:{
		hasChanges:function() {
			return this.name !== this.pgFunction.name
				|| this.codeArgs !== this.pgFunction.codeArgs
				|| this.codeReturns !== this.pgFunction.codeReturns
				|| JSON.stringify(this.schedules) !== JSON.stringify(this.pgFunction.schedules)
				|| JSON.stringify(this.captions)  !== JSON.stringify(this.pgFunction.captions)
			;
		},
		
		// simple states
		isNew:function() { return this.pgFunction.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.pgFunction; },
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
			let trans = new wsHub.transactionBlocking();
			trans.add('pgFunction','del',{
				id:this.pgFunction.id
			},this.delOk);
			trans.send(this.$root.genericError);
		},
		delOk:function(res) {
			this.$root.schemaReload(this.moduleId);
		},
		set:function() {
			if(this.codeFunction === '')
				this.codeFunction = this.getPgFunctionTemplate();
			
			let trans = new wsHub.transactionBlocking();
			trans.add('pgFunction','set',{
				id:this.pgFunction.id,
				moduleId:this.moduleId,
				name:this.name,
				codeArgs:this.codeArgs,
				codeFunction:this.codeFunction,
				codeReturns:this.codeReturns,
				schedules:this.schedules,
				captions:this.captions
			},this.setOk);
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			if(this.isNew)
				this.name = '';
			
			this.$root.schemaReload(this.moduleId);
			
			let trans = new wsHub.transaction();
			trans.add('scheduler','reload',{});
			trans.send(this.$root.genericError);
		}
	}
};

let MyBuilderPgFunctions = {
	name:'my-builder-pg-functions',
	components:{MyBuilderPgFunctionItem},
	template:`<div class="contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content builder-pg-functions default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.button.open }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.id }}</th>
						<th>{{ capGen.title }}</th>
						<th>{{ capApp.schedules }}</th>
						<th>{{ capApp.codeArgs }}</th>
						<th>{{ capApp.codeReturns }}</th>
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
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.pgFunction; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	}
};