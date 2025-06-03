import {getAttributeFileHref} from './shared/attribute.js';
export {MyInputRichtext as default};

let MyInputRichtext = {
	name:'my-input-richtext',
	components:{'editor':Editor},
	template:`<div class="input-richtext" :key="key">
		<editor api-key="API_KEY"
			v-model="input"
			@init="register"
			@keyDown="handleHotkeys"
			:init="init"
		/>
	</div>`,
	emits:['hotkey','update:modelValue'],
	props:{
		attributeIdFile:{ type:String,  required:false, default:'' },
		formLoading:    { type:Boolean, required:false, default:false },
		modelValue:     { required:true },
		readonly:       { type:Boolean, required:false, default:false },
		valueFiles:     { required:false, default:null }
	},
	data() {
		return {
			editor:null,             // reference to editor object for cleanup
			key:0,                   // forces recreation of the editor on init change, 0 = not yet initialized
			knownCtrlKeys:['q','s'], // for handling supported hot keys
			loading:false,           // blocks parallel reload of editor and changes before user action (TinyMCE cleans up content on load w/o user interaction)
			
			// tokens are used to authenticate with the current user session
			// we cannot store sensitive tokens inside richtext, but tokens are required for accessing files
			// therefore we replace tokens with a placeholder
			tokenPlaceholder:'__token__'
		};
	},
	computed:{
		init:(s) => {
			let toolbar = `bold italic forecolor paragraphgroup numlist bullist alignleft aligncenter alignright alignjustify`;
			if(!s.isMobile) toolbar = `undo redo ${toolbar} outdent indent insertgroup code print searchreplace`;
			if(s.readonly)  toolbar = false;

			return {
				branding:true, // https://www.tiny.cloud/docs/general-configuration-guide/attribution-requirements/
				cleanup_on_startup:false,
				content_style:`.mce-content-body{ background-color:transparent; }`,
				contextmenu:'copy cut paste | undo | link | inserttable table',
				document_base_url:`${location.protocol}//${location.host}/`, // required when disabling 'relative_urls'
				content_css:s.settings.dark ? 'dark' : 'default',
				entity_encoding:'raw', // disable encoding of things like umlaute, not required for UTF8 storage and makes searches easier
				height:'100%',
				image_advtab:true,
				image_list:JSON.parse(JSON.stringify(s.images)),
				language:s.language,
				menubar:false,
				min_height:200,
				paste_data_images:true,
				plugins:'code emoticons image link lists searchreplace table',
				readonly:s.readonly, // in init instead of as :disabled on editor component as we need to rebuild the toolbars too
				relative_urls:false, // if URL to internal path is used in link, Tiny cuts of base URL ('https://system/#/app/...' -> '#/app/...'), Tiny then fails to open relative URL
				resize:false,
				selector:'textarea',
				skin:s.settings.dark ? 'oxide-dark' : 'oxide',
				toolbar:toolbar,
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

				// adds more elements that tiny does not convert (adds to default valid_elements)
				// known issues: auto converts <b> to <strong>
				extended_valid_elements:'b'
			};
		},
		images:(s) => {
			if(s.valueFiles === null)
				return [];
			
			// file input is either array of files (initial value) or object of changes
			// keep known initial files if changes occurred (we only use stored files)
			if(!Array.isArray(s.valueFiles))
				return [];
			
			let out = [];
			for(const f of s.valueFiles) {
				if(!f.name.match(/\.(bmp|jpg|jpeg|png|gif|svg|webp)$/i))
					continue;
				
				// token is added to file HREF so that tiny can download image aspect ratios
				// token is replaced in model value
				out.push({
					title:f.name,
					value:s.getAttributeFileHref(s.attributeIdFile,f.id,f.name,s.token)
				});
			}
			return out;
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
				return this.modelValue === null ? '' : this.modelValue.replace(
					new RegExp(this.tokenPlaceholder,'g'),this.token);
			},
			set(v) {
				if(this.readonly || this.loading)
					return;
				
				// remove authentication tokens from file download link
				const n = v.replace(new RegExp(this.token,'g'),this.tokenPlaceholder);
				if(n !== this.modelValue)
					this.$emit('update:modelValue',n);
			}
		},
		
		// stores
		token:   (s) => s.$store.getters['local/token'],
		isDark:  (s) => s.$store.getters.settings.dark,
		isMobile:(s) => s.$store.getters.isMobile,
		settings:(s) => s.$store.getters.settings
	},
	mounted() {
		// refresh editor if any relevant input changes
		this.$watch(() => [this.formLoading,this.images,this.isDark,this.isMobile,this.language,this.readonly],this.reinit);
	},
	unmounted() {
		this.remove();
	},
	methods:{
		// externals
		getAttributeFileHref,
		
		// actions
		handleHotkeys(e) {
			if(e.key === 'Escape' || (e.ctrlKey && this.knownCtrlKeys.includes(e.key))) {
				this.$emit('hotkey',e);
				e.preventDefault();
			}
		},
		
		// editor handling
		register(ev,editor) {
			this.editor = editor;
		},
		reinit() {
			if(this.formLoading || this.loading)
				return;

			this.loading = true; // block parallel editor load
			this.remove();       // cleanup editor
			this.key++;          // reinit editor

			// remove loading state after editor is fully ready
			this.$nextTick(() => { this.loading = false; });
		},
		remove() {
			if(this.editor !== null) {
				this.editor.remove();
				this.editor = null;
			}
		}
	}
};