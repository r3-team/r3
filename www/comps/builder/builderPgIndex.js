export {MyBuilderPgIndex as default};

let MyBuilderPgIndex = {
	name:'my-builder-pg-index',
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-pg-index popUp" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/databaseAsterisk.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="delete.png"
						v-if="!isNew && !isSystem"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table-vertical">
					<tr>
						<td>{{ capGen.type }}</td>
						<td>
							<select v-model="values.method" :disabled="!isNew || readonly">
								<option value="BTREE">{{ capApp.method.BTREE }}</option>
								<option value="GIN">{{ capApp.method.GIN }}</option>
							</select>
						</td>
						<td>{{ capApp.description[values.method] }}</td>
					</tr>
					<tr>
						<td>{{ capApp.attributes }}</td>
						<td>
							<div class="column gap">
								<div class="row gap" v-if="isNew">
									<select v-model="attributeInput" :disabled="!isNew || readonly">
										<template v-for="a in relation.attributes.filter(v => !attributeIdsUsed.includes(v.id))">
											<option :value="a.id + '_ASC'">
												{{ getAttributeCaption(a.id,true) }}
											</option>
											<option v-if="isBtree" :value="a.id + '_DESC'">
												{{ getAttributeCaption(a.id,false) }}
											</option>
										</template>
									</select>
									<my-button image="add.png"
										@trigger="addAttribute"
										:active="isNew && attributeInput !== '' && (isBtree || values.attributes.length < 1)"
									/>
								</div>
								<div v-for="indAtr in values.attributes">
									{{ getAttributeCaption(indAtr.attributeId,indAtr.orderAsc) }}
								</div>
							</div>
						</td>
						<td>{{ capApp.attributesHint }}</td>
					</tr>
					<tr v-if="isBtree">
						<td>{{ capApp.unique }}</td>
						<td><my-bool v-model="values.noDuplicates" :readonly="!isNew || readonly" /></td>
						<td>{{ capApp.uniqueHint }}</td>
					</tr>
					<tr v-if="isGin">
						<td>{{ capApp.dictionary }}</td>
						<td>
							<select v-model="values.attributeIdDict" :disabled="!isNew || readonly">
								<option v-for="a in relation.attributes.filter(v => v.content === 'regconfig')" :value="a.id">
									{{ a.name }}
								</option>
							</select>
						</td>
						<td>{{ capApp.dictionaryHint }}</td>
					</tr>
					<tr v-if="isSystem">
						<td>{{ capGen.notice }}</td>
						<td colspan="2">{{ capApp.system }}</td>
					</tr>
					<tr v-if="!isSystem">
						<td>{{ capGen.notice }}</td>
						<td colspan="2">{{ capApp.noUpdate }}</td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		pgIndexId:      { required:true },
		builderLanguage:{ type:String,  required:true },
		readonly:       { type:Boolean, required:true },
		relation:       { type:Object,  required:true }
	},
	emits:['close'],
	data() {
		return {
			attributeInput:'',
			values:null,
			valuesOrg:null
		};
	},
	computed:{
		attributeIdsUsed:(s) => {
			let ids = [];
			for(let indAtr of s.values.attributes) {
				ids.push(indAtr.attributeId);
			}
			return ids;
		},
		
		// simple
		canSave:   (s) => s.values !== null && s.isNew && !s.isSystem && s.hasChanges && s.values.attributes.length !== 0,
		hasChanges:(s) => JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		isBtree:   (s) => s.values.method === 'BTREE',
		isGin:     (s) => s.values.method === 'GIN',
		isNew:     (s) => s.pgIndexId === null,
		isSystem:  (s) => s.values.primaryKey || s.values.autoFki,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		indexIdMap:    (s) => s.$store.getters['schema/indexIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.pgIndex,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.reset();
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// display
		getAttributeCaption(attributeId,orderAsc) {
			let order = this.isBtree ? ` (${orderAsc ? 'ASC' : 'DESC'})` : '';
			return `${this.attributeIdMap[attributeId].name}${order}`;
		},
		
		// actions
		addAttribute() {
			if(this.attributeInput === '') return;
			
			let s = this.attributeInput.split('_');
			this.values.attributes.push({
				attributeId:s[0],
				orderAsc:s[1] === 'ASC'
			});
			this.attributeInput = '';
		},
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's' && this.canSave) {
				this.set();
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},
		reset() {
			this.values = this.pgIndexId !== null
				? JSON.parse(JSON.stringify(this.indexIdMap[this.pgIndexId]))
				: {
					id:null,
					relationId:this.relation.id,
					attributeIdDict:null,
					autoFki:false,
					method:'BTREE',
					noDuplicates:false,
					primaryKey:false,
					attributes:[]
				};
			
			this.valuesOrg = JSON.parse(JSON.stringify(this.values));
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
			ws.send('pgIndex','del',{id:this.pgIndexId},true).then(
				() => {
					this.$root.schemaReload(this.relation.moduleId);
					this.$emit('close');
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('pgIndex','set',this.values,true).then(
				() => {
					this.$root.schemaReload(this.relation.moduleId);
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};