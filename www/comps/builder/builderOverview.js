import { srcBase64 } from '../shared/image.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name: 'my-builder-overview',
	template:`<div class="contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" :src="'images/'+entityIcon" />
				<h1 class="title">{{ capGen.overview }}: {{ entityTitle }}</h1>
			</div>
			<div class="area nowrap">
				<my-button-check v-model="useOverview" :caption="capGen.useOverview" />
			</div>
		</div>
		<div class="content default-inputs" v-if="module">
			<div class="builder-startscreen">

				<div class="row wrap gap-large">
					<router-link class="builder-startscreen-box clickable" tag="div"
						:to="'/builder/'+entity+'/'+id+'/all'"
					>
						<my-label :caption="capGen.button.showAll + ' (' + entityList.length + ')'" />
						<img class="preview" :src="'images/'+entityIcon" />
					</router-link>

					<div class="builder-startscreen-box clickable"
						@click="$emit('createNew',entityNew)"
						:class="{ clickable:!readonly }"
					>
						<my-label :caption="capGen.button.new" />
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
							:to="'/builder/'+entity+'/'+id+'/t-'+t.id"
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

					<!-- forms -->
					<div class="row wrap gap-large" v-if="isForms">
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/forms/'+id+'/data1'">
							<my-label :caption="capGen.recordLoad + ' (' + module.forms.filter(v => v.query !== null).length + ')'" />
							<img class="preview" src="images/databaseCircle.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/forms/'+id+'/list1'">
							<my-label :caption="capGen.listFullpage + ' (' + module.forms.filter(v => v.fields.length === 1 && v.fields[0].content === 'list').length + ')'" />
							<img class="preview" src="images/files_list2.png" />
						</router-link>
					</div>

					<!-- PG functions -->
					<div class="row wrap gap-large" v-if="isPgFunctions">
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/pg-functions/'+id+'/frontend1'">
							<my-label :caption="capAppFnc.isFrontendExec + ' (' + module.pgFunctions.filter(v => v.isFrontendExec).length + ')'" />
							<img class="preview" src="images/screen.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/pg-functions/'+id+'/column1'">
							<my-label :caption="capAppFnc.isColumnExec + ' (' + module.pgFunctions.filter(v => v.isColumnExec).length + ')'" />
							<img class="preview" src="images/files_list2.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/pg-functions/'+id+'/loginsync1'">
							<my-label :caption="capAppFnc.isLoginSync + ' (' + module.pgFunctions.filter(v => v.isLoginSync).length + ')'" />
							<img class="preview" src="images/personArrow.png" />
						</router-link>
					</div>

					<!-- relations -->
					<div class="row wrap gap-large" v-if="isRelations">
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/retention1'">
							<my-label :caption="capGen.changeLogs + ' (' + module.relations.filter(v => v.retentionCount !== null || v.retentionDays !== null).length + ')'" />
							<img class="preview" src="images/time.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/recordtitle1'">
							<my-label :caption="capGen.recordTitle + ' (' + module.relations.filter(v => v.attributeIdsTitle.length !== 0).length + ')'" />
							<img class="preview" src="images/databaseText.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/presets1'">
							<my-label :caption="capGen.presets + ' (' + module.relations.filter(v => v.presets.length !== 0).length + ')'" />
							<img class="preview" src="images/databaseCircle.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/triggers1'">
							<my-label :caption="capGen.triggers + ' (' + module.relations.filter(v => module.pgTriggers.some(t => t.relationId === v.id)).length + ')'" />
							<img class="preview" src="images/databasePlay.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/policies1'">
							<my-label :caption="capGen.policies + ' (' + module.relations.filter(v => v.policies.length !== 0).length + ')'" />
							<img class="preview" src="images/personTemplate.png" />
						</router-link>
						<router-link class="builder-startscreen-box clickable" tag="div" :to="'/builder/relations/'+id+'/encryption1'">
							<my-label :caption="capGen.encryption + ' (' + module.relations.filter(v => v.encryption).length + ')'" />
							<img class="preview" src="images/lock.png" />
						</router-link>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		directOpen:{ type:String,  required:true }, // overview is opened directly, skips forward if overview is not used by default
		id:        { type:String,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	watch: {
		entity:{
			handler(v) {
				if (this.directOpen === '' && !this.useOverview)
					this.$router.replace(`/builder/${v}/${this.id}/all`);
			},
			immediate:true
		}
	},
	computed: {
		entityIcon: s => {
			switch (s.entity) {
				case 'docs': return 'document.png'; break;
				case 'forms': return 'fileText.png'; break;
				case 'js-functions': return 'codeScreen.png'; break;
				case 'pg-functions': return 'codeDatabase.png'; break;
				case 'relations': return 'database.png'; break;
			}
			return null;
		},
		entityList: s => {
			if (s.isDocs) return s.module.docs;
			if (s.isForms) return s.module.forms;
			if (s.isJsFunctions) return s.module.jsFunctions;
			if (s.isPgFunctions) return s.module.pgFunctions;
			if (s.isRelations) return s.module.relations;
			return [];
		},
		entityNew: s => {
			switch (s.entity) {
				case 'docs': return 'doc'; break;
				case 'forms': return 'form'; break;
				case 'js-functions': return 'jsFunction'; break;
				case 'pg-functions': return 'pgFunction'; break;
				case 'relations': return 'relation'; break;
			}
			return null;
		},
		entityTitle: s => {
			switch (s.entity) {
				case 'docs': return s.capGen.pdfs; break;
				case 'forms': return s.capGen.forms; break;
				case 'js-functions': return s.capGen.jsFunctions; break;
				case 'pg-functions': return s.capGen.pgFunctions; break;
				case 'relations': return s.capGen.relations; break;
			}
			return '';
		},
		tagIdMapCount: s => {
			let out = {};
			for (const t of s.module.tags) {
				const len = s.entityList.filter(v => v.tagIds.includes(t.id)).length;
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
			get()  { return this.builderOptionGet(this.entity + 'OverviewUse', true); },
			set(v) { this.builderOptionSet(this.entity + 'OverviewUse', v); }
		},

		// simple
		entity:       s => s.$route.meta.nav,
		isDocs:       s => s.entity === 'docs',
		isForms:      s => s.entity === 'forms',
		isJsFunctions:s => s.entity === 'js-functions',
		isPgFunctions:s => s.entity === 'pg-functions',
		isRelations:  s => s.entity === 'relations',
		module:       s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		capAppFnc:  s => s.$store.getters.captions.builder.function,
		capGen:     s => s.$store.getters.captions.generic,
		iconIdMap:  s => s.$store.getters['schema/iconIdMap'],
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap']
	},
	methods: {
		// externals
		builderOptionGet,
		builderOptionSet,
		srcBase64
	}
};
