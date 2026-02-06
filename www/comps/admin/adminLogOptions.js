import {dialogCloseAsk} from '../shared/dialog.js';

export default {
	name:'my-admin-log-options',
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="closeAsk">
		<div class="contentBox admin-log-options float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/fileText.png" />
					<h1 class="title">{{ capGen.options }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png" @trigger="closeAsk" :cancel="true" />
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="isChanged"
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
				</div>
			</div>
			
			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical fullWidth">
					<tbody>
						<tr>
							<td>{{ capApp.keepDays }}</td>
							<td><input v-model="configInput.logsKeepDays" /></td>
						</tr>
						<tr><td class="grouping" colspan="2">{{ capApp.logLevel }}</td></tr>
						<tr v-for="c in contextsValid">
							<td class="minimum">{{ capApp.contextLabel[c] }}*</td>
							<td>
								<div class="row gap centered">
									<input type="range" min="1" max="3" step="1" v-model="configInput[contextMapConfig[c]]" />
									<my-label
										:caption="capApp['logLevel'+configInput[contextMapConfig[c]]]"
										:image="configInput[contextMapConfig[c]] === '3' ? 'warning.png' : ''"
									/>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		contextsValid:{ type:Array, required:true }
	},
	emits:['close'],
	data() {
		return {
			configInput:{},
		};
	},
	computed:{
		contextMapConfig:s => {
			let out = {};
			for(const c of s.contextsValid) {
				out[c] = `log${c[0].toUpperCase() + c.slice(1)}`
			}
			return out;
		},

		// simple
		isChanged:s => JSON.stringify(s.config) !== JSON.stringify(s.configInput),
		
		// stores
		capApp:s => s.$store.getters.captions.admin.logs,
		capGen:s => s.$store.getters.captions.generic,
		config:s => s.$store.getters.config
	},
	mounted() {
		this.reset();

		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.closeAsk,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.closeAsk);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// externals
		dialogCloseAsk,

		// actions
		close() {
			this.$emit('close');
		},
		closeAsk() {
			this.dialogCloseAsk(this.close,this.isChanged);
		},

		// calls
		reset() {
			this.configInput = JSON.parse(JSON.stringify(this.config));
		},
		set() {
			ws.send('config','set',this.configInput,true).then(() => {}, this.$root.genericError);
		}
	}
};