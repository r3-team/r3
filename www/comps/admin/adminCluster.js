import {
	getUnixFormat,
	getUnixFromDate
} from '../shared/time.js';
export {MyAdminCluster as default};

let MyAdminClusterNode = {
	name:'my-admin-cluster-node',
	template:`<div class="admin-cluster-node shade">
		<img class="server" src="images/server.png"
			:class="{ missing:isMissing }"
		/>
		
		<!-- node status -->
		<img v-if="!isMissing" class="status ok"      src="images/circle_ok.png" />
		<img v-if="isMissing"  class="status missing" src="images/circle_question.png" />
		
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
						@trigger="$emit('setName',nameInput)"
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
	emits:['setName'],
	props:{
		dateCheckIn: { type:Number, required:true },
		dateStarted: { type:Number, required:true },
		hostname:    { type:String, required:true },
		id:          { type:String, required:true },
		name:        { type:String, required:true },
		statMemory:  { type:Number, required:true },
		statSessions:{ type:Number, required:true }
	},
	computed:{
		isMissing:function() {
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
			
			<!-- cluster master -->
			<div class="master" v-if="nodeIndexMaster !== -1">
				<h2>{{ capApp.master }}</h2>
				<my-admin-cluster-node class="master"
					@setName="setName(nodes[nodeIndexMaster].id,$event)"
					:dateCheckIn="nodes[nodeIndexMaster].dateCheckIn"
					:dateStarted="nodes[nodeIndexMaster].dateStarted"
					:hostname="nodes[nodeIndexMaster].hostname"
					:id="nodes[nodeIndexMaster].id"
					:name="nodes[nodeIndexMaster].name"
					:statMemory="nodes[nodeIndexMaster].statMemory"
					:statSessions="nodes[nodeIndexMaster].statSessions"
				/>
			</div>
			
			<!-- cluster nodes -->
			<template v-if="nodes.length > 1">
				<h2>{{ capApp.nodes }}</h2>
				<div class="nodes">
					<my-admin-cluster-node
						v-for="n in nodes.filter(v => !v.clusterMaster)"
						@setName="setName(n.id,$event)"
						:dateCheckIn="n.dateCheckIn"
						:dateStarted="n.dateStarted"
						:hostname="n.hostname"
						:id="n.id"
						:name="n.name"
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
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	data:function() {
		return {
			nodes:[]
		};
	},
	mounted:function() {
		this.get();
	},
	methods:{
		// backend calls
		get:function() {
			this.nodes = [];
			ws.send('cluster','getNodes',{},true).then(
				res => this.nodes = res.payload,
				this.$root.genericError
			);
		},
		setName:function(id,name) {
			ws.send('cluster','setNode',{
				id:id,
				name:name
			},true).then(
				this.get,
				this.$root.genericError
			);
		}
	}
};