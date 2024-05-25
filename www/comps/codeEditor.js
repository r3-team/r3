export {MyCodeEditor as default};

let MyCodeEditor = {
	name:'my-code-editor',
	template:`<div class="code-editor">
	<div class="code-editor-field" ref="codeEditor"></div>
		<div class="code-editor-options default-inputs">
			<div class="row gap">
				<my-bool v-model="wrap"
					:caption0="capGen.wrap"
					:caption1="capGen.wrap"
				/>
				<select v-model="theme">
					<optgroup :label="capGen.bright">
						<option v-for="t in themesBright">{{ t }}</option>
					</optgroup>
					<optgroup :label="capGen.dark">
						<option v-for="t in themesDark">{{ t }}</option>
					</optgroup>
				</select>
			</div>
		</div>
	</div>`,
	props:{
		insertEntity:{ required:false, default:null },
		mode:        { type:String,  required:true },
		modelValue:  { required:true },
		readonly:    { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			editor:null,
			printMargin:true,
			theme:'monokai',
			themesBright:['chrome','cloud9_day','eclipse','github','textmate'],
			themesDark:[
				'chaos','cloud9_night','github_dark','gruvbox','gruvbox_dark_hard',
				'kr_theme','merbivore','mono_industrial','monokai','terminal',
				'tomorrow_night','twilight','vibrant_ink'
			],
			wrap:false
		};
	},
	emits:['clicked','update:modelValue'],
	watch:{
		modelValue(v) {
			if(v !== this.editor.getValue()) {
				// use editor.session.setValue() also clears undo history (editor.setValue() does not)
				this.editor.session.setValue(v);
				this.editor.clearSelection();
			}
		}
	},
	computed:{
		capGen:  (s) => s.$store.getters.captions.generic,
		settings:(s) => s.$store.getters.settings
	},
	mounted() {
		// init ACE code editor
		ace.require('ace/ext/searchbox');
		this.editor = ace.edit(this.$refs.codeEditor);
		this.editor.setValue(this.modelValue);
		this.editor.clearSelection();             // reset selection
		this.editor.setHighlightActiveLine(true); // mark selected line
		this.editor.session.setUseWorker(false);  // disable features like JS syntax checker
		this.editor.on('change',this.change);
		this.editor.on('click',this.click);
		this.setOptions();

		// react to setting changes
		this.$watch(() => [this.printMargin,this.readonly,this.settings,this.theme,this.wrap],this.setOptions);
	},
	unmounted() {
		this.editor.destroy();
	},
	methods:{
		change() {
			if(!this.readonly)
				this.$emit('update:modelValue',this.editor.getValue());
		},
		click() {
			if(this.insertEntity !== null){
				this.editor.insert(this.insertEntity);
				this.$emit('clicked');
			}
		},
		setOptions() {
			this.editor.setOptions({
				enableAutoIndent:true,
				fontSize:14 * this.settings.fontSize / 100,
				mode:`ace/mode/${this.mode}`,
				readOnly:this.readonly,
				theme:`ace/theme/${this.theme}`,
				wrap:this.wrap
			});
			this.editor.setShowPrintMargin(this.printMargin);
		}
	}
};