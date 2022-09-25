import {getFilesFromDataItems} from './shared/drop.js';
import {getUnixFormat}         from './shared/time.js';
import {
	getAttributeFileThumbHref,
	getAttributeFileVersionHref
} from './shared/attribute.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
import {
	getNilUuid,
	getSizeReadable
} from './shared/generic.js';
export {MyInputFiles as default};

let MyInputFilesName = {
	name:'my-input-files-name',
	template:`<div class="input-files-name">
		<input
			@input="$emit('update:name',$event.target.value)"
			:disabled="readonly"
			:value="value"
		/>
		<span v-if="unsaved" class="error">
			{{ capApp.unsaved }}
		</span>
	</div>`,
	props:{
		change:  { required:true },               // known file change (not affected by sort)
		name:    { type:String,  required:true }, // file name
		readonly:{ type:Boolean, required:true },
		unsaved: { type:Boolean, required:true }
	},
	emits:['update:name'],
	computed:{
		value:(s) => {
			return typeof s.change !== 'undefined' && s.change.name !== ''
				? s.change.name : s.name;
		},
		
		// store
		capApp:(s) => s.$store.getters.captions.input.files
	}
};

let MyInputFilesRequest = {
	name:'my-input-files-request',
	template:`<my-button image="screenFile.png"
		@trigger="$emit('open',false)"
		@trigger-shift="$emit('open',true)"
		:captionTitle="capApp.button.fileRequestHint"
		:active="hasClient"
		:naked="true"
		:tight="true"
	/>`,
	emits:['open'],
	computed:{
		// store
		hasClient:(s) => s.$store.getters.loginHasClient,
		capApp:   (s) => s.$store.getters.captions.input.files
	}
};

