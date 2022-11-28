import MyBuilderCaption        from './builderCaption.js';
import {getPgFunctionTemplate} from '../shared/builder.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
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
			:tight="true"
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
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && name !== '' && !readonly"
						:caption="isNew ? capGen.button.create : ''"
						:captionTitle="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="open.png"
						v-if="!isNew"
						@trigger="open"
						:captionTitle="capGen.button.open"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</td>
			<td>
				<input class="long"
					v-model="name"
					:disabled="readonly"
					:placeholder="isNew ? capApp.new : ''"
				/>
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="copyValueDialog(jsFunction.name,jsFunction.id,jsFunction.id)"
					:active="!isNew"
				/>
			</td>
			<td>
				<my-builder-caption
					v-model="captions.jsFunctionTitle"
					:language="builderLanguage"
					:readonly="readonly"
				/>
			</td>
			<td>
				<input disabled="disabled" :value="capApp.languageJs" />
			</td>
			<td>
				<input class="long"
					v-model="codeArgs"
					:disabled="readonly"
					:placeholder="capApp.codeArgsHintJs"
				/>
			</td>
			<td>
				<input
					v-model="codeReturns"
					:disabled="readonly"
					:placeholder="capApp.codeReturnsHintJs"
				/>
			</td>
			<td>
				<div class="row">
					<my-button image="open.png"
						@trigger="openForm"
						:active="formId !== null"
					/>
					<select :disabled="!isNew || readonly" v-model="formId">
						<option :value="null">-</option>
						<option v-for="f in module.forms" :value="f.id">
							{{ f.name }}
						</option>
					</select>
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
		},
		readonly:{ type:Boolean, required:true }
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
		// externals
		copyValueDialog,
		
		// actions
		open:function() {
			this.$router.push('/builder/js-function/'+this.jsFunction.id);
		},
		openForm:function() {
			this.$router.push('/builder/form/'+this.formId);
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

let MyBuilderFunctions = {
	name:'my-builder-functions',
	components:{
		MyBuilderJsFunctionItem
	},
	template:`<div class="contentBox grow builder-functions">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/code.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content" v-if="module">
		
			<!-- PG functions -->
			<div class="builder-entry-list">
				
				<div class="entry"
					@click="$emit('createNew',readonly ? null : 'pgFunction')"
					:class="{ clickable:!readonly, off:readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="f in module.pgFunctions.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="f.id"
					:to="'/builder/pg-function/'+f.id" 
				>
					<div class="lines">
						<span>{{ f.name }}</span>
						<span class="subtitle" v-if="typeof f.captions.pgFunctionTitle[builderLanguage] !== 'undefined'">
							[{{ f.captions.pgFunctionTitle[builderLanguage] }}]
						</span>
					</div>
					<div class="row">
						<my-button image="databaseCog.png"
							v-if="f.isTrigger"
							:active="false"
							:captionTitle="capApp.isTrigger"
							:naked="true"
							:tight="true"
						/>
						<my-button image="screen.png"
							v-if="f.isFrontendExec"
							:active="false"
							:captionTitle="capApp.isFrontendExec"
							:naked="true"
							:tight="true"
						/>
						<my-button image="time.png"
							v-if="f.schedules.length !== 0"
							:active="false"
							:captionTitle="capApp.schedules"
							:naked="true"
							:tight="true"
						/>
					</div>
				</router-link>
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
							<th>{{ capGen.actions }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.id }}</th>
							<th>{{ capGen.title }}</th>
							<th>{{ capApp.language }}</th>
							<th>{{ capApp.codeArgs }}</th>
							<th>{{ capApp.codeReturns }}</th>
							<th>{{ capApp.form }}</th>
						</tr>
					</thead>
					
					<!-- new record -->
					<my-builder-js-function-item
						:builderLanguage="builderLanguage"
						:module="module"
						:readonly="readonly"
					/>
					
					<!-- existing records -->
					<my-builder-js-function-item
						v-for="fnc in module.jsFunctions"
						:builderLanguage="builderLanguage"
						:key="fnc.id"
						:module="module"
						:jsFunction="fnc"
						:readonly="readonly"
					/>
				</table>
			</div>
		</div>
	</div>`,
	emits:['createNew'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data:function() {
		return {
			filter:'',
			showJs:true
		};
	},
	computed:{
		// stores
		module:     (s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.function,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// presentation
		displayArrow(state) {
			return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
		}
	}
};