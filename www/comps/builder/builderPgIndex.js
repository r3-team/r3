export {MyBuilderPgIndex as default};

let MyBuilderPgIndex = {
	name:'my-builder-pg-index',
	template:`<tr>
		<td>
			<my-button image="save.png"
				@trigger="set"
				:active="isNew && attributes.length !== 0 && !readonly"
				:caption="isNew ? capGen.button.create : ''"
				:captionTitle="isNew ? capGen.button.create : capGen.button.save"
			/>
			<my-button image="delete.png"
				v-if="!isNew"
				@trigger="del"
				:active="!autoFki && !primaryKey && !readonly"
				:cancel="true"
				:captionTitle="capGen.button.delete"
			/>
		</td>
		<td>
			<span>{{ pgIndexAttributesCaption }}</span>
			
			<select v-model="attributeInput" v-if="isNew" @change="addAttribute" :disabled="readonly">
				<option value="">{{ capApp.indexCreate }}</option>
				
				<template
					v-for="a in relation.attributes.filter(v => !attributeIdsUsed.includes(v.id))"
				>
					<option :value="a.id + '_ASC'">
						{{ getAttributeCaption(a.name,true) }}
					</option>
					<option :value="a.id + '_DESC'">
						{{ getAttributeCaption(a.name,false) }}
					</option>
				</template>
			</select>
		</td>
		<td><my-bool v-model="primaryKey" :readonly="true" /></td>
		<td><my-bool v-model="autoFki" :readonly="true" /></td>
		<td><my-bool v-model="noDuplicates" :readonly="!isNew || readonly" /></td>
	</tr>`,
	props:{
		index:{ type:Object, required:false,
			default:function() { return{
				id:null,
				autoFki:false,
				noDuplicates:false,
				primaryKey:false,
				attributes:[]
			}}
		},
		readonly:{ type:Boolean, required:true },
		relation:{ type:Object,  required:true }
	},
	data() {
		return {
			attributeInput:'',
			
			// values
			autoFki:this.index.autoFki,
			noDuplicates:this.index.noDuplicates,
			primaryKey:this.index.primaryKey,
			attributes:JSON.parse(JSON.stringify(this.index.attributes))
		};
	},
	computed:{
		attributeIdsUsed:(s) => {
			let ids = [];
			for(let a of s.attributes) {
				ids.push(a.attributeId);
			}
			return ids;
		},
		pgIndexAttributesCaption:(s) => {
			let out = [];
			for(let a of s.attributes) {
				out.push(s.getAttributeCaption(s.attributeIdMap[a.attributeId].name,a.orderAsc));
			}
			return out.join(' + ');
		},
		
		// simple states
		isNew:(s) => s.index.id === null,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.relation,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		addAttribute() {
			if(this.attributeInput === '') return;
			
			let s = this.attributeInput.split('_');
			this.attributes.push({
				attributeId:s[0],
				orderAsc:s[1] === 'ASC'
			});
			this.attributeInput = '';
		},
		getAttributeCaption(attributeName,orderAsc) {
			return `${attributeName} (${orderAsc ? 'ASC' : 'DESC'})`;
		},
		
		del(rel) {
			ws.send('pgIndex','del',{id:this.index.id},true).then(
				() => this.$root.schemaReload(this.relation.moduleId),
				this.$root.genericError
			);
		},
		set() {
			ws.send('pgIndex','set',{
				id:this.index.id,
				relationId:this.relation.id,
				noDuplicates:this.noDuplicates,
				attributes:this.attributes
			},true).then(
				() => {
					if(this.isNew) {
						this.attributes   = [];
						this.noDuplicates = false;
					}
					this.$root.schemaReload(this.relation.moduleId);
				},
				this.$root.genericError
			);
		}
	}
};