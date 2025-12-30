import MyBuilderCaption      from './builderCaption.js';
import MyBuilderQuery        from './builderQuery.js';
import MyTabs                from '../tabs.js';
import {deepIsEqual}         from '../shared/generic.js';
import {getDocPageTemplate} from '../shared/builderDoc.js';
export {MyBuilderDoc as default};

const MyBuilderDoc = {
	name:'my-builder-doc',
	components:{
		MyBuilderCaption,
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
					<my-button image="add.png"
						@trigger="pageAdd"
						:caption="capGen.button.add"
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
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
			<div class="top lower">
				<div class="area">
					<h1>{{ capGen.settings }}</h1>
				</div>
			</div>
			
			<my-tabs
				v-model="tabTarget"
				:entries="['content','properties']"
				:entriesIcon="['images/database.png','images/edit.png']"
				:entriesText="[capGen.content,capGen.properties]"
			/>
			
			<!-- content -->
			<div class="content grow" v-if="tabTarget === 'content'">
			</div>
			
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
					</tbody>
				</table>
			</div>
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
			showSidebar:true,
			tabTarget:'properties'
		};
	},
	computed:{
		// states
		hasChanges:(s) => !s.deepIsEqual(s.doc,s.docOrg),
		
		// simple
		docOrg:(s) => s.docIdMap[s.id] === undefined ? false : s.docIdMap[s.id],
		module:(s) => s.moduleIdMap[s.doc.moduleId],
		
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
		getDocPageTemplate,
		
		// actions
		pageAdd() {
			this.doc.pages.push(this.getDocPageTemplate());
		},
		reset() {
			if(this.docOrg !== false && !this.deepIsEqual(this.doc,this.docOrg))
				this.doc = JSON.parse(JSON.stringify(this.docOrg));
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