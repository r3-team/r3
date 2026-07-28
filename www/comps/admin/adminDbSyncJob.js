import { deepIsEqual } from '../shared/generic.js';
import { getCaption } from '../shared/language.js';
import MyCodeEditor from '../codeEditor.js';
import MyInputDecimal from '../inputDecimal.js';
import {
	dialogCloseAsk,
	dialogDeleteAsk
} from '../shared/dialog.js';

export default {
	name:'my-admin-db-sync-job',
	components:{ MyCodeEditor, MyInputDecimal },
	template:`<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-db-sync-job scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/cogMultiple.png" />
					<h1 class="title">{{ isNew ? capApp.titleJobNew : capApp.titleJob.replace('{NAME}',job.name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="closeAsk"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						v-if="!isNew"
						@trigger="reset"
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="$emit('makeNew')"
						:active="!readonly"
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>

			<div class="content flex column gap grow">
				<div class="row gap-large wrap centered default-inputs">
					<div class="row gap centered">
						<span>{{ capGen.name }}</span>
						<input v-model="job.name" :disabled="readonly" :placeholder="capGen.threeDots" />
					</div>
					<div class="row gap centered">
						<span>{{ capGen.mode }}</span>
						<select class="auto" v-model="job.jobType" :disabled="readonly || !isNew">
							<option v-for="t in jobTypes" :value="t">{{ capApp.jobType[t] }}</option>
						</select>
					</div>
					<template v-if="isLoad">
						<my-button-check
							v-model="job.deleteMissing"
							:caption="capGen.button.deleteMissing"
							:readonly
						/>
						<my-button-check
							@update:modelValue="$event ? job.pageLimit = 50 : job.pageLimit = null"
							:caption="capGen.limitPage"
							:modelValue="job.pageLimit !== null"
							:readonly
						/>
						<my-input-decimal class="short"
							v-if="job.pageLimit !== null"
							v-model="job.pageLimit"
							:min="0"
							:allowNull="false"
							:lengthFract="0"
							:readonly
						/>
					</template>
					<my-button-check
						v-model="job.active"
						:caption="capGen.active"
						:readonly
					/>
				</div>

				<div class="admin-db-sync-job-content">
					<div class="admin-db-sync-job-content-editor">
						<my-label image="codeDatabase.png" :caption="capApp.loadSource" :large="true" />
						<div class="admin-db-sync-job-content-editor-input">
							<my-code-editor
								v-model="job.codeSql"
								:mode="editorMode"
								:readonly
							/>
						</div>
						<span>{{ capApp.loadSourceHint.replace('{HOST}',hostName) }}</span>
					</div>
					<div class="admin-db-sync-job-content-arrow">
						<my-label image="triangleRight.png" :large="true" />
					</div>
					<div class="admin-db-sync-job-content-options column gap-large default-inputs">
						<div class="column gap">
							<my-label image="database.png" :caption="capApp.loadTargetRelation" :large="true" />
							<select
								@input="$event.target.value === '' ? job.relationId = null : job.relationId = $event.target.value"
								:disabled="readonly || !isNew"
								:value="job.relationId === null ? '' : job.relationId"
							>
								<option value="">-</option>
								<optgroup
									v-for="m in modules.filter(v => v.relations.length !== 0)"
									:label="getCaption('moduleTitle',m.id,m.id,m.captions,m.name)"
								>
									<option v-for="r in m.relations" :value="r.id">
										{{ getCaption('relationTitle',m.id,r.id,r.captions,r.name) }}
									</option>
								</optgroup>
							</select>
						</div>
						<template v-if="relation">
							<hr />
							<div class="column gap">
								<div class="row gap centered space-between">
									<my-label image="files_list2.png" :caption="capApp.loadTargetAttributes" />
									<my-button image="add.png"
										@trigger="addAttribute"
										:active="!readonly"
										:caption="capGen.button.add"
									/>
								</div>
								<div class="row gap centered" v-for="(a,i) in job.attributeIds">
									<span>#{{ i+1 }}</span>
									<select v-model="job.attributeIds[i]" :disabled="readonly">
										<option v-for="a in relation.attributes.filter(v => v.content !== 'files')" :value="a.id">
											{{ getCaption('attributeTitle',relation.moduleId,a.id,a.captions,a.name) }}
										</option>
									</select>
									<my-button image="cancel.png"
										@trigger="job.attributeIds.splice(i,1)"
										:naked="true"
									/>
								</div>
							</div>

							<template v-if="isPageLimit">
								<hr />
								<div class="column gap">
									<my-label image="code.png" :caption="capGen.placeholders" />
									<span v-for="(p,k) in placeholdersLoad">{{ k }} <b>{{ p }}</b></span>
								</div>
							</template>

							<template v-if="warnings.length !== 0">
								<hr />
								<my-label image="warning.png" :caption="capGen.warnings" :error="true" />
								<my-label v-for="w in warnings" :caption="w" />
							</template>
						</template>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		dbType:  { type: String,        required: true },
		hostName:{ type: String,        required: true },
		jobId:   { type: [String,null], required: true },
		jobOrg:  { type: Object,        required: true },
		readonly:{ type: Boolean,       required: true }
	},
	emits:['close','makeNew','reload'],
	watch:{
		jobId:{
			handler(v) { this.reset(); },
			immediate:true
		},
	},
	data() {
		return {
			isReady: false,
			job: {},
			jobTypes: ['LOAD','SEND_INSERT','SEND_UPDATE','SEND_DELETE'],
			placeholdersLoad: {
				'LIMIT': '{SQL_LIMIT}',
				'OFFSET': '{SQL_OFFSET}'
			}
		};
	},
	computed:{
		canSave: s => s.isReady && !s.readonly && s.isChanged
			&& s.job.name !== ''
			&& s.job.codeSql !== ''
			&& s.job.relationId !== null
			&& s.job.attributeIds.length !== 0,
		warnings: s => {
			let out = [];

			if (s.isLoad && !s.job.codeSql.includes('SELECT'))
				out.push(s.capApp.warning.missingSelect);

			if (s.isLoad && s.isPageLimit && (!s.job.codeSql.includes(s.placeholdersLoad['LIMIT']) || !s.job.codeSql.includes(s.placeholdersLoad['OFFSET'])))
				out.push(s.capApp.warning.missingLimit);

			return out;
		},

		// simple
		editorMode: s => s.dbType === 'mssql' ? 'sqlserver' : 'sql',
		isChanged:  s => !s.deepIsEqual(s.jobOrg, s.job),
		isLoad:     s => s.job.jobType === 'LOAD',
		isNew:      s => s.jobId === null,
		isPageLimit:s => s.isLoad && s.job.pageLimit !== null,
		relation:   s => s.job.relationId !== null ? s.relationIdMap[s.job.relationId] : false,

		// stores
		capApp:        s => s.$store.getters.captions.admin.dbSync,
		capGen:        s => s.$store.getters.captions.generic,
		modules:       s => s.$store.getters['schema/modules'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap']
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true });
		this.$store.commit('keyDownHandlerAdd', { fnc: this.closeAsk, key: 'Escape' });
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.closeAsk);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		deepIsEqual,
		dialogCloseAsk,
		dialogDeleteAsk,
		getCaption,

		// actions
		addAttribute() {
			if (this.relation !== false)
				this.job.attributeIds.push(this.relation.attributes[0].id);
		},
		closeAsk() {
			this.dialogCloseAsk(this.close,this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		reloadAndClose() {
			ws.send('dbSync', 'informChanged', {}, true).then(
				() => {
					this.$emit('reload');
					this.close();
				},
				this.$root.genericError
			);
		},
		reset() {
			this.job = JSON.parse(JSON.stringify(this.jobOrg));
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('dbSync','delJob',this.jobId,true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			ws.send('dbSync','setJob',this.job,true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
