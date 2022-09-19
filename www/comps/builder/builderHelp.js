import MyBuilderCaption from './builderCaption.js';
export {MyBuilderHelp as default};

let MyBuilderHelp = {
	name:'my-builder-help',
	components:{MyBuilderCaption},
	template:`<div class="builder-help contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
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
			</div>
		</div>
		
		<my-builder-caption
			v-model="helpInput"
			@hotkey="$emit('hotkey',$event)"
			:language="builderLanguage"
			:readonly="readonly"
			:richtext="true"
		/>
	</div>`,
	emits:['hotkey','hotkeysRegister'],
	data:function() {
		return {
			helpInput:{}
		};
	},
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	watch:{
		help:{
			handler:function(v) { this.reset(); },
			immediate:true
		}
	},
	mounted:function() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted:function() {
		this.$emit('hotkeysRegister',[]);
	},
	computed:{
		module:(s) => {
			return typeof s.moduleIdMap[s.id] === 'undefined'
				? false : s.moduleIdMap[s.id];
		},
		hasChanges:(s) => {
			return JSON.stringify(s.helpInput) !== JSON.stringify(s.help);
		},
		help:(s) => {
			return s.module === false
				? '' : s.module.captions.moduleHelp;
		},
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.help,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		reset() {
			this.helpInput = JSON.parse(JSON.stringify(this.help));
		},
		set() {
			let mod = JSON.parse(JSON.stringify(this.module));
			mod.captions.moduleHelp = this.helpInput;
			
			ws.send('module','set',mod,true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};
