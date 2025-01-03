import MyTabs                          from '../tabs.js';
import srcBase64Icon                   from '../shared/image.js';
import {getCaptionForLang}             from '../shared/language.js';
export {MyBuilderMenuTabSelect as default};

let MyBuilderMenuTabSelect = {
	name:'my-builder-menu-tab-select',
	components:{MyTabs},
	template:`<my-tabs
		@update:modelValue="$emit('update:modelValue',$event)"
		:entries="tabs.ids"
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
			let ids  = [];
			let imgs = [];
			let caps = [];
		
			for(const mt of s.menuTabs) {
				ids.push(mt.id);
				imgs.push(s.srcBase64Icon(mt.iconId,'images/icon_missing.png'));
				caps.push(s.getCaptionForLang('menuTabTitle',s.builderLanguage,mt.id,mt.captions,'-'));
			}
			return {
				ids:ids,
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