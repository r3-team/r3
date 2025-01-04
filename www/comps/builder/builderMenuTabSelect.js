import MyTabs                          from '../tabs.js';
import srcBase64Icon                   from '../shared/image.js';
import {getCaptionForLang}             from '../shared/language.js';
export {MyBuilderMenuTabSelect as default};

let MyBuilderMenuTabSelect = {
	name:'my-builder-menu-tab-select',
	components:{MyTabs},
	template:`<my-tabs
		@update:modelValue="$emit('update:modelValue',$event)"
		:entries="tabs.indx"
		:entriesIcon="tabs.imgs"
		:entriesText="tabs.caps"
		:modelValue="modelValue"
	/>`,
	props:{
		builderLanguage:{ type:String, required:true },
		menuTabs:       { type:Array,  required:true },
		modelValue:     { required:true }
	},
	emits:['update:modelValue'],
	computed:{
		tabs:(s) => {
			let indx = [];
			let imgs = [];
			let caps = [];
		
			for(let i = 0, j = s.menuTabs.length; i < j; i++) {
				const mt = s.menuTabs[i];
				indx.push(i);
				imgs.push(s.srcBase64Icon(mt.iconId,'images/icon_missing.png'));
				caps.push(s.getCaptionForLang('menuTabTitle',s.builderLanguage,mt.id,mt.captions,'-'));
			}
			return {
				indx:indx,
				imgs:imgs,
				caps:caps
			};
		}
	},
	methods:{
		// externals
		getCaptionForLang,
		srcBase64Icon
	}
};