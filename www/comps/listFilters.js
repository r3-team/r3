import {getColumnIsFilterable} from './shared/column.js';
import {getQueryFilterNew}     from './shared/query.js';
export {MyListFilters as default};

let MyListFilters = {
	name:'my-list-filters',
	template:`<div class="list-filters">
		<div class="list-filters-content">
			<my-filters class="default-inputs"
				v-model="values"
				@apply="set"
				:columns="columns"
				:columnBatches="columnBatches"
				:joins="joins"
			/>
		</div>
		<div class="row space-between">
			<div class="row gap">
				<my-button image="add.png"
					@trigger="add"
					:caption="capGen.button.add"
					:naked="false"
				/>
			</div>
			<div class="row gap">
				<my-button image="cancel.png"
					@trigger="removeAll"
					:active="values.length !== 0"
					:cancel="true"
					:caption="capGen.button.reset"
				/>
				<my-button image="ok.png"
					@trigger="set"
					:active="values.length !== 0 && bracketsEqual"
					:caption="capGen.button.apply"
				/>
			</div>
		</div>
	</div>`,
	props:{
		columns:      { type:Array, required:true },
		columnBatches:{ type:Array, required:true },
		filters:      { type:Array, required:true },
		joins:        { type:Array, required:true }
	},
	emits:['set-filters'],
	data() {
		return {
			values:[]
		};
	},
	watch:{
		filters:{
			handler(v) { this.values = JSON.parse(JSON.stringify(v)); },
			immediate:true
		}
	},
	computed:{
		bracketsEqual:(s) => {
			let cnt0 = 0;
			let cnt1 = 0;
			for(const f of s.values) {
				cnt0 += f.side0.brackets;
				cnt1 += f.side1.brackets;
			}
			return cnt0 === cnt1;
		},

		// stores
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getColumnIsFilterable,
		getQueryFilterNew,

		// actions
		add() {
			let f = this.getQueryFilterNew();
			f.operator = 'ILIKE';
			
			// apply first available column
			for(const b of this.columnBatches) {
				for(const ci of b.columnIndexes) {
					const column = this.columns[ci];
					if(this.getColumnIsFilterable(column)) {
						f.side0.attributeId    = column.attributeId;
						f.side0.attributeIndex = column.index;
						f.side0.content        = 'attribute';
						break;
					}
				}
				if(f.side0.attributeId !== null)
					break;
			}
			let v = JSON.parse(JSON.stringify(this.values));
			v.push(f);
			this.values = v;
		},
		removeAll() {
			this.$emit('set-filters',[]);
		},
		set() {
			if(this.bracketsEqual)
				this.$emit('set-filters',JSON.parse(JSON.stringify(this.values)));
		}
	}
};