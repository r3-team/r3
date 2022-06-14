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
		<div class="icons">
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
			
			<my-button image="logoff.png"
				v-if="available"
				@trigger="shutdownAsk"
				:naked="true"
				:tight="true"
			/>
			<my-button image="delete.png"
				v-if="!available"
				@trigger="delAsk"
				:naked="true"
				:tight="true"
			/>
		</div>
		
		<table>
			<tr>
				<td class="node-id" colspan="3"><b>{{ id }}</b></td>
			</tr>
			<tr class="default-inputs">
				<td>{{ capGen.name }}</td>
				<td><input v-model="nameInput" /></td>
				<td>
					<my-button image="save.png"
						v-if="name !== nameInput"
						@trigger="$emit('set',nameInput)"
						:naked="true"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.hostname }}</td>
				<td colspan="2"><b>{{ hostname }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.dateCheckIn }}</td>
				<td colspan="2"><b>{{ displayDate(dateCheckIn) }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.dateStarted }}</td>
				<td colspan="2"><b>{{ displayDate(dateStarted) }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.statMemory }}</td>
				<td colspan="2"><b>{{ statMemory }} MB</b></td>
			</tr>
			<tr>
				<td>{{ capApp.statSessions }}</td>
				<td colspan="2"><b>{{ statSessions }}</b></td>
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
		available:function() {
			return this.running && !this.missing;
		},
		displayTitle:function() {
			if(!this.running) return this.capApp.title.offline;
			if(!this.missing) return this.capApp.title.connected;
			return this.capApp.title.missing;
		},
		missing:function() {
			return this.dateCheckIn + parseInt(this.config.clusterNodeMissingAfter) < this.getUnixFromDate(new Date());
		},
		
		// stores
		capApp:  function() { return this.$store.getters.captions.admin.cluster; },
		capGen:  function() { return this.$store.getters.captions.generic; },
		config:  function() { return this.$store.getters.config; },
		settings:function() { return this.$store.getters.settings; }
	},
	data:function() {
		return {
			nameInput:this.name
		};
	},
	methods:{
		// externals
		getUnixFormat,
		getUnixFromDate,
		
		// presentation
		displayDate:function(date) {
			return this.getUnixFormat(date,[this.settings.dateFormat,'H:i:S'].join(' '));
		},
		
		// actions
		delAsk:function() {
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
		shutdownAsk:function() {
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
			<my-button image="refresh.png"
				@trigger="get"
				:caption="capGen.button.refresh"
				:darkBg="true"
			/>
		</div>
		
		<div class="content">
			
			<div class="contentPart config">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.title.config }}</h1>
				</div>
				<table>
					<tr class="default-inputs">
						<td>{{ capApp.configNodeMissing }}</td>
						<td><input v-model="configInput.clusterNodeMissingAfter" /></td>
					</tr>
				</table>
				
				<div>
					<my-button image="save.png"
						@trigger="setConfig"
						:active="config.clusterNodeMissingAfter !== configInput.clusterNodeMissingAfter"
						:caption="capGen.button.save"
					/>
				</div>
			</div>
			
			<hr />
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
	props:{
		menuTitle:{ type:String, required:true }
	},
	computed:{
		nodeIndexMaster:function() {
			for(let i = 0, j = this.nodes.length; i < j; i++) {
				if(this.nodes[i].clusterMaster)
					return i;
			}
			return -1;
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.admin.cluster; },
		capGen:function() { return this.$store.getters.captions.generic; },
		config:function() { return this.$store.getters.config; }
	},
	data:function() {
		return {
			configInput:{},
			nodes:[]
		};
	},
	mounted:function() {
		this.configInput = JSON.parse(JSON.stringify(this.config));
		this.get();
	},
	methods:{
		// backend calls,
		del:function(id) {
			ws.send('cluster','delNode',{id:id},true).then(
				this.get,
				this.$root.genericError
			);
		},
		get:function() {
			this.nodes = [];
			ws.send('cluster','getNodes',{},true).then(
				res => this.nodes = res.payload,
				this.$root.genericError
			);
		},
		set:function(id,name) {
			ws.send('cluster','setNode',{
				id:id,
				name:name
			},true).then(
				this.get,
				this.$root.genericError
			);
		},
		setConfig:function() {
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		},
		shutdown:function(id) {
			ws.send('cluster','shutdownNode',{id:id},true).then(
				() => {},
				this.$root.genericError
			);
		}
	}
};