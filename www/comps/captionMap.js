import {
	getFieldTitle
} from './shared/field.js';
import {
	getFieldMap
} from './shared/form.js';
export {MyCaptionMap as default};

let MyCaptionMapItemValue = {
	name:'my-caption-map-item-value',
	template:`<td>
		<div class="row wrap gap default-inputs">
			<input class="long"
				v-for="(captions,content) in captionMap"
				@input="$emit('update',content,languageCode,$event.target.value)"
				:placeholder="content"
				:value="typeof captions[languageCode] === 'undefined' ? '' : captions[languageCode]"
			/>
		</div>
	</td>`,
	emits:['update'],
	props:{
		captionMap:  { type:Object, required:true },
		languageCode:{ type:String, required:true }
	}
};

let MyCaptionMapItem = {
	name:'my-caption-map-item',
	components:{ MyCaptionMapItemValue },
	template:`<tr>
		<td>
			<div :style="style">
				<my-button
					@trigger="toggleDisplay(showChildrenIds,item.id)"
					:active="children.length !== 0"
					:caption="actionCaption"
					:image="actionImage"
					:naked="true"
				/>
			</div>
		</td>
		<td v-for="l in languageCodes">
			<my-caption-map-item-value
				v-if="item.capMap !== null"
				@update="(...args) => $emit('update',levelEntities[level],item.id,args[0],args[1],args[2])"
				:captionMap="item.capMap"
				:languageCode="l"
			/>
		</td>
	</tr>
	<my-caption-map-item
		v-if="showChildrenIds.includes(item.id)"
		v-for="child in children"
		@update="(...args) => $emit('update',args[0],args[1],args[2],args[3],args[4])"
		:item="child"
		:languageCodes="languageCodes"
		:level="level + 1"
		:levelEntities="levelEntities"
	/>`,
	emits:['update'],
	props:{
		item:          { type:Object, required:true },
		languageCodes: { type:Array,  required:true },
		level:         { type:Number, required:false, default:0 },
		levelEntities: { type:Array,  required:true }
	},
	data() {
		return {
			showChildrenIds:[]
		};
	},
	computed:{
		actionCaption:(s) => {
			if(s.level >= s.levelEntities.length-1) return s.item.name;
			return `${s.item.name} (${s.item.children.length})`;
		},
		actionImage:(s) => {
			if(s.level >= s.levelEntities.length-1) return '';
			return s.showChildrenIds.includes(s.item.id) ? 'triangleDown.png' : 'triangleRight.png';
		},
		children:(s) => typeof s.item.children !== 'undefined' ? s.item.children : [],
		style:(s) => `margin-left:${s.level * 15}px;`
	},
	methods:{
		toggleDisplay(list,value) {
			const i = list.indexOf(value);
			if(i === -1) list.push(value);
			else         list.splice(i,1);
		}
	}
};

