import {getUnixFormat} from '../shared/time.js';
export {MyAdminBackups as default};

let MyAdminBackups = {
	name:'my-admin-backups',
	template:`<div class="admin-backups contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/backup.png" />
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
					@trigger="reset"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content" v-if="ready">
			<div class="contentPartHeader">
				<img class="icon" src="images/settings.png" />
				<h1>{{ capApp.title }}</h1>
			</div>
			
			<table class="default-inputs">
				<tbody>
					<tr class="backup-dir">
						<td>{{ capApp.dir }}</td>
						<td colspan="3"><input v-model="configInput.backupDir" /></td>
					</tr>
					
					<!-- daily -->
					<tr>
						<td>{{ capApp.daily }}</td>
						<td><my-bool-string-number v-model="configInput.backupDaily" /></td>
						
						<template v-if="configInput.backupDaily === '1'">
							<td class="versions">{{ capApp.count }}</td>
							<td><input class="short" v-model="configInput.backupCountDaily" /></td>
						</template>
					</tr>
					
					<!-- weekly -->
					<tr>
						<td>{{ capApp.weekly }}</td>
						<td><my-bool-string-number v-model="configInput.backupWeekly" /></td>
						
						<template v-if="configInput.backupWeekly === '1'">
							<td class="versions">{{ capApp.count }}</td>
							<td><input class="short" v-model="configInput.backupCountWeekly" /></td>
						</template>
					</tr>
					
					<!-- monthly -->
					<tr>
						<td>{{ capApp.monthly }}</td>
						<td><my-bool-string-number v-model="configInput.backupMonthly" /></td>
						
						<template v-if="configInput.backupMonthly === '1'">
							<td class="versions">{{ capApp.count }}</td>
							<td><input class="short" v-model="configInput.backupCountMonthly" /></td>
						</template>
					</tr>
				</tbody>
			</table>
			<div class="note">{{ capApp.dirNote }}</div>
			<br />
			
			<div class="contentPartHeader">
				<img class="icon" src="images/backup.png" />
				<h1>{{ capApp.list }}</h1>
			</div>
			
			<table class="generic-table bright default-inputs shade sets">
				<thead>
					<tr>
						<th>{{ capGen.date }}</th>
						<th>{{ capGen.type }}</th>
						<th>{{ capGen.interval }}</th>
						<th>{{ capGen.version }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="b in backups">
						<td>{{ displayDate(b.timestamp) }}</td>
						<td>{{ capApp.full }}</td>
						<td>{{ capApp[b.jobName] }}</td>
						<td>{{ b.appBuild }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	computed:{
		hasChanges:(s) => s.config.backupDir !== s.configInput.backupDir
			|| s.config.backupDaily        !== s.configInput.backupDaily
			|| s.config.backupWeekly       !== s.configInput.backupWeekly
			|| s.config.backupMonthly      !== s.configInput.backupMonthly
			|| s.config.backupCountDaily   !== s.configInput.backupCountDaily
			|| s.config.backupCountWeekly  !== s.configInput.backupCountWeekly
			|| s.config.backupCountMonthly !== s.configInput.backupCountMonthly,
		
		// stores
		capApp:  (s) => s.$store.getters.captions.admin.backups,
		capGen:  (s) => s.$store.getters.captions.generic,
		config:  (s) => s.$store.getters.config,
		settings:(s) => s.$store.getters.settings
	},
	data() {
		return {
			backups:[],
			configInput:{},
			ready:false
		};
	},
	mounted() {
		this.reset();
		this.$store.commit('pageTitle',this.menuTitle);
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.ready = true;
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	methods:{
		// externals
		getUnixFormat,
		
		// presentation
		displayDate(date) {
			return this.getUnixFormat(date,[this.settings.dateFormat,'H:i:S'].join(' '));
		},
		
		// actions
		reset() {
			this.configInput = JSON.parse(JSON.stringify(this.config));
			this.get();
		},
		
		// backend calls,
		get() {
			this.nodes = [];
			ws.send('backup','get',{},true).then(
				res => this.backups = res.payload.backups.sort((a,b) => b.timestamp - a.timestamp),
				this.$root.genericError
			);
		},
		set() {
			if(!this.hasChanges) return;
			
			ws.send('config','set',this.configInput,true).then(
				() => {}, this.$root.genericError
			);
		}
	}
};