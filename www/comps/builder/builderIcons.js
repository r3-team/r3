import {getNilUuid} from '../shared/generic.js';
import {srcBase64}  from '../shared/image.js';
export {MyBuilderIcons as default};

let MyBuilderIcon = {
	name:'my-builder-icon',
	template:`<div class="icon">
		<my-button
			v-if="!readonly"
			@trigger="$emit('toggle')"
			:active="!readonly"
			:image="selected ? 'checkbox1.png' : 'checkbox0.png'"
		/>
		<img class="preview" :src="srcBase64(icon.file)" />
		<span class="default-inputs">
			<input v-model="name" :disabled="readonly" :placeholder="capApp.nameHint" />
		</span>
		<my-button image="save.png"
			v-if="!readonly"
			@trigger="set"
			:active="hasChanges"
		/>
	</div>`,
	props:{
		icon:    { type:Object,  required:true },
		readonly:{ type:Boolean, required:true },
		selected:{ type:Boolean, required:true }
	},
	emits:['toggle'],
	data:function() {
		return {
			name:this.icon.name
		};
	},
	computed:{
		hasChanges:(s) => s.icon.name !== s.name,
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.icon
	},
	methods:{
		// external
		srcBase64,
		
		set() {
			ws.send('icon','setName',{
				id:this.icon.id,
				moduleId:this.icon.moduleId,
				name:this.name
			},true).then(
				this.$root.schemaReload(this.icon.moduleId),
				this.$root.genericError
			);
		}
	}
};

let MyBuilderIcons = {
	name:'my-builder-icons',
	components:{ MyBuilderIcon },
	template:`<div class="contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/fileImage.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="delete.png" class="deleteAction"
					v-if="module.icons.length !== 0"
					@trigger="del"
					:active="iconIdsSelected.length !== 0 && !readonly"
					:cancel="true"
					:caption="capGen.button.deleteSelected"
				/>
			</div>
		</div>
		
		<div class="content builder-icons" v-if="module">
			<div class="icons">
				<my-builder-icon v-for="icon in module.icons"
					@toggle="toggleSelect(icon.id)"
					:key="icon.id"
					:icon="icon"
					:readonly="readonly"
					:selected="iconIdsSelected.includes(icon.id)"
				/>
			</div>
			
			<div v-if="iconIdsSelected.length < 2 && !readonly" class="builder-icons-add">
				<h2>{{ capApp.add }}</h2>
				
				<div>
					<span v-if="iconIdUpdate === -1">{{ capGen.button.add }}: </span>
					<span v-if="iconIdUpdate !== -1">{{ capGen.button.edit }}: </span>
					<input type="file" @change="add" :disabled="readonly" />
				</div>
				<p>{{ capApp.addHelp }}</p>
			</div>
		</div>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	data:function() {
		return {
			iconIdsSelected:[]
		};
	},
	computed:{
		// if single icon is selected, it can be updated
		iconIdUpdate:(s) => s.iconIdsSelected.length !== 1 ? -1 : s.iconIdsSelected[0],
		module:      (s) => s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		token:      (s) => s.$store.getters['local/token'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.icon,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getNilUuid,
		
		// actions
		toggleSelect(id) {
			let pos = this.iconIdsSelected.indexOf(id);
			
			if(pos === -1) this.iconIdsSelected.push(id);
			else           this.iconIdsSelected.splice(pos,1);
		},
		
		// backend calls
		del() {
			let requests = [];
			for(let i = 0, j = this.iconIdsSelected.length; i < j; i++) {
				requests.push(ws.prepare('icon','del',{id:this.iconIdsSelected[i]}));
			}
			
			ws.sendMultiple(requests,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.iconIdsSelected = [];
				},
				err => this.$root.genericError(err)
			);
		},
		add(evt) {
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