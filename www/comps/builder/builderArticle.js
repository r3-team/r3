import { dialogDeleteAsk } from '../shared/dialog.js';
import { copyValueDialog, deepIsEqual } from '../shared/generic.js';

import MyBuilderCaption from './builderCaption.js';

export default {
	name: 'my-builder-article',
	components: { MyBuilderCaption },
	template: `<div class="contentBox grow" v-if="article">
		<div class="top">
			<div class="area nowrap default-inputs">
				<img class="icon" src="images/question.png" />
				<h1 class="title">
					{{ capApp.titleOne.replace('{NAME}',article.name) }}
				</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !readonly"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset(true)"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area nowrap">
				<my-button image="visible1.png"
					@trigger="copyValueDialog(article.name,id,id)"
					:caption="capGen.id"
				/>
				<my-button image="delete.png"
					@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
					:active="!readonly"
					:cancel="true"
					:caption="capGen.button.delete"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</div>

		<div class="content no-padding row grow">

			<div class="builder-article-body">
				<my-builder-caption
					v-model="article.captions.articleBody"
					:contentName="''"
					:language="builderLanguage"
					:readonly
					:richtext="true"
				/>
			</div>

			<div class="contentBox builder-sidebar narrow">
				<div class="top lower">
					<div class="area nowrap">
						<img class="icon" src="images/edit.png" />
						<h1>{{ capGen.properties }}</h1>
					</div>
				</div>
				<div class="content no-padding default-inputs">
					<table class="generic-table-vertical default-inputs">
						<tbody>
							<tr>
								<td>{{ capGen.name }}</td>
								<td><input v-model="article.name" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capGen.title }}</td>
								<td>
									<my-builder-caption
										v-model="article.captions.articleTitle"
										:contentName="capGen.title"
										:language="builderLanguage"
										:readonly
									/>
								</td>
							</tr>
							<tr>
								<td colspan="2">
									<div class="row">
										<my-button image="question.png"
											@trigger="showHelp('<p>' + capApp.intro.join('</p><p>') + '</p>')"
											:caption="capGen.information"
										/>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		builderLanguage: { type: String, required: true },
		id: { type: String, required: false, default: '' },
		readonly: { type: Boolean, required: true }
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true });
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel', this.set);
	},
	data() {
		return {
			// inputs
			article: false,
			articleCopy: {},
		};
	},
	computed: {
		// simple
		hasChanges: s => !s.deepIsEqual(s.article, s.articleSchema),
		module: s => s.moduleIdMap[s.article.moduleId],
		articleSchema: s => s.articleIdMap[s.id] === undefined ? false : s.articleIdMap[s.id],

		// stores
		articleIdMap: s => s.$store.getters['schema/articleIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		capApp: s => s.$store.getters.captions.builder.article,
		capGen: s => s.$store.getters.captions.generic
	},
	watch: {
		articleSchema: {
			handler() { this.reset(false); },
			immediate: true
		}
	},
	methods: {
		// externals
		copyValueDialog,
		deepIsEqual,
		dialogDeleteAsk,

		// actions
		reset(manuelReset) {
			if (this.articleSchema !== false && (manuelReset || !this.deepIsEqual(this.articleCopy, this.articleSchema))) {
				this.article = JSON.parse(JSON.stringify(this.articleSchema));
				this.articleCopy = JSON.parse(JSON.stringify(this.articleSchema));
			}
		},
		showHelp(msg) {
			this.$store.commit('dialog', { captionBody: msg, captionTop: this.capGen.information });
		},

		// backend calls
		del() {
			ws.send('article', 'del', this.article.id, true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push(`/builder/articles/${this.article.moduleId}`);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('article', 'set', this.article),
				ws.prepare('schema', 'check', { moduleId: this.module.id })
			], true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};
