export {MyBuilderRelations as default};

let MyBuilderRelationsItem = {
	name:'my-builder-relations-item',
	template:`<tr>
		<td>
			<my-button image="open.png"
				v-if="!isNew"
				@trigger="open"
			/>
		</td>
		<td>
			<input class="long" v-model="name" :placeholder="isNew ? capApp.newRelation : ''" />
		</td>
		<td>
			<my-button image="visible1.png"
				@trigger="showInfo"
				:active="!isNew"
			/>
		</td>
		<td>
			<input v-model.number="retentionCountInput" :placeholder="capApp.retentionCount" />
		</td>
		<td>
			<input v-model.number="retentionDaysInput" :placeholder="capApp.retentionDays" />
		</td>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="delAsk"
					:cancel="true"
				/>
			</div>
		</td>
	</tr>`,
	props:{
		moduleId:{ type:String, required:true },
		relation:{ type:Object, required:false,
			default:function() { return{
				id:null,
				name:'',
				retentionCount:null,
				retentionDays:null
			}}
		}
	},
	data:function() {
		return {
			name:this.relation.name,
			retentionCount:this.relation.retentionCount,
			retentionDays:this.relation.retentionDays
		};
	},
	computed:{
		hasChanges:function() {
			return this.name !== this.relation.name
				|| this.retentionCount !== this.relation.retentionCount
				|| this.retentionDays !== this.relation.retentionDays
			;
		},
		retentionCountInput:{
			get:function()  { return this.retentionCount; },
			set:function(v) { this.retentionCount = v === '' ? null : v; },
		},
		retentionDaysInput:{
			get:function()  { return this.retentionDays; },
			set:function(v) { this.retentionDays = v === '' ? null : v; },
		},
		
		// simple states
		isNew:function() { return this.relation.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.relation; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		open:function() {
			this.$router.push('/builder/relation/'+this.relation.id);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.relation.id,
				captionTop:this.relation.name,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.deleteRelation,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('relation','del',{
				id:this.relation.id
			},this.delOk);
			trans.send(this.$root.genericError);
		},
		delOk:function(res) {
			this.$root.schemaReload(this.moduleId);
		},
		set:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('relation','set',{
				id:this.relation.id,
				moduleId:this.moduleId,
				name:this.name,
				retentionCount:this.retentionCount,
				retentionDays:this.retentionDays
			},this.setOk);
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			if(this.isNew)
				this.name = '';
			
			this.$root.schemaReload(this.moduleId);
		}
	}
};

let MyBuilderRelations = {
	name:'my-builder-relations',
	components:{MyBuilderRelationsItem},
	template:`<div class="contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.button.open }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.id }}</th>
						<th colspan="2">{{ capApp.retention }}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<!-- new record -->
					<my-builder-relations-item
						:module-id="module.id"
					/>
					
					<!-- existing records -->
					<my-builder-relations-item
						v-for="rel in module.relations"
						:key="rel.id"
						:module-id="module.id"
						:relation="rel"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		id:{ type:String, required:true }
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.relation; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	}
};