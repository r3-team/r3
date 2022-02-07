import {getSizeReadable} from '../shared/generic.js';
import {getUnixFormat}   from '../shared/time.js';
export {MyAdminMails as default};

let MyAdminMails = {
	name:'my-admin-mails',
	template:`<div class="admin-mails contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mail_spool.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
				<my-button image="delete.png"
					v-if="!noMails"
					@trigger="del"
					:active="mailIdsSelected.length !== 0"
					:cancel="true"
					:caption="capGen.button.delete"
					:darkBg="true"
				/>
			</div>
			<div class="area" v-if="!noMails">
				<my-button image="triangleLeft.png"
					@trigger="offsetSet(false)"
					:active="offset-limit >= 0"
					:darkBg="true"
					:naked="true"
				/>
				<my-button
					@trigger="startSet"
					:caption="String((offset / limit) + 1)"
					:darkBg="true"
					:naked="true"
				/>
				<my-button image="triangleRight.png"
					@trigger="offsetSet(true)"
					:active="mails.length === limit"
					:darkBg="true"
					:naked="true"
				/>
			</div>
		</div>
		
		<div class="content mails default-inputs" :class="{ 'no-padding':!noMails }">
			<span v-if="noMails"><i>{{ capApp.noMails }}</i></span>
			
			<table class="table-default shade" v-if="!noMails">
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
	data:function() {
		return {
			// mails
			mails:[],
			mailIdsSelected:[],
			limit:50,
			offset:0,
			
			// mail accounts
			accountIdMap:{}
		};
	},
	mounted:function() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.get();
		this.getAccounts();
	},
	computed:{
		// simple
		noMails:function() { return this.offset === 0 && this.mails.length === 0 },
		
		// stores
		capApp:  function() { return this.$store.getters.captions.admin.mails; },
		capGen:  function() { return this.$store.getters.captions.generic; },
		settings:function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getSizeReadable,
		getUnixFormat,
		
		// presentation
		displaySendAttempts:function(mail) {
			if(!mail.outgoing)
				return '';
			
			if(mail.attemptCount === 0)
				return '-';
			
			return `${mail.attemptCount}/5 (${this.getUnixFormat(mail.attemptDate,this.settings.dateFormat+' H:i')})`;
		},
		displayAttach:function(mail) {
			if(mail.outgoing)    return `<i>${this.capApp.attachmentsNoPreview}</i>`;
			if(mail.files === 0) return '-';
			return `${mail.files} (${this.getSizeReadable(mail.filesSize)})`;
		},
		
		// actions
		showMail:function(mail) {
			this.$store.commit('dialog',{
				captionBody:mail.body,
				captionTop:this.capApp.body,
				image:'mail2.png',
				textDisplay:'richtext',
				width:800,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		startSet:function() {
			this.offset = 0;
			this.get();
		},
		offsetSet:function(add) {
			if(add) this.offset += this.limit;
			else    this.offset -= this.limit;
			
			this.get();
		},
		toggleMailAll:function() {
			if(this.mailIdsSelected.length === this.mails.length) {
				this.mailIdsSelected = [];
				return;
			}
			
			this.mailIdsSelected = [];
			for(let i = 0, j = this.mails.length; i < j; i++) {
				this.mailIdsSelected.push(this.mails[i].id);
			}
		},
		toggleMailId:function(id) {
			let pos = this.mailIdsSelected.indexOf(id);
			
			if(pos === -1)
				return this.mailIdsSelected.push(id);
			
			this.mailIdsSelected.splice(pos,1);
		},
		
		// backend calls
		del:function() {
			ws.send('mail','del',{ids:this.mailIdsSelected},true).then(
				(res) => this.get(),
				(err) => this.$root.genericError(err)
			);
		},
		get:function() {
			ws.send('mail','get',{
				limit:this.limit,
				offset:this.offset
			},true).then(
				(res) => {
					this.mails           = res.payload.mails;
					this.mailIdsSelected = [];
				},
				(err) => this.$root.genericError(err)
			);
		},
		getAccounts:function() {
			ws.send('mailAccount','get',{},true).then(
				(res) => this.accountIdMap = res.payload.accounts,
				(err) => this.$root.genericError(err)
			);
		}
	}
};