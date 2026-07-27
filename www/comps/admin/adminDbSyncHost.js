import {dialogDeleteAsk}       from '../shared/dialog.js';
import {deepIsEqual}           from '../shared/generic.js';

export default {
	name:'my-admin-db-sync-host',
	components:{},
	template:`<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="close">

		<div class="contentBox admin-db-sync-host scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/databaseSync.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',host.name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
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

			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}*</td>
							<td><input v-model="host.name" :disabled="readonly" v-focus /></td>
							<td></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props: {
		hostId:  { type:[String,null], required:true },
		hostOrg: { type:Object,        required:true },
		readonly:{ type:Boolean,       required:true }
	},
	emits:['close','makeNew'],
	watch:{
		hostId:{
			handler(v) { this.reset(); },
			immediate:true
		},
	},
	data() {
		return {
			isReady:false,
			host:{}
		};
	},
	computed:{
		canSave:s => s.isReady && !s.readonly && s.isChanged && s.host.name !== '',

		// simple
		isChanged:s => !s.deepIsEqual(s.hostOrg,s.host),
		isNew:    s => s.hostId === null,

		// stores
		capApp:s => s.$store.getters.captions.admin.dbSync,
		capGen:s => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true });
		this.$store.commit('keyDownHandlerAdd', { fnc: this.close, key: 'Escape' });
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		deepIsEqual,
		dialogDeleteAsk,

		// actions
		close() {
			this.$emit('close');
		},
		informAndClose() {
			ws.send('dbSync', 'informChanged', {}, true).then(this.close, this.$root.genericError);
		},
		reset() {
			this.host = JSON.parse(JSON.stringify(this.hostOrg));
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('dbSync','delHost',this.id,true).then(
				this.informAndClose,
				this.$root.genericError
			);
		},
		set() {
			ws.send('dbSync','setHost',this.inputs,true).then(
				this.informAndClose,
				this.$root.genericError
			);
		}
	}
};
