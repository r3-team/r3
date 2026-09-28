import MyInputDecimal from './inputDecimal.js';

export default {
	name: 'my-input-offset',
	components: { MyInputDecimal },
	template: `<div class="my-input-offset default-inputs">
		<!-- prev page -->
		<my-button image="pagePrev.png"
			v-if="arrows && limit < total"
			@trigger="pageChange(false)"
			@triggerRight="pageSetFirst"
			:active="offset !== 0"
			:naked="true"
		/>

		<template v-if="inputAsPageNo">
			<!-- offset selector: page no input -->
			<div class="row gap centered default-inputs" v-if="offsetShow">
				<span>{{ capGen.page }}</span>
				<my-input-decimal class="short"
					v-model="offsetInput"
					:allowNull="true"
					:lengthFract="0"
					:max="pageCountTotal"
					:min="1"
					:size="offsetInputSize"
				/>
			</div>
			<div v-if="caption" class="my-input-offset-caption">{{ captionTextInput }}</div>
		</template>

		<template v-if="!inputAsPageNo">
			<!-- offset selector: results dropdown -->
			<select class="auto"
				v-if="offsetShow"
				v-model="offsetSelect"
				:class="classInput"
				:title="captionTextSelect"
			>
				<option v-for="n in pages" :class="{ currentPage:n === pageCurr }" :key="n" :value="(n-1)*limit">
					{{ displayOffset(n) }}
				</option>
			</select>
			<div v-if="caption" class="my-input-offset-caption">{{ captionTextSelect }}</div>
		</template>

		<!-- next page -->
		<my-button image="pageNext.png"
			v-if="arrows && limit < total"
			@trigger="pageChange(true)"
			@triggerRight="pageSetLast"
			:active="(offset + limit) < total"
			:naked="true"
		/>
	</div>`,
	props: {
		arrows: { type: Boolean, required: false, default: true },
		caption: { type: Boolean, required: false, default: false },
		classInput: { type: String, required: false, default: '' },
		inputAsPageNo: { type: Boolean, required: false, default: false },
		limit: { type: Number, required: true },
		offset: { type: Number, required: true },
		total: { type: Number, required: true }
	},
	emits: ['input'],
	computed: {
		captionTextInput: s => s.offsetShow ? s.capGen.resultsOf.replace('{CNT}', s.pageCountTotal) : s.capGen.results.replace('{CNT}', s.total),
		captionTextSelect: s => s.offsetShow ? s.capGen.resultsOf.replace('{CNT}', s.total) : s.capGen.results.replace('{CNT}', s.total),
		offsetInputSize: s => String(s.pageCountTotal).length,
		offsetShow: s => s.total > s.limit || s.offset !== 0,
		pageCountTotal: s => Math.ceil(s.total / s.limit, 10),
		pageCurr: s => parseInt(Math.ceil((s.offset + 1) / s.limit), 10),
		pageLast: s => parseInt(Math.ceil((s.total) / s.limit), 10),
		pages: s => {
			if (s.total === 0 || s.limit === 0)
				return [];

			// show up to 20 pages, starting at most 10 pages before current one
			const pages = [];
			for (let page = s.pageCurr - 10; page <= s.pageLast && pages.length <= 20; page++) {
				if (page >= 1) {
					pages.push(page);
				}
			}
			return pages;
		},

		// inputs
		offsetInput: {
			get() { return (this.offset / this.limit) + 1; },
			set(v) {
				if (v !== null && v !== 0 && v <= this.pageCountTotal)
					this.$emit('input', (v - 1) * this.limit);
			}
		},
		offsetSelect: {
			get() { return this.offset; },
			set(v) { this.$emit('input', v); }
		},

		// stores
		capGen: s => s.$store.getters.captions.generic
	},
	methods: {
		displayOffset(page) {
			return page === this.pageLast
				? `${((page - 1) * this.limit) + 1} - ${this.total}`
				: `${((page - 1) * this.limit) + 1} - ${((page - 1) * this.limit) + this.limit}`;
		},

		// actions
		pageChange(next) {
			if (next) this.$emit('input', this.offset + this.limit);
			else this.$emit('input', this.offset - this.limit);
		},
		pageSetFirst() {
			this.$emit('input', 0);
		},
		pageSetLast() {
			this.$emit('input', (this.pageCountTotal * this.limit) - 1);
		}
	}
};
