import { deepIsEqual } from '../shared/generic.js';
import MyInputDecimal from '../inputDecimal.js';
import {
	dialogCloseAsk,
	dialogDeleteAsk
} from '../shared/dialog.js';

export default {
	name:'my-admin-db-sync-host',
	components:{ MyInputDecimal },
	template:`<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-db-sync-host scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/databaseSync.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',host.name) }}</h1>
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

			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}*</td>
							<td><input v-model="host.name" :disabled="readonly" v-focus /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capGen.active }}*</td>
							<td><my-bool v-model="host.active" :disabled="readonly" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capGen.comments }}</td>
							<td><textarea v-model="host.comment" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capApp.address }}*</td>
							<td>
								<div class="row gap">
									<input v-model="host.address" :disabled="readonly" />
									<my-input-decimal class="short" v-model="host.port" :min="0" :max="65535" :allowNull="false" :lengthFract="0" :readonly />
								</div>
							</td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capGen.username }}*</td>
							<td><input v-model="host.username" :disabled="readonly" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capGen.password }}*</td>
							<td><input type="password" v-model="host.password" :disabled="readonly" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.dbName }}*</td>
							<td><input v-model="host.dbName" :disabled="readonly" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.dbType }}*</td>
							<td>
								<select v-model="host.dbType" :disabled="readonly">
									<option value="mysql">MySQL</option>
									<option value="mssql">MSSQL</option>
									<option value="pgsql">PostgreSQL</option>
									<option value="clickhouse">ClickHouse</option>
								</select>
							</td>
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
	emits:['close','makeNew','reload'],
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
		canSave: s => s.isReady && !s.readonly && s.isChanged
			&& s.host.name !== ''
			&& s.host.address !== ''
			&& s.host.dbName !== ''
			&& s.host.username !== ''
			&& s.host.password !== '',

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
			this.host = JSON.parse(JSON.stringify(this.hostOrg));
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('dbSync','delHost',this.hostId,true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			ws.send('dbSync','setHost',this.host,true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
