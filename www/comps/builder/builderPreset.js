import {isAttributeRelationship} from '../shared/attribute.js';
import {getDependentModules}     from '../shared/builder.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
export {MyBuilderPreset as default};

let MyBuilderPresetValue = {
	name:'my-builder-preset-value',
	template:`<tr>
		<td>{{ attribute.name }}</td>
		<td>
			<div class="row centered">
				<my-bool v-model="protectedInput" :readonly="readonly" />
				<my-button
					:active="false"
					:image="protected ? 'lock.png' : 'lockOpen.png'"
					:naked="true"
				/>
			</div>
		</td>
		<td>
			<select class="dynamic" v-if="isRelationship" v-model="presetIdReferInput" :disabled="readonly">
				<option :value="null">[{{ attribute.content }}]</option>
				<option v-for="p in relationship.presets" :value="p.id">{{ p.name }}</option>
			</select>
			
			<textarea class="dynamic startAsOneLine"
				v-if="!isRelationship"
				v-model="valueInput"
				:disabled="readonly"
				:placeholder="attribute.content"
			></textarea>
		</td>
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
	components:{ MyBuilderPresetValue },
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox scroll float" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" :src="values.protected ? 'images/lock.png' : 'images/lockOpen.png'" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',values.name) }}</h1>
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
					<my-button image="visible1.png"
						@trigger="copyValueDialog(values.name,id,id)"
						:active="!isNew"
						:caption="capGen.id"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
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
						<td><span>{{ capGen.name }}</span></td>
						<td colspan="2"><input class="dynamic" v-model="values.name" /></td>
					</tr>
					<tr>
						<td><span>{{ capApp.protected }}</span></td>
						<td>
							<div class="row centered">
								<my-bool v-model="values.protected" :readonly="readonly" />
								<my-button
									:active="false"
									:image="values.protected ? 'lock.png' : 'lockOpen.png'"
									:naked="true"
								/>
							</div>
						</td>
						<td v-html="capApp.protectedHint"></td>
					</tr>
					<tr>
						<td colspan="3"><b>{{ capApp.values }}</b></td>
					</tr>
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
				</table>
			</div>
		</div>
	</div>`,
	props:{
		id:      { required:true },
		readonly:{ type:Boolean, required:true },
		relation:{ type:Object,  required:true }
	},
	emits:['close'],
	data() {
		return {
			values:null,
			valuesOrg:null
		};
	},
	computed:{
		attributeIdMapValue:(s) => {
			let map = {};
			for(let v of s.values.values) {
				map[v.attributeId] = v;
			}
			return map;
		},

		// simple
		canSave:   (s) => s.values !== null && s.values.name !== '' && s.hasChanges,
		hasChanges:(s) => JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		isNew:     (s) => s.id === null,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.preset,
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
		// externals
		copyValueDialog,
		getDependentModules,
		getNilUuid,
		isAttributeRelationship,
		
		// actions
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
			const atr = this.attributeIdMap[atrId];
			
			// no preset value yet for attribute, create one
			if(this.attributeIdMapValue[atrId] === undefined)
				return this.values.values.push({
					id:this.getNilUuid(),
					attributeId:atrId,
					presetIdRefer:presetIdRefer,
					protected:protec,
					value:value
				});
			
			// update existing preset value
			for(let i = 0, j = this.values.values.length; i < j; i++) {
				if(this.values.values[i].attributeId !== atrId)
					continue;
				
				// remove preset value if nothing is set
				if((this.isAttributeRelationship(atr.content) && presetIdRefer === null) ||
					(!this.isAttributeRelationship(atr.content) && value === ''))
				{
					this.values.values.splice(i,1);
					break;
				}
				
				this.values.values[i].presetIdRefer = presetIdRefer;
				this.values.values[i].protected     = protec;
				this.values.values[i].value         = value;
				break;
			}
		},
		closeReload() {
			this.$root.schemaReload(this.relation.moduleId);
			this.$emit('close');
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
			if(this.id === null) {
				this.values = {
					id:null,
					name:'',
					relationId:this.relation.id,
					protected:true,
					values:[]
				};
			}
			else {
				for(const p of this.relation.presets) {
					if(p.id === this.id) {
						this.values = JSON.parse(JSON.stringify(p));
						break;
					}
				}
			}
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
		del(rel) {
			ws.send('preset','del',{id:this.id},true).then(
				this.closeReload,
				this.$root.genericError
			);
		},
		set() {
			ws.send('preset','set',this.values,true).then(
				this.closeReload,
				this.$root.genericError
			);
		}
	}
};