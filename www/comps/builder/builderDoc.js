import MyBuilderCaption     from './builderCaption.js';
import MyBuilderQuery       from './builderQuery.js';
import MyBuilderDocFont     from './builderDocFont.js';
import MyBuilderDocPage     from './builderDocPage.js';
import MyBuilderDocSets     from './builderDocSets.js';
import MyTabs               from '../tabs.js';
import {deepIsEqual}        from '../shared/generic.js';
import {getJoinsIndexMap}   from '../shared/query.js';
import {getTemplateDocPage} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-doc',
	components:{
		MyBuilderCaption,
		MyBuilderDocFont,
		MyBuilderDocPage,
		MyBuilderDocSets,
		MyBuilderQuery,
		MyTabs
	},
	template:`<div class="builder-doc" v-if="doc !== false">
		<div class="contentBox grow">
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
					:builderLanguage
					:joins="doc.query.joins"
					:pageOptionsElm="$refs.pageOptions"
					:readonly
				/>
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
			<div class="top lower" @click="sideFieldIdShow = null; sideColumnIdShow = null">
				<div class="area">
					<img class="icon" src="images/document.png" />
					<h1>{{ capGen.document }}</h1>
				</div>
			</div>
			
			<!-- document -->
			<template v-if="sideDocShow">
				<my-tabs
					v-model="tabTarget"
					:entries="['content','states','page','properties']"
					:entriesText="[capGen.content,capApp.tabStates.replace('{CNT}',doc.states.length),capGen.page + ' ' + String(pageIndexActive+1),capGen.properties]"
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
				</div>

				<!-- states -->
				
				<!-- page properties -->
				<div class="content grow no-padding" ref="pageOptions" v-show="tabTarget === 'page'">
				</div>
				
				<!-- document properties -->
				<div class="content grow no-padding" v-if="tabTarget === 'properties'">
					<table class="generic-table-vertical default-inputs">
						<tbody>
							<tr>
								<td>{{ capGen.name }}</td>
								<td><input class="long" v-model="doc.name" :disabled="readonly" /></td>
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
							<my-builder-doc-sets
								v-model="doc.sets"
								:allowData="true"
								:joins="doc.query.joins"
								:readonly
								:targetsDoc="true"
								:targetsFont="true"
							/>
						</tbody>
					</table>
				</div>
			</template>

			<!-- page -->

			<!-- field -->

			<!-- column -->
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:false, default:'' },
		readonly:       { type:Boolean, required:true }
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	data() {
		return {
			doc:false,
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','getter','globalSearch','javascript','record','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','variable'
			],
			
			// state
			pageOptions:null,
			sideColumnIdShow:null,
			sideFieldIdShow:null,
			showSidebar:true,
			tabPageIdShow:0,
			tabTarget:'content'
		};
	},
	computed:{
		pageIdMapIndex:(s) => {
			let out = {};
			for(let i = 0, j = s.doc.pages.length; i < j; i++) {
				out[s.doc.pages[i].id] = i;
			}
			return out;
		},
		tabsPages:(s) => {
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
		hasChanges:     s => !s.deepIsEqual(s.doc,s.docOrg),
		module:         s => s.moduleIdMap[s.doc.moduleId],
		pageIndexActive:s => s.pageIdMapIndex[s.tabPageIdShow],
		sideColumnShow: s => s.sideColumnIdShow !== null,
		sideDocShow:    s => !s.sideColumnShow && !s.sideFieldShow,
		sideFieldShow:  s => s.sideFieldIdShow !== null,
		
		// stores
		docIdMap:   s => s.$store.getters['schema/docIdMap'],
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capApp:     s => s.$store.getters.captions.builder.doc,
		capGen:     s => s.$store.getters.captions.generic
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
		getJoinsIndexMap,
		getTemplateDocPage,

		// presentation
		getPageName(id) {
			return String(this.pageIdMapIndex[id] + 1);
		},
		
		// actions
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