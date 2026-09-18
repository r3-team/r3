import { jsLibraryLoadNoCache } from '../shared/jsLibrary.js';
import MyAdminMailAccountInput from './adminMailAccountInput.js';
import MyAdminMailTemplateInput from './adminMailTemplateInput.js';

export default {
	name: 'my-admin-invitation',
	components: { MyAdminMailAccountInput, MyAdminMailTemplateInput },
	template: `<div class="admin-invitation contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mailPerson.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="question.png"
					@trigger="showHelp('<p>' + capApp.intro.join('</p><p>') + '</p>')"
					:caption="capGen.information"
				/>
			</div>
		</div>
		<div class="content no-padding grow" v-if="isReady">
			<table class="generic-table-vertical w1600 default-inputs">
				<tbody>
					<tr>
						<td>
							<div class="column gap">
								<my-label :caption="capApp.csvUpload" />
								<input type="file"
									@change="fileUploaded"
									:disabled="!activated"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="csvRowsPreview.length !== 0">
						<td>
							<div class="column gap">
								<my-label :caption="capGen.preview" />
								<table class="admin-invitation-preview-table">
									<thead>
										<tr>
											<th>#</th>
											<th v-for="h in csvHeaders">{{ h }}</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="(r,i) in csvRowsPreview">
											<td>{{ i+1 }}</td>
											<td v-for="c in r">{{ c }}</td>
										</tr>
									</tbody>
								</table>
								<ul v-if="errorMessages.length !== 0" class="textError">
									<li v-for="e in errorMessages">{{ e }}</li>
								</ul>
							</div>
						</td>
					</tr>
					<tr>
						<td>
							<div class="row gap centered">
								<my-label :caption="capGen.mailTemplate" />
								<my-admin-mail-template-input
									v-model="mailTemplateId"
									:onlyInvitation="true"
									:readonly="!activated"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>
							<div class="row gap centered">
								<my-label :caption="capGen.mailAccount" />
								<my-admin-mail-account-input
									v-model="mailAccountId"
									:onlySend="true"
									:readonly="!activated"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>
							<my-button image="cogMultiple.png"
								@trigger=""
								:active="isReadyToExec"
								:caption="capApp.button.exec"
							/>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	computed: {
		csvHeaders: s => [
			s.capGen.username, s.capAppMeta.email, s.capAppMeta.nameFore, s.capAppMeta.nameSur,
			s.capAppMeta.nameDisplay, s.capAppMeta.organization, s.capAppMeta.location, s.capAppMeta.department,
			s.capAppMeta.phoneMobile, s.capAppMeta.phoneLandline, s.capAppMeta.phoneFax, s.capAppMeta.notes
		],
		csvColumnCount: s => s.csvHeaders.length,
		csvRowsPreview: s => s.csvRows.slice(0, 20),
		errorMessages: s => {
			const out = [];
			for (let i = 0, j = s.csvRows.length; i < j; i++) {
				const r = s.csvRows[i];
				if (r.length !== s.csvColumnCount) {
					out.push(s.capApp.error.csvBadColumnCount
						.replace('{ROW}', String(i + 1))
						.replace('{CNT}', r.length)
						.replace('{EXP}', s.csvColumnCount)
					);
				} else {
					if (r[0] === '')
						out.push(s.capApp.error.csvMissingUser.replace('{ROW}', String(i + 1)));

					if (r[1] === '' || !r[1].includes('@'))
						out.push(s.capApp.error.csvMissingMail.replace('{ROW}', String(i + 1)));
				}
				if (out.length > 3)
					break;
			}
			return out;
		},
		isReadyToExec: s => s.mailAccountId !== 0 && s.mailTemplateId !== 0
			&& s.csvRows.length !== 0 && s.errorMessages.length === 0,

		// stores
		activated: s => s.$store.getters['local/activated'],
		capApp: s => s.$store.getters.captions.admin.invitation,
		capAppMeta: s => s.$store.getters.captions.admin.loginMeta,
		capGen: s => s.$store.getters.captions.generic
	},
	data() {
		return {
			// data
			csvRows: [],

			// inputs
			mailAccountId: 0,
			mailTemplateId: 0,

			// states
			isReady: false
		};
	},
	mounted() {
		this.$store.commit('pageTitle', this.menuTitle);

		jsLibraryLoadNoCache('externals/papaparse.js').then(
			() => this.isReady = true, this.$root.genericError
		);
	},
	methods: {
		// actions
		fileUploaded(e) {
			if (e.target.files.length !== 1)
				return;

			this.csvRows = [];

			const file = e.target.files[0];
			file.text().then(
				csvContent => {
					const parsed = Papa.parse(csvContent, {
						delimiter: "",	// auto-detect
						newline: "",	// auto-detect
						quoteChar: '"',
						escapeChar: '"'
					});

					if (parsed.errors.length !== 0)
						console.error(`errors occurred during CSV parsing, ${parsed.errors}`);

					this.csvRows = parsed.data;
				},
				this.$root.genericError
			);
		},
		showHelp(msg) {
			this.$store.commit('dialog', { captionBody: msg, captionTop: this.capGen.information });
		}
	}
};