let MyCaptionMap = {
	name:'my-caption-map',
	components:{ MyCaptionMapItem },
	template:`<div class="contentBox grow">
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/languages.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area nowrap">
				<my-button
					v-for="l in module.languages"
					@trigger="toggleDisplay(showLanguageCodes,l)"
					:caption="l"
					:image="showLanguageCodes.includes(l) ? 'checkbox1.png' : 'checkbox0.png'"
					:naked="true"
				/>
			</div>
		</div>
		<div class="content no-padding">
			<div class="captionMap" v-if="module">
				<table class="generic-table">
					<tbody>
						<!-- relations -->
						<tr>
							<td>
								<my-button
									@trigger="toggleDisplay(showEntities,'relations')"
									:caption="capGen.relations + ' (' + captionsAttributesByRelations.length + ')'"
									:image="showEntities.includes('relations') ? 'triangleDown.png' : 'triangleRight.png'"
								/>
							</td>
							<td v-for="l in showLanguageCodes">{{ l }}</td>
						</tr>
						<my-caption-map-item
							v-if="showEntities.includes('relations')"
							v-for="item in captionsAttributesByRelations"
							@update="storeChange"
							:item="item"
							:languageCodes="showLanguageCodes"
							:levelEntities="['relation','attribute']"
						/>
						
						<!-- forms -->
						<tr>
							<td>
								<my-button
									@trigger="toggleDisplay(showEntities,'forms')"
									:caption="capGen.forms + ' (' + captionsFieldsByForms.length + ')'"
									:image="showEntities.includes('forms') ? 'triangleDown.png' : 'triangleRight.png'"
								/>
							</td>
							<td v-for="l in showLanguageCodes">{{ l }}</td>
						</tr>
						<my-caption-map-item
							v-if="showEntities.includes('forms')"
							v-for="item in captionsFieldsByForms"
							@update="storeChange"
							:item="item"
							:languageCodes="showLanguageCodes"
							:levelEntities="['form','field']"
						/>
						
						<!-- menus -->
						<tr>
							<td>
								<my-button
									@trigger="toggleDisplay(showEntities,'menus')"
									:caption="capGen.menus + ' (' + captionsMenus.length + ')'"
									:image="showEntities.includes('menus') ? 'triangleDown.png' : 'triangleRight.png'"
								/>
							</td>
							<td v-for="l in showLanguageCodes">{{ l }}</td>
						</tr>
						<my-caption-map-item
							v-if="showEntities.includes('menus')"
							v-for="item in captionsMenus"
							@update="storeChange"
							:item="item"
							:languageCodes="showLanguageCodes"
							:levelEntities="['menu']"
						/>
						
						<!-- roles -->
						<tr>
							<td>
								<my-button
									@trigger="toggleDisplay(showEntities,'roles')"
									:caption="capGen.roles + ' (' + captionsRoles.length + ')'"
									:image="showEntities.includes('roles') ? 'triangleDown.png' : 'triangleRight.png'"
								/>
							</td>
							<td v-for="l in showLanguageCodes">{{ l }}</td>
						</tr>
						<my-caption-map-item
							v-if="showEntities.includes('roles')"
							v-for="item in captionsRoles"
							@update="storeChange"
							:item="item"
							:languageCodes="showLanguageCodes"
							:levelEntities="['role']"
						/>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		languageDefault:{ required:false, default:null },
		moduleIdForce:  { required:false, default:null }, // used for Builder context, only edits the current module
		target:         { type:String, required:false }   // instance / app
	},
	data() {
		return {
			// data
			captionMap:{},
			
			// states
			changes:[], // change to caption value, key = entity ID (attribute, form, field, etc.)
			hasChanges:false,
			isReady:false,
			moduleId:null,
			showLanguageCodes:[],
			showEntities:[]
		};
	},
	watch:{
		moduleIdForce:{
			handler(v) { this.resetDefaults(); },
			immediate:true
		}
	},
	computed:{
		captionsAttributesByRelations:(s) => {
			if(!s.isReady) return [];
			
			let relIdMap = {};
			for(let atrId in s.captionMap.attributeIdMap) {
				const atr   = s.attributeIdMap[atrId];
				const relId = atr.relationId;
				if(typeof relIdMap[relId] === 'undefined')
					relIdMap[relId] = [];
				
				relIdMap[relId].push({
					capMap:s.captionMap.attributeIdMap[atrId],
					id:atr.id,
					name:atr.name
				});
			}
			
			// return sorted by relation and attribute names
			let relations = [];
			for(let relId in relIdMap) {
				relations.push({
					capMap:null,
					children:relIdMap[relId].sort((a,b) => (a.name > b.name) ? 1 : -1),
					id:relId,
					name:s.relationIdMap[relId].name
				});
			}
			return relations.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsFieldsByForms:(s) => {
			if(!s.isReady) return [];
			
			let frmIdMap = {};
			for(const frm of s.module.forms) {
				const fieldIdMap = s.getFieldMap(frm.fields);
				let fieldCaptions = [];
				
				for(const fldId in fieldIdMap) {
					if(typeof s.captionMap.fieldIdMap[fldId] !== 'undefined')
						fieldCaptions.push({
							capMap:s.captionMap.fieldIdMap[fldId],
							id:fldId,
							name:s.getFieldTitle(fieldIdMap[fldId])
						});
				}
				// form has fields with captions or has captions itself
				if(fieldCaptions.length !== 0 || typeof s.captionMap.formIdMap[frm.id] !== 'undefined')
					frmIdMap[frm.id] = fieldCaptions;
			}
			
			// return sorted by form and field names
			let forms = [];
			for(const frmId in frmIdMap) {
				forms.push({
					capMap:typeof s.captionMap.formIdMap[frmId] !== 'undefined' ? s.captionMap.formIdMap[frmId] : null,
					children:frmIdMap[frmId].sort((a,b) => (a.name > b.name) ? 1 : -1),
					id:frmId,
					name:s.formIdMap[frmId].name
				});
			}
			return forms.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsMenus:(s) => {
			if(!s.isReady) return [];
			
			let out = [];
			for(const id in s.captionMap.menuIdMap) {
				out.push({
					capMap:s.captionMap.menuIdMap[id],
					id:id,
					name:'-'
				});
			}
			return out;
		},
		captionsRoles:(s) => {
			if(!s.isReady) return [];
			
			let out = [];
			for(const id in s.captionMap.roleIdMap) {
				out.push({
					capMap:s.captionMap.roleIdMap[id],
					id:id,
					name:s.roleIdMap[id].name
				});
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		
		// simple
		canSwitchModules:(s) => s.moduleIdForce === null,
		module:          (s) => s.moduleId === null ? false : s.moduleIdMap[s.moduleId],
		
		// stores
		modules:       (s) => s.$store.getters['schema/modules'],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     (s) => s.$store.getters['schema/formIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		roleIdMap:     (s) => s.$store.getters['schema/roleIdMap'],
		capApp:        (s) => s.$store.getters.captions.captionMap,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// external
		getFieldMap,
		getFieldTitle,
		
		// actions
		reset() {
			this.changes    = {};
			this.hasChanges = false;
			this.get();
		},
		resetDefaults() {
			if(this.modules.length === 0)
				return;
			
			this.showRelationIds   = [];
			this.showLanguageCodes = [];
			
			// apply forced or first available module
			if(this.moduleIdForce !== null)
				this.moduleId = this.moduleIdForce;
			else
				this.moduleId = this.modules[0];
			
			const mod = this.moduleIdMap[this.moduleId];
			
			if(mod.languages.length === 0)
				return;
			
			// choose default language
			if(mod.languages.length < 3) {
				this.showLanguageCodes = JSON.parse(JSON.stringify(mod.languages));
			} else {
				if(this.languageDefault !== null)
					this.showLanguageCodes.push(this.languageDefault);
				else
					this.showLanguageCodes.push(mod.languages[0]);
			}
			this.reset();
		},
		storeChange(entity,entityId,content,languageCode,value) {
			this.hasChanges = true;
			this.changes[`${entityId}_${content}_${languageCode}`] = {
				content:content,
				entity:entity,
				entityId:entityId,
				languageCode:languageCode,
				target:this.target,
				value:value
			};
		},
		toggleDisplay(list,value) {
			const i = list.indexOf(value);
			if(i === -1) list.push(value);
			else         list.splice(i,1);
		},
		
		// backend
		get() {
			ws.send('captionMap','get',{
				moduleId:this.moduleId,
				target:this.target
			},true).then(
				res => {
					this.captionMap = res.payload;
					this.isReady    = true;
				},
				this.$root.genericError
			);
		},
		set() {
			let requests = [];
			for(let k in this.changes) {
				requests.push(ws.prepare('captionMap','setOne',this.changes[k]));
			}
			ws.sendMultiple(requests,true).then(
				() => {
					this.$root.schemaReload(this.moduleId);
					this.changes    = {};
					this.hasChanges = false;
				},
				this.$root.genericError
			);
		}
	}
};