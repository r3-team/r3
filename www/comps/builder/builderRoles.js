import MyBuilderCaption      from './builderCaption.js';
import {getDependentModules} from '../shared/builder.js';
export {MyBuilderRoles as default};

let MyBuilderRolesItem = {
	name:'my-builder-roles-item',
	components:{MyBuilderCaption},
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
					:placeholder="isNew ? capApp.newRole : ''"
					:disabled="isEveryone"
				/>
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="showInfo"
					:active="!isNew"
				/>
			</td>
			<td>
				<my-builder-caption
					v-model="captions.roleTitle"
					:language="builderLanguage"
					:readonly="isEveryone"
				/>
			</td>
			<td>
				<my-builder-caption
					v-model="captions.roleDesc"
					:language="builderLanguage"
					:readonly="isEveryone"
				/>
			</td>
			<td>
				<my-bool
					v-model="assignable"
					:readonly="isEveryone"
				/>
			</td>
			<td>
				<my-button
					v-if="!isEveryone"
					@trigger="showChildren = !showChildren"
					:caption="String(childrenIds.length)"
				/>
				<my-button caption="-"
					v-if="isEveryone"
					:active="false"
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
						:active="!isEveryone"
						:cancel="true"
					/>
				</div>
			</td>
		</tr>
		
		<tr v-if="showChildren">
			<td colspan="999">
				<div class="role-children">
					
					<div class="role-child-add">
						<span>{{ capGen.button.add }}</span>
						<select
							@change="addChild($event.target.value)"
							:value="null"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="mod in getDependentModules(module,modules)"
								:label="mod.name"
							>
								<option
									v-for="r in mod.roles.filter(v => v.id !== role.id && !childrenIds.includes(v.id) && v.name !== 'everyone')"
									:value="r.id"
								>
									{{ r.name }}
								</option>
							</optgroup>
						</select>
					</div>
					
					<div class="role-child" v-for="c in childrenIds">
						<my-button image="cancel.png"
							@trigger="removeChild(c)"
							:naked="true"
						/>
						<my-button
							:caption="moduleIdMap[roleIdMap[c].moduleId].name + '->' + roleIdMap[c].name"
							:naked="true"
						/>
					</div>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String, required:true },
		moduleId:       { type:String, required:true },
		role:           { type:Object, required:false,
			default:function() { return{
				id:null,
				name:'',
				assignable:true,
				childrenIds:[],
				captions:{
					roleTitle:{},
					roleDesc:{}
				},
				accessRelations:{},
				accessAttributes:{},
				accessMenus:{}
			}}
		}
	},
	data:function() {
		return {
			name:this.role.name,
			assignable:this.role.assignable,
			childrenIds:JSON.parse(JSON.stringify(this.role.childrenIds)),
			captions:JSON.parse(JSON.stringify(this.role.captions)),
			
			// states
			showChildren:false
		};
	},
	computed:{
		hasChanges:function() {
			return this.name !== this.role.name
				|| this.assignable !== this.role.assignable
				|| JSON.stringify(this.childrenIds) !== JSON.stringify(this.role.childrenIds)
				|| JSON.stringify(this.captions)    !== JSON.stringify(this.role.captions)
			;
		},
		
		// simple states
		isEveryone:  function() { return this.role.name === 'everyone' },
		isNew:       function() { return this.role.id === null; },
		captionDesc: function() { return this.capRolDesc[this.role.id]; },
		captionTitle:function() { return this.capRolTitle[this.role.id]; },
		
		// stores
		module:     function() { return this.moduleIdMap[this.moduleId]; },
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		roleIdMap:  function() { return this.$store.getters['schema/roleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.role; },
		capGen:     function() { return this.$store.getters.captions.generic; },
		settings:   function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getDependentModules,
		
		// actions
		open:function() {
			this.$router.push('/builder/role/'+this.role.id);
		},
		addChild:function(id) {
			this.childrenIds.push(id);
		},
		removeChild:function(id) {
			let pos = this.childrenIds.indexOf(id);
			if(pos !== -1)
				this.childrenIds.splice(pos,1);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.role.id,
				captionTop:this.role.name,
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
			ws.send('role','del',{id:this.role.id},true).then(
				(res) => {
					this.$root.schemaReload(this.moduleId);
					this.$root.loginReauthAll(false);
				},
				(err) => this.$root.genericError(err)
			);
		},
		set:function() {
			ws.send('role','set',{
				id:this.role.id,
				moduleId:this.moduleId,
				childrenIds:this.childrenIds,
				name:this.name,
				assignable:this.assignable,
				captions:this.captions,
				
				// not changable values on this interface
				accessRelations:this.role.accessRelations,
				accessAttributes:this.role.accessAttributes,
				accessMenus:this.role.accessMenus
			},true).then(
				(res) => {
					if(this.isNew)
						this.name = '';
					
					this.$root.schemaReload(this.moduleId);
					this.$root.loginReauthAll(false);
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};

let MyBuilderRoles = {
	name:'my-builder-roles',
	components:{MyBuilderRolesItem},
	template:`<div class="builder-roles contentBox grow">
		
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
						<th>{{ capGen.title }}</th>
						<th>{{ capGen.description }}</th>
						<th>{{ capApp.assignable }}</th>
						<th>{{ capApp.children }}</th>
						<th></th>
					</tr>
				</thead>
				
				<!-- new role -->
				<my-builder-roles-item
					:builder-language="builderLanguage"
					:module-id="module.id"
				/>
				
				<!-- existing roles -->
				<my-builder-roles-item
					v-for="rol in module.roles"
					:builder-language="builderLanguage"
					:key="rol.id"
					:module-id="module.id"
					:role="rol"
				/>
			</table>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.role; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	}
};