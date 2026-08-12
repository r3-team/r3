export default {
	name: 'my-input-offset',
	template: `<div class="my-input-offset default-inputs">
		<!-- prev page -->
		<my-button image="pagePrev.png"
			v-if="arrows && limit < total"
			@trigger="pageChanged(false)"
			:active="offset !== 0"
			:naked="true"
		/>

		<!-- offset selector -->
		<select class="auto"
			v-if="offsetSelectShow"
			v-model="offsetSelect"
			:class="classInput"
			:title="captionText"
		>
			<option v-for="n in pages" :class="{ currentPage:n === pageCurr }" :key="n" :value="(n-1)*limit">
				{{ displayOffset(n) }}
			</option>
		</select>

		<!-- optional caption -->
		<div v-if="caption" class="my-input-offset-caption">{{ captionText }}</div>

		<!-- next page -->
		<my-button image="pageNext.png"
			v-if="arrows && limit < total"
			@trigger="pageChanged(true)"
			:active="(offset + limit) < total"
			:naked="true"
		/>
	</div>`,
	props: {
		arrows: { type: Boolean, required: false, default: true },
		caption: { type: Boolean, required: false, default: false },
		classInput: { type: String, required: false, default: '' },
		limit: { type: Number, required: true },
		offset: { type: Number, required: true },
		total: { type: Number, required: true }
	},
	emits: ['input'],
	computed: {
		captionText: s => s.offsetSelectShow ? s.capGen.resultsOf.replace('{CNT}', s.total) : s.capGen.results.replace('{CNT}', s.total),
		offsetSelectShow: s => s.total > s.limit || s.offset !== 0,
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
		pageChanged(next) {
			if (next) this.$emit('input', this.offset + this.limit);
			else this.$emit('input', this.offset - this.limit);
		}
	}
};
