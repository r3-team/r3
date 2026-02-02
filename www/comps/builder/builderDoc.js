import MyBuilderCaption          from './builderCaption.js';
import MyBuilderQuery            from './builderQuery.js';
import MyBuilderDocFont          from './builderDocFont.js';
import MyBuilderDocPage          from './builderDocPage.js';
import MyBuilderDocSets          from './builderDocSets.js';
import MyBuilderDocStates        from './builderDocStates.js';
import MyInputDecimal            from '../inputDecimal.js';
import MyTabs                    from '../tabs.js';
import {isAttributeRelationship} from '../shared/attribute.js';
import {getUuidV4}               from '../shared/crypto.js';
import {deepIsEqual}             from '../shared/generic.js';
import {getJoinsIndexMap}        from '../shared/query.js';
import {
	getDocEntityMapRef,
	getDocFieldIcon,
	getDocFieldTitle
} from '../shared/builderDoc.js';
import {
	getTemplateDocField,
	getTemplateDocPage
} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-doc',
	components:{
		MyBuilderCaption,
		MyBuilderDocFont,
		MyBuilderDocPage,
		MyBuilderDocSets,
		MyBuilderDocStates,
		MyBuilderQuery,
		MyInputDecimal,
		MyTabs
	},
	template:`<div class="builder-doc" v-if="doc !== false">
		<div class="contentBox grow scroll">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/document.png" />
					<h1 class="title">
						{{ capApp.titleOne.replace('{NAME}',doc.name) }}
					</h1>
				</div>
				<div class="area">
					<my-button
						@trigger="showSidebar = !showSidebar"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area nowrap">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && !readonly"
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
				</div>
				<div class="area nowrap default-inputs">
					<my-input-decimal class="short" v-model="recordId" :allowNull="true" :readonly :lengthFract="0" />
					<a target="_blank" :href="previewUrl">
						<my-button image="download.png"
							:active="previewUrl !== null"
							:caption="capGen.preview"
						/>
					</a>
					<my-button image="search.png"
						@trigger="zoom = zoomOrg"
						:active="zoom !== zoomOrg"
						:captionTitle="capGen.zoom"
						:naked="true"
					/>
					<input type="range"
						v-model.number="zoom"
						:max="3"
						:min="0.5"
						:step="0.1"
					/>
				</div>
				<div class="area nowrap">
					<my-button image="delete.png"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</div>
			<div class="builder-doc-content">
				<my-tabs
					v-model="tabPageIdShow"
					@add="pageAdd"
					@del="pageDel"
					@update:modelValue="sideFieldIdShow = null"
					:actionAdd="true"
					:actionAddCap="capApp.button.addPage"
					:actionDel="doc.pages.length > 1"
					:entries="tabsPages.entries"
					:entriesIcon="tabsPages.entriesIcon"
					:entriesText="tabsPages.entriesText"
					:small="true"
				/>

				<!-- page -->
				<my-builder-doc-page
					v-model="pageActive"
					@setFieldIdOptions="sideFieldIdShow = $event"
					:builderLanguage
					:elmPageOptions="$refs.pageOptions"
					:elmFieldOptions="$refs.fieldOptions"
					:entityIdMapRef
					:fieldIdOptions="sideFieldIdShow"
					:joins="doc.query.joins"
					:moduleId="doc.moduleId"
					:pages="doc.pages"
					:readonly
					:zoom
				/>
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
			<div class="top lower" @click="sideFieldIdShow = null" :class="{ clickable:sideFieldShow }">
				<div class="area">
					<img class="icon" src="images/document.png" />
					<h1>{{ capGen.pdf }}</h1>
				</div>
			</div>
			
			<!-- document / page options -->
			<div v-show="sideDocShow">
				<my-tabs
					v-model="tabTarget"
					:entries="['content','states','properties','page']"
					:entriesText="[capGen.content,capApp.tabStates.replace('{CNT}',doc.states.length),capGen.properties,capGen.page + ' ' + String(pageIndexActive+1)]"
				/>

				<!-- content -->
				<div class="content grow" v-if="tabTarget === 'content'">
					<my-builder-query
						v-model="doc.query"
						@index-removed=""
						:allowChoices="false"
						:allowFixedLimit="false"
						:builderLanguage
						:filtersDisable
						:moduleId="doc.moduleId"
					/>

					<br />
					<!-- field templates -->
					<h2>{{ capGen.fields }}</h2>
					<div class="builder-doc-templates">
						<div class="builder-doc-template" draggable="true"
							@dragstart="fieldDragStart($event,f)"
							v-for="f in fieldsTemplate"
							:class="{ 'isLayout':f.content === 'flow' || f.content === 'grid', 'notData':f.content !== 'data' }"
							:key="f.id"
						>
							<div class="builder-doc-button">
								<img :src="'images/' + getDocFieldIcon(f)" />
							</div>
							<span>{{ getDocFieldTitle(f) }}</span>
						</div>
					</div>
				</div>

				<!-- states -->
				<div class="content grow" v-if="tabTarget === 'states'">
					<my-builder-doc-states
						v-model="doc.states"
						:entityIdMapRef
						:joins="doc.query.joins"
						:moduleId="doc.moduleId"
						:readonly
					/>
				</div>
				
				<!-- properties -->
				<div class="content grow no-padding" v-if="tabTarget === 'properties'">
					<table class="generic-table-vertical default-inputs">
						<tbody>
							<tr>
								<td>{{ capGen.name }}</td>
								<td><input class="long" v-model="doc.name" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capGen.comments }}</td>
								<td><textarea class="long" v-model="doc.comment" :disabled="readonly"></textarea></td>
							</tr>
							<tr>
								<td>{{ capGen.language }}</td>
								<td>
									<select class="long" v-model="doc.language">
										<option v-for="l in module.languages" :value="l">{{ l }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capGen.title }}</td>
								<td>
									<my-builder-caption
										v-model="doc.captions.docTitle"
										:contentName="capGen.title"
										:language="builderLanguage"
										:longInput="true"
										:readonly
									/>
								</td>
							</tr>
							<tr>
								<td>{{ capGen.author }}</td>
								<td><input class="long" v-model="doc.author" :disabled="readonly" /></td>
							</tr>

							<tr><td colspan="2"><b>{{ capGen.font }}</b></td></tr>
							<my-builder-doc-font
								v-model:align="doc.font.align"
								v-model:boolFalse="doc.font.boolFalse"
								v-model:boolTrue="doc.font.boolTrue"
								v-model:color="doc.font.color"
								v-model:dateFormat="doc.font.dateFormat"
								v-model:family="doc.font.family"
								v-model:lineFactor="doc.font.lineFactor"
								v-model:numberSepDec="doc.font.numberSepDec"
								v-model:numberSepTho="doc.font.numberSepTho"
								v-model:size="doc.font.size"
								v-model:style="doc.font.style"
								:readonly
							/>
						</tbody>
					</table>
					<my-builder-doc-sets
						v-model="doc.sets"
						:allowData="true"
						:joins="doc.query.joins"
						:readonly
						:showDoc="true"
						:showFont="true"
					/>
				</div>
				
				<!-- page options -->
				<div class="content grow no-padding" ref="pageOptions" v-show="tabTarget === 'page'"></div>
			</div>

			<!-- field options -->
			<div class="content grow no-padding" ref="fieldOptions" v-show="sideFieldShow"></div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:false, default:'' },
		readonly:       { type:Boolean, required:true }
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.cacheDenialTimestamp = setInterval(this.setCacheDenialTimestamp,1000);
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		clearInterval(this.setCacheDenialTimestamp);
	},
	data() {
		return {
			cacheDenialTimestamp:0,
			doc:false,
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','getter','globalSearch','javascript','record','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','variable'
			],

			// inputs
			recordId:null,
			zoom:1,
			zoomOrg:1,
			
			// state
			pageOptions:null,
			sideFieldIdShow:null,
			showSidebar:true,
			tabPageIdShow:0,
			tabTarget:'content'
		};
	},
	computed:{
		fieldsTemplate:s => {
			let out = [
				s.getTemplateDocField('flow'),
				s.getTemplateDocField('grid'),
				s.getTemplateDocField('list'),
				s.getTemplateDocField('text')
			];
			for(const j of s.doc.query.joins) {
				const r = s.relationIdMap[j.relationId];

				for(const a of r.attributes) {
					if(s.isAttributeRelationship(a.content))
						continue;

					out.push(s.getTemplateDocField('data',j.index,a.id));
				}
			}
			return out;
		},
		pageIdMapIndex:s => {
			let out = {};
			for(let i = 0, j = s.doc.pages.length; i < j; i++) {
				out[s.doc.pages[i].id] = i;
			}
			return out;
		},
		tabsPages:s => {
			let pageIndexes = [];
			let icons   = [];
			let texts   = [];
			const titleShort = s.doc.pages.length > 3;
			for(let i = 0, j = s.doc.pages.length; i < j; i++) {
				const p = s.doc.pages[i];
				pageIndexes.push(p.id);
				icons.push(p.state ? null : 'images/visible0.png');
				texts.push(titleShort ? `P${i+1}` : `${s.capGen.page} ${i+1}`);
			}
			return {
				entries:pageIndexes,
				entriesIcon:icons,
				entriesText:texts
			};
		},

		// inputs
		pageActive:{
			get()  { return this.doc.pages[this.pageIndexActive]; },
			set(v) { this.doc.pages[this.pageIndexActive] = v; }
		},

		// simple
		docOrg:         s => s.docIdMap[s.id] === undefined ? false : s.docIdMap[s.id],
		entityIdMapRef: s => s.getDocEntityMapRef(s.doc),
		hasChanges:     s => !s.deepIsEqual(s.doc,s.docOrg),
		module:         s => s.moduleIdMap[s.doc.moduleId],
		pageIndexActive:s => s.pageIdMapIndex[s.tabPageIdShow],
		previewUrl:     s => s.recordId !== null && !s.hasChanges ? `/doc/download/test.pdf?doc_id=${s.id}&record_id=${s.recordId}&token=${s.token}&date=${s.cacheDenialTimestamp}` : null,
		sideDocShow:    s => !s.sideFieldShow,
		sideFieldShow:  s => s.sideFieldIdShow !== null,
		
		// stores
		docIdMap:     s => s.$store.getters['schema/docIdMap'],
		moduleIdMap:  s => s.$store.getters['schema/moduleIdMap'],
		relationIdMap:s => s.$store.getters['schema/relationIdMap'],
		token:        s => s.$store.getters['local/token'],
		capApp:       s => s.$store.getters.captions.builder.doc,
		capGen:       s => s.$store.getters.captions.generic,
	},
	watch:{
		docOrg:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		deepIsEqual,
		getDocEntityMapRef,
		getDocFieldIcon,
		getDocFieldTitle,
		getJoinsIndexMap,
		getTemplateDocField,
		getTemplateDocPage,
		getUuidV4,
		isAttributeRelationship,

		// presentation
		getPageName(id) {
			return String(this.pageIdMapIndex[id] + 1);
		},

		// system
		setCacheDenialTimestamp() {
			this.cacheDenialTimestamp = Math.floor(new Date().getTime() / 1000);
		},
		
		// actions
		fieldDragStart(e,field) {
			let f = JSON.parse(JSON.stringify(field));
			f.id = this.getUuidV4();
			e.dataTransfer.setData('application/json',JSON.stringify(f));
			e.dataTransfer.setData('doc-field','');
			e.dataTransfer.setDragImage(e.srcElement,0,0);
		},
		pageAdd() {
			const p = this.getTemplateDocPage();
			this.doc.pages.push(p);
			this.tabPageIdShow = p.id;
		},
		pageDel(id) {
			const i = this.pageIdMapIndex[id];
			this.doc.pages.splice(i,1);
			this.resetPageTab();
		},
		pageMove(forward) {

		},
		reset() {
			if(this.docOrg !== false && !this.deepIsEqual(this.doc,this.docOrg)) {
				this.doc = JSON.parse(JSON.stringify(this.docOrg));

				if(this.doc.pages.findIndex(v => v.id === this.tabPageIdShow) === -1)
					this.resetPageTab();
			}
		},
		resetPageTab() {
			this.tabPageIdShow = this.doc.pages[0].id;
		},
		
		// backend calls
		delAsk() {
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
		del() {
			ws.send('doc','del',this.doc.id,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push('/builder/docs/'+this.module.id);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('doc','set',this.doc),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};