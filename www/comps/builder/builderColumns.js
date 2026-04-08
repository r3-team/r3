import MyBuilderCaption     from './builderCaption.js';
import {getItemTitleColumn} from '../shared/builder.js';
import {getTemplateColumn}  from '../shared/builderTemplate.js';
import {getFlexBasis}       from '../shared/form.js';
import {
	getIndexAttributeId,
	isAttributeRelationship
} from '../shared/attribute.js';
import {
	getColumnIcon,
	getColumnTitleForLang
} from '../shared/column.js';

export const MyBuilderColumns = {
	name:'my-builder-columns',
	components:{MyBuilderCaption},
	template:`<draggable class="builder-column-batches" handle=".dragBatch" animation="100" itemKey="id"
		v-model="batches"
		:group="groupBatches"
	>
		<!-- computed column batch -->
		<template #item="{element:batch,index:batchIndex}">
			<div class="builder-column-batch" :class="{ dragBatch:!readonly }">
				<div class="builder-column-batch-options">
					<img class="icon move" src="images/column.png" :title="capApp.columnBatch" />
					
					<span v-if="batchIndex < batchIndexTitle.length">
						{{ batchIndexTitle[batchIndex] }}
					</span>
					
					<my-builder-caption class="caption"
						v-if="hasCaptions"
						@update:modelValue="batch.columns[0].captions = {columnTitle:$event}"
						:contentName="getColumnTitleForLang(batch.columns[0],builderLanguage)"
						:dynamicSize="true"
						:language="builderLanguage"
						:modelValue="batch.columns[0].captions.columnTitle"
						:readonly
					/>
					<img class="icon clickable"
						v-if="hasStyling && !readonly"
						@click="toggleVertical(batch.columns[0])"
						:src="batch.columns[0].styles.includes('vertical') ? 'images/flexColumn.png' : 'images/flexRow.png'"
						:title="capApp.columnBatchDir"
					/>
					<img class="icon clickable" src="images/delete.png"
						v-if="!readonly"
						@click="batchRemove(batchIndex)"
						:title="capGen.button.delete"
					/>
				</div>
				
				<!-- columns in batch -->
				<draggable handle=".dragAnchor" class="children" animation="100" itemKey="id"
					v-model="batch.columns"
					@change="batches = batches"
					:class="{ vertical:batch.columns[0].styles.includes('vertical') }"
					:group="groupColumns"
				>
					<template #item="{element:column}">
				   	 	<div class="builder-field column column-wrap" :class="{ dragAnchor:!readonly, selected:columnIdShow === column.id }">
							<div class="builder-field-header">
								<my-button
									@trigger="$emit('column-id-show',column.id,'properties')"
									:image="getColumnIcon(column)"
									:naked="true"
								/>
								<my-button image="database.png"
									v-if="column.subQuery"
									@trigger="$emit('column-id-show',column.id,'content')"
									:naked="true"
								/>
								<div class="title word-break" :title="getItemTitleColumn(column,false)">
									{{ getItemTitleColumn(column,false) }}
								</div>
								
								<div class="row centered gap">
									<div class="clickable"
										v-if="!readonly"
										@click="columnSetBy(column.id,'basis',toggleSize(column.basis,25))"
										@click.prevent.right="columnSetBy(column.id,'basis',toggleSize(column.basis,-25))"
										:title="capApp.columnSize"
									>
										<span>{{ getFlexBasis(column.basis) }}</span>
									</div>
									<img class="action clickable" src="images/visible0.png"
										v-if="column.hidden && !readonly"
										@click="columnSetBy(column.id,'hidden',false)"
										:title="capGen.showDefault0"
									/>
									<img class="action clickable" src="images/smartphoneOff.png"
										v-if="!column.hidden && !column.onMobile && !readonly"
										@click="columnSetBy(column.id,'onMobile',true)"
										:title="capGen.showDefaultMobile0"
									/>
									<img class="action end clickable" src="images/columnOff.png"
										v-if="batch.columns.length !== 1 && !readonly"
										@click="columnSetBy(column.id,'batch',null)"
										:title="capApp.columnBatchOff"
									/>
								</div>
							</div>
						</div>
					</template>
				</draggable>
			</div>
		</template>
	</draggable>`,
	props:{
		batchIndexTitle:{ type:Array,   required:false, default:() => [] }, // titles by batch index (0 is for first batch)
		builderLanguage:{ type:String,  required:true },
		columns:        { type:Array,   required:true },
		columnIdShow:   { required:false,default:null },
		groupName:      { type:String,  required:true },
		hasBatches:     { type:Boolean, required:false, default:true },
		hasCaptions:    { type:Boolean, required:true },
		hasStyling:     { type:Boolean, required:false, default:true }, // display/formatting options
		readonly:       { type:Boolean, required:true }
	},
	emits:['column-id-show','columns-set'],
	computed:{
		batches:{
			get() {
				let out = [];
				for(let c of this.columns) {
					let columnAdded = false;
					
					if(c.batch !== null) {
						// lookup existing batch to add column to
						for(let i = 0, j = out.length; i < j; i++) {
							if(out[i].batch === c.batch) {
								out[i].columns.push(c);
								columnAdded = true;
								break;
							}
						}
					}
					
					// column is either without batch or the first column of a batch
					// create new batch with single column in it
					if(!columnAdded) {
						out.push({
							batch:c.batch,
							columns:[c],
							vertical:c.styles.includes('vertical')
						});
					}
				}
				return out;
			},
			set(batches) {
				let columns = [];
				let index   = 0; // unique index to separate nearby but separate batches
				
				for(let b of batches) {
					if(b.columns.length === 0)
						continue; // remove empty
					
					let sharedIndex = b.columns.length === 1 ? null : index++;
					
					for(let c of b.columns) {
						c.batch = sharedIndex;
						columns.push(c);
					}
				}
				this.$emit('columns-set',columns);
			}
		},
		
		// drag groups must be unique or else batches/columns could be moved between separate entities
		groupBatches:s => {
			let name = `batches_${s.groupName}`;
			return { name:name, pull:[name], put:[name] };
		},
		groupColumns:s => {
			return {
				name:s.groupName,
				pull:s.hasBatches ? [s.groupName] : false,
				put:s.hasBatches ? [s.groupName] : false
			};
		},
		
		// stores
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.form,
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getColumnIcon,
		getColumnTitleForLang,
		getFlexBasis,
		getItemTitleColumn,
		
		// actions
		batchRemove(i) {
			// close column properties
			for(const c of this.batches[i].columns) {
				if(c.id === this.columnIdShow) {
					this.$emit('column-id-show',null,'properties');
					break;
				}
			}

			let batches = JSON.parse(JSON.stringify(this.batches));
			batches.splice(i,1);
			this.batches = batches;
		},
		columnSetBy(id,name,value) {
			let columns = JSON.parse(JSON.stringify(this.columns));
			for(let i = 0, j = columns.length; i < j; i++) {
				if(columns[i].id === id) {
					columns[i][name] = value;
					return this.$emit('columns-set',columns);
				}
			}
		},
		toggleSize(oldVal,change) {
			return oldVal+change < 0 ? 0 : oldVal+change;
		},
		toggleVertical(column) {
			const pos = column.styles.indexOf('vertical');
			if(pos === -1) column.styles.push('vertical');
			else           column.styles.splice(pos,1);
		}
	}
};

