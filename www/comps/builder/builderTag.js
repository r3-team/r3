import MyBuilderIconInput from './builderIconInput.js';
import {dialogDeleteAsk}  from '../shared/dialog.js';
import {
	copyValueDialog,
	deepIsEqual
} from '../shared/generic.js';

export default {
	name:'my-builder-tag',
	components: {
		MyBuilderIconInput
	},
	template:`<div class="app-sub-window under-header" @mousedown.self="close">
		<div class="contentBox builder-tag float" v-if="tag !== false">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/tag.png" />
					<h1 class="title">{{ title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
				</div>
				<div class="area">
					<my-button image="visible1.png"
						@trigger="copyValueDialog(tag.name,id,id)"
						:caption="capGen.id"
					/>
					<my-button image="delete.png"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>

			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td>
								<input v-focus v-model="tag.name" :disabled="readonly" />
								<p class="error" v-if="nameTaken">{{ capGen.error.nameTaken }}</p>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.icon }}</td>
							<td>
								<my-builder-icon-input
									v-model="tag.iconId"
									:module
									:readonly
									:title="capGen.icon"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.comment }}</td>
							<td><textarea v-model="tag.comment" :disabled="readonly"></textarea></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		id:      { required:true },
		module:  { type:Object,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	emits:['close','next-language'],
	data() {
		return {
			tag:false,  // tag being edited in this component
			tagCopy:{}, // copy of tag from schema when component last reset
		};
	},
	watch:{
		tagSchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	computed:{
		nameTaken:s => {
			for(let t of s.module.tags) {
				if(t.id !== s.tag.id && t.name === s.tag.name)
					return true;
			}
			return false;
		},

		// simple
		canSave:   s => !s.readonly && s.isChanged && !s.nameTaken,
		isChanged: s => !s.deepIsEqual(s.tag,s.tagSchema),
		tagSchema: s => s.tagIdMap[s.id] === undefined ? false : s.tagIdMap[s.id],
		title:     s => s.capApp.titleOne.replace('{NAME}',s.tag.name),

		// stores
		capApp:  s => s.$store.getters.captions.builder.tag,
		capGen:  s => s.$store.getters.captions.generic,
		tagIdMap:s => s.$store.getters['schema/tagIdMap']
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		copyValueDialog,
		deepIsEqual,
		dialogDeleteAsk,

		// actions
		close() {
			this.$emit('close');
		},
		reset(manuelReset) {
			if(this.tagSchema !== false && (manuelReset || !this.deepIsEqual(this.tagCopy,this.tagSchema))) {
				this.tag     = JSON.parse(JSON.stringify(this.tagSchema));
				this.tagCopy = JSON.parse(JSON.stringify(this.tagSchema));
			}
		},

		// backend calls
		del() {
			ws.send('tag','del',this.id,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.close();
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('tag','set',{ moduleId:this.module.id, tag:this.tag },true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.close();
				},
				this.$root.genericError
			);
		}
	}
};
