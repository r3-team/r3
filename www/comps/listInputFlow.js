export default {
	name:'my-list-input-flow',
	template:`<div class="list-input-flow">
			<slot name="input-icon" />
			<div class="list-input-flow-entry-wrap"
				v-for="(r,i) in rows"
				@click="$emit('clicked-row',r)"
				:class="{ clickable:!readonly }"
			>
				<div class="list-input-flow-entry" :class="{ active:i <= rowLastIndexActive, readonly }">
					<div class="list-input-flow-entry-values" v-for="(b,bi) in columnBatches" :style="b.style">
						<template v-for="(ci,cii) in b.columnIndexes">
							<my-value-rich class="context-list-input"
								v-if="r.values[ci] !== null"
								:alignEnd="columns[ci].flags.alignEnd"
								:alignMid="columns[ci].flags.alignMid"
								:attribute-id="columns[ci].attributeId"
								:basis="columns[ci].basis"
								:bold="columns[ci].flags.bold"
								:boolAtrIcon="columns[ci].flags.boolAtrIcon"
								:clipboard="columns[ci].flags.clipboard"
								:display="columns[ci].display"
								:italic="columns[ci].flags.italic"
								:key="ci"
								:length="columns[ci].length"
								:monospace="columns[ci].flags.monospace"
								:noShrink="columns[ci].flags.noShrink"
								:noThousandsSep="columns[ci].flags.noThousandsSep"
								:value="r.values[ci]"
								:wrap="columns[ci].flags.wrap"
							/>
						</template>
					</div>
					<div class="list-input-flow-entry-actions" v-if="anyActions">
						<my-button image="open.png"
							v-if="showOpen"
							@trigger="$emit('clicked-open',r)"
							@trigger-middle="$emit('clicked-open-middle',r)"
							:blockBubble="true"
							:captionTitle="capApp.inputHintOpen"
							:darkBg="i <= rowLastIndexActive"
							:naked="true"
						/>
					</div>
				</div>
			</div>
	</div>`,
	props:{
		columns:          { type:Array,   required:true },
		columnBatches:    { type:Array,   required:true },
		readonly:         { type:Boolean, required:true },
		recordIdsSelected:{ type:Array,   required:true },
		rows:             { type:Array,   required:true },
		showOpen:         { type:Boolean, required:true }
	},
	emits:['clicked-open','clicked-open-middle','clicked-row'],
	computed:{
		rowLastIndexActive:(s) => {
			for(let i = s.rows.length - 1; i >= 0; i--) {
				if(s.recordIdsSelected.includes(s.rows[i].indexRecordIds['0']))
					return i;
			}
			return -1;
		},

		// simple
		anyActions:(s) => s.showOpen,

		// stores
		capApp:(s) => s.$store.getters.captions.list
	}
};