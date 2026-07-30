import MyCodeEditor from '../codeEditor.js';
import MyInputDecimal from '../inputDecimal.js';
import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';
import srcBase64Icon from '../shared/image.js';
import { getCaption } from '../shared/language.js';
import { getPgIndexTitle } from '../shared/schema.js';
import MyAdminDbSyncJobJoins from './adminDbSyncJobJoins.js';
import MyAdminDbSyncJobLookups from './adminDbSyncJobLookups.js';

export default {
	name: 'my-admin-db-sync-job',
	components: { MyAdminDbSyncJobJoins, MyAdminDbSyncJobLookups, MyCodeEditor, MyInputDecimal },
	template: `<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

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
						<div class="row gap centered">
							<my-label image="clock.png" />
							<span>{{ capGen.every }}</span>
							<my-input-decimal class="short"
								@update:modelValue="intervalValueSet($event)"
								:lengthFract="0"
								:min="1"
								:modelValue="intervalValue"
								:readonly
							/>
							<select class="auto" @input="intervalTypeSet($event.target.value)" :value="intervalType">
								<option value="seconds">{{ capGen.interval.seconds }}</option>
								<option value="minutes">{{ capGen.interval.minutes }}</option>
								<option value="hours"  >{{ capGen.interval.hours   }}</option>
								<option value="days"   >{{ capGen.interval.days    }}</option>
								<option value="weeks"  >{{ capGen.interval.weeks   }}</option>
							</select>
						</div>
						<div class="row gap centered">
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
						</div>
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
						<img src="images/arrowsPushRight.png" />
					</div>
					<div class="admin-db-sync-job-content-options column gap-large default-inputs">
						<div class="column gap">
							<my-label image="edit.png" :caption="capApp.loadTargetRelation" :large="true" />
							<div class="row gap centered">
								<my-label
									:image="module ? '' : 'icon_missing.png'"
									:imageBase64="module ? srcBase64Icon(module.iconId,'images/module.png') : ''"
								/>
								<select
									@input="changeModuleId($event.target.value)"
									:disabled="readonly || !isNew"
									:value="moduleIdActive !== null ? moduleIdActive : ''"
								>
									<option value=""> - {{ capGen.application }} - </option>
									<option v-for="m in modulesUsable" :value="m.id">
										{{ getCaption('moduleTitle',m.id,m.id,m.captions,m.name) }}
									</option>
								</select>
							</div>

							<my-admin-db-sync-job-joins
								v-if="module !== false"
								v-model="job.joins"
								@indexRemoved="indexRemoved"
								:module
								:protectRelationBase="!isNew"
								:readonly
							/>
						</div>
						<template v-if="job.joins.length !== 0">
							<div class="column gap">
								<hr />
								<my-label image="databaseAsterisk.png" :caption="capApp.loadUniqueIndex" />
								<my-admin-db-sync-job-lookups
									v-if="job.joins.length !== 0"
									v-model="job.lookups"
									:joins="job.joins"
									:readonly
								/>
								<my-button-check
									v-model="job.deleteMissing"
									:active="isLookupOnBaseRelation"
									:caption="capApp.deleteMissing"
									:readonly
								/>
							</div>
							<div class="column gap">
								<hr />
								<div class="row gap centered space-between">
									<my-label image="files_list2.png" :caption="capApp.loadTargetAttributes" />
									<my-button image="add.png"
										@trigger="columnAdd"
										:active="!readonly"
										:caption="capGen.button.add"
									/>
								</div>
								<div class="admin-db-sync-job-content-options-columns" v-if="job.columns.length !== 0">
									<div class="row gap centered" v-for="(c,i) in job.columns">
										<span>#{{ i+1 }}</span>
										<select @input="columnSetValue($event.target.value,i)" :disabled="readonly" :value="columnGetValue(c)">
											<template v-for="j in job.joins">
												<option
													v-for="a in relationIdMap[j.relationId].attributes.filter(v => v.content !== 'files')"
													:value="j.index + '_' + a.id"
												>
													{{ j.index }}) {{ getCaption('attributeTitle',relationIdMap[j.relationId].moduleId,a.id,a.captions,a.name) }}
												</option>
											</template>
										</select>
										<my-button image="cancel.png"
											@trigger="job.columns.splice(i,1)"
											:naked="true"
										/>
									</div>
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
								<my-label image="warning.png" :caption="capGen.warnings" :error="true" :large="true" />
								<my-label image="warning.png" v-for="w in warnings" :caption="w" />
							</template>
						</template>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		dbType: { type: String, required: true },
		hostName: { type: String, required: true },
		jobId: { type: [String, null], required: true },
		jobOrg: { type: Object, required: true },
		readonly: { type: Boolean, required: true },
	},
	emits: ['close', 'makeNew', 'reload'],
	watch: {
		jobId() { this.reset(); },
	},
	data() {
		return {
			intervalType: 'seconds',
			intervalValue: 0,
			isReady: false,
			job: {},
			jobTypes: ['LOAD', 'SEND_INSERT', 'SEND_UPDATE', 'SEND_DELETE'],
			moduleIdActive: null,
			placeholdersLoad: {
				LIMIT: '{SQL_LIMIT}',
				OFFSET: '{SQL_OFFSET}',
			},
		};
	},
	computed: {
		canSave: s => s.isReady && !s.readonly && s.isChanged &&
			s.job.name !== '' &&
			s.job.codeSql !== '' &&
			s.job.columns.length !== 0 &&
			s.job.joins.length !== 0,
		warnings: s => {
			const out = [];
			if (s.isLoad) {
				if (!s.job.codeSql.includes('SELECT'))
					out.push(s.capApp.warning.missingSelect);

				if (s.isPageLimit) {
					if (!s.job.codeSql.includes(s.placeholdersLoad.LIMIT) || !s.job.codeSql.includes(s.placeholdersLoad.OFFSET))
						out.push(s.capApp.warning.missingLimit);

					if (!s.job.codeSql.includes('ORDER BY'))
						out.push(s.capApp.warning.missingOrder);
				}
				if (s.isWithLookups) {
					for (const l of s.job.lookups) {
						for (const a of s.indexIdMap[l.pgIndexId].attributes) {
							if (!s.job.columns.some(v => v.attributeId === a.attributeId)) {
								out.push(s.capApp.warning.missingIndexAttribute);
								break;
							}
						}
					}
				}
			}
			return out;
		},

		// simple
		editorMode: s => (s.dbType === 'mssql' ? 'sqlserver' : 'sql'),
		isLookupOnBaseRelation: s => s.job.lookups.some(v => v.index === 0),
		isChanged: s => !s.deepIsEqual(s.jobOrg, s.job),
		isLoad: s => s.job.jobType === 'LOAD',
		isNew: s => s.jobId === null,
		isPageLimit: s => s.isLoad && s.job.pageLimit !== null,
		isWithLookups: s => s.job.lookups.length !== 0,
		module: s => s.moduleIdActive !== null ? s.moduleIdMap[s.moduleIdActive] : false,
		modulesUsable: s => s.modules.filter((v) => v.relations.length !== 0),

		// stores
		capApp: s => s.$store.getters.captions.admin.dbSync,
		capGen: s => s.$store.getters.captions.generic,
		modules: s => s.$store.getters['schema/modules'],
		indexIdMap: s => s.$store.getters['schema/indexIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true, });
		this.$store.commit('keyDownHandlerAdd', { fnc: this.closeAsk, key: 'Escape', });

		this.reset();
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel', this.set);
		this.$store.commit('keyDownHandlerDel', this.closeAsk);
		this.$store.commit('keyDownHandlerWake');
	},
	methods: {
		// external
		deepIsEqual,
		dialogCloseAsk,
		dialogDeleteAsk,
		getCaption,
		getPgIndexTitle,
		srcBase64Icon,

		// actions
		columnAdd() {
			if (this.job.joins.length === 0)
				return;

			const r = this.relationIdMap[this.job.joins[0].relationId];
			this.job.columns.push({ attributeId: r.attributes[0], index: 0 });
		},
		columnGetValue(c) {
			return `${c.index}_${c.attributeId}`;
		},
		columnSetValue(v, i) {
			const p = v.split('_');
			this.job.columns[i] = {
				attributeId: p[1],
				index: parseInt(p[0], 10),
			};
		},
		changeModuleId(input) {
			this.moduleIdActive = input === '' ? null : input;
			this.job.columns = [];
			this.job.joins = [];
			this.job.lookups = [];
		},
		closeAsk() {
			this.dialogCloseAsk(this.close, this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		indexRemoved(index) {
			this.job.columns = this.job.columns.filter(v => v.index !== index);
			this.job.joins = this.job.joins.filter(v => v.index !== index);
			this.job.lookups = this.job.lookups.filter(v => v.index !== index);
		},
		intervalTypeSet(v) {
			this.intervalType = v;
			this.intervalValueSet(this.intervalValue);
		},
		intervalValueSet(v) {
			if (Number.isNaN(v))
				return;

			v = parseInt(v, 10);
			this.intervalValue = v;

			if (this.intervalType === 'weeks') this.job.intervalSeconds = v * 604800;
			else if (this.intervalType === 'days') this.job.intervalSeconds = v * 86400;
			else if (this.intervalType === 'hours') this.job.intervalSeconds = v * 3600;
			else if (this.intervalType === 'minutes') this.job.intervalSeconds = v * 60;
			else this.job.intervalSeconds = v;
		},
		reloadAndClose() {
			ws.send('dbSync', 'informChanged', {}, true).then(() => {
				this.$emit('reload');
				this.close();
			}, this.$root.genericError);
		},
		reset() {
			this.job = JSON.parse(JSON.stringify(this.jobOrg));

			if (this.job.joins.length !== 0)
				this.moduleIdActive = this.relationIdMap[this.job.joins[0].relationId].moduleId;

			// apply interval
			if (this.job.intervalSeconds % 604800 === 0) {
				this.intervalType = 'weeks';
				this.intervalValue = this.job.intervalSeconds / 604800;
			} else if (this.job.intervalSeconds % 86400 === 0) {
				this.intervalType = 'days';
				this.intervalValue = this.job.intervalSeconds / 86400;
			} else if (this.job.intervalSeconds % 3600 === 0) {
				this.intervalType = 'hours';
				this.intervalValue = this.job.intervalSeconds / 3600;
			} else if (this.job.intervalSeconds % 60 === 0) {
				this.intervalType = 'minutes';
				this.intervalValue = this.job.intervalSeconds / 60;
			} else {
				this.intervalType = 'seconds';
				this.intervalValue = this.job.intervalSeconds;
			}
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('dbSync', 'delJob', this.jobId, true).then(
				this.reloadAndClose,
				this.$root.genericError,
			);
		},
		set() {
			ws.send('dbSync', 'setJob', this.job, true).then(
				this.reloadAndClose,
				this.$root.genericError,
			);
		},
	},
};
