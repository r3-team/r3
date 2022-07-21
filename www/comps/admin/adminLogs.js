import MyInputDate                 from '../inputDate.js';
import MyInputOffset               from '../inputOffset.js';
import {getLineBreaksParsedToHtml} from '../shared/generic.js';
import {getUnixFormat}             from '../shared/time.js';
export {MyAdminLogs as default};

let MyAdminLogs = {
	name:'my-admin-logs',
	components:{MyInputDate,MyInputOffset},
	template:`<div class="contentBox grow">
		
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/log.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		
		<div class="content logs no-padding">
			<div class="actions">
				
				<my-input-date class="entry"
					@set-unix-from="setDate($event,true)"
					@set-unix-to="setDate($event,false)"
					:isDate="true"
					:isTime="true"
					:isRange="true"
					:isValid="true"
					:unixFrom="unixFrom"
					:unixTo="unixTo"
				/>
				
				<div class="right-bar default-inputs">
					<my-input-offset
						@input="offset = $event;get()"
						:caption="true"
						:limit="limit"
						:offset="offset"
						:total="total"
					/>
					<select class="entry" v-model="context" @change="offset = 0;get()">
						<option value="">[{{ capApp.context }}]</option>
						<option value="application">Applications</option>
						<option value="backup">Backup</option>
						<option value="cache">Cache</option>
						<option value="cluster">Cluster</option>
						<option value="csv">CSV</option>
						<option value="ldap">LDAP</option>
						<option value="mail">Mail</option>
						<option value="scheduler">Scheduler</option>
						<option value="server">Server</option>
						<option value="transfer">Transfer</option>
					</select>
					<input class="entry"
						v-model="byString"
						@keyup.enter="offset = 0;get()"
						:placeholder="capApp.byString"
					/>
					<span>{{ capGen.limit }}</span>
					<select class="entry short" v-model.number="limit" @change="offset = 0;get()">
						<option value="100">100</option>
						<option value="250">250</option>
						<option value="500">500</option>
						<option value="1000">1000</option>
					</select>
					<my-button image="refresh.png"
						@trigger="get"
						:caption="capGen.button.refresh"
					/>
				</div>
			</div>
		
			<div class="table-default-wrap shade">
				<table class="table-default">
					<thead>
						<tr class="title">
							<th></th>
							<th class="minimum">{{ capApp.date }}</th>
							<th class="minimum">{{ capApp.level }}</th>
							<th class="minimum">{{ capApp.node }}</th>
							<th class="minimum">{{ capApp.module }}</th>
							<th class="minimum">{{ capApp.context }}</th>
							<th>{{ capApp.message }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-if="logs.length === 0">
							<td colspan="999">{{ capGen.nothingThere }}</td>
						</tr>
						
						<tr v-for="(l,i) in logs">
							<td>
								<my-button image="open.png"
									v-if="l.message.length > messageLengthShow"
									@trigger="showMessage(i)"
								/>
							</td>
							<td class="minimum">{{ displayDate(l.date) }}</td>
							<td class="minimum">{{ displayLevel(l.level) }}</td>
							<td class="minimum">{{ l.nodeName }}</td>
							<td class="minimum">{{ l.moduleName }}</td>
							<td class="minimum">{{ l.context }}</td>
							<td>{{ displayMessage(l.message) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			messageLengthShow:200,
			
			// inputs
			byString:'',
			context:'',
			limit:100,
			offset:0,
			total:0,
			unixFrom:null,
			unixTo:null,
			
			// data
			logs:[]
		};
	},
	mounted:function() {
		this.$store.commit('pageTitle',this.menuTitle);
		
		// set date range for log retrieval (7 days ago to now)
		let d = new Date();
		d.setDate(d.getDate()-7);
		d.setHours(0,0,0);
		this.setDate(Math.floor(d.getTime() / 1000),true);
	},
	computed:{
		// stores
		settings:function() { return this.$store.getters.settings; },
		capApp:  function() { return this.$store.getters.captions.admin.logs; },
		capGen:  function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getLineBreaksParsedToHtml,
		getUnixFormat,
		
		// presentation
		displayDate:function(date) {
			let format = [this.settings.dateFormat,'H:i:S'];
			return this.getUnixFormat(date,format.join(' '));
		},
		displayLevel:function(level) {
			switch(level) {
				case 1: return this.capApp.level1; break;
				case 2: return this.capApp.level2; break;
				case 3: return this.capApp.level3; break;
				default: '';
			}
		},
		displayMessage:function(msg) {
			if(msg.length > this.messageLengthShow)
				return msg.substr(0,this.messageLengthShow)+'...';
			
			return msg;
		},
		setDate:function(unix,from) {
			if(from) {
				this.unixFrom = unix;
			}
			else {
				this.unixTo = unix;
				
				// add 23:59:59 to to date, if from and to date are equal
				let d = new Date(this.unixTo * 1000);
				if(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0)
					this.unixTo += 86399;
			}
			this.get();
		},
		showMessage:function(index) {
			this.$store.commit('dialog',{
				captionBody:this.getLineBreaksParsedToHtml(this.logs[index].message),
				textDisplay:'textarea',
				width:800,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		get:function() {
			ws.send('log','get',{
				byString:this.byString,
				context:this.context,
				dateFrom:this.unixFrom,
				dateTo:this.unixTo,
				limit:this.limit,
				offset:this.offset
			},true).then(
				res => {
					this.logs  = res.payload.logs;
					this.total = res.payload.total;
				},
				this.$root.genericError
			);
		}
	}
};