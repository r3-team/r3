import {
	getUnixFormat,
	getUnixFromDate
} from '../shared/time.js';
export {MyAdminCluster as default};

let MyAdminClusterNode = {
	name:'my-admin-cluster-node',
	template:`<div class="admin-cluster-node shade">
		<img class="server" src="images/server.png"
			:class="{ missing:!available }"
		/>
		
		<!-- node status -->
		<div class="icons left">
			<img class="status running" src="images/circle_ok.png"
				v-if="available"
				:title="displayTitle"
			/>
			<img class="status offline" src="images/circle_cancel.png"
				v-if="!running"
				:title="displayTitle"
			/>
			<img class="status missing" src="images/circle_question.png"
				v-if="running && missing"
				:title="displayTitle"
			/>
		</div>
		<div class="icons">
			<my-button image="logoff.png"
				v-if="available"
				@trigger="shutdownAsk"
				:active="licenseValid"
				:cancel="true"
			/>
			<my-button image="delete.png"
				v-if="!available"
				@trigger="delAsk"
				:active="licenseValid"
				:cancel="true"
			/>
		</div>
		
		<table>
			<tr>
				<td class="node-id" colspan="3"><b>{{ id }}</b></td>
			</tr>
			<tr class="default-inputs">
				<td>{{ capGen.name }}</td>
				<td>
					<div class="row gap centered">
						<input v-model="nameInput" :disabled="!licenseValid" />
						<my-button image="save.png"
							@trigger="$emit('set',nameInput)"
							:active="name !== nameInput"
						/>
					</div>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.hostname }}</td>
				<td><b>{{ hostname }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.dateCheckIn }}</td>
				<td><b>{{ displayDate(dateCheckIn) }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.dateStarted }}</td>
				<td><b>{{ displayDate(dateStarted) }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.statMemory }}</td>
				<td><b>{{ statMemory }} MB</b></td>
			</tr>
			<tr>
				<td>{{ capApp.statSessions }}</td>
				<td><b>{{ statSessions }}</b></td>
			</tr>
		</table>
	</div>`,
	emits:['del','set','shutdown'],
	props:{
		dateCheckIn: { type:Number,  required:true },
		dateStarted: { type:Number,  required:true },
		hostname:    { type:String,  required:true },
		id:          { type:String,  required:true },
		name:        { type:String,  required:true },
		running:     { type:Boolean, required:true },
		statMemory:  { type:Number,  required:true },
		statSessions:{ type:Number,  required:true }
	},
	computed:{
		available:(s) => s.running && !s.missing,
		displayTitle:(s) => {
			if(!s.running) return s.capApp.title.offline;
			if(!s.missing) return s.capApp.title.connected;
			return s.capApp.title.missing;
		},
		missing:(s) => {
			return s.dateCheckIn + parseInt(s.config.clusterNodeMissingAfter) < s.getUnixFromDate(new Date());
		},
		
		// stores
		capApp:      (s) => s.$store.getters.captions.admin.cluster,
		capGen:      (s) => s.$store.getters.captions.generic,
		config:      (s) => s.$store.getters.config,
		licenseValid:(s) => s.$store.getters.licenseValid,
		settings:    (s) => s.$store.getters.settings
	},
	data() {
		return {
			nameInput:this.name
		};
	},
	methods:{
		// externals
		getUnixFormat,
		getUnixFromDate,
		
		// presentation
		displayDate(date) {
			return this.getUnixFormat(date,[this.settings.dateFormat,'H:i:S'].join(' '));
		},
		
		// actions
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:() => { this.$emit('del'); },
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		shutdownAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.shutdown,
				buttons:[{
					cancel:true,
					caption:this.capApp.button.shutdown,
					exec:() => { this.$emit('shutdown'); },
					image:'logoff.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		}
	}
};

let MyAdminCluster = {
	name:'my-admin-cluster',
	components:{ MyAdminClusterNode },
	template:`<div class="admin-cluster contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/cluster.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="setConfig"
					:active="config.clusterNodeMissingAfter !== configInput.clusterNodeMissingAfter"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content">
			<div class="contentPartHeader">
				<img class="icon" src="images/settings.png" />
				<h1>{{ capApp.title.config }}</h1>
			</div>
			<table>
				<tr class="default-inputs">
					<td>{{ capApp.configNodeMissing }}</td>
					<td>
						<input
							v-model="configInput.clusterNodeMissingAfter"
							:disabled="!licenseValid"
						/>
					</td>
				</tr>
			</table>
			
			<br />
			
			<!-- cluster master -->
			<div class="master" v-if="nodeIndexMaster !== -1">
				<h2>{{ capApp.title.master }}</h2>
				<my-admin-cluster-node
					@del="del(nodes[nodeIndexMaster].id)"
					@set="set(nodes[nodeIndexMaster].id,$event)"
					@shutdown="shutdown(nodes[nodeIndexMaster].id)"
					:dateCheckIn="nodes[nodeIndexMaster].dateCheckIn"
					:dateStarted="nodes[nodeIndexMaster].dateStarted"
					:hostname="nodes[nodeIndexMaster].hostname"
					:id="nodes[nodeIndexMaster].id"
					:name="nodes[nodeIndexMaster].name"
					:running="nodes[nodeIndexMaster].running"
					:statMemory="nodes[nodeIndexMaster].statMemory"
					:statSessions="nodes[nodeIndexMaster].statSessions"
				/>
			</div>
			
			<!-- cluster nodes -->
			<template v-if="nodes.length > 1">
				<h2>{{ capApp.title.nodes }}</h2>
				<div class="nodes">
					<my-admin-cluster-node
						v-for="n in nodes.filter(v => !v.clusterMaster)"
						@del="del(n.id)"
						@set="set(n.id,$event)"
						@shutdown="shutdown(n.id)"
						:dateCheckIn="n.dateCheckIn"
						:dateStarted="n.dateStarted"
						:hostname="n.hostname"
						:id="n.id"
						:name="n.name"
						:running="n.running"
						:statMemory="n.statMemory"
						:statSessions="n.statSessions"
					/>
				</div>
			</template>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		menuTitle:{ type:String, required:true }
	},
	computed:{
		nodeIndexMaster:(s) => {
			for(let i = 0, j = s.nodes.length; i < j; i++) {
				if(s.nodes[i].clusterMaster)
					return i;
			}
			return -1;
		},
		
		// stores
		capApp:      (s) => s.$store.getters.captions.admin.cluster,
		capGen:      (s) => s.$store.getters.captions.generic,
		config:      (s) => s.$store.getters.config,
		licenseValid:(s) => s.$store.getters.licenseValid
	},
	data() {
		return {
			configInput:{},
			nodes:[]
		};
	},
	mounted() {
		this.reset();
		this.$store.commit('pageTitle',this.menuTitle);
		this.$emit('hotkeysRegister',[{fnc:this.setConfig,key:'s',keyCtrl:true}]);
	},
	methods:{
		// actions
		reset() {
			this.configInput = JSON.parse(JSON.stringify(this.config));
			this.get();
		},
		
		// backend calls,
		del(id) {
			ws.send('cluster','delNode',{id:id},true).then(
				this.get,
				this.$root.genericError
			);
		},
		get() {
			this.nodes = [];
			ws.send('cluster','getNodes',{},true).then(
				res => this.nodes = res.payload,
				this.$root.genericError
			);
		},
		set(id,name) {
			ws.send('cluster','setNode',{
				id:id,
				name:name
			},true).then(
				this.get,
				this.$root.genericError
			);
		},
		setConfig() {
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		},
		shutdown(id) {
			ws.send('cluster','shutdownNode',{id:id},true).then(
				() => {},
				this.$root.genericError
			);
		}
	}
};