import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
import {
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeFloat,
	isAttributeInteger,
	isAttributeNumeric,
	isAttributeRelationship,
	isAttributeString,
	isAttributeUuid
} from '../shared/attribute.js';
export {MyBuilderAttribute as default};

let MyBuilderAttribute = {
	name:'my-builder-attribute',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput
	},
	template:`<tr>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !readonly"
					:caption="isNew ? capGen.button.create : ''"
					:captionTitle="isNew ? capGen.button.create : capGen.button.save"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="delAsk"
					:active="!isId && !readonly"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</td>
		<td>
			<my-builder-icon-input
				@input="iconId = $event"
				:icon-id-selected="iconId"
				:module="module"
				:readonly="readonly"
			/>
		</td>
		<td>
			<input
				v-model="name"
				:placeholder="isNew ? capApp.new : ''"
				:disabled="readonly || isId"
			/>
		</td>
		<td class="minimum">
			<my-button image="visible1.png"
				@trigger="copyValueDialog(attribute.name,attribute.id,attribute.id)"
				:active="!isNew"
			/>
		</td>
		<td>
			<my-builder-caption
				v-model="captions.attributeTitle"
				:language="builderLanguage"
				:readonly="readonly"
			/>
		</td>
		<td>
			<select v-model="content" :disabled="readonly">
				<option v-if="isNew || isAttributeInteger(content)" value="integer">integer</option>
				<option v-if="isNew || isAttributeInteger(content)" value="bigint">bigint</option>
				<option v-if="isNew || isAttributeNumeric(content)" value="numeric">numeric</option>
				<option v-if="isNew || isAttributeFloat(content)"   value="real">real</option>
				<option v-if="isNew || isAttributeFloat(content)"   value="double precision">double precision</option>
				<option v-if="isNew || isAttributeString(content)"  value="varchar">varchar</option>
				<option v-if="isNew || isAttributeString(content)"  value="text">text</option>
				<option v-if="isNew || isAttributeBoolean(content)" value="boolean">boolean</option>
				<option v-if="isNew || isAttributeUuid(content)"    value="uuid">UUID</option>
				<option v-if="isNew || isAttributeFiles(content)"   value="files">files</option>
				<option v-if="isNew || isAttributeRelationship(content)" value="1:1">1:1</option>
				<option v-if="isNew || isAttributeRelationship(content)" value="n:1">
					{{ !foreign ? 'n:1' : '1:n' }}
				</option>
			</select>
		</td>
		<td>
			<select
				v-model="relationshipId"
				:disabled="!isNew || readonly || !isRelationship || isId"
			>
				<option :value="null">-</option>
				<option v-for="rel in module.relations" :value="rel.id">
					{{ !foreign ? rel.name : module.name + ': ' + rel.name }}
				</option>
				
				<!-- relations from other modules -->
				<optgroup
					v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.relations.length !== 0)"
					:label="mod.name"
				>
					<option v-for="rel in mod.relations" :value="rel.id">
						{{ mod.name + ': ' + rel.name }}
					</option>
				</optgroup>
			</select>
		</td>
		<td>
			<input class="short"
				v-model.number="length"
				:disabled="readonly || isId || !hasLength"
			/>
		</td>
		<td>
			<my-bool
				v-model="nullable"
				:readonly="readonly || isId"
			/>
		</td>
		<td v-if="relation.encryption">
			<my-bool
				v-model="encrypted"
				:readonly="readonly || !isNew || !canEncrypt"
			/>
		</td>
		<td>
			<input placeholder="NO DEFAULT"
				v-if="!isId"
				v-model="def"
				:disabled="readonly || isId || isFiles"
			/>
			<input v-if="isId" placeholder="SYSTEM" disabled="disabled" />
		</td>
		<td>
			<select v-model="onUpdate" :disabled="readonly || !isRelationship || isId">
				<option v-if="!isRelationship" value="">-</option>
				<template v-if="isRelationship">
					<option value="NO ACTION">NO ACTION</option>
					<option value="RESTRICT">RESTRICT</option>
					<option value="CASCADE">CASCADE</option>
					<option value="SET NULL">SET NULL</option>
					<option value="SET DEFAULT">SET DEFAULT</option>
				</template>
			</select>
		</td>
		<td>
			<select v-model="onDelete" :disabled="readonly || !isRelationship || isId">
				<option v-if="!isRelationship" value="">-</option>
				<template v-if="isRelationship">
					<option value="NO ACTION">NO ACTION</option>
					<option value="RESTRICT">RESTRICT</option>
					<option value="CASCADE">CASCADE</option>
					<option value="SET NULL">SET NULL</option>
					<option value="SET DEFAULT">SET DEFAULT</option>
				</template>
			</select>
		</td>
	</tr>`,
	props:{
		attribute:{
			type:Object,
			required:false,
			default:function() { return{
				id:null,
				relationshipId:null,
				iconId:null,
				content:'integer',
				length:0,
				name:'',
				nullable:true,
				encrypted:false,
				def:'',
				onUpdate:'NO ACTION',
				onDelete:'NO ACTION',
				captions:{
					attributeTitle:{}
				}
			}}
		},
		builderLanguage:{ type:String,  required:true },
		foreign:        { type:Boolean, required:true },
		relation:       { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			relationshipId:!this.foreign ? this.attribute.relationshipId : this.attribute.relationId,
			iconId:this.attribute.iconId,
			content:this.attribute.content,
			length:this.attribute.length,
			name:this.attribute.name,
			nullable:this.attribute.nullable,
			encrypted:this.attribute.encrypted,
			def:this.attribute.def,
			onUpdate:this.attribute.onUpdate,
			onDelete:this.attribute.onDelete,
			captions:JSON.parse(JSON.stringify(this.attribute.captions))
		};
	},
	computed:{
		hasChanges:(s) => s.iconId !== s.attribute.iconId
			|| s.relationshipId !== s.attribute.relationshipId
			|| s.content        !== s.attribute.content
			|| s.length         !== s.attribute.length
			|| s.name           !== s.attribute.name
			|| s.nullable       !== s.attribute.nullable
			|| s.encrypted      !== s.attribute.encrypted
			|| s.def            !== s.attribute.def
			|| s.onUpdate       !== s.attribute.onUpdate
			|| s.onDelete       !== s.attribute.onDelete
			|| JSON.stringify(s.captions) !== JSON.stringify(s.attribute.captions),
		
		// simple states
		canEncrypt:    (s) => s.content === 'text',
		hasLength:     (s) => ['varchar','files'].includes(s.content),
		isFiles:       (s) => s.isAttributeFiles(s.content),
		isId:          (s) => !s.isNew && s.attribute.name === 'id',
		isNew:         (s) => s.attribute.id === null,
		isRelationship:(s) => s.isAttributeRelationship(s.content),
		
		// stores
		module:       (s) => s.moduleIdMap[s.relation.moduleId],
		modules:      (s) => s.$store.getters['schema/modules'],
		moduleIdMap:  (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap:(s) => s.$store.getters['schema/relationIdMap'],
		capApp:       (s) => s.$store.getters.captions.builder.attribute,
		capGen:       (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		isAttributeBoolean,
		isAttributeFiles,
		isAttributeFloat,
		isAttributeInteger,
		isAttributeNumeric,
		isAttributeRelationship,
		isAttributeString,
		isAttributeUuid,
		getDependentModules,
		
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
		del(rel) {
			ws.send('attribute','del',{id:this.attribute.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set() {
			if(this.encrypted && !this.canEncrypt)
				this.encrypted = false;
			
			ws.sendMultiple([
				ws.prepare('attribute','set',{
					id:this.attribute.id,
					moduleId:this.relation.moduleId,
					relationId:this.relation.id,
					relationshipId:this.relationshipId,
					iconId:this.iconId,
					name:this.name,
					content:this.content,
					length:this.length,
					nullable:this.nullable,
					encrypted:this.encrypted,
					def:this.def,
					onUpdate:this.onUpdate,
					onDelete:this.onDelete,
					captions:this.captions
				}),
				ws.prepare('schema','check',{
					moduleId:this.relation.moduleId
				})
			],true).then(
				() => {
					if(this.isNew) {
						this.name   = '';
						this.iconId = null;
						this.def    = '';
						this.length = 0;
						this.relationshipId = null;
						this.captions = {
							attributeTitle:{}
						};
					}
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};