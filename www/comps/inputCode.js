import { jsLibraryLoadNoCache } from './shared/jsLibrary.js';
import { setSingle as setSettingSingle } from './shared/settings.js';

const sourceLanguages = [
	'css', 'csv', 'dockerfile', 'golang', 'html', 'ini', 'java', 'javascript',
	'json', 'markdown', 'mysql', 'perl', 'pgsql', 'php', 'powershell',
	'python', 'ruby', 'rust', 'sql', 'sqlserver', 'text', 'typescript',
	'vbscript', 'vue', 'xml', 'zig'
];
const themesBright = ['chrome', 'cloud9_day', 'eclipse', 'github', 'textmate'];
const themesDark = [
	'chaos', 'cloud9_night', 'github_dark', 'gruvbox', 'gruvbox_dark_hard',
	'kr_theme', 'merbivore', 'mono_industrial', 'monokai', 'terminal',
	'tomorrow_night', 'twilight', 'vibrant_ink'
];

export default {
	name: 'my-input-code',
	template: `<div class="input-code-editor">
		<div class="input-code-editor-field" ref="codeEditor"></div>
		<div class="input-code-editor-options default-inputs">

			<!-- source language -->
			<div class="row">
				<span v-if="singleLanguage"><i>{{ sourceLanguage }}</i></span>
				<select v-if="!singleLanguage && !isEmpty" v-model="sourceLanguage">
					<option v-for="l in sourceLanguages">{{ l }}</option>
				</select>
			</div>

			<!-- view options -->
			<div class="row gap centered">
				<my-button-check v-model="wrap" :caption="capGen.wrap" />
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
	props: {
		allowNull: { type: Boolean, required: false, default: false },
		modelValue: { type: [String, null], required: true },                        // JSON string, such as: { language:'golang', text: 'func main() {}' }
		modelValuePreview: { type: String, required: false, default: '' },           // alternative preview text - just text, uses source language from original value
		readonly: { type: Boolean, required: false, default: false },
		singleLanguage: { type: [String, null], required: false, default: null },    // if set, source language is not part of value
		textInsertOnClick: { type: [String, null], required: false, default: null }, // if set, inserts text at cursor position
	},
	data() {
		return {
			editor: null,
			printMargin: true,
			sessionLive: null,
			sessionPreview: null,
		};
	},
	emits: ['textInserted', 'update:modelValue'],
	computed: {
		// inputs
		sourceLanguage: {
			get() {
				if (this.singleLanguage !== null)
					return this.singleLanguage;

				return this.isEmpty ? 'text' : JSON.parse(this.modelValue).language;
			},
			set(v) { this.setSourceLanguage(v); }
		},
		theme: {
			get() { return this.settings.codeEditorTheme; },
			set(v) { this.setSettingSingle('codeEditorTheme', v); }
		},
		wrap: {
			get() { return this.settings.codeEditorWrap; },
			set(v) { this.setSettingSingle('codeEditorWrap', v); }
		},

		// simple
		isEmpty: s => s.modelValue === null,
		sourceLanguages: () => sourceLanguages,
		sourceText: s => s.isEmpty ? '' : (s.singleLanguage !== null ? s.modelValue : JSON.parse(s.modelValue).text),
		themesBright: () => themesBright,
		themesDark: () => themesDark,

		// stores
		capGen: s => s.$store.getters.captions.generic,
		settings: s => s.$store.getters.settings
	},
	mounted() {
		jsLibraryLoadNoCache('externals/ace/ace.js').then(() => {
			// init ACE code editor
			ace.require('ace/ext/searchbox');
			this.sessionLive = ace.createEditSession(this.sourceText);
			this.sessionPreview = ace.createEditSession('');

			// disable features like JS syntax checker
			this.sessionLive.setUseSoftTabs(false);
			this.sessionLive.setUseWorker(false);
			this.sessionPreview.setUseWorker(false);

			this.editor = ace.edit(this.$refs.codeEditor);
			this.editor.setSession(this.sessionLive);
			this.editor.clearSelection(); // reset selection
			this.editor.setHighlightActiveLine(true); // mark selected line
			this.editor.on('change', this.setSourceText);
			this.editor.on('click', this.click);
			this.setOptions();

			// react to editor option changes
			this.$watch(() => [this.printMargin, this.readonly, this.settings, this.sourceLanguage], this.setOptions);

			this.$watch('modelValuePreview', v => {
				if (v === '') {
					this.sessionLive.setScrollTop(this.sessionPreview.getScrollTop());
					this.editor.setSession(this.sessionLive);
					return;
				}
				this.sessionPreview.setScrollTop(this.sessionLive.getScrollTop());
				this.sessionPreview.setValue(v);
				this.editor.setSession(this.sessionPreview);
				this.editor.clearSelection();
			});
			this.$watch('sourceText', v => {
				if (v !== this.sessionLive.getValue()) {
					this.sessionLive.setValue(v);
					this.editor.clearSelection();
				}
			});
		}, this.$root.genericError);
	},
	unmounted() {
		if (this.editor !== null)
			this.editor.destroy();
	},
	methods: {
		// externals
		setSettingSingle,

		// actions
		click() {
			if (!this.readonly && this.textInsertOnClick !== null) {
				this.editor.insert(this.textInsertOnClick);
				this.$emit('textInserted');
			}
		},
		set(sourceLanguage, sourceText) {
			if (this.readonly)
				return;

			const v = sourceText === null || sourceText === ''
				? this.allowNull ? null : ''
				: (
					this.singleLanguage ? sourceText : JSON.stringify({
						'language': sourceLanguage,
						'text': sourceText
					})
				);

			this.$emit('update:modelValue', v);
		},
		setSourceLanguage(v) {
			this.set(v, this.sessionLive.getValue());
		},
		setSourceText() {
			this.set(this.sourceLanguage, this.sessionLive.getValue());
		},

		// editor functions
		setOptions() {
			this.editor.setOptions({
				enableAutoIndent: true,
				fontSize: 17 * this.settings.fontSize / 100,
				mode: `ace/mode/${this.sourceLanguage}`,
				readOnly: this.readonly,
				theme: `ace/theme/${this.theme}`,
				wrap: this.wrap
			});
			this.editor.setShowPrintMargin(this.printMargin);
		}
	}
};
