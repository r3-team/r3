export default {
	name:'my-list-input-rows',
	template:`<div class="list-input-rows-wrap"
			@click="$emit('clicked')"
			:class="{ clickable:!multiInput && !readonly, 'multi-line':multiInput }"
		>
			<table class="list-input-rows">
				<tbody>
					<tr v-for="(r,i) in rows">
						
						<!-- icons -->
						<td class="minimum">
							<div class="list-input-row-items nowrap">
								
								<!-- either field/attribute icon or gallery file from first column -->
								<slot name="input-icon"
									v-if="!hasGalleryIcon || r.values[0] === null"
								/>
								<my-value-rich class="context-list-input"
									v-else
									@focus="$emit('focus')"
									:alignEnd="columns[0].flags.alignEnd"
									:alignMid="columns[0].flags.alignMid"
									:attribute-id="columns[0].attributeId"
									:class="{ clickable:showAllValues && !readonly }"
									:basis="columns[0].basis"
									:bold="columns[0].bold"
									:boolAtrIcon="columns[0].boolAtrIcon"
									:display="columns[0].display"
									:length="columns[0].length"
									:monospace="columns[0].flags.monospace"
									:noShrink="columns[0].flags.noShrink"
									:noThousandsSep="columns[0].flags.noThousandsSep"
									:value="r.values[0]"
									:wrap="columns[0].flags.wrap"
								/>
							</div>
						</td>
						
						<!-- category input check box -->
						<td class="minimum" v-if="showAllValues">
							<div class="list-input-row-checkbox">
								<my-button
									@trigger="$emit('clicked-row',r)"
									:active="!readonly"
									:image="getCheckIcon(recordIdsSelected.includes(r.indexRecordIds['0']))"
									:naked="true"
								/>
							</div>
						</td>
						
						<!-- values -->
						<td v-for="(b,bi) in columnBatches" :style="b.style">
							<div class="list-input-row-items">
								<template v-for="(ci,cii) in b.columnIndexes">
									<my-value-rich class="context-list-input"
										v-if="r.values[ci] !== null && (!hasGalleryIcon || bi !== 0 || cii !== 0)"
										@focus="$emit('focus')"
										@trigger="$emit('clicked-row',r)"
										:alignEnd="columns[ci].flags.alignEnd"
										:alignMid="columns[ci].flags.alignMid"
										:attribute-id="columns[ci].attributeId"
										:class="{ clickable:showAllValues && !readonly }"
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
						</td>
						
						<!-- actions -->
						<td class="minimum">
							<div class="list-input-row-items nowrap justifyEnd">
								<my-button image="open.png"
									v-if="showOpen"
									@trigger="$emit('clicked-open',r)"
									@trigger-middle="$emit('clicked-open-middle',r)"
									:blockBubble="true"
									:captionTitle="capApp.inputHintOpen"
									:naked="true"
								/>
								<my-button image="cancel.png"
									v-if="!showAllValues"
									@trigger="$emit('clicked-row-remove',i)"
									:active="!readonly"
									:captionTitle="capApp.inputHintRemove"
									:naked="true"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
	</div>`,
	props:{
		columns:          { type:Array,   required:true },
		columnBatches:    { type:Array,   required:true },
		hasGalleryIcon:   { type:Boolean, required:true },
		multiInput:       { type:Boolean, required:true },
		readonly:         { type:Boolean, required:true },
		recordIdsSelected:{ type:Array,   required:true },
		rows:             { type:Array,   required:true },
		showAllValues:    { type:Boolean, required:true },
		showOpen:         { type:Boolean, required:true }
	},
	emits:['clicked','clicked-open','clicked-open-middle','clicked-row','clicked-row-remove','focus'],
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.list
	},
	methods:{
		// presentation
		getCheckIcon(s) {
			return this.multiInput
				? (s ? 'checkbox1.png' : 'checkbox0.png')
				: (s ? 'radio1.png'    : 'radio0.png');
		}
	}
};