let MyInputFiles = {
	name:'my-input-files',
	components:{
		MyInputFilesName,
		MyInputFilesRequest
	},
	template:`<div class="input-files" ref="main"
			v-on:dragleave.stop.prevent="dragLeave"
			v-on:dragenter.stop.prevent="dragEnter"
			v-on:dragover.stop.prevent="dragOver"
			v-on:drop.stop.prevent="drop"
		>
		<!-- header -->
		<div v-if="!dragActive" class="input-files-header default-inputs">
			<div class="row">
				<slot name="input-icon" />
				<my-button image="files.png"
					v-if="!unsavedSelected && fileIdsSelected.length !== 0"
					@trigger="copyFilesSelected"
					:caption="!noSpace ? capGen.button.copy : ''"
					:captionTitle="capApp.button.copyHint"
					:naked="true"
					:tight="true"
				/>
				<my-button image="paste.png"
					v-if="filesCopy.attributeId !== null"
					@trigger="pasteFilesStored"
					:caption="!noSpace ? capGen.button.paste : ''"
					:captionTitle="capApp.button.pasteHint"
					:naked="true"
					:tight="true"
				/>
				<my-button image="delete.png"
					v-if="fileIdsSelected.length !== 0"
					@trigger="removeSelected"
					:caption="!noSpace ? capGen.button.delete : ''"
					:naked="true"
					:tight="true"
				/>
			</div>
			
			<!-- file count -->
			<div>{{ fileCountCaption }}</div>
			
			<!-- file name filter -->
			<div class="right-side">
				<div class="view-toggle">
					<img src="images/files_list1.png" :class="{ active:viewListCompact }" @click="setViewMode('listCompact')" />
					<img src="images/files_list2.png" :class="{ active:viewListComfort }" @click="setViewMode('listComfort')" />
					<img src="images/files_list3.png" :class="{ active:viewGallery }"     @click="setViewMode('gallery')" />
				</div>
				<input v-if="!noSpace" v-model="filterName" class="short" placeholder="..." />
			</div>
		</div>
		
		<!-- drag&drop display -->
		<div v-if="dragActive" class="input-files-drop">
			{{ !maxFiles ? capApp.dropTarget : capGen.inputTooManyFiles }}
		</div>
		
		<div v-if="!dragActive" class="input-files-content">
			<div class="input-files-actions">
				
				<!-- file upload -->
				<div class="input-files-upload">
					<input type="file" multiple="multiple"
						v-if="!readonly && !maxFiles"
						@change="upload($event.target.files)"
					/>
					
		   			<transition name="fade_out">
						<div v-if="progress !== 100" class="counter">
							{{ progress + '%' }}
						</div>
					</transition>
				</div>
				
				<!-- toggle all -->
				<my-button
					v-if="!viewListCompact && !noFiles && !oneFile && !readonly"
					@trigger="toggleAll"
					:caption="!noSpace ? capGen.button.selectAll : capGen.button.selectAllShort"
					:image="displayChecked(allSelected)"
					:naked="true"
					:tight="true"
				/>
				
				<!-- sort mode -->
				<div class="row default-inputs" v-if="!viewListCompact && !fewFiles && !noSpace">
					<my-button
						@trigger="toggleSortDir"
						:image="sortDirAsc ? 'triangleUp.png' : 'triangleDown.png'"
						:naked="true"
						:tight="true"
					/>
					<select @change="setSortMode($event.target.value)" :value="sortMode">
						<option value="name">{{ capApp.fileName }}</option>
						<option value="size">{{ capApp.fileSize }}</option>
						<option value="changed">{{ capApp.fileChanged }}</option>
					</select>
				</div>
			</div>
			
			<!-- listCompact -->
			<table class="listCompact" v-if="viewListCompact && !noFiles">
				<thead>
					<tr>
						<th v-if="!readonly" class="minimum">
							<my-button
								@trigger="toggleAll"
								:image="displayChecked(allSelected)"
								:naked="true"
								:tight="true"
							/>
						</th>
						<th>
							<my-button
								@trigger="setSortMode('name')"
								@trigger-right="setSortModeClear('name')"
								:caption="capApp.fileName + displaySortDir('name')"
								:naked="true"
								:tight="true"
							/>
						</th>
						<th>
							<my-button
								@trigger="setSortMode('size')"
								@trigger-right="setSortModeClear('size')"
								:caption="capApp.fileSize + displaySortDir('size')"
								:naked="true"
								:tight="true"
							/>
						</th>
						<th v-if="!noSpace">
							<my-button
								@trigger="setSortMode('changed')"
								@trigger-right="setSortModeClear('changed')"
								:caption="capApp.fileChanged + displaySortDir('changed')"
								:naked="true"
								:tight="true"
							/>
						</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="f in filesProcessed">
						<td v-if="!readonly" class="minimum">
							<my-button
								@trigger="toggle(f.id)"
								:image="displayChecked(fileIdsSelected.includes(f.id))"
								:naked="true"
								:tight="true"
							/>
						</td>
						<td>
							<my-input-files-name
								@update:name="updateName(f.id,$event)"
								:change="fileIdMapChange[f.id]"
								:name="f.name"
								:readonly="readonly"
								:unsaved="fileIdsUnsaved.includes(f.id)"
							/>
						</td>
						<td>{{ getSizeReadable(f.size) }}</td>
						<td v-if="!noSpace">{{ displayDate(f.changed) }}</td>
						<td>
							<div class="row">
								<a target="_blank"
									:href="getAttributeFileVersionHref(attributeId,f.id,f.name,f.version,token)"
								>
									<my-button image="download.png"
										:captionTitle="capApp.button.downloadHint"
										:naked="true"
										:tight="true"
									/>
								</a>
								<my-input-files-request
									v-if="!readonly && !fileIdsUnsaved.includes(f.id)"
									@open="fileRequest(f.id,$event)"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
			
			<!-- list comfortable -->
			<div class="listComfort" v-if="viewListComfort">
				<div class="item" v-for="f in filesProcessed">
					<a target="_blank"
						:href="getAttributeFileVersionHref(attributeId,f.id,f.name,f.version,token)"
						:title="capApp.button.downloadHint"
					>
						<img class="prev" :src="imagePreview(f.id,f.name,f.version)" />
					</a>
					<div class="item-content">
						<my-input-files-name
							@update:name="updateName(f.id,$event)"
							:change="fileIdMapChange[f.id]"
							:name="f.name"
							:readonly="readonly"
							:unsaved="fileIdsUnsaved.includes(f.id)"
						/>
						<div class="item-meta">
							<span>{{ displayDate(f.changed) }}</span>
							<span>{{ getSizeReadable(f.size) }}</span>
						</div>
					</div>
					<div v-if="!readonly" class="item-actions shade">
						<my-button
							@trigger="toggle(f.id)"
							:image="displayChecked(fileIdsSelected.includes(f.id))"
							:naked="true"
							:tight="true"
						/>
						<my-input-files-request
							v-if="!readonly && !fileIdsUnsaved.includes(f.id)"
							@open="fileRequest(f.id,$event)"
						/>
					</div>
				</div>
			</div>
			
			<!-- gallery -->
			<div class="gallery" v-if="viewGallery" >
				<div class="item" v-for="f in filesProcessed">
					<a target="_blank"
						:href="getAttributeFileVersionHref(attributeId,f.id,f.name,f.version,token)"
						:title="capApp.button.downloadHint"
					>
						<img class="prev" :src="imagePreview(f.id,f.name,f.version)">
					</a>
					<div class="item-meta">
						<my-input-files-name
							@update:name="updateName(f.id,$event)"
							:change="fileIdMapChange[f.id]"
							:name="f.name"
							:readonly="readonly"
							:unsaved="fileIdsUnsaved.includes(f.id)"
						/>
						<span>{{ displayDate(f.changed) }}</span>
						<span>{{ getSizeReadable(f.size) }}</span>
					</div>
					<div v-if="!readonly" class="item-actions shade">
						<my-button
							@trigger="toggle(f.id)"
							:image="displayChecked(fileIdsSelected.includes(f.id))"
							:naked="true"
							:tight="true"
						/>
						<my-input-files-request
							v-if="!readonly && !fileIdsUnsaved.includes(f.id)"
							@open="fileRequest(f.id,$event)"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		attributeId: { type:String,  required:true },
		countAllowed:{ type:Number,  required:true }, // number of allowed files
		fieldId:     { type:String,  required:true },
		formLoading: { type:Boolean, required:true }, // to react to form load events
		modelValue:  { required:true },
		readonly:    { type:Boolean, required:false, default:false },
		recordId:    { type:Number,  required:true },
		showGallery: { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	data:function() {
		return {
			extPreview:[
				'bmp','gif','jpg','jpeg','pdf','png','psd','svg','xcf','webp',
				'cfg','conf','css','csv','go','html','ini','java','js','json',
				'log','md','php','sql','txt','xml'
			],
			
			extRegex:/(?:\.([^.]+))?$/,
			noSpace:false,         // if input field is tiny, reduces clutter,
			progress:100,
			viewModes:['listCompact','listComfort','gallery'],
			
			// inputs
			dragActive:false,
			dragTarget:{},
			files:[],              // files from value
			fileIdMapChange:{},    // map of file changes done inside this component, key: file ID
			fileIdsSelected:[],    // file IDs selected by checkbox
			filterName:'',         // filter files by name
			sortDirAsc:true,
			sortMode:'name',       // name, size, changed
			viewMode:'listCompact' // active view mode
		};
	},
	created:function() {
		window.addEventListener('resize',this.setNoSpaceMode);
	},
	mounted:function() {
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(val) return;
			
			let v = JSON.parse(JSON.stringify(this.modelValue));
			this.files = v !== null ? v : [];
			this.fileIdMapChange = {};
		});
		
		// apply initial view size
		this.setNoSpaceMode();
		
		// apply defaults
		if(this.showGallery)
			this.viewMode = 'gallery';
		
		// apply last chosen view mode
		this.setViewMode(this.fieldOptionGet(this.fieldId,'fileViewMode',this.viewMode));
	},
	unmounted:function() {
		window.removeEventListener('resize',this.setNoSpaceMode);
	},
	computed:{
		filesProcessed:{
			get:	function() {
				let v = JSON.parse(JSON.stringify(this.files));
				
				if(this.filterName !== '')
					v = v.filter(f => f.name.includes(this.filterName))
				
				if(this.sortByChanged) {
					if(this.sortDirAsc)  v.sort((a, b) => a.changed - b.changed);
					if(!this.sortDirAsc) v.sort((a, b) => b.changed - a.changed);
				} else if(this.sortByName) {
					if(this.sortDirAsc)  v.sort((a, b) => a.name.localeCompare(b.name));
					if(!this.sortDirAsc) v.sort((a, b) => b.name.localeCompare(a.name));
				} else if(this.sortBySize) {
					if(this.sortDirAsc)  v.sort((a, b) => a.size - b.size);
					if(!this.sortDirAsc) v.sort((a, b) => b.size - a.size);
				}
				return v;
			}
		},
		fileCountCaption:(s) => {
			let out = `${s.files.length}`;
			if(s.countAllowed !== 0) out += ` / ${s.countAllowed}`;
			if(!s.noSpace)           out += ` ${s.capGen.files}`;
			return out;
		},
		fileIdsUnsaved:(s) => {
			let out = [];
			for(let fileId in s.fileIdMapChange) {
				if(s.fileIdMapChange[fileId].action === 'create')
					out.push(fileId);
			}
			return out;
		},
		
		// simple
		allSelected:    (s) => s.filesProcessed.length === s.fileIdsSelected.length,
		fewFiles:       (s) => s.files.length <= 5,
		maxFiles:       (s) => s.countAllowed !== 0 && s.countAllowed <= s.files.length,
		noFiles:        (s) => s.files.length === 0,
		oneFile:        (s) => s.files.length === 1,
		sortByChanged:  (s) => s.sortMode === 'changed',
		sortByName:     (s) => s.sortMode === 'name',
		sortBySize:     (s) => s.sortMode === 'size',
		unsavedSelected:(s) => s.fileIdsSelected.some(v => s.fileIdsUnsaved.includes(v)),
		viewListComfort:(s) => s.viewMode === 'listComfort',
		viewListCompact:(s) => s.viewMode === 'listCompact',
		viewGallery:    (s) => s.viewMode === 'gallery',
		
		// store
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.input.files,
		capGen:        (s) => s.$store.getters.captions.generic,
		filesCopy:     (s) => s.$store.getters.filesCopy,
		settings:      (s) => s.$store.getters.settings,
		token:         (s) => s.$store.getters['local/token']
	},
	methods:{
		// externals
		fieldOptionGet,
		fieldOptionSet,
		getAttributeFileThumbHref,
		getAttributeFileVersionHref,
		getFilesFromDataItems,
		getNilUuid,
		getSizeReadable,
		getUnixFormat,
		
		// presentation
		displayChecked(state) {
			return state ? 'checkbox1.png' : 'checkbox0.png';
		},
		displayDate(date) {
			return date !== 0
				? this.getUnixFormat(date,[this.settings.dateFormat,'H:i:S'].join(' '))
				: '-';
		},
		displaySortDir(mode) {
			if(this.sortMode !== mode)
				return '';
			
			return this.sortDirAsc ? ' \u25B2' : ' \u25BC';
		},
		imagePreview(fileId,name,version) {
			if(!this.extPreview.includes(this.extRegex.exec(name)[1]))
				return 'images/noPic.png';
			
			return this.getAttributeFileThumbHref(this.attributeId,fileId,name,version,this.token);
		},
		setNoSpaceMode() {
			this.noSpace = this.$refs.main.clientWidth <= 700;
		},
		
		// drag&drop
		dragEnter(event) {
			this.dragTarget = event.target;
			this.dragActive = true;
		},
		dragLeave(event) {
			if(event.target === this.dragTarget)
				this.dragActive = false;
		},
		dragOver(event) {
			// needs to be defined, otherwise drag and drop does not work
		},
		drop(event) {
			this.dragActive = false;
			if(!this.maxFiles) {
				this.getFilesFromDataItems(event.dataTransfer.items).then(
					files => this.upload(files)
				);
			}
		},
		
		// actions
		fileRequest(fileId,chooseApp) {
			ws.send('file','request',{
				attributeId:this.attributeId,
				fileId:fileId,
				recordId:this.recordId,
				chooseApp:chooseApp
			},false);
		},
		copyFilesSelected() {
			let v = {
				attributeId:this.attributeId,
				fileIds:this.fileIdsSelected,
				recordId:this.recordId
			};
			ws.send('file','copy',v,true);
			this.$store.commit('filesCopy',v);
			this.fileIdsSelected = [];
		},
		pasteFilesStored() {
			ws.send('file','paste',{
				srcAttributeId:this.filesCopy.attributeId,
				srcFileIds:this.filesCopy.fileIds,
				srcRecordId:this.filesCopy.recordId,
				dstAttributeId:this.attributeId
			},true).then(
				res => {
					let files = [];
					for(let i = 0, j = res.payload.length; i < j; i++) {
						let f = res.payload[i];
						files.push({
							id:f.id,
							name:f.name,
							size:f.size,
							changed:f.changed
						});
					}
					this.updateCreate(files);
					this.$store.commit('filesCopyReset');
				},
				this.$root.genericError
			);
		},
		removeSelected() {
			this.updateDelete(this.fileIdsSelected);
			this.fileIdsSelected = [];
		},
		setSortMode(mode) {
			if(this.sortMode === mode) {
				this.sortDirAsc = !this.sortDirAsc;
			} else {
				this.sortMode   = mode;
				this.sortDirAsc = true;
			}
			
			if(mode === 'name') {
				for(let fileId in this.fileIdMapChange) {
					if(this.fileIdMapChange[fileId].action !== 'rename')
						continue;
					
					for(let i = 0, j = files.length; i < j; i++) {
						if(files[i].id === fileId) {
							files[i].name = this.fileIdMapChange[fileId].name;
							break;
						}
					}
				}
			}
		},
		setSortModeClear(mode) {
			if(this.sortMode === mode)
				this.setSortMode('');
		},
		setViewMode(mode) {
			if(!this.viewModes.includes(mode))
				return this.viewMode = 'listCompact';
			
			this.viewMode = mode;
			this.fieldOptionSet(this.fieldId,'fileViewMode',mode);
		},
		toggle(fileId) {
			let pos = this.fileIdsSelected.indexOf(fileId);
			if(pos === -1) this.fileIdsSelected.push(fileId);
			else           this.fileIdsSelected.splice(pos,1);
		},
		toggleAll() {
			if(this.allSelected)
				return this.fileIdsSelected = [];
			
			this.fileIdsSelected = [];
			for(let i = 0, j = this.filesProcessed.length; i < j; i++) {
				this.fileIdsSelected.push(this.filesProcessed[i].id);
			}
		},
		toggleSortDir(){
			this.sortDirAsc = !this.sortDirAsc;
		},
		update(fileId,action,name) {
			if(typeof this.fileIdMapChange[fileId] === 'undefined') {
				this.fileIdMapChange[fileId] = {
					action:action,
					name:name,
					version:-1
				};
			} else {
				// delete action always takes priority, even if another already existed
				if(action === 'delete')
					this.fileIdMapChange[fileId].action = action;
				
				// file name is used for file reference in change logs regardless of action
				this.fileIdMapChange[fileId].name = name;
			}
			
			// update parent
			this.$emit('update:modelValue',{
				fileCount:this.files.length,
				fileIdMapChange:this.fileIdMapChange
			});
		},
		updateCreate(filesNew) {
			for(let f of filesNew) {
				this.files.push(f);
				this.update(f.id,'create',f.name);
			}
		},
		updateDelete(fileIds) {
			for(let fileId of fileIds) {
				for(let i = 0, j = this.files.length; i < j; i++) {
					if(this.files[i].id === fileId) {
						this.update(fileId,'delete',this.files[i].name);
						this.files.splice(i,1);
						break;
					}
				}
			}
		},
		updateName(fileId,name) {
			// name is not immediately updated in files list to conserve sorting
			// when form is reloaded or sort updated, file name changes are applied
			this.update(fileId,'rename',name);
		},
		upload(files) {
			let maxSize = this.attributeIdMap[this.attributeId].length;
			let updateTotal = () => {
				let total = 0;
				for(let i = 0, j = files.length; i < j; i++) {
					total += files[i].hasProgress;
				}
				this.progress = Math.floor(total / files.length);
			}
			
			for(let i = 0, j = files.length; i < j; i++) {
				
				// check file
				let file = files[i];
				
				if(maxSize !== 0 && Math.floor(file.size/1024) > maxSize) {
					file.hasProgress = 100;
					this.$root.genericError(this.capApp.tooLarge.replace(
						'{NAME}',file.name).replace('{SIZE}',this.getSizeReadable(maxSize))
					);
					continue;
				}
				
				// upload file
				file.hasProgress = 0;
				
				let formData = new FormData();
				let xhr      = new XMLHttpRequest();
				
				xhr.upload.onprogress = function(event) {
					if(event.lengthComputable) {
						file.hasProgress = Math.floor(event.loaded / event.total * 100);
						updateTotal();
					}
				};
				xhr.onload = event => {
					let res = JSON.parse(xhr.response);
					
					if(typeof res.error !== 'undefined') {
						this.$root.genericError('import failed');
						return;
					}
					
					this.updateCreate([{
						id:res.id,
						name:file.name,
						size:Math.floor(file.size/1024),
						changed:0
					}]);
				};
				formData.append('token',this.token);
				formData.append('attributeId',this.attributeId);
				formData.append('fileId',this.getNilUuid())
				formData.append('file',file);
				xhr.open('POST','data/upload',true);
				xhr.send(formData);
			}
		}
	}
};