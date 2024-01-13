import MyCaptionMap from '../captionMap.js';
export {MyAdminCaptionMap as default};

let MyAdminCaptionMap = {
	name:'my-admin-caption-map',
	components:{ MyCaptionMap },
	template:`<my-caption-map :isCustom="true" />`
};