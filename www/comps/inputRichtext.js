import {getAttributeFileHref} from './shared/attribute.js';
export {MyInputRichtext as default};

let MyInputRichtext = {
	name:'my-input-richtext',
	components:{'editor':Editor},
	template:`<div class="input-richtext" :key="key">
		<editor api-key="API_KEY" ref="editor"
			v-model="input"
			@keyDown="handleHotkeys"
			:disabled="readonly"
			:init="init"
		/>
	</div>`,
	emits:['hotkey','update:modelValue'],
	props:{
		attributeIdFile:{ type:String,  required:false, default:'' },
		modelValue:     { required:true },
		readonly:       { type:Boolean, required:false, default:false },
		valueFiles:     { required:false, default:null }
	},
	watch:{
		isMobile  () { this.key++; }, // update menu bar
		readonly  () { this.key++; }, // update menu bar
		valueFiles() { this.key++; }  // update image list
	},
	data() {
		return {
			imageList:[], // list of available images
			key:0,        // key is used to force update richtext editor
			knownCtrlKeys:['q','s'],
			
			// tokens are used to authenticate with the current user session
			// we cannot store sensitive tokens inside richtext, but tokens are required for accessing files
			// therefore we replace tokens with a placeholder
			tokenPlaceholder:'__token__'
		};
	},
	computed:{
		init:(s) => {
			s.parseImages();
			
			let obj = {
				branding:true, // https://www.tiny.cloud/docs/general-configuration-guide/attribution-requirements/
				content_style:`
					.mce-content-body{ background-color:transparent; }
				`,
				entity_encoding:'raw', // disable encoding of things like umlaute, not required for UTF8 storage and makes searches easier
				height:'100%',
				image_advtab:true,
				image_list:s.imageList,
				language:s.language,
				menubar:false,
				min_height:200,
				paste_data_images:true,
				plugins:'code emoticons image link lists searchreplace table',
				resize:false,
				selector:'textarea',
				toolbar:`bold italic forecolor paragraphgroup numlist bullist alignleft aligncenter alignright alignjustify`,
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
				toolbar_mode:'floating'
			};
			
			if(s.settings.dark) {
				obj.skin        = 'oxide-dark';
				obj.content_css = 'dark';
			}
			
			if(!s.isMobile)
				obj.toolbar = `undo redo ${obj.toolbar} outdent indent insertgroup code print searchreplace`;
			
			if(s.readonly)
				obj.toolbar = false;
			
			return obj;
		},
		language:(s) => {
			switch(s.settings.languageCode) {
				case 'en_us': return 'en'; break;
				case 'de_de': return 'de'; break;
			}
			return 'en';
		},
		
		// inputs
		input:{
			get() {
				// tinyMCE cannot deal with null, set empty string instead
				if(this.modelValue === null)
					return '';
				
				// add authentication tokens to file download link
				return this.modelValue.replace(
					new RegExp(this.tokenPlaceholder,'g'),this.token
				);
			},
			set(v) {
				if(this.readonly)
					return;
				
				// remove authentication tokens from file download link
				this.$emit('update:modelValue',v.replace(
					new RegExp(this.token,'g'),this.tokenPlaceholder));
			}
		},
		
		// stores
		token:   (s) => s.$store.getters['local/token'],
		isMobile:(s) => s.$store.getters.isMobile,
		settings:(s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getAttributeFileHref,
		
		parseImages() {
			if(this.valueFiles === null)
				return this.imageList = [];
			
			// file input is either array of files (initial value) or object of changes
			// keep known initial files if changes occured (we only use stored files)
			if(!Array.isArray(this.valueFiles))
				return;
			
			this.imageList = [];
			for(let f of this.valueFiles) {
				if(!f.name.match(/\.(bmp|jpg|jpeg|png|gif|webp)$/i))
					continue;
				
				// token is added to file HREF so that tiny can download image aspect ratios
				// token is replaced in model value
				this.imageList.push({
					title:f.name,
					value:this.getAttributeFileHref(
						this.attributeIdFile,f.id,f.name,this.token)
				});
			}
		},
		
		// actions
		handleHotkeys(e) {
			if(e.key === 'Escape' || (e.ctrlKey && this.knownCtrlKeys.includes(e.key))) {
				this.$emit('hotkey',e);
				e.preventDefault();
			}
		}
	}
};