import MyBuilderCaption      from './builderCaption.js';
import MyBuilderQuery        from './builderQuery.js';
import {MyBuilderDocFont}    from './builderDocOptions.js';
import {MyBuilderDocSets}    from './builderDocSets.js';
import MyTabs                from '../tabs.js';
import {deepIsEqual}         from '../shared/generic.js';
import {getTemplateDocPage}  from '../shared/builderTemplate.js';
export {MyBuilderDoc as default};

const MyBuilderDoc = {
	name:'my-builder-doc',
	components:{
		MyBuilderCaption,
		MyBuilderDocFont,
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
				<div class="content grow no-padding">
					<my-tabs
						v-model="tabPageIdShow"
						@add="pageAdd"
						@del="pageDel"
						@upd="pageSel"
						:actionAdd="true"
						:actionAddCap="capApp.button.addPage"
						:actionDel="doc.pages.length > 1"
						:actionUpd="true"
						:entries="tabsPages.entries"
						:entriesText="tabsPages.entriesText"
						:small="true"
					/>
				</div>
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
			<div class="top lower" :class="{ clickable:sidePageIdShow }" @click="sideFieldIdShow = null; sidePageIdShow = null; sideColumnIdShow = null">
				<div class="area">
					<img class="icon" src="images/document.png" />
					<h1>{{ capGen.document }}</h1>
				</div>
			</div>
			<div class="top lower" v-if="sidePageShow">
				<div class="area">
					<img class="icon" src="images/fileText.png" />
					<h2>{{ capApp.sidebarPage.replace('{NAME}',getPageName(sidePageIdShow)) }}</h2>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="sidePageIdShow = null;"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
			
			<!-- document -->
			<template v-if="sideDocShow">
				<my-tabs
					v-model="tabTarget"
					:entries="['content','properties']"
					:entriesIcon="['images/database.png','images/edit.png']"
					:entriesText="[capGen.content,capGen.properties]"
				/>

				<!-- content -->
				
				<!-- properties -->
				<div class="content no-padding" v-if="tabTarget === 'properties'">
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
										:readonly="readonly"
									/>
								</td>
							</tr>

							<tr><td colspan="2"><b>{{ capApp.fontSettings }}</b></td></tr>
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
								:readonly="readonly"
							/>

							<tr><td colspan="2"><b>{{ capGen.overwrites }}</b></td></tr>
							<my-builder-doc-sets
								v-model="doc.sets"
								:allowTypeData="true"
								:allowTypeValue="false"
								:joinsIndexMap="[]"
								:readonly
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
			
			// state
			sideColumnIdShow:null,
			sideFieldIdShow:null,
			sidePageIdShow:null,
			showSidebar:true,
			tabPageIdShow:0,
			tabTarget:'properties'
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
			let texts   = [];
			for(let i = 0, j = s.doc.pages.length; i < j; i++) {
				pageIndexes.push(s.doc.pages[i].id);
				texts.push(`P${i+1}`);
			}
			return {
				entries:pageIndexes,
				entriesText:texts
			};
		},

		// simple
		docOrg:        (s) => s.docIdMap[s.id] === undefined ? false : s.docIdMap[s.id],
		hasChanges:    (s) => !s.deepIsEqual(s.doc,s.docOrg),
		module:        (s) => s.moduleIdMap[s.doc.moduleId],
		sideColumnShow:(s) => s.sideColumnIdShow !== null,
		sideDocShow:   (s) => !s.sideColumnShow && !s.sideFieldShow && !s.sidePageShow,
		sideFieldShow: (s) => s.sideFieldIdShow !== null,
		sidePageShow:  (s) => s.sidePageIdShow !== null,
		
		// stores
		docIdMap:   (s) => s.$store.getters['schema/docIdMap'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.doc,
		capGen:     (s) => s.$store.getters.captions.generic
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
			if(id === this.sidePageIdShow)
				this.sidePageIdShow = null;

			const i = this.pageIdMapIndex[id];
			this.doc.pages.splice(i,1);
			this.resetPageTab();
		},
		pageMove(forward) {

		},
		pageSel(id) {
			this.sidePageIdShow = id;
			this.tabPageIdShow  = id;
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