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
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
		
			<!-- cluster master schedules -->
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
							<th colspan="2">{{ capGen.active }}</th>
						</tr>
					</thead>
					<tbody>
						<template v-for="(s,i) in schedulersInput.filter(v => v.taskName !== '')">
							<tr v-if="s.clusterMasterOnly">
								<td>{{ displayName(s.taskName) }}</td>
								<td><input class="short" v-model.number="schedulersInput[i].intervalValue" /></td>
								<td>{{ displayTime(s.dateAttempt) }}</td>
								<td>{{ displayTime(s.dateSuccess) }}</td>
								<td>
									<my-bool
										v-if="!schedulersInput[i].activeOnly"
										v-model="schedulersInput[i].active"
									/>
								</td>
								<td>
									<my-button image="clock.png"
										@trigger="runSystemTask(s.taskName)"
										:active="schedulers[i].active"
										:caption="capApp.button.runNow"
									/>
								</td>
							</tr>
						</template>
					</tbody>
				</table>
			</div>
			
			<!-- cluster node schedules -->
			<div class="contentPart full">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.systemTasksNode }}</h1>
				</div>
				
				<table class="table-default default-inputs shade">
					<thead>
						<tr>
							<th colspan="2">{{ capGen.name }}</th>
							<th>{{ capApp.intervalSeconds }}</th>
							<th>{{ capApp.dateAttempt }}</th>
							<th>{{ capApp.dateSuccess }}</th>
							<th colspan="2">{{ capGen.active }}</th>
						</tr>
					</thead>
					<tbody>
						<template v-for="(s,i) in schedulersInput.filter(v => v.taskName !== '')">
							<template v-if="!s.clusterMasterOnly">
								<tr>
									<td class="minimum">
										<my-button
											@trigger="expandScheduler(i)"
											:image="schedulersExpanded.includes(i) ? 'triangleDown.png' : 'triangleRight.png'"
											:naked="true"
											:tight="true"
										/>
									</td>
									<td>{{ displayName(s.taskName) }}</td>
									<td><input class="short" v-model.number="schedulersInput[i].intervalValue" /></td>
									<td>{{ displayTime(s.dateAttempt) }}</td>
									<td>{{ displayTime(s.dateSuccess) }}</td>
									<td>
										<my-bool
											v-if="!schedulersInput[i].activeOnly"
											v-model="schedulersInput[i].active"
										/>
									</td>
									<td>
										<my-button image="clock.png"
											@trigger="runSystemTask(s.taskName)"
											:active="schedulers[i].active"
											:caption="capApp.button.runNow"
											:captionTitle="capApp.button.runNowHint"
										/>
									</td>
								</tr>
								<tr v-if="schedulersExpanded.includes(i)" v-for="meta in s.nodeMeta">
									<td></td>
									<td colspan="2">{{ meta.name }}</td>
									<td>{{ displayTime(meta.dateAttempt) }}</td>
									<td>{{ displayTime(meta.dateSuccess) }}</td>
									<td colspan="3"></td>
								</tr>
							</template>
						</template>
					</tbody>
				</table>
			</div>
			
			<!-- module schedules -->
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
			schedulersExpanded:[] // indexes of schedules that show all nodes
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
			return unixTime === 0 ? '-' : this.getUnixFormat(unixTime,'Y-m-d H:i:S');
		},
		displayName:function(name) {
			return typeof this.capApp.names[name] === 'undefined'
				? name : this.capApp.names[name];
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
		expandScheduler:function(i) {
			let pos = this.schedulersExpanded.indexOf(i);
			
			if(pos === -1) this.schedulersExpanded.push(i);
			else           this.schedulersExpanded.splice(pos,1);
		},
		
		// backend calls
		get:function() {
			ws.send('scheduler','get',{},true).then(
				res => {
					this.schedulers      = res.payload;
					this.schedulersInput = JSON.parse(JSON.stringify(this.schedulers));
				},
				this.$root.genericError
			);
		},
		runPgFunction:function(pgFunctionId,pgFunctionScheduleId) {
			ws.send('task','run',{
				clusterMasterOnly:true,
				pgFunctionId:pgFunctionId,
				pgFunctionScheduleId:pgFunctionScheduleId
			},true).then(
				() => {},
				this.$root.genericError
			);
		},
		runSystemTask:function(name,clusterMasterOnly) {
			ws.send('task','run',{
				clusterMasterOnly:clusterMasterOnly,
				taskName:name
			},true).then(
				() => {},
				this.$root.genericError
			);
		},
		set:function() {
			let requests = [];
			for(let i = 0, j = this.schedulersInput.length; i < j; i++) {
				let s = this.schedulersInput[i];
				
				if(s.taskName === '' || JSON.stringify(s) === JSON.stringify(this.schedulers[i]))
					continue;
				
				requests.push(ws.prepare('task','set',{
					active:s.active,
					interval:s.intervalValue,
					name:s.taskName
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				() => {
					this.get();
					
					ws.send('task','informChanged',{},false).then(
						() => {},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		}
	}
};