import {deepIsEqual}     from '../shared/generic.js';
import {getTemplateRepo} from '../shared/templates.js';

export default {
	name:'my-admin-repo',
	components:{},
	template:`<div v-if="repo !== false" class="app-sub-window under-header at-top with-margin" @mousedown.self="$emit('close')">
		Hello world
	</div>`,
	props:{
		id:       { type:String, required:true },
		repoIdMap:{ type:Object, required:true }
	},
	emits:['close','create'],
	data() {
		return {
			repo:false // repo being edited
		};
	},
	computed:{
		isChanged:s => s.deepIsEqual(s.repo,s.repoOrg),
		isNew:    s => s.repoIdMap[s.id] === undefined,
		repoOrg:  s => s.isNew ? s.getTemplateRepo() : s.repoIdMap[s.id]
	},
	mounted() {
		this.repo = JSON.parse(JSON.stringify(this.repoOrg));
	},
	methods:{
		// externals
		deepIsEqual,
		getTemplateRepo
	}
};