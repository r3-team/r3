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
		attributeIdFile:{ type:String, required:false, default:'' },
		modelValue:     { required:true },
		readonly:       { type:Boolean, required:false, default:false },
		valueFiles:     { required:false, default:null }
	},
	watch:{
		isMobile:  function() { this.key++; }, // update menu bar
		readonly:  function() { this.key++; }, // update menu bar
		valueFiles:function() { this.key++; }  // update image list
	},
	data:function() {
		return {
			key:0, // key is used to force update richtext editor
			knownHotkeys:['q','s'],
			
			// tokens are used to authenticate with the current user session
			// we cannot store sensitive tokens inside richtext, but tokens are required for accessing files
			// therefore we replace tokens with a placeholder
			tokenPlaceholder:'__token__'
		};
	},
	computed:{
		init:function() {
			let obj = {
				branding:true, // https://www.tiny.cloud/docs/general-configuration-guide/attribution-requirements/
				height:'100%',
				image_list:this.imageList,
				language:this.language,
				menubar:false,
				min_height:'200px',
				paste_data_images:true,
				plugins:'code emoticons hr image link lists print searchreplace table textpattern',
				resize:false,
				selector:'textarea',
				toolbar:`bold italic forecolor | numlist bullist |
					alignleft aligncenter alignright alignjustify`,
				toolbar_mode:'wrap',
				
				// pseudo markdown shortcuts (full markdown support is not yet available)
				textpattern_patterns:[
					{start:'*',end:'*',format:'italic'},
					{start:'**',end:'**',format:'bold'},
					{start:'#',format:'h1'},
					{start:'##',format:'h2'},
					{start:'###',format:'h3'},
					{start:'####',format:'h4'},
					{start:'#####',format:'h5'},
					{start:'######',format:'h6'},
					{start:'1. ',cmd:'InsertOrderedList'},
					{start:'* ',cmd:'InsertUnorderedList'},
					{start:'- ',cmd:'InsertUnorderedList'}
				]
			};
			
			if(this.settings.dark) {
				obj.skin        = 'oxide-dark';
				obj.content_css = 'dark';
			}
			
			if(!this.isMobile) {
				obj.toolbar = `undo redo | styleselect | ${obj.toolbar} | outdent indent`
					+ `| hr | emoticons link image table | code print searchreplace`;
			}
			
			if(this.readonly)
				obj.toolbar = false;
			
			return obj;
		},
		language:function() {
			switch(this.settings.languageCode) {
				case 'en_us': return 'en'; break;
				case 'de_de': return 'de'; break;
			}
			return 'en';
		},
		input:{
			get:function() {
				// tinyMCE cannot deal with null, set empty string instead
				if(this.modelValue === null)
					return '';
				
				// add authentication tokens to file download link
				return this.modelValue.replace(
					new RegExp(this.tokenPlaceholder,'g'),this.token
				);
			},
			set:function(v) {
				if(this.readonly)
					return;
				
				// remove authentication tokens from file download link
				this.$emit('update:modelValue',v.replace(
					new RegExp(this.token,'g'),this.tokenPlaceholder));
			}
		},
		imageList:function() {
			if(this.valueFiles === null)
				return [];
			
			let out = [];
			for(let i = 0, j = this.valueFiles.length; i < j; i++) {
				let file = this.valueFiles[i];
				
				// file is not yet available to be downloaded
				// new state is removed, once record is saved
				if(file.new) continue;
				
				// token is added to file HREF so that tiny can download image aspect ratios
				// token is replaced in model value
				out.push({
					title:file.name,
					value:this.getAttributeFileHref(this.attributeIdFile,
						file.id,file.name,this.token)
				});
			}
			return out;
		},
		
		// stores
		token:   function() { return this.$store.getters['local/token']; },
		isMobile:function() { return this.$store.getters.isMobile; },
		settings:function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getAttributeFileHref,
		
		// actions
		handleHotkeys:function(e) {
			if(e.ctrlKey && this.knownHotkeys.includes(e.key)) {
				this.$emit('hotkey',e);
				e.preventDefault();
			}
		}
	}
};