import MyInputDecimal from '../inputDecimal.js';
import { openTextFile } from '../shared/generic.js';
import { jsLibraryLoadNoCache } from '../shared/jsLibrary.js';
import MyAdminLoginTemplateInput from './adminLoginTemplateInput.js';
import MyAdminMailAccountInput from './adminMailAccountInput.js';
import MyAdminMailTemplateInput from './adminMailTemplateInput.js';

export default {
	name: 'my-admin-invitation',
	components: { MyAdminLoginTemplateInput, MyAdminMailAccountInput, MyAdminMailTemplateInput, MyInputDecimal },
	template: `<div class="admin-invitation contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mailPerson.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="download.png"
					@trigger="fileTemplateLoad"
					:caption="capGen.template"
				/>
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
								<my-label :caption="capApp.csvUpload" image="upload.png" />
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
								<my-label :caption="capGen.preview" image="visible1.png" />
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
							<div class="column gap">
								<my-label :caption="capGen.settings" image="cog.png" />
								<table>
									<tbody>
										<tr>
											<td>{{ capGen.loginTemplate }}</td>
											<td><my-admin-login-template-input v-model="loginTemplateId" :readonly="!activated" /></td>
										</tr>
										<tr>
											<td>{{ capGen.mailTemplate }}</td>
											<td>
												<my-admin-mail-template-input
													v-model="mailTemplateId"
													:onlyInvitation="true"
													:readonly="!activated"
												/>
											</td>
										</tr>
										<tr>
											<td>{{ capGen.mailAccount }}</td>
											<td>
												<my-admin-mail-account-input
													v-model="mailAccountId"
													:onlySend="true"
													:readonly="!activated"
												/>
											</td>
										</tr>
										<tr>
											<td>{{ capGen.expireAfter }}</td>
											<td>
												<div class="row gap centered">
													<my-input-decimal class="short" v-model="expireAfterSeconds" :min="0" :allowNull="false" :lengthFract="0" :readonly="!activated" />
													<my-label :caption="capGen.seconds" />
												</div>
											</td>
										</tr>
										<tr>
											<td>{{ capGen.mfa }}</td>
											<td>
												<select v-model="mfaRequiredSelect" :disabled="!activated">
													<option value="">{{ capGen.systemDefault }}</option>
													<option value="1">{{ capGen.required }}</option>
													<option value="0">{{ capGen.optional }}</option>
												</select>
											</td>
										</tr>
										<tr>
											<td>{{ capGen.separator }}</td>
											<td><input class="short" maxlength="1" v-model="csvSeparator" :disabled="!activated" /></td>
										</tr>
									</tbody>
								</table>
							</div>
						</td>
					</tr>
					<tr>
						<td>
							<my-button image="cogMultiple.png"
								@trigger="invite"
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
		isReadyToExec: s => s.loginTemplateId !== null && s.mailAccountId !== 0 && s.mailTemplateId !== 0
			&& s.csvRows.length !== 0 && s.errorMessages.length === 0,

		// inputs
		mfaRequiredSelect: {
			get() { return this.mfaRequired === null ? '' : (this.mfaRequired ? '1' : '0'); },
			set(v) { this.mfaRequired = v === '' ? null : v === '1'; }
		},

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
			csvSeparator: ',',
			expireAfterSeconds: 86400,
			loginTemplateId: null,
			mailAccountId: 0,
			mailTemplateId: 0,
			mfaRequired: null,
			roleIds: [],

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
		fileTemplateLoad() {
			const header = this.csvHeaders.join(this.csvSeparator);
			const line1 = ['h.testuser', 'h-testuser@testorg.com', 'Hans', 'Testuser', 'Hans Testuser', 'Testorg Inc.', 'Headerquarters', 'Sales', '+49 172 390 7321', '', '', ''].join(this.csvSeparator);
			const line2 = ['m.otheruser', 'm-otheruser@testorg.com', 'Maria', 'Otheruser', 'Maria Otheruser', 'Testorg Inc.', 'Headerquarters', 'Quality Assurance', '', '+49 89 231 3392', '', 'Test user'].join(this.csvSeparator);
			openTextFile(`${header}\n${line1}\n${line2}\n`, 'user_invitation_example.csv');
		},
		fileUploaded(e) {
			if (e.target.files.length !== 1)
				return;

			this.csvRows = [];

			const file = e.target.files[0];
			file.text().then(
				csvContent => {
					const parsed = Papa.parse(csvContent, {
						delimiter: this.csvSeparator,
						escapeChar: '"',
						newline: '', // auto-detect
						quoteChar: '"',
						skipEmptyLines: true // CSV files should contain empty line at the end
					});

					if (parsed.errors.length !== 0)
						console.error(`errors occurred during CSV parsing, ${parsed.errors}`);

					// remove header line
					parsed.data.shift();

					this.csvRows = parsed.data;
				},
				this.$root.genericError
			);
		},
		showHelp(msg) {
			this.$store.commit('dialog', { captionBody: msg, captionTop: this.capGen.information });
		},

		// backend calls
		invite() {
			const logins = [];
			for (const r of this.csvRows) {
				logins.push({
					name: r[0],
					meta: {
						email: r[1],
						nameFore: r[2],
						nameSur: r[3],
						nameDisplay: r[4],
						organization: r[5],
						location: r[6],
						department: r[7],
						phoneMobile: r[8],
						phoneLandline: r[9],
						phoneFax: r[10],
						notes: r[11],
					}
				});
			}

			ws.send('loginInvitation', 'set', {
				expireAfterSeconds: this.expireAfterSeconds,
				logins,
				loginTemplateId: this.loginTemplateId,
				mailAccountId: this.mailAccountId,
				mailTemplateId: this.mailTemplateId,
				mfaRequired: this.mfaRequired,
				roleIds: this.roleIds
			}, true).then(
				() => {
					const msg = this.capApp.dialog.success.replace('{CNT}', logins.length);
					this.$store.commit('dialog', { captionBody: msg });
					this.csvRows = [];
				},
				this.$root.genericError
			);
		}
	}
};
