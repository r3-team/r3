import {isAttributeRelationship} from '../shared/attribute.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
export {MyBuilderPreset as default};

let MyBuilderPresetValue = {
	name:'my-builder-preset-value',
	template:`<tr>
		<td><span>{{ attribute.name }}</span></td>
		<td>
			<select v-if="isRelationship" v-model="presetIdReferInput" :disabled="readonly">
				<option :value="null">[{{ attribute.content }}]</option>
				<option v-for="p in relationship.presets" :value="p.id">
					{{ p.name }}
				</option>
			</select>
			
			<textarea
				v-if="!isRelationship"
				v-model="valueInput"
				:disabled="readonly"
				:placeholder="attribute.content"
			></textarea>
		</td>
		<td><my-bool v-model="protectedInput" :readonly="readonly" /></td>
	</tr>`,
	props:{
		attribute:    { type:Object,  required:true },
		presetIdRefer:{ required:true },
		protected:    { type:Boolean, required:true },
		readonly:     { type:Boolean, required:true },
		value:        { type:String,  required:true }
	},
	emits:['set'],
	computed:{
		isRelationship:(s) => s.isAttributeRelationship(s.attribute.content),
		relationship:  (s) => !s.isRelationship ? false : s.relationIdMap[s.attribute.relationshipId],
		
		// inputs
		presetIdReferInput:{
			get()  { return this.presetIdRefer; },
			set(v) { return this.$emit('set',v,this.protected,this.value); }
		},
		protectedInput:{
			get()  { return this.protected; },
			set(v) { return this.$emit('set',this.presetIdRefer,v,this.value); }
		},
		valueInput:{
			get()  { return this.value; },
			set(v) { return this.$emit('set',this.presetIdRefer,this.protected,v); }
		},
		
		// stores
		relationIdMap:(s) => s.$store.getters['schema/relationIdMap']
	},
	methods:{
		isAttributeRelationship
	}
};

let MyBuilderPreset = {
	name:'my-builder-preset',
	components:{MyBuilderPresetValue},
	template:`<tbody class="builder-preset">
		<tr>
			<td>
				<div class="row gap">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && !readonly"
						:caption="isNew ? capGen.button.create : ''"
						:captionTitle="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</td>
			<td>
				<input v-model="name" :disabled="readonly" :placeholder="isNew ? capApp.new : ''" />
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="copyValueDialog(name,preset.id,preset.id)"
					:active="!isNew"
				/>
			</td>
			<td><my-bool v-model="protected" :readonly="readonly" /></td>
			<td class="minimum">
				<my-button
					@trigger="showValues = !showValues"
					:caption="capApp.valueCount.replace('{CNT}',values.length)"
				/>
			</td>
			<td>
				<input disabled="readonly" :value="previewLine" />
			</td>
		</tr>
		<tr v-if="showValues">
			<td colspan="999">
				<div class="preset-values">
					<table>
						<thead>
							<tr>
								<th colspan="2" class="no-padding">{{ capApp.value }}</th>
								<th>{{ capApp.protected }}</th>
							</tr>
						</thead>
						<tbody>
							<my-builder-preset-value
								v-for="(a,i) in relation.attributes.filter(v => v.name !== 'id')"
								@set="(...args) => childSet(a.id,...args)"
								:attribute="a"
								:key="a.id"
								:preset-id-refer="childGet(a.id,'presetIdRefer')"
								:protected="childGet(a.id,'protected')"
								:readonly="readonly"
								:value="childGet(a.id,'value')"
							/>
						</tbody>
					</table>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		readonly:{ type:Boolean, required:true },
		relation:{ type:Object,  required:true },
		preset:{
			type:Object,
			required:false,
			default:function() { return{
				id:null,
				name:'',
				presetIdRefer:null,
				protected:true,
				values:[]
			}}
		}
	},
	data() {
		return {
			showValues:false,
			name:this.preset.name,
			protected:this.preset.protected,
			values:JSON.parse(JSON.stringify(this.preset.values))
		};
	},
	computed:{
		hasChanges:(s) => {
			if(s.name === '')
				return false;
			
			return (s.isNew && s.values.length !== 0)
				|| s.name !== s.preset.name
				|| s.protected !== s.preset.protected
				|| JSON.stringify(s.values) !== JSON.stringify(s.preset.values);
		},
		previewLine:(s) => {
			let items = [];
			for(let v of s.values) {
				if(v.value !== '')
					items.push(v.value);
			}
			return items.join(', ');
		},
		attributeIdMapValue:(s) => {
			let map = {};
			for(let v of s.values) {
				map[v.attributeId] = v;
			}
			return map;
		},
		
		// simple states
		isNew:(s) => s.preset.id === null,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.preset,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		getNilUuid,
		isAttributeRelationship,
		
		childGet(atrId,mode) {
			const exists = typeof this.attributeIdMapValue[atrId] !== 'undefined';
			
			switch(mode) {
				case 'presetIdRefer':
					return exists ? this.attributeIdMapValue[atrId].presetIdRefer : null;
				break;
				case 'protected':
					return exists ? this.attributeIdMapValue[atrId].protected : true;
				break;
				case 'value':
					return exists ? this.attributeIdMapValue[atrId].value : '';
				break;
			}
			return false;
		},
		childSet(atrId,presetIdRefer,protec,value) {
			let atr = this.attributeIdMap[atrId];
			
			// no preset value yet for attribute, create one
			if(typeof this.attributeIdMapValue[atrId] === 'undefined') {
				this.values.push({
					id:this.getNilUuid(),
					attributeId:atrId,
					presetIdRefer:presetIdRefer,
					protected:protec,
					value:value
				});
				return;
			}
			
			// update existing preset value
			for(let i = 0, j = this.values.length; i < j; i++) {
				if(this.values[i].attributeId !== atrId)
					continue;
				
				// remove preset value if nothing is set
				if((this.isAttributeRelationship(atr.content) && presetIdRefer === null)
					|| (!this.isAttributeRelationship(atr.content) && value === '')) {
					
					this.values.splice(i,1);
					break;
				}
				
				this.values[i].presetIdRefer = presetIdRefer;
				this.values[i].protected     = protec;
				this.values[i].value         = value;
				break;
			}
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
		del(rel) {
			ws.send('preset','del',{id:this.preset.id},true).then(
				() => this.$root.schemaReload(this.relation.moduleId),
				this.$root.genericError
			);
		},
		set() {
			ws.send('preset','set',{
				id:this.preset.id,
				relationId:this.relation.id,
				name:this.name,
				protected:this.protected,
				values:this.values
			},true).then(
				() => {
					if(this.isNew) {
						this.name   = '';
						this.values = [];
					}
					this.$root.schemaReload(this.relation.moduleId);
				},
				this.$root.genericError
			);
		}
	}
};