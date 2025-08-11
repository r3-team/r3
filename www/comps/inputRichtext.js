import {getAttributeFileHref} from './shared/attribute.js';
import {deepIsEqual}          from './shared/generic.js';
import {getDateFormat}        from './shared/time.js';

export default {
	name:'my-input-richtext',
	components:{'editor':Editor},
	template:`<div class="input-richtext">
		<div class="input-toolbar">
			<div class="row">
				<slot name="input-icon" />
				<div class="input-richtext-toolbar-content" ref="toolbar" v-show="!readonly"></div>
			</div>
			<div></div>
			<div class="row gap centered">
				<a
					class="input-richtext-toolbar-link clickable"
					target="_blank"
					href="https://www.tiny.cloud/powered-by-tiny?utm_campaign=poweredby&utm_source=tiny&utm_medium=referral&utm_content=v6"
					tabindex="-1"
				>
					<img class="input-richtext-toolbar-logo" src="images/externals/tinymce.svg" />
				</a>
				<my-button image="copyClipboard.png"
					v-if="clipboard"
					@trigger="$emit('copyToClipboard')"
					:active="modelValue !== null"
					:captionTitle="capGen.button.copyClipboard"
					:naked="true"
				/>
			</div>
		</div>
		<div class="input-richtext-content" :key="key">
			<editor api-key="no-api-key"
				v-if="active"
				v-model="input"
				@init="register"
				:disabled="readonly"
				:init="init"
			/>
		</div>
	</div>`,
	emits:['copyToClipboard','hotkey','update:modelValue'],
	props:{
		attributeIdFile:{ type:String,  required:false, default:'' },
		clipboard:      { type:Boolean, required:false, default:false },
		isHidden:       { type:Boolean, required:false, default:false },
		modelValue:     { required:true },
		printCaption:   { type:String,  required:false, default:'export' },
		readonly:       { type:Boolean, required:false, default:false },
		valueFiles:     { required:false, default:null }
	},
	data() {
		return {
			debug:false,
			editor:null,       // registered tinymce editor instance
			isMounted:false,   // wait for mount as toolbar ref must exist for tinymce init object to target it
			images:[],         // image links to offer in editor
			key:0,             // forces recreation of the editor on init change, 0 = not yet initialized
			toolbarBase:'bold italic forecolor paragraphgroup numlist bullist alignleft aligncenter alignright alignjustify',
			wasfocussed:false, // user focussed editor input
			
			// tokens are used to authenticate with the current user session
			// we cannot store sensitive tokens inside richtext, but tokens are required for accessing files
			// therefore we replace tokens with a placeholder
			tokenPlaceholder:'__token__'
		};
	},
	computed:{
		init:(s) => {
			return !s.isMounted ? {} : {
				branding:true, // https://www.tiny.cloud/docs/general-configuration-guide/attribution-requirements/
				cleanup_on_startup:false,
				contextmenu:'copy cut paste | undo | link | inserttable table',
				document_base_url:`${location.protocol}//${location.host}/`, // required when disabling 'relative_urls'
				entity_encoding:'raw', // disable encoding of things like umlaute, not required for UTF8 storage and makes searches easier
				fixed_toolbar_container_target:s.$refs.toolbar,
				highlight_on_focus:false,
				image_advtab:true,
				image_list:s.images,
				inline:true,
				language:s.language,
				menubar:false,
				paste_data_images:true,
				plugins:'code emoticons image link lists searchreplace table',
				readonly:s.readonly,
				relative_urls:false, // if URL to internal path is used in link, Tiny cuts of base URL ('https://system/#/app/...' -> '#/app/...'), Tiny then fails to open relative URL
				resize:false,
				skin:s.settings.dark ? 'oxide-dark' : 'oxide',
				toolbar:s.toolbar,
				toolbar_groups:{
					paragraphgroup: {
						icon:'change-case',
						items:'styles fontsize fontfamily'
					},
					insertgroup:{
						icon:'duplicate',
						items:'hr emoticons link image table'
					}
				},
				toolbar_mode:'floating',
				toolbar_persist:true,

				// adds more elements that tiny does not convert (adds to default valid_elements)
				// known issues: auto converts <b> to <strong>
				extended_valid_elements:'b',
				
				setup:(e) => {
					e.ui.registry.addButton('customPrint',{ icon:'print', onAction:s.print });
					e.on('focus', () => s.wasfocussed = true);

					if(s.debug) {
						e.on('remove', ()    => s.debugEvent('remove') );
						e.on('error',  (err) => s.debugEvent('error',err) );
					}
				}
			};
		},
		language:(s) => {
			switch(s.settings.languageCode.substring(0,2)) {
				case 'ar': return 'ar';    break;
				case 'en': return 'en';    break;
				case 'de': return 'de';    break;
				case 'fr': return 'fr_FR'; break;
				case 'hu': return 'hu_HU'; break;
				case 'it': return 'it';    break;
				case 'lv': return 'lv';    break;
				case 'ro': return 'ro';    break;
				case 'zh': return 'zh_CN'; break;
			}
			return 'en';
		},
		
		// inputs
		input:{
			get() {
				// tinyMCE cannot deal with null, set empty string instead
				// add authentication tokens to file download link
				return this.modelValue === null ? '' : this.modelValue.replace(this.rxTokensAdd,this.token);
			},
			set(v) {
				if(this.readonly || !this.wasfocussed)
					return;
				
				// remove authentication tokens from file download link
				const n = v.replace(this.rxTokensDel,this.tokenPlaceholder);
				if(n !== this.modelValue)
					this.$emit('update:modelValue',n);
			}
		},

		// component is expensive, do not load if hidden
		// unless it was already loaded once, keep it to avoid expensive reload and keep editor state
		active:(s) => s.isMounted && (!s.isHidden || s.editor !== null),
		toolbar:(s) => {
			if(s.readonly) return false;
			return s.isMobile ? s.toolbarBase : `undo redo ${s.toolbarBase} outdent indent insertgroup code customPrint searchreplace`;
		},

		// simple
		editorId:   (s) => s.editor === null ? 'NOT REGISTERED' : s.editor.id,
		rxTokensAdd:(s) => new RegExp(s.tokenPlaceholder,'g'),
		rxTokensDel:(s) => new RegExp(s.token,'g'),
		
		// stores
		token:   (s) => s.$store.getters['local/token'],
		capGen:  (s) => s.$store.getters.captions.generic,
		isMobile:(s) => s.$store.getters.isMobile,
		settings:(s) => s.$store.getters.settings
	},
	watch:{
		init(v) {
			// wait for next tick as readonly change (eg. disabled state) must be applied first
			// otherwise v-model is not updated correctly
			this.$nextTick(() => this.key++);
		},
		valueFiles(v0,v1) {
			if(!this.deepIsEqual(v0,v1))
				this.parseImages(v0);
		}
	},
	mounted() {
		this.isMounted = true;
	},
	methods:{
		// externals
		deepIsEqual,
		getAttributeFileHref,
		getDateFormat,
		
		// editor
		debugEvent(ev,err) {
			if(this.debug) {
				console.log(`Editor [${this.editorId}] ${new Date().toLocaleTimeString()} '${ev}'`);
				if(err !== undefined)
					console.error(`Editor [${this.editorId}] error`, err);
			}
		},
		parseImages(files) {
			// file input is either null (empty), array of files (initial value) or object of changes
			// keep known initial files if changes occurred (we only use stored files)
			if(files === null || !Array.isArray(files))
				return this.images = [];
			
			let out = [];
			for(const f of files) {
				if(!f.name.match(/\.(bmp|jpg|jpeg|png|gif|svg|webp)$/i))
					continue;
				
				// token is added to file HREF so that tiny can download image aspect ratios (token is replaced in model value)
				out.push({
					title:f.name,
					value:this.getAttributeFileHref(this.attributeIdFile,f.id,f.name,this.token)
				});
			}
			this.images = out;
		},
		print() {
			const win = window.open('', '', 'height=600,width=800');
			win.document.write(`<html><head><title>${this.printCaption}_${this.getDateFormat(new Date(),'Y-m-d H:i:S')}</title></head><body style="margin:20px;">${this.input}</body></html>`);
			win.document.close();

			setTimeout(() => {
				win.focus();
				win.print();
				win.close();
			}, 500);
		},
		register(ev,editor) {
			this.editor = editor;
			this.debugEvent('REGISTERED');
		}
	}
};