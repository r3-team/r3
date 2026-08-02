import { isAttributeRelationship, isAttributeRelationship11 } from '../shared/attribute.js';
import { getDependentAttributes, getDependentModules } from '../shared/builder.js';

const MyAdminDbSyncJobJoinsNested = {
	name: 'my-admin-db-sync-job-joins-nested',
	template: `<div class="nested-join" :class="{ nested:index !== 0 }">

		<!-- descriptive summary line with relation options -->
		<div class="summary">
			<img class="relationship" :src="'images/'+iconRelationship" :title="iconRelationshipTitle" />

			<span>{{ index }}</span>
			<span>{{ joinRelation.name }}</span>
			<span v-if="!isBaseRelation" :title="joinReferenceFull">({{ joinReference }})</span>

			<!-- relation options -->
			<div class="options" v-if="!readonly">
				<img v-if="index !== 0" class="option clickable" :src="iconJoin" :title="iconJoinTitle" @click="toggleConnector" />

				<my-button image="databaseAdd.png"
					@trigger="relationAddShow = !relationAddShow"
					:active="!readonly && !relationBaseOnly"
					:captionTitle="capApp.joinAddHint"
					:naked="true"
				/>
				<img class="option clickable toggle" src="images/recordCreate.png"
					@click="toggleApply('create')"
					:class="{ off:!applyCreate }"
					:title="capApp.joinApplyCreateHint"
				/>
				<img class="option clickable toggle" src="images/recordUpdate.png"
					@click="toggleApply('update')"
					:class="{ off:!applyUpdate }"
					:title="capApp.joinApplyUpdateHint"
				/>
				<img class="option clickable toggle" src="images/recordDelete.png"
					@click="toggleApply('delete')"
					:class="{ off:!applyDelete }"
					:title="capApp.joinApplyDeleteHint"
				/>

				<!-- delete only if last relation in chain -->
				<my-button image="cancel.png"
					@trigger="$emit('relationRemove',index)"
					:active="!readonly && joins.length === 0 && (!isBaseRelation || !relationBaseFixed)"
					:naked="true"
				/>
			</div>
		</div>

		<!-- candidates for joined relations -->
		<select class="default"
			v-if="relationAddShow"
			@change="relationAdd"
			v-model="relationAddId"
		>
			<option :value="null">{{ capApp.select }}</option>
			<option v-for="atr in attributesUnused" :value="atr.id">
				{{ displayJoinOption(atr) }}
			</option>
		</select>

		<!-- child joins -->
		<div class="children">
			<my-admin-db-sync-job-joins-nested
				v-for="j in joins"
				@relationAdd="(...args) => $emit('relationAdd',...args)"
				@relationRemove="(...args) => $emit('relationRemove',...args)"
				@relationApplyToggle="(...args) => $emit('relationApplyToggle',...args)"
				@relationConnectorSet="(...args) => $emit('relationConnectorSet',...args)"
				:applyCreate="j.applyCreate"
				:applyUpdate="j.applyUpdate"
				:applyDelete="j.applyDelete"
				:connector="j.connector"
				:key="j.index"
				:index="j.index"
				:joins="j.joins"
				:joinAttributeId="j.joinAttributeId"
				:joinRelationId="j.joinRelationId"
				:module
				:readonly
				:relationBaseFixed
				:relationBaseOnly
				:relationIdParent="joinRelationId"
			/>
		</div>
	</div>`,
	data() {
		return {
			relationAddId: null,
			relationAddShow: false
		};
	},
	props: {
		applyCreate: { type: Boolean, required: true },
		applyUpdate: { type: Boolean, required: true },
		applyDelete: { type: Boolean, required: true },
		connector: { type: String, required: true },
		index: { type: Number, required: true },
		joins: { type: Array, required: true },
		joinAttributeId: { required: true },
		joinRelationId: { type: String, required: true },
		module: { type: Object, required: true },
		relationBaseFixed: { type: Boolean, required: true },
		relationBaseOnly: { type: Boolean, required: true },
		readonly: { type: Boolean, required: true },
		relationIdParent: { type: String, required: false, default: null }
	},
	emits: ['relationAdd', 'relationApplyToggle', 'relationConnectorSet', 'relationRemove'],
	computed: {
		attributesUnused: s => {
			const atrs = [];
			for (const atr of s.getDependentAttributes(s.module)) {
				if (!s.isAttributeRelationship(atr.content))
					continue;

				// relationship attribute is from current relation or pointing to it
				if (atr.relationId === s.joinRelationId || atr.relationshipId === s.joinRelationId)
					atrs.push(atr);
			}
			return atrs;
		},

		// simple
		hasNoJoinOptions: s => s.attributesUnused.length === 0,
		iconJoin: s => {
			switch (s.connector) {
				case 'INNER': return 'images/joinInner.png';
				case 'LEFT': return 'images/joinLeft.png';
				case 'RIGHT': return 'images/joinRight.png';
				case 'FULL': return 'images/joinOuter.png';
			}
			return 'images/clear.png';
		},
		iconJoinTitle: s => s.capApp.join.replace('{NAME}', s.connector),
		iconRelationship: s => {
			if (s.isBaseRelation) return 'link0.png';
			if (s.isRelation11) return 'link1.png';
			if (s.isRelation1N) return 'link2.png';
			if (s.isRelationN1) return 'link3.png';
			return 'noPic.png';
		},
		iconRelationshipTitle: s => {
			if (s.isBaseRelation) return '';
			if (s.isRelation11) return '1:1';
			if (s.isRelation1N) return '1:n';
			if (s.isRelationN1) return 'n:1';
			return '';
		},
		isBaseRelation: s => s.index === 0,
		isOutsideIn: s => !s.isBaseRelation && (s.joinRelationId !== s.joinAttribute.relationId || s.joinRelationId === s.relationIdParent),
		isRelation11: s => !s.isBaseRelation && s.isAttributeRelationship11(s.joinAttribute.content),
		isRelationN1: s => !s.isBaseRelation && !s.isRelation11 && s.isOutsideIn,
		isRelation1N: s => !s.isBaseRelation && !s.isRelation11 && !s.isOutsideIn,
		joinAttribute: s => !s.isBaseRelation ? s.attributeIdMap[s.joinAttributeId] : false,
		joinReference: s => !s.isOutsideIn ? s.joinAttribute.name : s.joinReferenceFull,
		joinReferenceFull: s => `${s.relationIdMap[s.joinAttribute.relationId].name}.${s.joinAttribute.name}`,
		joinRelation: s => s.relationIdMap[s.joinRelationId],

		// stores
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		capApp: s => s.$store.getters.captions.builder.query
	},
	methods: {
		// externals
		getDependentAttributes,
		isAttributeRelationship,
		isAttributeRelationship11,

		// actions
		relationAdd() {
			this.$emit('relationAdd', this.index, this.joinRelationId, this.relationAddId, 'LEFT');
			this.relationAddId = null;
			this.relationAddShow = false;
		},
		toggleApply(content) {
			this.$emit('relationApplyToggle', this.index, content);
		},
		toggleConnector() {
			switch (this.connector) {
				case 'INNER': this.$emit('relationConnectorSet', this.index, 'LEFT'); break;
				case 'LEFT': this.$emit('relationConnectorSet', this.index, 'RIGHT'); break;
				case 'RIGHT': this.$emit('relationConnectorSet', this.index, 'FULL'); break;
				case 'FULL': this.$emit('relationConnectorSet', this.index, 'INNER'); break;
			}
		},

		// presentation
		displayJoinOption(atr) {
			const outsideIn = atr.relationId !== this.joinRelationId;
			const relIdPartner = !outsideIn ? atr.relationshipId : atr.relationId;
			const atrRel = this.relationIdMap[atr.relationId];
			let relType = outsideIn ? '1:n' : 'n:1';

			if (this.isAttributeRelationship11(atr.content))
				relType = '1:1';

			return `[${relType}] ${this.relationIdMap[relIdPartner].name} (${atrRel.name}.${atr.name})`;
		}
	}
};

