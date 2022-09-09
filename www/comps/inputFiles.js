import {getFilesFromDataItems} from './shared/drop.js';
import {getUnixFormat}         from './shared/time.js';
import {
	getAttributeFileHref,
	getAttributeFileHrefThumb
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
		change:  { required:true },               // file change object (not affected by sort)
		name:    { type:String,  required:true }, // file name
		readonly:{ type:Boolean, required:true }
	},
	emits:['update:name'],
	computed:{
		unsaved:(s) => {
			return typeof s.change !== 'undefined' && s.change.create;
		},
		value:(s) => {
			return typeof s.change !== 'undefined' && s.change.name !== ''
				? s.change.name : s.name;
		},
		
		// store
		capApp:(s) => s.$store.getters.captions.input.files
	}
};

let MyInputFiles = {
	name:'my-input-files',
	components:{MyInputFilesName},
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
				<my-button image="delete.png"
					@trigger="removeSelected"
					:active="fileIdsSelected.length !== 0"
					:caption="!noSpace ? capGen.button.delete : ''"
					:naked="true"
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
					:image="files.length === fileIdsSelected.length ? 'checkBox1.png' : 'checkBox0.png'"
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
								:image="files.length === fileIdsSelected.length ? 'checkBox1.png' : 'checkBox0.png'"
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
					<tr v-for="f in files">
						<td v-if="!readonly" class="minimum">
							<my-button
								@trigger="toggle(f.id)"
								:image="fileIdsSelected.includes(f.id) ? 'checkBox1.png' : 'checkBox0.png'"
								:naked="true"
								:tight="true"
							/>
						</td>
						<td>
							<my-input-files-name
								@update:name="update([f.id],'name',$event)"
								:change="fileIdMapChange[f.id]"
								:name="f.name"
								:readonly="readonly"
							/>
						</td>
						<td>{{ getSizeReadable(f.size) }}</td>
						<td v-if="!noSpace">{{ displayDate(f.changed) }}</td>
						<td>
							<div class="row">
								<a target="_blank"
									:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
								>
									<my-button image="download.png"
										:captionTitle="capApp.button.download"
										:naked="true"
										:tight="true"
									/>
								</a>
								<my-button image="screenFile.png"
									v-if="!readonly"
									@trigger="fileRequest(f.id,false)"
									@trigger-shift="fileRequest(f.id,true)"
									:captionTitle="capApp.button.fileRequestHint"
									:active="hasClient"
									:naked="true"
									:tight="true"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
			
			<!-- list comfortable -->
			<div class="listComfort" v-if="viewListComfort">
				<div class="item" v-for="f in files">
					<a target="_blank"
						:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
						:title="capApp.button.download"
					>
						<img class="prev" :src="imagePreview(f.id,f.name)" />
					</a>
					<div class="item-content">
						<my-input-files-name
							@update:name="update([f.id],'name',$event)"
							:change="fileIdMapChange[f.id]"
							:name="f.name"
							:readonly="readonly"
						/>
						<div class="item-meta">
							<span>{{ displayDate(f.changed) }}</span>
							<span>{{ getSizeReadable(f.size) }}</span>
						</div>
					</div>
					<div v-if="!readonly" class="item-actions shade">
						<my-button
							@trigger="toggle(f.id)"
							:image="fileIdsSelected.includes(f.id) ? 'checkBox1.png' : 'checkBox0.png'"
							:naked="true"
							:tight="true"
						/>
						<my-button image="screenFile.png"
							@trigger="fileRequest(f.id,false)"
							@trigger-shift="fileRequest(f.id,true)"
							:active="hasClient"
							:captionTitle="capApp.button.fileRequestHint"
							:naked="true"
							:tight="true"
						/>
					</div>
				</div>
			</div>
			
			<!-- gallery -->
			<div class="gallery" v-if="viewGallery" >
				<div class="item" v-for="f in files">
					<a target="_blank"
						:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
						:title="capApp.button.download"
					>
						<img class="prev" :src="imagePreview(f.id,f.name)">
					</a>
					<div class="item-meta">
						<my-input-files-name
							@update:name="update([f.id],'name',$event)"
							:change="fileIdMapChange[f.id]"
							:name="f.name"
							:readonly="readonly"
						/>
						<span>{{ displayDate(f.changed) }}</span>
						<span>{{ getSizeReadable(f.size) }}</span>
					</div>
					<div v-if="!readonly" class="item-actions shade">
						<my-button
							@trigger="toggle(f.id)"
							:image="fileIdsSelected.includes(f.id) ? 'checkBox1.png' : 'checkBox0.png'"
							:naked="true"
							:tight="true"
						/>
						<my-button image="screenFile.png"
							@trigger="fileRequest(f.id,false)"
							@trigger-shift="fileRequest(f.id,true)"
							:captionTitle="capApp.button.fileRequestHint"
							:active="hasClient"
							:naked="true"
							:tight="true"
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
			noSpace:false,       // if input field is tiny, reduces clutter,
			progress:100,
			viewModes:['listCompact','listComfort','gallery'],
			
			// inputs
			dragActive:false,
			dragTarget:{},
			fileIdMapChange:{},    // map of file changes done inside this component, key: file ID
			fileIdsSelected:[],    // all file IDs selected by checkbox
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
			if(!val) this.fileIdMapChange = {};
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
		files:{
			get:	function() {
				if(this.modelValue === null)
					return [];
				
				let v = JSON.parse(JSON.stringify(this.modelValue.files));
				
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
			},
			set:function(v) {
				this.$emit('update:modelValue',{
					files:v,
					fileIdMapChange:this.fileIdMapChange
				});
			}
		},
		fileCountCaption:(s) => {
			let out = `${s.files.length}`;
			if(s.countAllowed !== 0) out += ` / ${s.countAllowed}`;
			if(!s.noSpace)           out += ` ${s.capGen.files}`;
			return out;
		},
		
		// simple
		fewFiles:       (s) => s.files.length <= 5,
		maxFiles:       (s) => s.countAllowed !== 0 && s.countAllowed <= s.files.length,
		noFiles:        (s) => s.files.length === 0,
		oneFile:        (s) => s.files.length === 1,
		sortByChanged:  (s) => s.sortMode === 'changed',
		sortByName:     (s) => s.sortMode === 'name',
		sortBySize:     (s) => s.sortMode === 'size',
		viewListComfort:(s) => s.viewMode === 'listComfort',
		viewListCompact:(s) => s.viewMode === 'listCompact',
		viewGallery:    (s) => s.viewMode === 'gallery',
		
		// store
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.input.files,
		capGen:        (s) => s.$store.getters.captions.generic,
		hasClient:     (s) => s.$store.getters.loginHasClient,
		settings:      (s) => s.$store.getters.settings,
		token:         (s) => s.$store.getters['local/token']
	},
	methods:{
		// externals
		fieldOptionGet,
		fieldOptionSet,
		getAttributeFileHref,
		getAttributeFileHrefThumb,
		getFilesFromDataItems,
		getNilUuid,
		getSizeReadable,
		getUnixFormat,
		
		// presentation
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
		imagePreview(fileId,fileName) {
			if(!this.extPreview.includes(this.extRegex.exec(fileName)[1]))
				return 'images/noPic.png';
			
			return this.getAttributeFileHrefThumb(this.attributeId,fileId,fileName,this.token);
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
				chooseApp:chooseApp
			},false);
		},
		removeSelected() {
			this.update(this.fileIdsSelected,'delete',true);
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
				// apply changed file names locally to update sorting
				let files = JSON.parse(JSON.stringify(this.files));
				
				for(let fileId in this.fileIdMapChange) {
					if(this.fileIdMapChange[fileId].name === '')
						continue;
					
					for(let i = 0, j = files.length; i < j; i++) {
						if(files[i].id === fileId) {
							files[i].name = this.fileIdMapChange[fileId].name;
							break;
						}
					}
				}
				this.files = files;
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
			if(this.fileIdsSelected.length === this.files.length)
				return this.fileIdsSelected = [];
			
			this.fileIdsSelected = [];
			for(let i = 0, j = this.files.length; i < j; i++) {
				this.fileIdsSelected.push(this.files[i].id);
			}
		},
		toggleSortDir(){
			this.sortDirAsc = !this.sortDirAsc;
		},
		update(fileIds,key,value) {
			let files = JSON.parse(JSON.stringify(this.files));
			
			for(let fileId of fileIds) {
				if(typeof this.fileIdMapChange[fileId] === 'undefined')
					this.fileIdMapChange[fileId] = {
						name:'',
						create:false,
						delete:false
					};
				
				switch(key) {
					case 'create':
						files.push(value);
						this.fileIdMapChange[fileId].create = true;
					break;
					case 'name':
						// name is not immediately updated in files list to conserve sorting
						// when form is reloaded or sort updated, file name changes are applied
						this.fileIdMapChange[fileId].name = value;
					break;
					case 'delete':
						for(let i = 0, j = files.length; i < j; i++) {
							if(files[i].id === fileId) {
								files.splice(i,1);
								break;
							}
						}
						this.fileIdMapChange[fileId].delete = true;
					break;
				}
			}
			
			if(files.length === 0 && JSON.stringify(this.fileIdMapChange) === '{}')
				return this.$emit('update:modelValue',null);
			
			this.files = files;
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
					
					this.update([res.id],'create',{
						id:res.id,
						name:file.name,
						size:Math.floor(file.size/1024),
						changed:0
					});
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