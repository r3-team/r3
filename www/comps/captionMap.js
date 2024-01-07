import {getColumnTitle} from './shared/column.js';
import {getFieldTitle}  from './shared/field.js';
import {getFieldMap}    from './shared/form.js';
export {MyCaptionMap as default};

let MyCaptionMapItemValue = {
	name:'my-caption-map-item-value',
	template:`<td>
		<div class="row wrap gap default-inputs">
			<input class="long"
				v-for="(captions,content) in captionMap"
				@input="$emit('update',content,languageCode,$event.target.value)"
				:disabled="readonly"
				:placeholder="content"
				:value="typeof captions[languageCode] === 'undefined' ? '' : captions[languageCode]"
			/>
		</div>
	</td>`,
	emits:['update'],
	props:{
		captionMap:  { type:Object,  required:true },
		languageCode:{ type:String,  required:true },
		readonly:    { type:Boolean, required:true }
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
				@update="(...args) => $emit('update',item.entity,item.id,args[0],args[1],args[2])"
				:captionMap="item.capMap"
				:languageCode="l"
				:readonly="readonly"
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
		:levelMax="levelMax"
		:readonly="readonly"
	/>`,
	emits:['update'],
	props:{
		item:         { type:Object,  required:true },
		languageCodes:{ type:Array,   required:true },
		level:        { type:Number,  required:false, default:0 },
		levelMax:     { type:Number , required:true },
		readonly:     { type:Boolean, required:true }
	},
	data() {
		return {
			showChildrenIds:[]
		};
	},
	computed:{
		actionCaption:(s) => {
			if(s.level >= s.levelMax) return s.item.name;
			return `${s.item.name} (${s.item.children.length})`;
		},
		actionImage:(s) => {
			if(s.level >= s.levelMax) return '';
			return s.showChildrenIds.includes(s.item.id) ? 'triangleDown.png' : 'triangleRight.png';
		},
		children:(s) => typeof s.item.children !== 'undefined' ? s.item.children : [],
		style:(s) => `margin-left:${s.level * 20}px;`
	},
	methods:{
		toggleDisplay(list,value) {
			const i = list.indexOf(value);
			if(i === -1) list.push(value);
			else         list.splice(i,1);
		}
	}
};

let MyCaptionMapItems = {
	name:'my-caption-map-items',
	components:{ MyCaptionMapItem },
	template:`<tr>
		<td>
			<my-button
				@trigger="show = !show"
				:active="items.length !== 0"
				:caption="name + ' (' + items.length + ')'"
				:images="[show ? 'triangleDown.png' : 'triangleRight.png',icon]"
			/>
		</td>
		<td v-for="l in languageCodes"></td>
	</tr>
	<my-caption-map-item
		v-if="show"
		v-for="item in items"
		@update="(...args) => $emit('update',...args)"
		:item="item"
		:languageCodes="languageCodes"
		:levelMax="levelMax"
		:readonly="readonly"
	/>`,
	emits:['update'],
	props:{
		icon:         { type:String,  required:true },
		items:        { type:Array,   required:true },
		languageCodes:{ type:Array,   required:true },
		levelMax:     { type:Number,  required:false, default:0 },
		name:         { type:String,  required:true },
		readonly:     { type:Boolean, required:true }
	},
	data() {
		return {
			show:false
		};
	}
};

let MyCaptionMap = {
	name:'my-caption-map',
	components:{
		MyCaptionMapItems,
		MyCaptionMapItemValue
	},
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
			<div class="captionMap" v-if="isReady && module">
				<table class="generic-table sticky-top">
					<thead>
						<tr>
							<th></th>
							<th v-for="l in showLanguageCodes">{{ l }}</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<my-button image="module.png"
									:active="false"
									:caption="capGen.module"
									:naked="true"
								/>
							</td>
							<td v-for="l in showLanguageCodes">
								<my-caption-map-item-value
									@update="(...args) => storeChange('module',moduleId,args[0],args[1],args[2])"
									:captionMap="captionMap.moduleIdMap[moduleId]"
									:languageCode="l"
									:readonly="readonly"
								/>
							</td>
						</tr>
						
						<!-- relations -->
						<my-caption-map-items icon="database.png"
							@update="storeChange"
							:items="captionsAttributesByRelations"
							:languageCodes="showLanguageCodes"
							:levelMax="1"
							:name="capGen.relations"
							:readonly="readonly"
						/>
						<!-- forms -->
						<my-caption-map-items icon="fileText.png"
							@update="storeChange"
							:items="captionsFieldsByForms"
							:languageCodes="showLanguageCodes"
							:levelMax="2"
							:name="capGen.forms"
							:readonly="readonly"
						/>
						<!-- menus -->
						<my-caption-map-items icon="menu.png"
							@update="storeChange"
							:items="captionsMenus"
							:languageCodes="showLanguageCodes"
							:name="capGen.menus"
							:readonly="readonly"
						/>
						<!-- roles -->
						<my-caption-map-items icon="personMultiple.png"
							@update="storeChange"
							:items="captionsRoles"
							:languageCodes="showLanguageCodes"
							:name="capGen.roles"
							:readonly="readonly"
						/>
						<!-- PG functions -->
						<my-caption-map-items icon="codeDatabase.png"
							@update="storeChange"
							:items="captionsPgFunctions"
							:languageCodes="showLanguageCodes"
							:name="capGen.pgFunctions"
							:readonly="readonly"
						/>
						<!-- JS functions -->
						<my-caption-map-items icon="codeScreen.png"
							@update="storeChange"
							:items="captionsJsFunctions"
							:languageCodes="showLanguageCodes"
							:name="capGen.jsFunctions"
							:readonly="readonly"
						/>
						<!-- collections -->
						<my-caption-map-items icon="tray.png"
							@update="storeChange"
							:items="captionsCollections"
							:languageCodes="showLanguageCodes"
							:levelMax="1"
							:name="capGen.collections"
							:readonly="readonly"
						/>
						<!-- login forms -->
						<my-caption-map-items icon="personCog.png"
							@update="storeChange"
							:items="captionsLoginForms"
							:languageCodes="showLanguageCodes"
							:name="capGen.loginForms"
							:readonly="readonly"
						/>
						<!-- articles -->
						<my-caption-map-items icon="question.png"
							@update="storeChange"
							:items="captionsArticles"
							:languageCodes="showLanguageCodes"
							:name="capGen.articles"
							:readonly="readonly"
						/>
						<!-- widgets -->
						<my-caption-map-items icon="tiles.png"
							@update="storeChange"
							:items="captionsWidgets"
							:languageCodes="showLanguageCodes"
							:name="capGen.widgets"
							:readonly="readonly"
						/>
						<!-- query choices -->
						<my-caption-map-items icon="search.png"
							@update="storeChange"
							:items="captionsQueryChoices"
							:languageCodes="showLanguageCodes"
							:name="capGen.queryChoices"
							:readonly="readonly"
						/>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		languageDefault:{ required:false, default:null },
		moduleIdForce:  { required:false, default:null }, // used for Builder context, only edits the current module
		readonly:       { type:Boolean, required:false, default:false },
		target:         { type:String,  required:false }  // instance / app
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
			showLanguageCodes:[]
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
			let relIdMap = {};
			for(let atrId in s.captionMap.attributeIdMap) {
				const atr   = s.attributeIdMap[atrId];
				const relId = atr.relationId;
				if(typeof relIdMap[relId] === 'undefined')
					relIdMap[relId] = [];
				
				relIdMap[relId].push(s.makeItem('attribute',atrId,atr.name,s.captionMap.attributeIdMap[atrId],[]));
			}
			
			// return sorted by relation and attribute names
			let out = [];
			for(let id in relIdMap) {
				out.push(s.makeItem('relation',id,s.relationIdMap[id].name,null,relIdMap[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsCollections:(s) => {
			let collectionIdMap = {};
			for(const collection of s.module.collections) {
				let childCaptions = [];
				for(const col of collection.columns) {
					if(s.captionMap.columnIdMap[col.id] !== undefined)
						childCaptions.push(s.makeItem('column',col.id,s.getColumnTitle(col),s.captionMap.columnIdMap[col.id],[]));
				}
				
				if(childCaptions.length !== 0)
					collectionIdMap[collection.id] = childCaptions;
			}
			let out = [];
			for(const id in collectionIdMap) {
				out.push(s.makeItem('collection',id,s.collectionIdMap[id].name,null,collectionIdMap[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsFieldsByForms:(s) => {
			let frmIdMap = {};
			for(const frm of s.module.forms) {
				const fieldIdMap = s.getFieldMap(frm.fields);
				let fieldCaptions = [];
				
				for(const fldId in fieldIdMap) {
					const fld = fieldIdMap[fldId];
					
					// check for field children (columns, tabs)
					let fieldChildCaptions = [];
					if(fld.columns !== undefined) {
						for(const col of fld.columns) {
							if(s.captionMap.columnIdMap[col.id] !== undefined)
								fieldChildCaptions.push(s.makeItem('column',col.id,s.getColumnTitle(col),s.captionMap.columnIdMap[col.id],[]));
						}
					}
					if(fld.tabs !== undefined) {
						for(const tab of fld.tabs) {
							if(s.captionMap.tabIdMap[tab.id] !== undefined)
								fieldChildCaptions.push(s.makeItem('tab',tab.id,'-',s.captionMap.tabIdMap[tab.id],[]));
						}
					}
					
					if(fieldChildCaptions.length !== 0 || s.captionMap.fieldIdMap[fldId] !== undefined)
						fieldCaptions.push(s.makeItem('field',fldId,s.getFieldTitle(fld),s.captionMap.fieldIdMap[fldId],fieldChildCaptions));
				}
				// form has fields with captions or has captions itself
				if(fieldCaptions.length !== 0 || s.captionMap.formIdMap[frm.id] !== undefined)
					frmIdMap[frm.id] = fieldCaptions;
			}
			
			// return sorted by form and field names
			let out = [];
			for(const id in frmIdMap) {
				out.push(s.makeItem('form',id,s.formIdMap[id].name,s.captionMap.formIdMap[id],frmIdMap[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsMenus:(s) => {
			let out = [];
			for(const id in s.captionMap.menuIdMap) {
				out.push(s.makeItem('menu',id,'-',s.captionMap.menuIdMap[id],[]));
			}
			return out;
		},
		captionsQueryChoices:(s) => {
			let out = [];
			for(const id in s.captionMap.queryChoiceIdMap) {
				out.push(s.makeItem('query_choice',id,'-',s.captionMap.queryChoiceIdMap[id],[]));
			}
			return out;
		},
		
		// simple
		captionsArticles:   (s) => s.makeSortedItemList(s.captionMap.articleIdMap,s.articleIdMap,'article'),
		captionsJsFunctions:(s) => s.makeSortedItemList(s.captionMap.jsFunctionIdMap,s.jsFunctionIdMap,'js_function'),
		captionsLoginForms: (s) => s.makeSortedItemList(s.captionMap.loginFormIdMap,s.loginFormIdMap,'login_form'),
		captionsPgFunctions:(s) => s.makeSortedItemList(s.captionMap.pgFunctionIdMap,s.pgFunctionIdMap,'pg_function'),
		captionsRoles:      (s) => s.makeSortedItemList(s.captionMap.roleIdMap,s.roleIdMap,'role'),
		captionsWidgets:    (s) => s.makeSortedItemList(s.captionMap.widgetIdMap,s.widgetIdMap,'widget'),
		canSwitchModules:   (s) => s.moduleIdForce === null,
		module:             (s) => s.moduleId === null ? false : s.moduleIdMap[s.moduleId],
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		articleIdMap:   (s) => s.$store.getters['schema/articleIdMap'],
		attributeIdMap: (s) => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		jsFunctionIdMap:(s) => s.$store.getters['schema/jsFunctionIdMap'],
		loginFormIdMap: (s) => s.$store.getters['schema/loginFormIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		roleIdMap:      (s) => s.$store.getters['schema/roleIdMap'],
		widgetIdMap:    (s) => s.$store.getters['schema/widgetIdMap'],
		capApp:         (s) => s.$store.getters.captions.captionMap,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// external
		getColumnTitle,
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
		
		// helper
		makeItem(entity,id,name,capMap,children) {
			return {
				capMap:capMap !== undefined ? capMap : null,
				children:children !== undefined ? children.sort((a,b) => (a.name > b.name) ? 1 : -1) : [],
				entity:entity,
				id:id,
				name:name
			};
		},
		makeSortedItemList(capMap,entityMap,entity) {
			let out = [];
			for(const id in capMap) {
				out.push(this.makeItem(entity,id,entityMap[id].name,capMap[id],[]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
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