export default {
	name: 'my-admin-db-sync-job-joins',
	components: { MyAdminDbSyncJobJoinsNested },
	template: `<div class="admin-db-sync-job-joins default-inputs">
		<!-- start relation -->
		<div class="row gap centered" v-if="modelValue.length === 0 && !readonly">
			<my-label image="database.png" />
			<select @input="relationSet($event.target.value)" value="">
				<option value="">- [{{ capGen.relation }}] -</option>
				<option v-for="r in module.relations" :value="r.id">{{ r.name }}</option>
				<optgroup
					v-for="mod in getDependentModules(module).filter(v => v.id !== module.id)"
					:label="mod.name"
				>
					<option v-for="r in mod.relations" :value="r.id">{{ r.name }}</option>
				</optgroup>
			</select>
		</div>

		<my-admin-db-sync-job-joins-nested
			v-if="relationsNested !== false"
			@relationAdd="relationAdd"
			@relationRemove="relationRemove"
			@relationConnectorSet="relationConnectorSet"
			@relationApplyToggle="relationApplyToggle"
			:applyCreate="relationsNested.applyCreate"
			:applyUpdate="relationsNested.applyUpdate"
			:applyDelete="relationsNested.applyDelete"
			:connector="relationsNested.connector"
			:index="relationsNested.index"
			:joins="relationsNested.joins"
			:joinAttributeId="relationsNested.joinAttributeId"
			:joinRelationId="relationsNested.joinRelationId"
			:key="relationsNested.index"
			:module
			:relationBaseFixed
			:relationBaseOnly
			:readonly
		/>
	</div>`,
	props: {
		module: { type: Object, required: true },
		modelValue: { type: Array, required: true },
		relationBaseFixed: { type: Boolean, required: true },
		relationBaseOnly: { type: Boolean, required: true },
		readonly: { type: Boolean, required: true },
	},
	emits: ['indexRemoved', 'update:modelValue'],
	computed: {
		relationNextIndex: s => {
			let indexCandidate = 0;
			for (const join of s.modelValue) {
				if (join.index >= indexCandidate)
					indexCandidate = join.index + 1;
			}
			return indexCandidate;
		},
		relationsNested: s => {
			const getChildRelationsByIndex = (indexFrom) => {
				const rels = [];
				for (const j of s.modelValue) {
					if (j.indexFrom !== indexFrom)
						continue;

					const join = JSON.parse(JSON.stringify(j));
					rels.push({
						applyCreate: join.applyCreate,
						applyUpdate: join.applyUpdate,
						applyDelete: join.applyDelete,
						connector: join.connector,
						index: join.index,
						joins: getChildRelationsByIndex(join.index),
						joinAttributeId: join.attributeId,
						joinRelationId: join.relationId
					});
				}
				return rels;
			};

			if (!s.module || !s.relation || s.modelValue.length === 0)
				return false;

			// source relation with all relations deep-nested
			return {
				applyCreate: s.modelValue[0].applyCreate,
				applyUpdate: s.modelValue[0].applyUpdate,
				applyDelete: s.modelValue[0].applyDelete,
				connector: 'INNER',
				index: 0,
				joins: getChildRelationsByIndex(0),
				joinAttributeId: null,
				joinRelationId: s.relation.id,
				name: s.relation.name
			};
		},

		// stores
		relation: s => s.modelValue.length !== 0 ? s.relationIdMap[s.modelValue[0].relationId] : false,
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		capApp: s => s.$store.getters.captions.builder.query,
		capGen: s => s.$store.getters.captions.generic
	},
	methods: {
		// externals
		getDependentModules,

		// actions
		relationSet(v) {
			v = v === '' ? null : v;

			// if source relation set, but not added as join yet: add
			if (v !== null && this.modelValue.length === 0)
				this.relationAdd(-1, v, null, 'INNER');
		},
		relationAdd(indexFrom, relationIdFrom, attributeId, connector) {
			const isSource = indexFrom === -1;
			let relId = '';
			if (!isSource) {
				const atr = this.attributeIdMap[attributeId];
				relId = relationIdFrom !== atr.relationId ? atr.relationId : atr.relationshipId;
			} else {
				relId = relationIdFrom;
			}
			const v = JSON.parse(JSON.stringify(this.modelValue));
			v.push({
				applyCreate: isSource,
				applyUpdate: isSource,
				applyDelete: isSource,
				connector: connector,
				relationId: relId,
				attributeId: attributeId,
				index: this.relationNextIndex,
				indexFrom: indexFrom
			});
			this.$emit('update:modelValue', v);
		},
		relationRemove(index) {
			this.$emit('indexRemoved', index);
		},
		relationApplyToggle(index, content) {
			const joins = JSON.parse(JSON.stringify(this.modelValue));
			for (const j of joins) {
				if (j.index === index) {
					switch (content) {
						case 'create': j.applyCreate = !j.applyCreate; break;
						case 'update': j.applyUpdate = !j.applyUpdate; break;
						case 'delete': j.applyDelete = !j.applyDelete; break;
					}
					this.$emit('update:modelValue', joins);
					break;
				}
			}
		},
		relationConnectorSet(index, connector) {
			const joins = JSON.parse(JSON.stringify(this.modelValue));
			for (const j of joins) {
				if (j.index === index) {
					j.connector = connector;
					this.$emit('update:modelValue', joins);
					break;
				}
			}
		}
	}
};
