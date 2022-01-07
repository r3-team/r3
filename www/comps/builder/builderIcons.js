import {getNilUuid} from '../shared/generic.js';
import {srcBase64}  from '../shared/image.js';
export {MyBuilderIcons as default};

let MyBuilderIcons = {
	name:'my-builder-icons',
	template:`<div class="contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="delete.png" class="deleteAction"
					v-if="module.icons.length !== 0"
					@trigger="del"
					:active="iconIdsSelected.length !== 0"
					:cancel="true"
					:caption="capGen.button.deleteSelected"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<div class="content builder-icons" v-if="module">
		
			<div class="icons">
				<div class="icon" v-for="icon in module.icons">
					<my-button
						@trigger="toggleSelect(icon.id)"
						:image="iconIdsSelected.includes(icon.id) ? 'checkbox1.png' : 'checkbox0.png'"
					/>
					<img class="preview" :src="srcBase64(icon.file)" />
				</div>
			</div>
			
			<div v-if="iconIdsSelected.length < 2" class="builder-icons-add">
				<h2>{{ capApp.add }}</h2>
				
				<div>
					<span v-if="iconIdUpdate === -1">{{ capGen.button.add }}: </span>
					<span v-if="iconIdUpdate !== -1">{{ capGen.button.edit }}: </span>
					<input type="file" @change="add" />
				</div>
				<p>{{ capApp.addHelp }}</p>
			</div>
		</div>
	</div>`,
	props:{
		id:{ type:String, required:true }
	},
	data:function() {
		return {
			iconIdsSelected:[]
		};
	},
	computed:{
		iconIdUpdate:function() {
			// if single icon is selected, it can be updated
			return this.iconIdsSelected.length !== 1 ? -1 : this.iconIdsSelected[0];
		},
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		token:      function() { return this.$store.getters['local/token']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.icon; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getNilUuid,
		srcBase64,
		
		// actions
		toggleSelect:function(id) {
			let pos = this.iconIdsSelected.indexOf(id);
			
			if(pos === -1) this.iconIdsSelected.push(id);
			else           this.iconIdsSelected.splice(pos,1);
		},
		
		// backend calls
		del:function() {
			let requests = [];
			for(let i = 0, j = this.iconIdsSelected.length; i < j; i++) {
				requests.push(ws.prepare('icon','del',{id:this.iconIdsSelected[i]}));
			}
			
			ws.send(requests,true).then(
				(res) => {
					this.$root.schemaReload(this.module.id);
					this.iconIdsSelected = [];
				},
				(err) => this.$root.genericError(err)
			);
		},
		add:function(evt) {
			let that        = this;
			let formData    = new FormData();
			let httpRequest = new XMLHttpRequest();
			
			httpRequest.upload.onprogress = function(event) {
				if(event.lengthComputable) {}
			}
			httpRequest.onload = function(event) {
				let res = JSON.parse(httpRequest.response);
				
				if(res.error === '')
					that.$root.schemaReload(that.module.id);
				else
					that.$root.genericError('icon upload failed');
			}
			
			let file = evt.target.files[0];
			
			if(file.type !== "image/png") {
				this.$root.genericError('only PNG files are supported');
				return;
			}
			
			if(Math.round(file.size / 1024) > 64) {
				this.$root.genericError('max. icon size is 64kb');
				return;
			}
			
			formData.append('token',this.token);
			formData.append('moduleId',this.module.id);
			formData.append('iconId',this.iconIdUpdate !== -1 ? this.iconIdUpdate : this.getNilUuid());
			formData.append('file',file);
			httpRequest.open('POST','icon/upload',true);
			httpRequest.send(formData);
		}
	}
};
