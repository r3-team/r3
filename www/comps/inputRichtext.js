import {getAttributeFileHref} from './shared/attribute.js';
import {deepIsEqual}          from './shared/generic.js';
export {MyInputRichtext as default};

const MyInputRichtext = {
	name:'my-input-richtext',
	components:{'editor':Editor},
	template:`<div class="input-richtext">
		<div class="input-richtext-toolbar">
			<div class="input-richtext-toolbar-content" ref="toolbar" v-show="!readonly"></div>
			<div></div>
			<a
				class="input-richtext-toolbar-link clickable"
				target="_blank"
				href="https://www.tiny.cloud/powered-by-tiny?utm_campaign=poweredby&utm_source=tiny&utm_medium=referral&utm_content=v6"
			>
				<img class="input-richtext-toolbar-logo" src="images/externals/tinymce.svg" />
			</a>
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
	emits:['hotkey','update:modelValue'],
	props:{
		attributeIdFile:{ type:String,  required:false, default:'' },
		isHidden:       { type:Boolean, required:false, default:false },
		modelValue:     { required:true },
		readonly:       { type:Boolean, required:false, default:false },
		valueFiles:     { required:false, default:null }
	},
	data() {
		return {
			debug:true,
			editor:null,             // registered tinymce editor instance
			images:[],               // image links to offer in editor
			key:0,                   // forces recreation of the editor on init change, 0 = not yet initialized
			mountDone:false,
			toolbarBase:'bold italic forecolor paragraphgroup numlist bullist alignleft aligncenter alignright alignjustify',
			
			// tokens are used to authenticate with the current user session
			// we cannot store sensitive tokens inside richtext, but tokens are required for accessing files
			// therefore we replace tokens with a placeholder
			tokenPlaceholder:'__token__'
		};
	},
	computed:{
		init:(s) => {
			return !s.mountDone ? {} : {
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

				// debug events
				setup:(e) => {
					if(!s.debug) return;
					
					e.on('remove', () => s.debugEvent('remove') );
					e.on('error', (err) => s.debugEvent('error',err) );
					e.on('SkinLoadError', (err) => s.debugEvent('SkinLoadError',err) );
					e.on('ThemeLoadError', (err) => s.debugEvent('ThemeLoadError',err) );
					e.on('ModelLoadError', (err) => s.debugEvent('ModelLoadError',err) );
					e.on('PluginLoadError', (err) => s.debugEvent('PluginLoadError',err) );
					e.on('IconsLoadError', (err) => s.debugEvent('IconsLoadError',err) );
					e.on('LanguageLoadError', (err) => s.debugEvent('LanguageLoadError',err) );
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
				if(this.readonly)
					return;
				
				// remove authentication tokens from file download link
				const n = v.replace(this.rxTokensDel,this.tokenPlaceholder);
				if(n !== this.modelValue)
					this.$emit('update:modelValue',n);
			}
		},

		// component is expensive, do not load if hidden
		// unless it was already loaded once, keep it to avoid expensive reload and keep editor state
		active:(s) => s.mountDone && (!s.isHidden || s.editor !== null),
		toolbar:(s) => {
			if(s.readonly) return false;
			return s.isMobile ? s.toolbarBase : `undo redo ${s.toolbarBase} outdent indent insertgroup code print searchreplace`;
		},

		// simple
		editorId:   (s) => s.editor === null ? 'NOT REGISTERED' : s.editor.id,
		rxTokensAdd:(s) => new RegExp(s.tokenPlaceholder,'g'),
		rxTokensDel:(s) => new RegExp(s.token,'g'),
		
		// stores
		token:   (s) => s.$store.getters['local/token'],
		isMobile:(s) => s.$store.getters.isMobile,
		settings:(s) => s.$store.getters.settings
	},
	watch:{
		active(v) {
			this.debugEvent('WATCH: ACTIVE CHANGE');
		},
		init(v) {
			this.debugEvent('WATCH: INIT CHANGE, key++');
			this.key++;
		},
		readonly(v) { 
			this.debugEvent('WATCH: READONLY CHANGE');
		},
		valueFiles(v0,v1) {
			if(!this.deepIsEqual(v0,v1)) {
				this.parseImages(v0);
				this.debugEvent('WATCH: FILES CHANGE');
			}
		}
	},
	mounted() {
		console.log('mount done');
		this.mountDone = true;
	},
	methods:{
		// externals
		deepIsEqual,
		getAttributeFileHref,
		
		// editor
		debugEvent(ev,err) {
			if(this.debug) {
				console.log(`TINY [${this.editorId}] ${new Date().toLocaleTimeString()} '${ev}'`);
				if(err !== undefined)
					console.error(`TINY [${this.editorId}] error`, err);
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
				
				// token is added to file HREF so that tiny can download image aspect ratios
				// token is replaced in model value
				out.push({
					title:f.name,
					value:this.getAttributeFileHref(this.attributeIdFile,f.id,f.name,this.token)
				});
			}
			this.images = out;
		},
		register(ev,editor) {
			this.editor = editor;
			this.debugEvent('REGISTERED');
		}
	}
};