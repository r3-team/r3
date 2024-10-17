import {getAttributeFileHref} from '../shared/attribute.js';
import {getSizeReadable}      from '../shared/generic.js';
import {getUnixFormat}        from '../shared/time.js';
export {MyAdminFiles as default};

let MyAdminFiles = {
	name:'my-admin-files',
	template:`<div class="admin-files contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/files.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanged"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content">
			<div class="contentPartHeader">
				<img class="icon" src="images/settings.png" />
				<h1>{{ capApp.titleConfig }}</h1>
			</div>
			<table class="default-inputs">
				<tbody>
					<tr>
						<td>{{ capApp.fileVersionsKeepCount }}</td>
						<td><input v-model="configInput.fileVersionsKeepCount" /></td>
					</tr>
					<tr>
						<td>{{ capApp.fileVersionsKeepDays }}</td>
						<td><input v-model="configInput.fileVersionsKeepDays" /></td>
					</tr>
					<tr>
						<td>{{ capApp.filesKeepDaysDeleted }}</td>
						<td><input v-model="configInput.filesKeepDaysDeleted" /></td>
					</tr>
				</tbody>
			</table>
			
			<br />
			
			<!-- deleted files -->
			<div class="contentPartHeader">
				<img class="icon" src="images/delete.png" />
				<h1>{{ capApp.titleDeleted }}</h1>
			</div>
			
			<table class="generic-table bright sticky-top default-inputs shade">
				<thead>
					<tr>
						<th>{{ capGen.actions }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.size }}</th>
						<th>{{ capApp.deleteDate }}</th>
						<th>{{ capGen.record }}</th>
						<th>{{ capGen.id }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-if="Object.keys(attributeIdMapDeleted).length === 0">
						<td colspan="999">{{ capGen.nothingThere }}</td>
					</tr>
					<template v-for="(files,atrId) in attributeIdMapDeleted">
						<tr class="attribute-title">
							<td class="minimum" colspan="999">
								<my-button
									@trigger="toggleShow(atrId)"
									:caption="displayAttribute(atrId,files.length)"
									:image="attributeIdsShowDeleted.includes(atrId) ? 'triangleDown.png' : 'triangleRight.png'"
									:naked="true"
								/>
							</td>
						</tr>
						<tr v-if="attributeIdsShowDeleted.includes(atrId)" v-for="f in files">
							<td class="minimum">
								<div class="row gap">
									<my-button image="time.png"
										@trigger="restore(atrId,f.id,f.recordId)"
										:caption="capGen.button.restore"
									/>
									<a target="_blank"
										:href="getAttributeFileHref(atrId,f.id,f.name,token)"
									>
										<my-button image="download.png"
											:caption="capGen.button.download"
										/>
									</a>
								</div>
							</td>
							<td class="file-name">{{ f.name }}</td>
							<td>{{ getSizeReadable(f.size) }}</td>
							<td>{{ displayTime(f.deleted) }}</td>
							<td>{{ f.recordId }}</td>
							<td>{{ f.id }}</td>
						</tr>
					</template>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			attributeIdMapDeleted:{},
			attributeIdsShowDeleted:[],
			configInput:{}
		};
	},
	mounted() {
		this.reset();
		this.$store.commit('pageTitle',this.menuTitle);
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	computed:{
		// simple
		hasChanged:(s) => JSON.stringify(s.config) !== JSON.stringify(s.configInput),
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.admin.files,
		capGen:        (s) => s.$store.getters.captions.generic,
		config:        (s) => s.$store.getters.config,
		token:         (s) => s.$store.getters['local/token']
	},
	methods:{
		// externals
		getAttributeFileHref,
		getSizeReadable,
		getUnixFormat,
		
		// presentation
		displayAttribute(atrId,cnt) {
			let a = this.attributeIdMap[atrId];
			let r = this.relationIdMap[a.relationId];
			let m = this.moduleIdMap[r.moduleId];
			return `${m.name} -> ${r.name} -> ${a.name} (${cnt})`;
		},
		displayTime(unixTime) {
			return unixTime === 0 ? '-' : this.getUnixFormat(unixTime,'Y-m-d H:i:S');
		},
		
		// actions
		reset() {
			this.configInput = JSON.parse(JSON.stringify(this.config));
			this.get();
		},
		toggleShow(atrId) {
			let v = this.attributeIdsShowDeleted;
			let pos = v.indexOf(atrId);
			if(pos === -1) v.push(atrId);
			else           v.splice(pos,1);
		},
		
		// backend calls
		get() {
			ws.send('file','get',{},true).then(
				res => this.attributeIdMapDeleted = res.payload.attributeIdMapDeleted,
				this.$root.genericError
			);
		},
		restore(attributeId,fileId,recordId) {
			ws.send('file','restore',{
				attributeId:attributeId,
				fileId:fileId,
				recordId:recordId
			},true).then(
				this.get,
				this.$root.genericError
			);
		},
		set() {
			if(!this.hasChanged) return;
			
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		},
	}
};