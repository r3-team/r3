import MyBuilderVariable  from './builderVariable.js';
import {getAttributeIcon} from '../shared/attribute.js';
import {routeParseParams} from '../shared/router.js';
export {MyBuilderVariables as default};

let MyBuilderVariables = {
	name:'my-builder-variables',
	components:{MyBuilderVariable},
	template:`<div class="contentBox grow builder-variables">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/variable.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content" v-if="module">
			<div class="generic-entry-list">
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','variable')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<div class="entry clickable"
					v-for="v in module.variables.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					@click="variableIdEdit = v.id"
				>
					<my-button
						:active="false"
						:image="getAttributeIcon(v.content,v.contentUse,false,false)"
						:naked="true"
					/>
					<div class="lines">
						<span v-if="v.formId === null">{{ v.name }}</span>
						<span v-if="v.formId !== null"><b>{{ formIdMap[v.formId].name }}:</b> {{ v.name }}</span>
					</div>
					<my-button image="fileText.png"
						v-if="v.formId !== null"
						:active="false"
						:captionTitle="capApp.form"
						:naked="true"
					/>
				</div>
			</div>
		</div>
		
		<!-- variable dialog -->
		<my-builder-variable
			v-if="module && variableIdEdit !== false"
			@close="variableIdEdit = false"
			:module="module"
			:readonly="readonly"
			:variableId="variableIdEdit"
		/>
	</div>`,
	emits:['createNew'],
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	data() {
		return {
			filter:'',
			variableIdEdit:false
		};
	},
	mounted() {
		let params = { variableIdEdit:{ parse:'string', value:null } };
		this.routeParseParams(params);
		
		if(params.variableIdEdit.value !== null)
			this.variableIdEdit = params.variableIdEdit.value;
	},
	computed:{
		// stores
		module:     (s) => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.variable,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getAttributeIcon,
		routeParseParams
	}
};