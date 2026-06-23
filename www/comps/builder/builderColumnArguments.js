import {getIndexAttributeIdsByJoins}  from '../shared/attribute.js';
import {getCaptionByIndexAttributeId} from '../shared/query.js';

export default {
	name:'my-builder-column-arguments',
	template:`<div class="column gap">
		<div class="class row gap" v-for="(a,i) in modelValue">

			<my-label :caption="'#' + String(i)" />
			<select
				@change="setIndexAttribute(i,$event.target.value)"
				:disabled="readonly"
				:value="a.attributeIndex+'_'+a.attributeId"
			>
				<option value="0_null">[{{ capGen.valueFixedText }}]</option>
				<option v-for="ia in indexAttributeIds" :value="ia">
					{{ getCaptionByIndexAttributeId(ia) }}
				</option>
			</select>

			<input class="short"
				v-if="a.attributeId === null"
				@input="setValue(i,$event.target.value)"
				:disabled="readonly"
				:placeholder="capGen.value"
				:value="a.value"
			/>
			<my-button image="delete.png"
				@trigger="del(i)"
				:active="!readonly"
				:cancel="true"
			/>
		</div>
	</div>`,
	props:{
		joinsParents:{ type:Array,   required:true },
		modelValue:  { type:Array,   required:true },
		readonly:    { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		indexAttributeIds:s => s.joinsParents.length === 0 ? [] : s.getIndexAttributeIdsByJoins(s.joinsParents[0],[]),

		// stores
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,

		// actions
		del(pos) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.splice(pos,1);
			this.$emit('update:modelValue',v);
		},
		setIndexAttribute(pos,ia) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			let p = ia.split('_');
			if(p[1] === 'null') {
				v[pos].attributeId    = null;
				v[pos].attributeIndex = 0;
			} else {
				v[pos].attributeId    = p[1];
				v[pos].attributeIndex = parseInt(p[0]);
			}
			this.$emit('update:modelValue',v);
		},
		setValue(pos,input) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[pos].value = input === '' ? null : input;
			this.$emit('update:modelValue',v);
		}
	}
};