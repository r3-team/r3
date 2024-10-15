import {getSizeReadable} from '../shared/generic.js';
import {getUnixFormat}   from '../shared/time.js';
export {MyAdminMailTraffic as default};

let MyAdminMailTraffic = {
	name:'my-admin-mail-traffic',
	template:`<div class="admin-mail-traffic contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mail_clock.png" />
				<h1>{{ menuTitle + ' (' + total + ')' }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
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
			</div>
			<div class="area default-inputs">
				<div class="row gap default-inputs">
					<my-button
						@trigger="showOptions = !showOptions"
						:caption="capGen.settings"
						:image="showOptions ? 'visible1.png' : 'visible0.png'"
					/>
					<input class="short"
						v-model="search"
						@keyup.enter="startAtPageFirst"
						:placeholder="capGen.textSearch"
					/>
					<select class="short" v-model.number="limit" @change="startAtPageFirst">
						<option>10</option>
						<option>25</option>
						<option>50</option>
						<option>100</option>
						<option>500</option>
					</select>
				</div>
			</div>
		</div>
		
		<div class="content default-inputs" :class="{ 'no-padding':!noMails }">
			
			<!-- options -->
			<div v-if="showOptions" class="admin-mail-traffic-settings">
				<div class="row gap centered default-inputs">
					<span>{{ capApp.trafficKeepDays }}</span>
					<input class="short" v-model="configInput.mailTrafficKeepDays" />
					<my-button image="save.png"
						@trigger="setConfig"
						:caption="capGen.button.save"
						:active="config.mailTrafficKeepDays !== configInput.mailTrafficKeepDays"
					/>
				</div>
			</div>
			
			<span v-if="noMails"><i>{{ capApp.noMailsInTraffic }}</i></span>
			
			<table class="generic-table bright" v-if="!noMails">
				<thead>
					<tr>
						<th>{{ capApp.dir }}</th>
						<th>{{ capApp.toList }}</th>
						<th>{{ capApp.ccList }}</th>
						<th>{{ capApp.bccList }}</th>
						<th>{{ capApp.subject }}</th>
						<th>{{ capApp.files }}</th>
						<th>{{ capGen.date }}</th>
						<th>{{ capApp.account }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="m in mails">
						<td>{{ m.outgoing ? capApp.dirOut : capApp.dirIn }}</td>
						<td>{{ m.toList }}</td>
						<td>{{ m.ccList }}</td>
						<td>{{ m.bccList }}</td>
						<td>{{ m.subject }}</td>
						<td v-if="m.files.length === 0">-</td>
						<td v-else><my-button image="visible1.png" @trigger="showFiles(m.files)" :caption="String(m.files.length)" /></td>
						<td>{{ getUnixFormat(m.date,settings.dateFormat+' H:i') }}</td>
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
			configInput:{},
			limit:50,
			offset:0,
			search:'',
			showOptions:false,
			
			// mails
			mails:[],
			total:0,
			
			// mail accounts
			accountIdMap:{}
		};
	},
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.configInput = JSON.parse(JSON.stringify(this.config));
		
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
		config:  (s) => s.$store.getters.config,
		settings:(s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getSizeReadable,
		getUnixFormat,
		
		// actions
		offsetSet(add) {
			if(add) this.offset += this.limit;
			else    this.offset -= this.limit;
			this.get();
		},
		showFiles(files) {
			this.$store.commit('dialog',{
				captionBody:files.join('<br />')
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
		
		// backend calls
		get() {
			ws.send('mailTraffic','get',{
				limit:this.limit,
				offset:this.offset,
				search:this.search
			},true).then(
				res => {
					this.mails = res.payload.mails;
					this.total = res.payload.total;
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
		setConfig() {
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		}
	}
};