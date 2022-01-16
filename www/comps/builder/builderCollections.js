import {getQueryTemplate} from '../shared/query.js';
export {MyBuilderCollections as default};

let MyBuilderCollectionsItem = {
	name:'my-builder-collections-item',
	template:`<tbody>
		<tr>
			<td>
				<my-button image="open.png"
					v-if="!isNew"
					@trigger="open"
				/>
			</td>
			<td>
				<input class="long"
					v-model="name"
					:placeholder="isNew ? capApp.new : ''"
				/>
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="showInfo"
					:active="!isNew"
				/>
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
		</tr>
	</tbody>`,
	props:{
		module:    { type:Object, required:true },
		collection:{ type:Object, required:false,
			default:function() { return{
				id:null,
				moduleId:null,
				name:'',
				columns:[],
				query:null
			}}
		}
	},
	data:function() {
		return {
			name:this.collection.name
		};
	},
	computed:{
		// simple states
		hasChanges:function() { return this.name !== this.collection.name; },
		isNew:     function() { return this.collection.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.collection; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getQueryTemplate,
		
		// actions
		open:function() {
			this.$router.push('/builder/collection/'+this.collection.id);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.collection.id,
				captionTop:this.collection.name,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
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
				(res) => this.$root.schemaReload(this.module.id),
				(err) => this.$root.genericError(err)
			);
		},
		set:function() {
			let query = JSON.parse(JSON.stringify(this.collection.query));
			if(query === null)
				query = this.getQueryTemplate();
			
			ws.send('collection','set',{
				id:this.collection.id,
				moduleId:this.module.id,
				name:this.name,
				
				// not changable values on this interface
				columns:this.collection.columns,
				query:query
			},true).then(
				(res) => {
					if(this.isNew)
						this.name = '';
					
					this.$root.schemaReload(this.module.id);
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};

let MyBuilderCollections = {
	name:'my-builder-collections',
	components:{MyBuilderCollectionsItem},
	template:`<div class="builder-collections contentBox grow">
		
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
						<th></th>
					</tr>
				</thead>
				
				<!-- new collection -->
				<my-builder-collections-item
					:module="module"
				/>
				
				<!-- existing collections -->
				<my-builder-collections-item
					v-for="c in module.collections"
					:collection="c"
					:key="c.id"
					:module="module"
				/>
			</table>
		</div>
	</div>`,
	props:{
		id:{ type:String, required:true }
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