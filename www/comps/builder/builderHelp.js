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
					:active="hasChanges"
					:caption="capGen.button.save"
					:darkBg="true"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<my-builder-caption
			v-model="helpInput"
			:language="builderLanguage"
			:richtext="true"
		/>
	</div>`,
	data:function() {
		return {
			helpInput:{}
		};
	},
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	watch:{
		help:{
			handler:function(v) {
				this.reset();
			},
			immediate:true
		}
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		help:function() {
			if(this.module === false)
				return '';
			
			return this.module.captions.moduleHelp;
		},
		hasChanges:function() {
			return JSON.stringify(this.helpInput) !== JSON.stringify(this.help);
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.help; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		reset:function() {
			this.helpInput = JSON.parse(JSON.stringify(this.help));
		},
		set:function() {
			let mod = JSON.parse(JSON.stringify(this.module));
			mod.captions.moduleHelp = this.helpInput;
			
			ws.send('module','set',mod,true).then(
				(res) => this.$root.schemaReload(this.module.id),
				(err) => this.$root.genericError(err)
			);
		}
	}
};
