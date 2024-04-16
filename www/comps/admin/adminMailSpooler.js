import {getSizeReadable} from '../shared/generic.js';
import {getUnixFormat}   from '../shared/time.js';
export {MyAdminMailSpooler as default};

let MyAdminMailSpooler = {
	name:'my-admin-mail-spooler',
	template:`<div class="admin-mail-spooler contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mail_spool.png" />
				<h1>{{ menuTitle + ' (' + total + ')' }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
				<my-button image="autoRenew.png"
					v-if="!noMails"
					@trigger="reset"
					:active="mailIdsSelected.length !== 0"
					:caption="capApp.button.attemptsReset"
				/>
				<my-button image="delete.png"
					v-if="!noMails"
					@trigger="del"
					:active="mailIdsSelected.length !== 0"
					:cancel="true"
					:caption="capGen.button.delete"
				/>
			</div>
			<div class="area default-inputs" v-if="!noMails">
				<my-button image="triangleLeft.png"
					@trigger="offsetSet(false)"
					@trigger-shift="startAtPageFirst"
					:active="offset-limit >= 0"
					:naked="true"
				/>
				
				<span>{{ String((offset / limit) + 1) + ' / ' + pages  }}</span>
				
				<my-button image="triangleRight.png"
					@trigger="offsetSet(true)"
					@trigger-shift="startAtPageLast"
					:active="offset+limit < total"
					:naked="true"
				/>
				
				<select v-model.number="limit" @change="startAtPageFirst">
					<option>10</option>
					<option>25</option>
					<option>50</option>
					<option>100</option>
					<option>500</option>
					<option>1000</option>
				</select>
			</div>
			<div class="area default-inputs">
				<div class="row gap">
					<input v-model="search" @keyup.enter="startAtPageFirst" :placeholder="capGen.threeDots" />
				</div>
			</div>
		</div>
		
		<div class="content mails default-inputs" :class="{ 'no-padding':!noMails }">
			<span v-if="noMails"><i>{{ capApp.noMailsInSpool }}</i></span>
			
			<table class="generic-table bright shade" v-if="!noMails">
				<thead>
					<tr>
						<th>
							<my-button
								@trigger="toggleMailAll"
								:image="mailIdsSelected.length === mails.length ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
						</th>
						<th>{{ capApp.dir }}</th>
						<th>{{ capApp.toList }}</th>
						<th>{{ capApp.ccList }}</th>
						<th>{{ capApp.bccList }}</th>
						<th>{{ capApp.subject }}</th>
						<th>{{ capApp.body }}</th>
						<th>{{ capApp.files }}</th>
						<th>{{ capGen.date }}</th>
						<th>{{ capApp.attempts }}</th>
						<th>{{ capApp.account }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="m in mails">
						<td class="minimum">
							<my-button
								@trigger="toggleMailId(m.id)"
								:image="mailIdsSelected.includes(m.id) ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
						</td>
						<td>{{ m.outgoing ? capApp.dirOut : capApp.dirIn }}</td>
						<td>{{ m.toList }}</td>
						<td>{{ m.ccList }}</td>
						<td>{{ m.bccList }}</td>
						<td>{{ m.subject }}</td>
						<td class="minimum">
							<my-button image="search.png" @trigger="showMail(m)" />
						</td>
						<td v-html="displayAttach(m)"></td>
						<td>{{ getUnixFormat(m.date,settings.dateFormat+' H:i') }}</td>
						<td>{{ displaySendAttempts(m) }}</td>
						<td>{{ typeof accountIdMap[m.accountId] !== 'undefined' ? accountIdMap[m.accountId].name : '-' }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			// inputs
			limit:50,
			offset:0,
			search:'',
			
			// mails
			mails:[],
			mailIdsSelected:[],
			total:0,
			
			// mail accounts
			accountIdMap:{}
		};
	},
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.get();
		this.getAccounts();
	},
	computed:{
		// simple
		noMails:(s) => s.total === 0,
		pages:  (s) => Math.ceil(s.total / s.limit),
		
		// stores
		capApp:  (s) => s.$store.getters.captions.admin.mails,
		capGen:  (s) => s.$store.getters.captions.generic,
		settings:(s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getSizeReadable,
		getUnixFormat,
		
		// presentation
		displaySendAttempts(mail) {
			if(!mail.outgoing)          return '';
			if(mail.attemptCount === 0) return '-';
			return `${mail.attemptCount}/5 (${this.getUnixFormat(mail.attemptDate,this.settings.dateFormat+' H:i')})`;
		},
		displayAttach(mail) {
			if(mail.outgoing)    return `<i>${this.capApp.attachmentsNoPreview}</i>`;
			if(mail.files === 0) return '-';
			return `${mail.files} (${this.getSizeReadable(mail.filesSize)})`;
		},
		
		// actions
		showMail(mail) {
			this.$store.commit('dialog',{
				captionBody:mail.body,
				captionTop:this.capApp.body,
				image:'mail2.png',
				textDisplay:'richtext',
				width:800
			});
		},
		startAtPageFirst() {
			this.offset = 0;
			this.get();
		},
		startAtPageLast() {
			this.offset = this.limit * (this.pages-1);
			this.get();
		},
		offsetSet(add) {
			if(add) this.offset += this.limit;
			else    this.offset -= this.limit;
			this.get();
		},
		toggleMailAll() {
			if(this.mailIdsSelected.length === this.mails.length) {
				this.mailIdsSelected = [];
				return;
			}
			
			this.mailIdsSelected = [];
			for(let i = 0, j = this.mails.length; i < j; i++) {
				this.mailIdsSelected.push(this.mails[i].id);
			}
		},
		toggleMailId(id) {
			const pos = this.mailIdsSelected.indexOf(id);
			
			if(pos === -1) this.mailIdsSelected.push(id);
			else           this.mailIdsSelected.splice(pos,1);
		},
		
		// backend calls
		del() {
			ws.send('mailSpooler','del',{ids:this.mailIdsSelected},true).then(
				() => {
					this.mailIdsSelected = [];
					this.offset = 0;
					this.get();
				},
				this.$root.genericError
			);
		},
		get() {
			ws.send('mailSpooler','get',{
				limit:this.limit,
				offset:this.offset,
				search:this.search
			},true).then(
				res => {
					this.mails           = res.payload.mails;
					this.mailIdsSelected = [];
					this.total           = res.payload.total;
				},
				this.$root.genericError
			);
		},
		getAccounts() {
			ws.send('mailAccount','get',{},true).then(
				res => this.accountIdMap = res.payload,
				this.$root.genericError
			);
		},
		reset() {
			ws.send('mailSpooler','reset',{ids:this.mailIdsSelected},true).then(
				() => {
					this.mailIdsSelected = [];
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};