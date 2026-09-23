export default {
	name: 'my-builder-articles',
	template: `<div class="builder-articles contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/question.png" />
				<h1 class="title">{{ capGen.helpArticles }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-focus v-model="filter" placeholder="..." />
			</div>
		</div>

		<div class="content default-inputs" v-if="module">
			<div class="generic-entry-list">

				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','article')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>

				<router-link class="entry clickable"
					v-for="a in module.articles.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="a.id"
					:to="'/builder/article/'+a.id"
				>
					<div class="lines">
						<span>{{ a.name }}</span>
					</div>
				</router-link>
			</div>
		</div>
	</div>`,
	props: {
		id: { type: String, required: true },
		readonly: { type: Boolean, required: true }
	},
	data() {
		return {
			filter: '',
		};
	},
	computed: {
		module: s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		capGen: s => s.$store.getters.captions.generic
	}
};
