import { srcBase64 } from '../shared/image.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name: 'my-builder-relations',
	template:`<div class="contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/database.png" />
				<h1 class="title">{{ capGen.relations }}: {{ capGen.overview}}</h1>
			</div>
			<div class="area nowrap">
				<my-button-check v-model="useOverview" :caption="capApp.useOverview" />
			</div>
		</div>
		<div class="content default-inputs" v-if="module">
			<div class="builder-startscreen">

				<div class="row wrap gap-large">
					<router-link class="builder-startscreen-box clickable" tag="div"
						:to="'/builder/relations/'+id+'/show/all'"
					>
						<my-label :caption="capGen.button.showAll + ' (' + module.relations.length + ')'" />
						<img class="preview" src="images/checkbox1.png" />
					</router-link>

					<div class="builder-startscreen-box clickable"
						@click="$emit('createNew','relation')"
						:class="{ clickable:!readonly }"
					>
						<my-label :caption="capAppNew.relation" />
						<img class="preview" src="images/add.png" />
					</div>
				</div>

				<!-- tags -->
				<div class="column gap-large">
					<my-label image="tag.png" :caption="capGen.tags" :large="true" />
					<h2 v-if="tagsOrdered.length === 0"><i>- {{ capGen.nothingThere }} -</i></h2>
					<div class="row wrap gap-large" v-if="tagsOrdered.length !== 0">
						<router-link class="builder-startscreen-box clickable" tag="div"
							v-for="t in tagsOrdered"
							:to="'/builder/relations/'+id+'/show/t-'+t.id"
						>
							<my-label :caption="t.name + ' (' + tagIdMapCount[t.id] + ')'" />
							<img class="preview"
								:src="t.iconId !== null ? srcBase64(iconIdMap[t.iconId].file) : 'images/icon_missing.png'"
							/>
						</router-link>
					</div>
				</div>

				<!-- special -->
				<div class="column gap-large">
					<my-label image="filter.png" :caption="capGen.filters" :large="true" />
					<div class="row wrap gap-large">
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/show/changelog1'">
							<my-label :caption="capGen.changeLogs + ' (' + module.relations.filter(v => v.retentionCount !== null || v.retentionDays !== null).length + ')'" />
							<img class="preview" src="images/time.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/show/policies1'">
							<my-label :caption="capGen.policies + ' (' + module.relations.filter(v => v.policies.length !== 0).length + ')'" />
							<img class="preview" src="images/personTemplate.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/show/triggers1'">
							<my-label :caption="capGen.triggers + ' (' + module.relations.filter(v => module.pgTriggers.some(t => t.relationId === v.id)).length + ')'" />
							<img class="preview" src="images/databasePlay.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/show/encryption1'">
							<my-label :caption="capGen.encryption + ' (' + module.relations.filter(v => v.encryption).length + ')'" />
							<img class="preview" src="images/lock.png" />
						</router-link>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		directOpen:{ type:[String,null], required:false, default:null }, // overview is opened directly, skips forward if overview is not used by default
		id:        { type:String,        required:true },
		readonly:  { type:Boolean,       required:true }
	},
	computed: {
		tagIdMapCount: s => {
			let out = {};
			for (const t of s.module.tags) {
				const len = s.module.relations.filter(v => v.tagIds.includes(t.id)).length;
				if (len !== 0)
					out[t.id] = len;
			}
			return out;
		},
		tagsOrdered: s => {
			let out = [];
			for (const t of s.module.tags) {
				if (s.tagIdMapCount[t.id] !== undefined)
					out.push(t);
			}
			return out.toSorted((a,b) => s.tagIdMapCount[b.id] - s.tagIdMapCount[a.id]);
		},

		// inputs
		useOverview: {
			get()  { return this.builderOptionGet('relationsOverviewUse', true); },
			set(v) { this.builderOptionSet('relationsOverviewUse', v); }
		},

		// simple
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		capApp:     s => s.$store.getters.captions.builder.relation,
		capAppNew:  s => s.$store.getters.captions.builder.new,
		capGen:     s => s.$store.getters.captions.generic,
		iconIdMap:  s => s.$store.getters['schema/iconIdMap'],
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap']
	},
	mounted() {
		if (this.directOpen === null && !this.useOverview)
			this.$router.replace(`/builder/relations/${this.id}/show/all`);
	},
	methods: {
		// externals
		builderOptionGet,
		builderOptionSet,
		srcBase64
	}
};
