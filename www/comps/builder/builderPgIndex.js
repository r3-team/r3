export {MyBuilderPgIndex as default};

let MyBuilderPgIndex = {
	name:'my-builder-pg-index',
	template:`<tr>
		<td>
			<span>{{ pgIndexAttributesCaption }}</span>
			
			<select v-model="attributeInput" v-if="isNew" @change="addAttribute">
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
		<td><my-bool v-model="autoFki" :readonly="true" /></td>
		<td><my-bool v-model="noDuplicates" :readonly="!isNew" /></td>
		<td>
			<my-button image="save.png"
				v-if="isNew"
				@trigger="set"
				:active="attributes.length !== 0"
			/>
			<my-button image="delete.png"
				v-if="!isNew && !autoFki"
				@trigger="del"
				:cancel="true"
			/>
		</td>
	</tr>`,
	props:{
		index:{ type:Object, required:false,
			default:function() { return{
				id:null,
				autoFki:false,
				noDuplicates:false,
				attributes:[]
			}}
		},
		relation:{ type:Object, required:true }
	},
	data:function() {
		return {
			attributeInput:'',
			
			// values
			autoFki:this.index.autoFki,
			noDuplicates:this.index.noDuplicates,
			attributes:JSON.parse(JSON.stringify(this.index.attributes))
		};
	},
	computed:{
		attributeIdsUsed:function() {
			let ids = [];
			
			for(let i = 0, j = this.attributes.length; i < j; i++) {
				ids.push(this.attributes[i].attributeId);
			}
			return ids;
		},
		pgIndexAttributesCaption:function() {
			let out = [];
			for(let i = 0, j = this.attributes.length; i < j; i++) {
				let atr = this.attributeIdMap[this.attributes[i].attributeId];
				
				out.push(this.getAttributeCaption(atr.name,this.attributes[i].orderAsc));
			}
			return out.join(' + ');
		},
		
		// simple states
		isNew:function() { return this.index.id === null; },
		
		// stores
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.relation; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		addAttribute:function() {
			if(this.attributeInput === '') return;
			
			let s = this.attributeInput.split('_');
			
			this.attributes.push({
				attributeId:s[0],
				orderAsc:s[1] === 'ASC'
			});
			this.attributeInput = '';
		},
		getAttributeCaption:function(attributeName,orderAsc) {
			return `${attributeName} (${orderAsc ? 'ASC' : 'DESC'})`;
		},
		
		del:function(rel) {
			ws.send('pgIndex','del',{id:this.index.id},true).then(
				(res) => this.$root.schemaReload(this.relation.moduleId),
				(err) => this.$root.genericError(err)
			);
		},
		set:function() {
			ws.send('pgIndex','set',{
				id:this.index.id,
				relationId:this.relation.id,
				noDuplicates:this.noDuplicates,
				attributes:this.attributes
			},true).then(
				(res) => {
					if(this.isNew) {
						this.attributes   = [];
						this.noDuplicates = false;
					}
					this.$root.schemaReload(this.relation.moduleId);
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};