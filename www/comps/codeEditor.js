import {
	builderOptionGet,
	builderOptionSet
} from './shared/builder.js';
export {MyCodeEditor as default};

let MyCodeEditor = {
	name:'my-code-editor',
	template:`<div class="code-editor">
	<div class="code-editor-field" ref="codeEditor"></div>
		<div class="code-editor-options default-inputs">
			<span><i>{{ mode }}</i></span>
			<div class="row gap centered">
				<my-button
					@trigger="builderOptionSet('codeEditorWrap',!wrap); wrap = !wrap"
					:caption="capGen.wrap"
					:image="wrap ? 'checkbox1.png' : 'checkbox0.png'"
					:naked="true"
				/>
				<select v-model="theme" @input="builderOptionSet('codeEditorTheme',$event.target.value)">
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
		insertEntity: { required:false, default:null },
		mode:         { type:String,  required:true },
		modelValue:   { required:true },
		modelValueAlt:{ type:String,  required:false, default:'' },
		readonly:     { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			editor:null,
			printMargin:true,
			sessionLive:'',
			sessionPreview:'',
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
			if(v !== this.sessionLive.getValue()) {
				this.sessionLive.setValue(v);
				this.editor.clearSelection();
			}
		},
		modelValueAlt(v) {
			if(v === '') {
				this.sessionLive.setScrollTop(this.sessionPreview.getScrollTop());
				this.editor.setSession(this.sessionLive);
				return;
			}

			this.sessionPreview.setScrollTop(this.sessionLive.getScrollTop());
			this.sessionPreview.setValue(v);
			this.editor.setSession(this.sessionPreview);
			this.editor.clearSelection();
		}
	},
	computed:{
		capGen:  (s) => s.$store.getters.captions.generic,
		settings:(s) => s.$store.getters.settings
	},
	mounted() {
		// init ACE code editor
		ace.require('ace/ext/searchbox');
		this.sessionLive    = ace.createEditSession(this.modelValue);
		this.sessionPreview = ace.createEditSession('');

		// disable features like JS syntax checker
		this.sessionLive.setUseWorker(false);
		this.sessionPreview.setUseWorker(false);

		this.editor = ace.edit(this.$refs.codeEditor);
		this.editor.setSession(this.sessionLive);
		this.editor.clearSelection();             // reset selection
		this.editor.setHighlightActiveLine(true); // mark selected line
		this.editor.on('change',this.change);
		this.editor.on('click',this.click);
		this.theme = this.builderOptionGet('codeEditorTheme',this.settings.dark ? 'cloud9_night' : 'cloud9_day');
		this.wrap  = this.builderOptionGet('codeEditorWrap',false);
		this.setOptions();

		// react to setting changes
		this.$watch(() => [this.printMargin,this.readonly,this.settings,this.theme,this.wrap],this.setOptions);
	},
	unmounted() {
		this.editor.destroy();
	},
	methods:{
		// externals
		builderOptionGet,
		builderOptionSet,

		// actions
		change() {
			if(!this.readonly)
				this.$emit('update:modelValue',this.sessionLive.getValue());
		},
		click() {
			if(!this.readonly && this.insertEntity !== null){
				this.editor.insert(this.insertEntity);
				this.$emit('clicked');
			}
		},

		// editor functions
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