import MyCaptionMap from '../captionMap.js';
export {MyAdminCaptionMap as default};

let MyAdminCaptionMap = {
	name:'my-admin-caption-map',
	components:{ MyCaptionMap },
	template:`<my-caption-map :isCustom="true" />`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
	}
};