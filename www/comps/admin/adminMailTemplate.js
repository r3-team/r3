import MyInputRichtext from '../inputRichtext.js';

import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';

export default {
	name: 'my-admin-mail-template',
	components: { MyInputRichtext },
	template: `<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-mail-template scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/mailPlus.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',template.name) }}</h1>
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
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>

			<div class="content no-padding grow">
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.usage }}</td>
							<td>
								<select v-model="template.content" :disabled="!isNew">
									<option value="loginInvitation">{{ capGen.invitation }}</option>
									<option value="loginPwReset">{{ capGen.passwordReset }}</option>
								</select>
							</td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capGen.name }}</td>
							<td colspan="2"><input class="long" v-model="template.name" /></td>
						</tr>
						<tr>
							<td>{{ capGen.subject }}</td>
							<td colspan="2"><input class="dynamic" v-model="template.subject" /></td>
						</tr>
						<tr>
							<td>{{ capGen.message }}</td>
							<td colspan="2" class="no-padding">
								<div class="admin-mail-template-body">
									<my-input-richtext v-model="template.body" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.placeholders }}</td>
							<td>
								<table>
									<tbody>
										<tr>
											<td class="minimum"><my-button image="copyClipboard.png" @trigger="toClipboard('')" /></td>
											<td>TEST</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props: {
		templateId: { type: [Number, null], required: true },
		templateOrg: { type: Object, required: true }
	},
	emits: ['close', 'makeNew', 'reload'],
	watch: {
		templateId: {
			handler() { this.reset(); },
			immediate: true
		}
	},
	data() {
		return {
			// inputs
			template: {},

			// states
			isReady: false,
		};
	},
	computed: {
		canSave: s => s.isReady && s.isChanged
			&& s.template.name !== ''
			&& s.template.body !== ''
			&& s.template.subject !== '',

		// simple
		isChanged: s => !s.deepIsEqual(s.templateOrg, s.template),
		isNew: s => s.templateId === null,

		// stores
		capApp: s => s.$store.getters.captions.admin.mailTemplate,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true });
		this.$store.commit('keyDownHandlerAdd', { fnc: this.closeAsk, key: 'Escape' });
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

		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close, this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		reloadAndClose() {
			ws.send('mailTemplate', 'informChanged', {}, true).then(
				() => {
					this.$emit('reload');
					this.close();
				},
				this.$root.genericError
			);
		},
		reset() {
			this.template = JSON.parse(JSON.stringify(this.templateOrg));
			this.isReady = true;
		},
		toClipboard(value) {
			navigator.clipboard.writeText(value);
		},

		// backend calls
		del() {
			ws.send('mailTemplate', 'del', this.templateId, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			if (!this.canSave)
				return;

			ws.send('mailTemplate', 'set', this.template, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
