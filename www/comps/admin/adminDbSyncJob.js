import { deepIsEqual } from '../shared/generic.js';
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
						<input v-model="job.name" :disabled="readonly" />
					</div>
					<my-button-check
						v-model="job.active"
						:caption="capGen.active"
						:readonly
					/>
					<div class="row gap centered">
						<span>{{ capGen.mode }}</span>
						<select class="auto" v-model="job.jobType" :disabled="readonly">
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
							:caption="capGen.limit"
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
				</div>

				<div class="admin-db-sync-job-content">
					<div class="admin-db-sync-job-content-editor">
						<my-code-editor
							v-model="job.codeSql"
							:mode="editorMode"
							:readonly
						/>
					</div>
					<div class="admin-db-sync-job-content-arrow">
						<my-label image="triangleRight.png" :large="true" />
					</div>
					<div class="admin-db-sync-job-content-options">
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		dbType:  { type: String,        required: true },
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
			isReady:false,
			job: {},
			jobTypes: ['LOAD','SEND_INSERT','SEND_UPDATE','SEND_DELETE']
		};
	},
	computed:{
		canSave: s => s.isReady && !s.readonly && s.isChanged
			&& s.job.name !== '',

		// simple
		editorMode:s => s.dbType === 'mssql' ? 'sqlserver' : 'sql',
		isChanged: s => !s.deepIsEqual(s.jobOrg, s.job),
		isLoad:    s => s.job.jobType === 'LOAD',
		isNew:     s => s.jobId === null,

		// stores
		capApp:        s => s.$store.getters.captions.admin.dbSync,
		capGen:        s => s.$store.getters.captions.generic,
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

		// actions
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
