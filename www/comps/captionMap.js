import {getColumnTitle}    from './shared/column.js';
import {getFieldTitle}     from './shared/field.js';
import {getFieldMap}       from './shared/form.js';
import {objectDeepMerge}   from './shared/generic.js';
import srcBase64Icon       from './shared/image.js';
import {getCaptionMapName} from './shared/language.js';
import {MyModuleSelect}    from './input.js';
import MyBuilderCaption    from './builder/builderCaption.js';
export {MyCaptionMap as default};

let MyCaptionMapTransfer = {
	name:'my-caption-map-transfer',
	template:`<div class="app-sub-window under-header" @mousedown.self="close">
		<div class="contentBox float">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" :src="'images/' + (isExport ? 'download.png' : 'upload.png')" />
					<h1 class="title">{{ isExport ? capApp.export : capApp.import }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="content default-inputs">
				<div class="column gap-large">
					<div class="row gap centered">
						<span>{{ capGen.language }}</span>
						<select v-model="language">
							<option value="">-</option>
							<option v-for="l in languages" :value="l">{{ l }}</option>
						</select>
					</div>
					<input type="file"
						v-if="!isExport"
						@change="fileImport"
					/>
					<div class="row">
						<my-button image="download.png"
							v-if="isExport"
							@trigger="fileExport"
							:active="language !== ''"
							:caption="capGen.button.export"
						/>
						<my-button image="upload.png"
							v-if="!isExport"
							@trigger="fileImportUpdate"
							:active="importData !== null && language !== ''"
							:caption="capGen.button.import"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	emits:['close','update'],
	props:{
		captionMap:{ type:Object,  required:true },
		isCustom:  { type:Boolean, required:true },
		isExport:  { type:Boolean, required:true },
		languages: { type:Array,   required:true },
		moduleId:  { type:String,  required:true }
	},
	data() {
		return {
			importData:null,
			language:''
		};
	},
	computed:{
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.captionMap,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape',keyCtrl:false});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		objectDeepMerge,
		
		// actions
		close() {
			this.$emit('close');
		},
		fileExport(filename,data) {
			const module   = this.moduleIdMap[this.moduleId];
			const fileName = `${module.name}_v${module.releaseBuild}_${this.language}_${this.isCustom ? 'custom' : 'app'}.json`;
			const fileData = JSON.stringify(this.getContentFromMap(this.captionMap,this.language),null,4);
			
			// download file
			const blob = new Blob([fileData],{type:'application/json'});
			const elem = window.document.createElement('a');
			const url  = window.URL.createObjectURL(blob);
			
			elem.href     = url;
			elem.download = fileName;  
			
			document.body.appendChild(elem);
			elem.click();
			document.body.removeChild(elem);
			window.URL.revokeObjectURL(url);
		},
		fileImport(event) {
			if(event.target.files.length !== 1)
				return;
			
			const reader = new FileReader();
			reader.readAsText(event.target.files[0]);
			reader.onload  = () => this.importData = JSON.parse(reader.result);
			reader.onerror = this.$root.genericError;
		},
		fileImportUpdate() {
			for(const k in this.importData) {
				const map = this.importData[k];
				for(const entityId in map) {
					for(const content in map[entityId]) {
						for(const language in map[entityId][content]) {
							if(language !== this.language) continue;
							
							this.$emit('update',entityId,content,language,map[entityId][content][language]);
						}
					}
				}
			}
		},
		
		// helper
		getContentFromMap(captionMap,languageGet) {
			let out = {};
			for(const k in captionMap) {
				const map = captionMap[k];
				out[k] = {};
				
				for(const entityId in map) {
					for(const content in map[entityId]) {
						for(const language in map[entityId][content]) {
							if(language !== languageGet)
								continue;
							
							if(out[k][entityId]          === undefined) out[k][entityId]          = {};
							if(out[k][entityId][content] === undefined) out[k][entityId][content] = {};
							
							out[k][entityId][content][language] = map[entityId][content][language];
						}
					}
				}
			}
			return out;
		}
	}
};

let MyCaptionMapNewLanguage = {
	name:'my-caption-map-new-language',
	template:`<div class="app-sub-window under-header" @mousedown.self="close">
		<div class="contentBox float">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/languages.png" />
					<h1 class="title">{{ capApp.titleNew }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="content default-inputs captionMap-new-language">
				<div class="row gap">
					<input class="short" maxlength="5" size="5" v-focus v-model="inputLine" />
					<my-button image="save.png"
						@trigger="$emit('create',input)"
						:active="canSave"
						:caption="capGen.button.save"
					/>
				</div>
				<p v-for="t in capApp.newDesc">{{ t }}</p>
			</div>
		</div>
	</div>`,
	emits:['close','create'],
	props:{
		languages:      { type:Array,  required:true },
		languagesCustom:{ type:Array,  required:true },
		moduleId:       { type:String, required:true }
	},
	data() {
		return {
			input:''
		};
	},
	computed:{
		canSave:(s) =>
			s.input !== '' &&
			s.input.length === 5 &&
			!s.languagesCustom.includes(s.input),
		inputLine:{
			get()  { return this.input; },
			set(v) { this.input = v.toLowerCase().replace('-','_').replace(/[^a-z\_]/g,''); }
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.captionMap,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.create,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape',keyCtrl:false});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.create);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		close()  { this.$emit('close'); },
		create() { this.$emit('create',this.input); }
	}
};

let MyCaptionMapItemValue = {
	name:'my-caption-map-item-value',
	components:{ MyBuilderCaption },
	template:`<td>
		<div class="row wrap gap default-inputs">
			<template v-for="(captions,content) in captionMap">
				<input class="long"
					v-if="!contentRichtext.includes(content)"
					@input="$emit('update',content,language,$event.target.value)"
					:disabled="readonly"
					:placeholder="content"
					:value="typeof captions[language] === 'undefined' ? '' : captions[language]"
				/>
				<my-button image="edit.png"
					v-if="contentRichtext.includes(content)"
					@trigger="showRichtextContent = content"
					:caption="content"
				/>
			</template>
			
			<div class="app-sub-window under-header" v-if="showRichtextContent !== null" @mousedown.self="showRichtextContent = null">
				<div class="contentBox shade popUp captionMap-richtext">
					<div class="top lower">
						<div class="area">{{ showRichtextContent }}</div>
						<div class="area">
							<my-button image="cancel.png"
								@trigger="showRichtextContent = null"
								:cancel="true"
							/>
						</div>
					</div>
					<div class="content grow no-padding captionMap-richtext-content">
						<my-builder-caption
							@update:modelValue="$emit('update',showRichtextContent,language,$event[language])"
							:contentName="''"
							:language="language"
							:modelValue="captionMap[showRichtextContent]"
							:readonly="readonly"
							:richtext="true"
						/>
					</div>
				</div>
			</div>
		</div>
	</td>`,
	data() {
		return {
			contentRichtext:['articleBody'],
			showRichtextContent:null
		};
	},
	emits:['update'],
	props:{
		captionMap:{ type:Object,  required:true },
		language:  { type:String,  required:true }, // language code: en_us, de_de, ...
		readonly:  { type:Boolean, required:true }
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
		<td v-for="l in languages">
			<my-caption-map-item-value
				v-if="item.capMap !== null"
				@update="(...args) => $emit('update',item.id,args[0],args[1],args[2])"
				:captionMap="item.capMap"
				:language="l"
				:readonly="readonly || (isCustom && !languagesCustom.includes(l))"
			/>
		</td>
	</tr>
	<my-caption-map-item
		v-if="showChildrenIds.includes(item.id)"
		v-for="child in children"
		@update="(...args) => $emit('update',args[0],args[1],args[2],args[3])"
		:isCustom="isCustom"
		:item="child"
		:languages="languages"
		:languagesCustom="languagesCustom"
		:level="level + 1"
		:levelMax="levelMax"
		:readonly="readonly"
	/>`,
	emits:['update'],
	props:{
		isCustom:       { type:Boolean, required:true },
		item:           { type:Object,  required:true },
		languages:      { type:Array,   required:true },
		languagesCustom:{ type:Array,   required:true },
		level:          { type:Number,  required:false, default:0 },
		levelMax:       { type:Number , required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			showChildrenIds:[]
		};
	},
	computed:{
		actionCaption:(s) => s.level >= s.levelMax || s.item.children.length === 0 ? s.item.name : `${s.item.name} (${s.item.children.length})`,
		actionImage:  (s) => s.level >= s.levelMax ? '' : s.showChildrenIds.includes(s.item.id) ? 'triangleDown.png' : 'triangleRight.png',
		children:     (s) => typeof s.item.children !== 'undefined' ? s.item.children : [],
		style:        (s) => `margin-left:${s.level * 20}px;`
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
	template:`<tr :class="{ 'sticky-row':show }">
		<td>
			<my-button
				@trigger="show = !show"
				:active="items.length !== 0"
				:caption="label"
				:images="[show ? 'triangleDown.png' : 'triangleRight.png',icon]"
			/>
		</td>
		<td v-for="l in languages">{{ show ? l : '-' }}</td>
	</tr>
	<my-caption-map-item
		v-if="show"
		v-for="item in items"
		@update="(...args) => $emit('update',...args)"
		:isCustom="isCustom"
		:item="item"
		:languages="languages"
		:languagesCustom="languagesCustom"
		:levelMax="levelMax"
		:readonly="readonly"
	/>`,
	emits:['update'],
	props:{
		icon:           { type:String,  required:true },
		isCustom:       { type:Boolean, required:true },
		items:          { type:Array,   required:true },
		languages:      { type:Array,   required:true },
		languagesCustom:{ type:Array,   required:true },
		levelMax:       { type:Number,  required:false, default:0 },
		name:           { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			show:false
		};
	},
	computed:{
		label:(s) => s.items.length === 0 ? s.name : `${s.name} (${s.items.length})`
	}
};

let MyCaptionMap = {
	name:'my-caption-map',
	components:{
		MyCaptionMapItems,
		MyCaptionMapItemValue,
		MyCaptionMapNewLanguage,
		MyCaptionMapTransfer,
		MyModuleSelect
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
					:active="canSave"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area default-inputs" v-if="canSwitchModules">
				<img class="icon"
					:src="srcBase64Icon(moduleIdMap[moduleId].iconId,'images/module.png')"
				/>
				<my-module-select
					@update:modelValue="changeModule($event)"
					:modelValue="moduleId"
				/>
			</div>
			<div class="area nowrap">
				<div class="row gap-large" v-if="module">
					<div class="row centered">
						<span>{{ capApp.languagesApp }}</span>
						<my-button
							v-for="l in languages.filter(v => !languagesCustom.includes(v))"
							@trigger="toggleDisplay(showLanguageCodes,l)"
							:caption="l"
							:image="showLanguageCodes.includes(l) ? 'checkbox1.png' : 'checkbox0.png'"
							:naked="true"
						/>
					</div>
					<div class="row centered" v-if="isCustom">
						<span>{{ capApp.languagesInstance }}</span>
						<my-button
							v-for="l in languagesCustom"
							@trigger="toggleDisplay(showLanguageCodes,l)"
							:caption="l"
							:image="showLanguageCodes.includes(l) ? 'checkbox1.png' : 'checkbox0.png'"
							:naked="true"
						/>
					</div>
					<div class="row gap">
						<my-button image="add.png"
							v-if="isCustom"
							@trigger="showLanguageNew = true"
							:caption="capGen.button.add"
						/>
						<my-button image="download.png"
							@trigger="showTransferMode = 'export';showTransfer = true"
							:caption="capGen.button.export"
						/>
						<my-button image="upload.png"
							@trigger="showTransferMode = 'import';showTransfer = true"
							:caption="capGen.button.import"
						/>
					</div>
				</div>
			</div>
		</div>
		<div class="content no-padding">
			<div class="captionMap">
				<div class="content" v-if="module === false">
					<i>{{ capGen.nothingInstalled }}</i>
				</div>
				<table class="generic-table sticky-top" v-if="isReady && module">
					<thead>
						<tr>
							<th></th>
							<th v-for="l in showLanguageCodes">
								<div class="row centered gap">
									<span>{{ l }}</span>
									<my-button image="delete.png"
										v-if="isCustom && languagesCustom.includes(l)"
										@trigger="setLanguagesCustom(l,false)"
										:captionTitle="capGen.button.delete"
										:cancel="true"
									/>
								</div>
							</th>
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
									v-if="captionMap.moduleIdMap[moduleId] !== undefined"
									@update="(...args) => storeChange(moduleId,args[0],args[1],args[2])"
									:captionMap="captionMap.moduleIdMap[moduleId]"
									:language="l"
									:readonly="readonly || (isCustom && !languagesCustom.includes(l))"
								/>
							</td>
						</tr>
						
						<!-- relations -->
						<my-caption-map-items icon="database.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsAttributesByRelations"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:levelMax="1"
							:name="capGen.relations"
							:readonly="readonly"
						/>
						<!-- forms -->
						<my-caption-map-items icon="fileText.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsFieldsByForms"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:levelMax="2"
							:name="capGen.forms"
							:readonly="readonly"
						/>
						<!-- menu tabs -->
						<my-caption-map-items icon="menu.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsMenusByMenuTabs"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:levelMax="2"
							:name="capGen.menus"
							:readonly="readonly"
						/>
						<!-- roles -->
						<my-caption-map-items icon="personMultiple.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsRoles"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.roles"
							:readonly="readonly"
						/>
						<!-- PG functions -->
						<my-caption-map-items icon="codeDatabase.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsPgFunctions"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.pgFunctions"
							:readonly="readonly"
						/>
						<!-- JS functions -->
						<my-caption-map-items icon="codeScreen.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsJsFunctions"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.jsFunctions"
							:readonly="readonly"
						/>
						<!-- collections -->
						<my-caption-map-items icon="tray.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsCollections"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:levelMax="1"
							:name="capGen.collections"
							:readonly="readonly"
						/>
						<!-- login forms -->
						<my-caption-map-items icon="personCog.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsLoginForms"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.loginForms"
							:readonly="readonly"
						/>
						<!-- articles -->
						<my-caption-map-items icon="question.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsArticles"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.articles"
							:readonly="readonly"
						/>
						<!-- APIs -->
						<my-caption-map-items icon="api.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsApis"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:levelMax="1"
							:name="capGen.apis"
							:readonly="readonly"
						/>
						<!-- widgets -->
						<my-caption-map-items icon="tiles.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsWidgets"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.widgets"
							:readonly="readonly"
						/>
						<!-- query choices -->
						<my-caption-map-items icon="search.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsQueryChoices"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.queryChoices"
							:readonly="readonly"
						/>
						<!-- client events -->
						<my-caption-map-items icon="screen.png"
							@update="storeChange"
							:isCustom="isCustom"
							:items="captionsClientEvents"
							:languages="showLanguageCodes"
							:languagesCustom="languagesCustom"
							:name="capGen.clientEvents"
							:readonly="readonly"
						/>
					</tbody>
				</table>
				
				<my-caption-map-new-language
					v-if="showLanguageNew"
					@close="showLanguageNew = false"
					@create="setLanguagesCustom($event,true)"
					:languages="languages"
					:languagesCustom="languagesCustom"
					:moduleId="moduleId"
				/>
				<my-caption-map-transfer
					v-if="showTransfer"
					@close="showTransfer = false"
					@update="storeChange"
					:captionMap="isCustom ? captionMapCustom : captionMap"
					:isCustom="isCustom"
					:isExport="showTransferMode === 'export'"
					:languages="isCustom ? languagesCustom : languages"
					:moduleId="moduleId"
				/>
			</div>
		</div>
	</div>`,
	props:{
		isCustom:       { type:Boolean, required:false, default:false }, // if enabled, custom languages can be added
		languageDefault:{ required:false, default:null },
		moduleIdForce:  { required:false, default:null },                // only edit the current module
		readonly:       { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			// data
			captionMap:{},       // map of all captions (combines application + custom)
			captionMapCustom:{}, // map of all custom captions
			
			// states
			changes:[],               // change to caption value, key = entity ID (attribute, form, field, etc.)
			hasChanges:false,
			isReady:false,
			moduleId:null,            // current module to show caption map for
			showLanguageNew:false,
			showLanguageCodes:[],
			showTransfer:false,
			showTransferMode:'export'
		};
	},
	watch:{
		moduleIdForce(v) {
			this.moduleId = v;
			this.resetDefaults();
		}
	},
	computed:{
		captionsApis:(s) => {
			let apiIdMap = {};
			for(const api of s.module.apis) {
				let childCaptions = [];
				for(const col of api.columns) {
					if(s.captionMap.columnIdMap[col.id] !== undefined)
						childCaptions.push(s.makeItem(col.id,s.getColumnTitle(col,s.moduleId),s.captionMap.columnIdMap[col.id],[]));
				}
				
				if(childCaptions.length !== 0)
					apiIdMap[api.id] = childCaptions;
			}
			let out = [];
			for(const id in apiIdMap) {
				out.push(s.makeItem(id,s.apiIdMap[id].name,null,apiIdMap[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsAttributesByRelations:(s) => {
			let relIdMap = {};
			for(let atrId in s.captionMap.attributeIdMap) {
				const atr   = s.attributeIdMap[atrId];
				const relId = atr.relationId;
				if(relIdMap[relId] === undefined)
					relIdMap[relId] = [];
				
				relIdMap[relId].push(s.makeItem(atrId,atr.name,s.captionMap.attributeIdMap[atrId],[]));
			}
			
			// return sorted by relation and attribute names
			let out = [];
			for(let id in relIdMap) {
				out.push(s.makeItem(id,s.relationIdMap[id].name,null,relIdMap[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsClientEvents:(s) => {
			let out = [];
			for(const ce of s.module.clientEvents) {
				out.push(s.makeItem(ce.id,'-',s.captionMap.clientEventIdMap[ce.id],[]));
			}
			return out;
		},
		captionsCollections:(s) => {
			let collectionIdMap = {};
			for(const collection of s.module.collections) {
				let childCaptions = [];
				for(const col of collection.columns) {
					if(s.captionMap.columnIdMap[col.id] !== undefined)
						childCaptions.push(s.makeItem(col.id,s.getColumnTitle(col,s.moduleId),s.captionMap.columnIdMap[col.id],[]));
				}
				
				if(childCaptions.length !== 0)
					collectionIdMap[collection.id] = childCaptions;
			}
			let out = [];
			for(const id in collectionIdMap) {
				out.push(s.makeItem(id,s.collectionIdMap[id].name,null,collectionIdMap[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsFieldsByForms:(s) => {
			let frmIdMapChildren = {};
			for(const frm of s.module.forms) {
				const fieldIdMap = s.getFieldMap(frm.fields);
				let formChildren = [];
				
				// form fields
				for(const fldId in fieldIdMap) {
					const fld = fieldIdMap[fldId];
					
					// check for fields with nesting (columns, tabs)
					let fieldChildren = [];
					if(fld.columns !== undefined) {
						for(const col of fld.columns) {
							if(s.captionMap.columnIdMap[col.id] !== undefined)
								fieldChildren.push(s.makeItem(col.id,s.getColumnTitle(col,s.moduleId),s.captionMap.columnIdMap[col.id],[]));
						}
					}
					if(fld.tabs !== undefined) {
						for(const tab of fld.tabs) {
							if(s.captionMap.tabIdMap[tab.id] !== undefined)
								fieldChildren.push(s.makeItem(tab.id,'-',s.captionMap.tabIdMap[tab.id],[]));
						}
					}
					
					if(fieldChildren.length !== 0 || s.captionMap.fieldIdMap[fldId] !== undefined)
						formChildren.push(s.makeItem(fldId,s.getFieldTitle(fld),s.captionMap.fieldIdMap[fldId],fieldChildren));
				}

				// form actions
				for(const act of frm.actions) {
					formChildren.push(s.makeItem(act.id,s.capGen.action,s.captionMap.formActionIdMap[act.id],[]));
				}

				// form has children with captions or has captions itself
				if(formChildren.length !== 0 || s.captionMap.formIdMap[frm.id] !== undefined)
					frmIdMapChildren[frm.id] = formChildren;
			}
			
			// return sorted by form and field names
			let out = [];
			for(const id in frmIdMapChildren) {
				out.push(s.makeItem(id,s.formIdMap[id].name,s.captionMap.formIdMap[id],frmIdMapChildren[id]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		captionsMenusByMenuTabs:(s) => {
			let out          = [];
			let menuTabIdMap = {};
			for(const mt of s.module.menuTabs) {
				menuTabIdMap[mt.id] = mt;
			}

			for(const id in s.captionMap.menuTabIdMap) {
				let children = [];
				if(menuTabIdMap[id] !== undefined) {
					for(const m of menuTabIdMap[id].menus) {
						children.push(s.makeItem(m.id,'-',s.captionMap.menuIdMap[m.id],[]));
					}
				}
				out.push(s.makeItem(id,'-',s.captionMap.menuTabIdMap[id],children));
			}
			return out;
		},
		captionsQueryChoices:(s) => {
			let out = [];
			for(const id in s.captionMap.queryChoiceIdMap) {
				out.push(s.makeItem(id,'-',s.captionMap.queryChoiceIdMap[id],[]));
			}
			return out;
		},
		
		// simple
		captionsArticles:   (s) => s.makeSortedItemList(s.captionMap.articleIdMap,s.articleIdMap),
		captionsJsFunctions:(s) => s.makeSortedItemList(s.captionMap.jsFunctionIdMap,s.jsFunctionIdMap),
		captionsLoginForms: (s) => s.makeSortedItemList(s.captionMap.loginFormIdMap,s.loginFormIdMap),
		captionsPgFunctions:(s) => s.makeSortedItemList(s.captionMap.pgFunctionIdMap,s.pgFunctionIdMap),
		captionsRoles:      (s) => s.makeSortedItemList(s.captionMap.roleIdMap,s.roleIdMap),
		captionsWidgets:    (s) => s.makeSortedItemList(s.captionMap.widgetIdMap,s.widgetIdMap),
		canSave:            (s) => !s.readonly && s.hasChanges,
		canSwitchModules:   (s) => s.moduleIdForce === null && s.moduleId !== null,
		languages:          (s) => s.moduleId === null ? [] : s.moduleIdMap[s.moduleId].languages,
		languagesCustom:    (s) => s.moduleId === null ? [] : s.moduleIdMapMeta[s.moduleId].languagesCustom,
		module:             (s) => s.moduleId === null ? false : s.moduleIdMap[s.moduleId],
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		apiIdMap:       (s) => s.$store.getters['schema/apiIdMap'],
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
		capGen:         (s) => s.$store.getters.captions.generic,
		moduleIdMapMeta:(s) => s.$store.getters.moduleIdMapMeta
	},
	mounted() {
		this.resetDefaults();
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	methods:{
		// external
		getCaptionMapName,
		getColumnTitle,
		getFieldMap,
		getFieldTitle,
		objectDeepMerge,
		srcBase64Icon,
		
		// actions
		changeModule(id) {
			this.moduleId = id;
			this.resetDefaults();
		},
		reset() {
			this.changes    = {};
			this.hasChanges = false;
			this.get();
		},
		resetDefaults() {
			if(this.modules.length === 0)
				return;
			
			this.showLanguageCodes = [];
			
			if(this.moduleId === null) {
				// apply forced or first available module
				if(this.moduleIdForce !== null)
					this.moduleId = this.moduleIdForce;
				else
					this.moduleId = this.modules[0].id;
			}
			
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
		storeChange(entityId,content,languageCode,value) {
			const mapName    = this.getCaptionMapName(content);
			const customLang = this.isCustom && this.languagesCustom.includes(languageCode);
			
			this.hasChanges = true;
			
			// add to combined caption map
			if(this.captionMap[mapName] === undefined)
				this.captionMap[mapName] = {};
			
			if(this.captionMap[mapName][entityId] === undefined)
				this.captionMap[mapName][entityId] = {};
			
			if(this.captionMap[mapName][entityId][content] === undefined)
				this.captionMap[mapName][entityId][content] = {};
			
			this.captionMap[mapName][entityId][content][languageCode] = value;
			
			// add to custom caption map
			if(customLang) {
				if(this.captionMapCustom[mapName] === undefined)
					this.captionMapCustom[mapName] = {};
				
				if(this.captionMapCustom[mapName][entityId] === undefined)
					this.captionMapCustom[mapName][entityId] = {};
				
				if(this.captionMapCustom[mapName][entityId][content] === undefined)
					this.captionMapCustom[mapName][entityId][content] = {};
				
				this.captionMapCustom[mapName][entityId][content][languageCode] = value;
			}
			
			this.changes[`${entityId}_${content}_${languageCode}`] = {
				content:content,
				entityId:entityId,
				languageCode:languageCode,
				target:customLang ? 'instance' : 'app',
				value:value
			};
		},
		toggleDisplay(list,value) {
			const i = list.indexOf(value);
			if(i === -1) list.push(value);
			else         list.splice(i,1);
		},
		
		// helper
		makeItem(id,name,capMap,children) {
			return {
				capMap:capMap !== undefined ? capMap : null,
				children:children !== undefined ? children.sort((a,b) => (a.name > b.name) ? 1 : -1) : [],
				id:id,
				name:name
			};
		},
		makeSortedItemList(capMap,entityMap) {
			let out = [];
			for(const id in capMap) {
				out.push(this.makeItem(id,entityMap[id].name,capMap[id],[]));
			}
			return out.sort((a,b) => (a.name > b.name) ? 1 : -1);
		},
		
		// backend
		get() {
			// application captions from schema
			let requests = [ws.prepare('captionMap','get',{
				moduleId:this.moduleId, target:'app'
			})];
			
			// custom captions from instance
			if(this.isCustom)
				requests.push(ws.prepare('captionMap','get',{
					moduleId:this.moduleId, target:'instance'
				}));
			
			ws.sendMultiple(requests,true).then(
				res => {
					this.captionMap = this.isCustom
						? this.objectDeepMerge(res[0].payload,res[1].payload)
						: res[0].payload;
					
					if(this.isCustom)
						this.captionMapCustom = res[1].payload;
					
					this.isReady = true;
				},
				this.$root.genericError
			);
		},
		set() {
			if(!this.canSave) return;
			
			let requests = [];
			for(let k in this.changes) {
				requests.push(ws.prepare('captionMap','setOne',this.changes[k]));
			}
			ws.sendMultiple(requests,true).then(
				() => {
					if(this.isCustom) this.$root.schemaReload();
					else              this.$root.schemaReload(this.moduleId);
					
					this.changes    = {};
					this.hasChanges = false;
				},
				this.$root.genericError
			);
		},
		setLanguagesCustom(languageSet,add) {
			let v = JSON.parse(JSON.stringify(this.languagesCustom));
			
			if(add) v.push(languageSet);
			else    v.splice(v.indexOf(languageSet),1);
			
			let requests = [
				ws.prepare('moduleMeta','setLanguagesCustom',{id:this.moduleId,languages:v})
			];
			
			if(!add) {
				// delete existing custom captions
				for(const k in this.captionMapCustom) {
					const map = this.captionMapCustom[k];
					for(const entityId in map) {
						for(const content in map[entityId]) {
							for(const language in map[entityId][content]) {
								if(language !== languageSet)
									continue;
								
								requests.push(ws.prepare('captionMap','setOne',{
									content:content,
									entityId:entityId,
									languageCode:language,
									target:'instance',
									value:''
								}));
							}
						}
					}
				}
			}
			
			ws.sendMultiple(requests,true).then(
				() => {
					this.$root.schemaReload();
					this.showLanguageNew = false;
					
					if(!add) this.get();
				},
				this.$root.genericError
			);
		}
	}
};