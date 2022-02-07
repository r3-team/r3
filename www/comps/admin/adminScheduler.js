import {getStringFilled} from '../shared/generic.js';
import {getUnixFormat}   from '../shared/time.js';
import {
	getCaption,
	getCaptionForModule
} from '../shared/language.js';
export {MyAdminScheduler as default};

let MyAdminScheduler = {
	name:'my-admin-scheduler',
	template:`<div class="admin-scheduler contentBox grow">
	
		<div class="top">
			<div class="area">
				<img class="icon" src="images/tasks.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
					:darkBg="true"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
			
			<div class="contentPart full">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.systemTasks }}</h1>
				</div>
				
				<table class="table-default default-inputs shade">
					<thead>
						<tr>
							<th>{{ capGen.name }}</th>
							<th>{{ capApp.intervalSeconds }}</th>
							<th>{{ capApp.dateAttempt }}</th>
							<th>{{ capApp.dateSuccess }}</th>
							<th>{{ capGen.active }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(s,i) in schedulersInput.filter(v => v.taskName !== '')">
							<td>{{ displayName(s.taskName) }}</td>
							<td><input v-model.number="schedulersInput[i].intervalValue" /></td>
							<td>{{ displayTime(s.dateAttempt) }}</td>
							<td>{{ displayTime(s.dateSuccess) }}</td>
							<td><my-bool v-model="schedulersInput[i].active" /></td>
							<td>
								<my-button image="clock.png"
									@trigger="runSystemTask(s.taskName)"
									:active="!taskRunning && schedulersInput[i].active"
									:caption="capApp.button.runNow"
								/>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<div class="contentPart full" v-if="hasAppSchedules">
				<div class="contentPartHeader">
					<img class="icon" src="images/builder.png" />
					<h1>{{ capApp.functions }}</h1>
				</div>
				
				<table class="table-default shade">
					<thead>
						<tr>
							<th>{{ capGen.application }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capApp.interval }}</th>
							<th>{{ capApp.dateAttempt }}</th>
							<th>{{ capApp.dateSuccess }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="s in pgFunctionSchedulers">
							<td>{{ displayModuleName(s.pgFunctionId) }}</td>
							<td>{{ displayFunctionName(s.pgFunctionId) }}</td>
							<td>{{ displaySchedule(s.pgFunctionId,s.pgFunctionScheduleId) }}</td>
							<td>{{ displayTime(s.dateAttempt) }}</td>
							<td>{{ displayTime(s.dateSuccess) }}</td>
							<td>
								<my-button image="clock.png"
									@trigger="runPgFunction(s.pgFunctionId,s.pgFunctionScheduleId)"
									:active="!taskRunning"
									:caption="capApp.button.runNow"
								/>
							</td>
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
			schedulers:[],
			schedulersInput:[],
			taskRunning:false
		};
	},
	mounted:function() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	computed:{
		hasChanges:function() {
			return JSON.stringify(this.schedulers) !== JSON.stringify(this.schedulersInput);
		},
		hasAppSchedules:function() {
			for(let i = 0, j = this.schedulers.length; i < j; i++) {
				if(this.schedulers[i].taskName === '')
					return true;
			}
			return false;
		},
		pgFunctionSchedulers:function() {
			let out = [];
			for(let i = 0, j = this.schedulers.length; i < j; i++) {
				let s = this.schedulers[i];
				
				if(s.taskName === '' && s.intervalType !== 'once')
					out.push(s);
			}
			return out;
		},
		
		// stores
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		pgFunctionIdMap:function() { return this.$store.getters['schema/pgFunctionIdMap']; },
		capApp:         function() { return this.$store.getters.captions.admin.scheduler; },
		capGen:         function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getCaption,
		getCaptionForModule,
		getStringFilled,
		getUnixFormat,
		
		// presentation
		displayTime:function(unixTime) {
			if(unixTime === 0)
				return '-';
			
			return this.getUnixFormat(unixTime,'Y-m-d H:i:S');
		},
		displayName:function(name) {
			if(typeof this.capApp.names[name] === 'undefined')
				return name;
			
			return this.capApp.names[name];
		},
		displayModuleName:function(pgFunctionId) {
			let m = this.moduleIdMap[this.pgFunctionIdMap[pgFunctionId].moduleId];
			return this.getCaptionForModule(m.captions.moduleTitle,m.name,m);
		},
		displayFunctionName:function(pgFunctionId) {
			let f = this.pgFunctionIdMap[pgFunctionId];
			
			return this.getCaption(f.captions.pgFunctionTitle,f.name);
		},
		displaySchedule:function(pgFunctionId,pgFunctionScheduleId) {
			let f = this.pgFunctionIdMap[pgFunctionId];
			let s = null;
			
			for(let i = 0, j = f.schedules.length; i < j; i++) {
				if(f.schedules[i].id === pgFunctionScheduleId) {
					s = f.schedules[i];
					break;
				}
			}
			
			if(s === null)
				return '';
			
			let parts    = [];
			let typeName = '';
			
			switch(s.intervalType) {
				case 'days':    typeName = this.capApp.intervalTypeDays;    break;
				case 'hours':   typeName = this.capApp.intervalTypeHours;   break;
				case 'minutes': typeName = this.capApp.intervalTypeMinutes; break;
				case 'months':  typeName = this.capApp.intervalTypeMonths;  break;
				case 'seconds': typeName = this.capApp.intervalTypeSeconds; break;
				case 'weeks':   typeName = this.capApp.intervalTypeWeeks;   break;
				case 'years':   typeName = this.capApp.intervalTypeYears;   break;
			}
			
			parts.push(this.capApp.scheduleLine
				.replace('{TYPE}',typeName)
				.replace('{VALUE}',s.intervalValue)
			);
			
			switch(s.intervalType) {
				case 'months': parts.push(this.capApp.scheduleLineDayMonths.replace('{DAY}',s.atDay+1)); break;
				case 'weeks':  parts.push(this.capApp.scheduleLineDayWeeks.replace('{DAY}',s.atDay));    break;
				case 'years':  parts.push(this.capApp.scheduleLineDayYears.replace('{DAY}',s.atDay));    break;
			}
			
			if(['days','weeks','months','years'].includes(s.intervalType))
				parts.push(this.capApp.scheduleLineTime
					.replace('{HH}',this.getStringFilled(s.atHour,2,'0'))
					.replace('{MM}',this.getStringFilled(s.atMinute,2,'0'))
					.replace('{SS}',this.getStringFilled(s.atSecond,2,'0'))
				);
			
			return parts.join(', ');
		},
		
		// backend calls
		get:function() {
			ws.send('scheduler','get',{},true).then(
				(res) => {
					this.schedulers      = res.payload;
					this.schedulersInput = JSON.parse(JSON.stringify(this.schedulers));
				},
				(err) => this.$root.genericError(err)
			);
		},
		runPgFunction:function(pgFunctionId,pgFunctionScheduleId) {
			ws.send('scheduler','trigger',{
				pgFunctionId:pgFunctionId,
				pgFunctionScheduleId:pgFunctionScheduleId
			},true).then(
				(res) => this.runOk(),
				(err) => this.$root.genericError(err)
			);
			this.taskRunning = true;
		},
		runSystemTask:function(name) {
			ws.send('scheduler','trigger',{systemTaskName:name},true).then(
				(res) => this.runOk(),
				(err) => this.$root.genericError(err)
			);
			this.taskRunning = true;
		},
		runOk:function() {
			this.taskRunning = false;
			this.get();
		},
		set:function() {
			let requests = [];
			for(let i = 0, j = this.schedulersInput.length; i < j; i++) {
				let s = this.schedulersInput[i];
				
				if(s.taskName !== '' && JSON.stringify(s) === JSON.stringify(this.schedulers[i]))
					continue;
				
				requests.push(ws.prepare('task','set',{
					active:s.active,
					interval:s.intervalValue,
					name:s.taskName
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				res => {
					this.get();
					
					ws.send('scheduler','reload',{},false).then(
						res => {},
						err => this.$root.genericError(err)
					);
				},
				err => this.$root.genericError(err)
			);
		}
	}
};