export const MyBuilderColumnTemplates = {
	name:'my-builder-column-templates',
	template:`<draggable class="builder-column-batches template" handle=".dragAnchor" animation="100" itemKey="id"
		v-model="batches"
		:group="groupName"
	>
		<template #item="{element:b}">
			<div class="builder-column-batch" :class="{ dragAnchor:!readonly }">
				
				<div v-for="c in b.columns" class="builder-column-batch-options">
					<img class="icon clickable" src="images/add.png"
						v-if="!readonly"
						@click="$emit('column-add',c)"
						:title="capGen.button.add"
					/>
					<my-button
						:active="false"
						:image="getColumnIcon(c)"
						:naked="true"
					/>
					<div class="title word-break" :title="getItemTitleColumn(c,false)">
						{{ getItemTitleColumn(c,false) }}
					</div>
				</div>
			</div>
		</template>
	</draggable>`,
	props:{
		allowRelationships:{ type:Boolean, required:false, default:false },
		columns:           { type:Array,   required:true },
		groupName:         { type:String,  required:true },
		joins:             { type:Array,   required:true },
		readonly:          { type:Boolean, required:true }
	},
	emits:['column-add'],
	computed:{
		batches:{
			get() {
				// add attribute columns
				let out = [];
				for(let join of this.joins) {
					let rel = this.relationIdMap[join.relationId];
					
					for(let atr of rel.attributes) {
						if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(join.index,atr.id,false,null)))
							continue;
						
						if(this.isAttributeRelationship(atr.content) && !this.allowRelationships)
							continue;
						
						out.push({
							batch:null,
							columns:[this.getTemplateColumn(atr.id,join.index,false)],
							vertical:false
						});
					}
				}
				
				// add sub query column
				out.push({
					batch:null,
					columns:[this.getTemplateColumn(null,0,true)],
					vertical:false
				});
				return out;
			},
			set() {}
		},
		indexAttributeIdsUsed:(s) => {
			let ids = [];
			for(let c of s.columns) {
				ids.push(s.getIndexAttributeId(c.index,c.attributeId,false,null));
			}
			return ids;
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getColumnIcon,
		getIndexAttributeId,
		getItemTitleColumn,
		getTemplateColumn,
		isAttributeRelationship
	}
};