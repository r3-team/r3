export default {
	name:'my-admin-repo-keys',
	template:`<div class="admin-repo-keys contentBox grow">
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png" @trigger="set"   :active="isChanged" :caption="capGen.button.save" />
				<my-button image="refresh.png" @trigger="reset" :active="isChanged" :caption="capGen.button.refresh" />
			</div>
		</div>
		
		<div class="content grow">
			<div class="column gap">
				<table class="generic-table admin-repo-keys-table bright default-inputs shade">
					<thead>
						<tr><th colspan="2">{{ capGen.name }}</th></tr>
					</thead>
					<tbody>
						<tr v-if="isEmpty"><td colspan="2"><i>{{ capGen.nothingThere }}</i></td></tr>
						<tr v-for="(pk,name) in publicKeys">
							<td>{{ name }}</td>
							<td class="minimum">
								<div class="row gap">
									<my-button image="search.png" @trigger="show(name,pk)" />
									<my-button image="cancel.png" @trigger="remove(name)" :cancel="true" />
								</div>
							</td>
						</tr>
					</tbody>
				</table>
				<p>{{ capApp.publicKeysTrustedDesc }}</p>
			</div>

			<br />
			<div class="column gap default-inputs">
				<my-label image="add.png" :caption="capApp.publicKeyAdd" />
				<input    v-model="name"  :placeholder="capGen.name" />
				<textarea v-model="value" :placeholder="capApp.publicKeyHint"></textarea>
				<div class="row">
					<my-button image="ok.png" @trigger="add" :active="isValidInput" :caption="capGen.button.ok" />
				</div>
			</div>
		</div>
	</div>`,
	data() {
		return {
			// inputs
			name:'',
			value:'',

			// states
			publicKeys:{}
		};
	},
	mounted() {
		this.reset();
	},
	computed:{
		isChanged:   s => s.config.repoPublicKeys !== JSON.stringify(s.publicKeys),
		isEmpty:     s => Object.keys(s.publicKeys).length === 0,
		isValidInput:s => s.name !== '' && s.value !== '',

		// stores
		config:s => s.$store.getters.config,
		capApp:s => s.$store.getters.captions.admin.repo,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// actions
		add() {
			this.publicKeys[this.name] = this.value;
			this.name  = '';
			this.value = '';
		},
		remove(keyName) {
			if(this.publicKeys[keyName] !== undefined)
				delete this.publicKeys[keyName];
		},
		reset() {
			this.publicKeys = JSON.parse(this.config.repoPublicKeys);
		},
		set() {
			if(!this.isChanged) return;

			let v = JSON.parse(JSON.stringify(this.config));
			v.repoPublicKeys = JSON.stringify(this.publicKeys);
			
			ws.send('config','set',v,true).then(() => {}, this.$root.genericError);
		},
		show(name,key) {
			this.$store.commit('dialog',{
				captionBody:key,
				captionTop:name,
				image:'key.png',
				textDisplay:'textarea'
			});
		}
	}
};