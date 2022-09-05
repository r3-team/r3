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
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
			<div class="contentPart config">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.titleConfig }}</h1>
				</div>
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.filesKeepDaysDeleted }}</td>
						<td><input v-model="configInput.filesKeepDaysDeleted" /></td>
					</tr>
					<tr>
						<td>{{ capApp.filesKeepDaysUnassigned }}</td>
						<td><input v-model="configInput.filesKeepDaysUnassigned" /></td>
					</tr>
				</table>
				
				<div>
					<my-button image="save.png"
						@trigger="setConfig"
						:active="hasChanged"
						:caption="capGen.button.save"
					/>
				</div>
			</div>
			
			<hr />
			<br />
		
			<!-- deleted files -->
			<div class="contentPart full">
				<div class="contentPartHeader">
					<img class="icon" src="images/delete.png" />
					<h1>{{ capApp.titleDeleted }}</h1>
				</div>
				
				<table class="table-default default-inputs shade">
					<thead>
						<tr>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.size }}</th>
							<th>{{ capApp.deleteDate }}</th>
							<th>{{ capGen.record }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody v-for="(files,atrId) in attributeIdMapDeleted">
						<tr class="attribute-title">
							<td class="minimum" colspan="999">
								<my-button
									@trigger="toggleShow(atrId,'deleted')"
									:caption="displayAttribute(atrId,files.length)"
									:image="attributeIdsShowDeleted.includes(atrId) ? 'triangleDown.png' : 'triangleRight.png'"
									:naked="true"
									:tight="true"
								/>
							</td>
						</tr>
						<tr v-if="attributeIdsShowDeleted.includes(atrId)" v-for="f in files">
							<td class="file-name">{{ f.name }}</td>
							<td>{{ getSizeReadable(f.size) }}</td>
							<td>{{ displayTime(f.deleted) }}</td>
							<td>{{ f.recordId }}</td>
							<td>
								<div class="row">
									<my-button image="time.png"
										@trigger="restore(atrId,f.id)"
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
						</tr>
					</tbody>
				</table>
			</div>
		
			<!-- unassigned files -->
			<div class="contentPart full">
				<div class="contentPartHeader">
					<img class="icon" src="images/linkBroken.png" />
					<h1>{{ capApp.titleUnassigned }}</h1>
				</div>
				<span>{{ capApp.hintUnassigned }}</span>
				<br />
				
				<table class="table-default default-inputs shade">
					<thead>
						<tr>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.size }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody v-for="(files,atrId) in attributeIdMapUnassigned">
						<tr class="attribute-title">
							<td class="minimum" colspan="999">
								<my-button
									@trigger="toggleShow(atrId,'unassigned')"
									:caption="displayAttribute(atrId,files.length)"
									:image="attributeIdsShowUnassigned.includes(atrId) ? 'triangleDown.png' : 'triangleRight.png'"
									:naked="true"
									:tight="true"
								/>
							</td>
						</tr>
						<tr v-if="attributeIdsShowUnassigned.includes(atrId)" v-for="f in files">
							<td class="file-name">{{ f.name }}</td>
							<td>{{ getSizeReadable(f.size) }}</td>
							<td>
								<div class="row">
									<a target="_blank"
										:href="getAttributeFileHref(atrId,f.id,f.name,token)"
									>
										<my-button image="download.png"
											:caption="capGen.button.download"
										/>
									</a>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			attributeIdMapDeleted:{},
			attributeIdMapUnassigned:{},
			attributeIdsShowDeleted:[],
			attributeIdsShowUnassigned:[],
			configInput:{}
		};
	},
	mounted:function() {
		this.configInput = JSON.parse(JSON.stringify(this.config));
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
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
		toggleShow(atrId,mode) {
			let v = mode === 'deleted'
				? this.attributeIdsShowDeleted
				: this.attributeIdsShowUnassigned;
			
			let pos = v.indexOf(atrId);
			if(pos === -1) v.push(atrId);
			else           v.splice(pos,1);
		},
		
		// backend calls
		get() {
			ws.send('file','get',{},true).then(
				res => {
					this.attributeIdMapDeleted    = res.payload.attributeIdMapDeleted;
					this.attributeIdMapUnassigned = res.payload.attributeIdMapUnassigned;
				},
				this.$root.genericError
			);
		},
		restore(attributeId,fileId) {
			ws.send('file','restore',{
				attributeId:attributeId,
				fileId:fileId
			},true).then(
				this.get,
				this.$root.genericError
			);
		},
		setConfig() {
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		},
	}
};