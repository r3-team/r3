import MyBuilderIconInput from './builderIconInput.js';
import {getQueryTemplate} from '../shared/query.js';
import {copyValueDialog}  from '../shared/generic.js';
export {MyBuilderCollections as default};

let MyBuilderCollectionsItem = {
	name:'my-builder-collections-item',
	components:{MyBuilderIconInput},
	template:`<tbody>
		<tr>
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && !readonly"
						:caption="isNew ? capGen.button.create : ''"
						:captionTitle="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="open.png"
						v-if="!isNew"
						@trigger="open"
						:captionTitle="capGen.button.open"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</td>
			<td>
				<my-builder-icon-input
					@input="iconId = $event"
					:iconIdSelected="iconId"
					:module="module"
					:readonly="readonly"
				/>
			</td>
			<td>
				<input class="long"
					v-model="name"
					:disabled="readonly"
					:placeholder="isNew ? capApp.new : ''"
				/>
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="copyValueDialog(collection.name,collection.id,collection.id)"
					:active="!isNew"
				/>
			</td>
		</tr>
	</tbody>`,
	props:{
		module:    { type:Object, required:true },
		collection:{ type:Object, required:false,
			default:function() { return{
				id:null,
				iconId:null,
				moduleId:null,
				name:'',
				columns:[],
				query:null,
				inHeader:[]
			}}
		},
		readonly:{ type:Boolean, required:true }
	},
	data:function() {
		return {
			iconId:this.collection.iconId,
			name:this.collection.name
		};
	},
	computed:{
		hasChanges:function() {
			return this.iconId !== this.collection.iconId
				|| this.name   !== this.collection.name;
		},
		
		// simple states
		isNew:function() { return this.collection.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.collection; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		copyValueDialog,
		getQueryTemplate,
		
		// actions
		open:function() {
			this.$router.push('/builder/collection/'+this.collection.id);
		},
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
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
			ws.send('collection','del',{id:this.collection.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set:function() {
			let query = JSON.parse(JSON.stringify(this.collection.query));
			if(query === null)
				query = this.getQueryTemplate();
			
			ws.send('collection','set',{
				id:this.collection.id,
				moduleId:this.module.id,
				iconId:this.iconId,
				name:this.name,
				
				// not changable values on this interface
				columns:this.collection.columns,
				query:query,
				inHeader:this.collection.inHeader
			},true).then(
				() => {
					if(this.isNew)
						this.name = '';
					
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};

let MyBuilderCollections = {
	name:'my-builder-collections',
	components:{MyBuilderCollectionsItem},
	template:`<div class="builder-collections contentBox grow">
		
		<div class="top lower">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.actions }}</th>
						<th>{{ capGen.icon }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.id }}</th>
					</tr>
				</thead>
				
				<!-- new collection -->
				<my-builder-collections-item
					:module="module"
					:readonly="readonly"
				/>
				
				<!-- existing collections -->
				<my-builder-collections-item
					v-for="c in module.collections"
					:collection="c"
					:key="c.id"
					:module="module"
					:readonly="readonly"
				/>
			</table>
		</div>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	computed:{
		module:function() {
			return typeof this.moduleIdMap[this.id] === 'undefined'
				? false : this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.collection; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	}
};