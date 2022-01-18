import {getColumnTitle} from './shared/column.js';
import {
	getCollectionColumn,
	getCollectionOptions
} from './shared/collection.js';
export {MyInputCollection as default};

let MyInputCollection = {
	name:'my-input-collection',
	template:`<select @input="$emit('index-selected',$event.target.value)">
		
		<option :value="-1">
			- {{ getColumnTitle(getCollectionColumn(collectionId,columnIdDisplay)) }} -
		</option>
		
		<option v-for="(o,i) in getCollectionOptions(collectionId,columnIdDisplay)"
			:value="i"
		>{{ o }}</option>
	</select>`,
	props:{
		collectionId:   { type:String, required:true }, 
		columnIdDisplay:{ type:String, required:true }
	},
	emits:['index-selected'],
	methods:{
		// externals
		getCollectionColumn,
		getCollectionOptions,
		getColumnTitle
	}
};