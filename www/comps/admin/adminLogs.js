import MyInputDate                 from '../inputDate.js';
import MyInputOffset               from '../inputOffset.js';
import {getLineBreaksParsedToHtml} from '../shared/generic.js';
import {getUnixFormat}             from '../shared/time.js';
export {MyAdminLogs as default};

let MyAdminLogs = {
	name:'my-admin-logs',
	components:{MyInputDate,MyInputOffset},
	template:`<div class="contentBox admin-logs grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/fileText.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area admin-logs-date-wrap">
				<my-input-date
					@set-unix-from="setDate($event,true)"
					@set-unix-to="setDate($event,false)"
					:isDate="true"
					:isTime="true"
					:isRange="true"
					:isValid="true"
					:unixFrom="unixFrom"
					:unixTo="unixTo"
				/>
			</div>
			<div class="area">
				<my-input-offset
					@input="offset = $event;get()"
					:caption="true"
					:limit="limit"
					:offset="offset"
					:total="total"
				/>
			</div>
			<div class="area gap default-inputs">
				<my-button image="refresh.png"
					@trigger="get"
					:captionTitle="capGen.button.refresh"
					:naked="true"
				/>
				<input class="short"
					v-model="byString"
					@keyup.enter="offset = 0;get()"
					:placeholder="capGen.textSearch"
				/>
				<select v-model="context" @change="offset = 0;get()">
					<option value="">[{{ capGen.everything }}]</option>
					<option v-for="c in contextsValid" :value="c">
						{{ capApp.contextLabel[c] }}
					</option>
				</select>
				<select class="short" v-model.number="limit" @change="offset = 0;get()">
					<option value="100">100</option>
					<option value="250">250</option>
					<option value="500">500</option>
					<option value="1000">1000</option>
				</select>
				<my-button
					@trigger="showOptions = !showOptions"
					:caption="capGen.settings"
					:image="showOptions ? 'visible1.png' : 'visible0.png'"
				/>
			</div>
		</div>
		
		<div class="content admin-logs-content no-padding">
		
			<!-- options -->
			<div v-if="showOptions" class="admin-logs-settings">
				<table class="default-inputs">
					<tbody>
						<tr>
							<td>{{ capApp.keepDays }}</td>
							<td colspan="2">
								<input class="short" v-model="configInput.logsKeepDays" />
							</td>
							<td>
								<my-button image="save.png"
									@trigger="setConfig"
									:active="config.logsKeepDays !== configInput.logsKeepDays"
									:caption="capGen.button.save"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.logLevel }}</td>
							<td>
								<select v-model="levelContext">
									<option v-for="c in contextsValid" :value="getConfigLogContextName(c)">
										{{ capApp.contextLabel[c] }}
									</option>
								</select>
							</td>
							<td>
								<select v-model="configInput[levelContext]">
									<option value="1">{{ capApp.logLevel1 }}</option>
									<option value="2">{{ capApp.logLevel2 }}</option>
									<option value="3">{{ capApp.logLevel3 }}</option>
								</select>
							</td>
							<td>
								<my-button image="save.png"
									@trigger="setConfig"
									:active="config[levelContext] !== configInput[levelContext]"
									:caption="capGen.button.save"
								/>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<!-- logs -->
			<div class="admin-logs-table">
				<table class="generic-table bright sticky-top">
					<thead>
						<tr class="title">
							<th class="minimum">{{ capGen.button.show }}</th>
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
							<td class="minimum">
								<div class="row centered">
									<div class="level-indicator"
										:style="'background-color:'+displayIndicator(l.level)"
									></div>
									<span>{{ displayLevel(l.level) }}</span>
								</div>
							</td>
							<td class="minimum">{{ l.nodeName }}</td>
							<td class="minimum">{{ l.moduleName }}</td>
							<td class="minimum">{{ capApp.contextLabel[l.context] }}</td>
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
	data() {
		return {
			contextsValid:[
				'module','api','backup','cache','cluster','csv','imager',
				'ldap','mail','scheduler','server','transfer','websocket'
			],
			messageLengthShow:200,
			
			// inputs
			byString:'',
			configInput:{},
			context:'',
			levelContext:'logModule',
			limit:100,
			offset:0,
			total:0,
			unixFrom:null,
			unixTo:null,
			
			// states
			showOptions:false,
			
			// data
			logs:[]
		};
	},
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.configInput = JSON.parse(JSON.stringify(this.config));
		
		// set date range for log retrieval (7 days ago to now)
		let d = new Date();
		d.setDate(d.getDate()-7);
		d.setHours(0,0,0);
		this.setDate(Math.floor(d.getTime() / 1000),true);
	},
	computed:{
		// stores
		settings:(s) => s.$store.getters.settings,
		capApp:  (s) => s.$store.getters.captions.admin.logs,
		capGen:  (s) => s.$store.getters.captions.generic,
		config:  (s) => s.$store.getters.config
	},
	methods:{
		// externals
		getLineBreaksParsedToHtml,
		getUnixFormat,
		
		getConfigLogContextName(context) {
			return `log${context[0].toUpperCase() + context.slice(1)}`;
		},
		displayDate(date) {
			let format = [this.settings.dateFormat,'H:i:S'];
			return this.getUnixFormat(date,format.join(' '));
		},
		displayIndicator(level) {
			switch(level) {
				case 1: return '#ca2a2a'; break;
				case 2: return '#caac2a'; break;
			}
			return '#b0b0b0';
		},
		displayLevel(level) {
			return this.capApp['level'+level];
		},
		displayMessage(msg) {
			return msg.length > this.messageLengthShow
				? msg.substr(0,this.messageLengthShow)+'...' : msg;
		},
		setDate(unix,from) {
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
		showMessage(index) {
			this.$store.commit('dialog',{
				captionBody:this.getLineBreaksParsedToHtml(this.logs[index].message),
				textDisplay:'textarea',
				width:800
			});
		},
		
		// backend calls
		get() {
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
		},
		setConfig() {
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		}
	}
};