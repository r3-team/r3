import {getAttributeFileHref} from './shared/attribute.js';
import {getUnixFormat}        from './shared/time.js';
import {
	getNilUuid,
	getSizeReadable
} from './shared/generic.js';
export {MyInputFiles as default};

let MyInputFiles = {
	name:'my-input-files',
	template:`<div class="input-files">
	
		<!-- header -->
		<div class="input-files-header default-inputs">
		
			<!-- file upload -->
			<div class="upload" v-if="!readonly">
				<input type="file" multiple="multiple"
					@change="upload"
				/>
				
	   			<transition name="fade_out">
					<div v-if="progress !== 100" class="counter">
						{{ progress + '%' }}
					</div>
				</transition>
			</div>
			
			<!-- file name filter -->
			<div class="row">
				<div class="view-toggle">
					<img src="images/files_list1.png" @click="viewMode = 'listCompact'" />
					<img src="images/files_list2.png" @click="viewMode = 'listComfortable'" />
					<img src="images/files_list3.png" @click="viewMode = 'gallery'" />
				</div>
				<input v-model="filterName" class="short" placeholder="..." />
			</div>
		</div>
		
		<div class="input-files-content">
			
			<!-- listCompact -->
			<table class="listCompact" v-if="viewMode === 'listCompact'">
				<thead>
					<tr>
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
						<th>
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
						<td>
							<div class="row">
								<slot name="input-icon" />
								<input
									@input="update(f.id,$event.target.value)"
									:disabled="readonly"
									:value="f.name"
								/>
							</div>
						</td>
						<td>{{ getSizeReadable(f.size) }}</td>
						<td>{{ displayDate(f.changed) }}</td>
						<td>
							<div class="row">
								<my-button image="form.png"
									v-if="!readonly"
									@trigger="fileRequest(f.id,false)"
									@trigger-shift="fileRequest(f.id,true)"
									:naked="true"
									:tight="true"
								/>
								<a target="_blank"
									:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
								>
									<my-button image="download.png"
										:naked="true"
										:tight="true"
									/>
								</a>
								<my-button image="cancel.png"
									v-if="!readonly"
									@trigger="remove(f.id)"
									:naked="true"
									:tight="true"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
			
			<!-- list comfortable -->
			<div class="listComfortable" v-if="viewMode === 'listComfortable'">
				<div class="item" v-for="f in files">
					<a target="_blank"
						:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
					>
						<img class="prev" :src="imagePreview(f.id,f.name)" />
					</a>
					<div class="item-content">
						<input
							@input="update(f.id,$event.target.value)"
							:disabled="readonly"
							:value="f.name"
						/>
						<div class="item-meta">
							<span>{{ displayDate(f.changed) }}</span>
							<span>{{ getSizeReadable(f.size) }}</span>
						</div>
					</div>
					<div class="item-actions">
						<my-button image="form.png"
							v-if="!readonly"
							@trigger="fileRequest(f.id,false)"
							@trigger-shift="fileRequest(f.id,true)"
							:naked="true"
							:tight="true"
						/>
						<my-button image="cancel.png"
							v-if="!readonly"
							@trigger="remove(f.id)"
							:naked="true"
							:tight="true"
						/>
					</div>
				</div>
			</div>
			
			<!-- gallery -->
			<div class="gallery" v-if="viewMode === 'gallery'" >
			
				<div class="item" v-for="f in files">
					<a target="_blank"
						:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
					>
						<img class="prev" :src="imagePreview(f.id,f.name)">
					</a>
					<div class="item-meta">
						<input
							@input="update(f.id,$event.target.value)"
							:disabled="readonly"
							:value="f.name"
						/>
						<span>{{ displayDate(f.changed) }}</span>
						<span>{{ getSizeReadable(f.size) }}</span>
					</div>
					<div class="item-actions shade">
						<my-button image="form.png"
							v-if="!readonly"
							@trigger="fileRequest(f.id,false)"
							@trigger-shift="fileRequest(f.id,true)"
							:naked="true"
							:tight="true"
						/>
						<my-button image="cancel.png"
							v-if="!readonly"
							@trigger="remove(f.id)"
							:naked="true"
							:tight="true"
						/>
					</div>
				</div>
			</div>
		</div>
		
		<!-- nothing here -->
		<div class="item" v-if="modelValue === null">
			<slot name="input-icon" />
			<slot name="input-empty" />
		</div>
	</div>`,
	props:{
		attributeId:{ type:String,  required:true },
		modelValue: { required:true },
		readonly:   { type:Boolean, required:false, default:false },
		showGallery:{ type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	data:function() {
		return {
			extPreview:['bmp','gif','jpg','jpeg','png','webp'],
			extRegex:/(?:\.([^.]+))?$/,
			filterName:'',         // filter files by name
			galleryIndex:0,
			progress:100,
			sortDirAsc:true,
			sortMode:'name',       // name, size, changed
			viewMode:'gallery' // listCompact, listComfortable, gallery
		};
	},
	mounted:function() {
		// TEMP
		// check for field options
		
		// apply defaults
		if(this.showGallery)
			this.viewMode = 'gallery';
	},
	computed:{
		files:{
			get:	function() {
				if(this.modelValue === null)
					return [];
				
				let v = JSON.parse(JSON.stringify(this.modelValue.files));
				
				if(this.filterName !== '')
					v = v.filter(f => f.name.includes(this.filterName))
				
				switch(this.sortMode) {
					case 'changed':
						if(this.sortDirAsc)  v.sort((a, b) => a.changed - b.changed);
						if(!this.sortDirAsc) v.sort((a, b) => b.changed - a.changed);
					break;
					case 'name':
						if(this.sortDirAsc)  v.sort((a, b) => a.name.localeCompare(b.name));
						if(!this.sortDirAsc) v.sort((a, b) => b.name.localeCompare(a.name));
					break;
					case 'size':
						if(this.sortDirAsc)  v.sort((a, b) => a.size - b.size);
						if(!this.sortDirAsc) v.sort((a, b) => b.size - a.size);
					break;
				}
				return v;
			},
			set:function(v) {
				if(v.length === 0)
					return this.$emit('update:modelValue',null);
				
				this.$emit('update:modelValue',{files:v});
			}
		},
		
		// store
		settings:      function() { return this.$store.getters.settings; },
		token:         function() { return this.$store.getters['local/token']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.input.files; }
	},
	methods:{
		// externals
		getAttributeFileHref,
		getNilUuid,
		getSizeReadable,
		getUnixFormat,
		
		// presentation
		displayDate:function(date) {
			return date !== 0
				? this.getUnixFormat(date,[this.settings.dateFormat,'H:i:S'].join(' '))
				: '-';
		},
		displaySortDir:function(mode) {
			if(this.sortMode !== mode)
				return '';
			
			return this.sortDirAsc ? ' \u25B2' : ' \u25BC';
		},
		imagePreview:function(fileId,fileName) {
			if(!this.extPreview.includes(this.extRegex.exec(fileName)[1]))
				return 'images/noPic.png';
			
			return this.getAttributeFileHref(this.attributeId,fileId,fileName,this.token);
		},
		setSortMode:function(mode) {
			if(this.sortMode === mode)
				return this.sortDirAsc = !this.sortDirAsc;
			
			this.sortMode   = mode;
			this.sortDirAsc = true;
		},
		setSortModeClear:function(mode) {
			if(this.sortMode === mode)
				this.sortMode = '';
		},
		
		// actions
		fileRequest:function(fileId,chooseApp) {
			ws.send('file','request',{
				attributeId:this.attributeId,
				fileId:fileId,
				chooseApp:chooseApp
			},false);
		},
		remove:function(fileId) {
			for(let i = 0, j = this.files.length; i < j; i++) {
				if(this.files[i].id === fileId) {
					this.files.splice(i,1);
					break;
				}
			}
			this.files = this.files;
			
			if(this.galleryIndex > 0)
				this.galleryIndex--;
		},
		update:function(fileId,name) {
			for(let i = 0, j = this.files.length; i < j; i++) {
				if(this.files[i].id === fileId) {
					this.files[i].name = name;
					break;
				}
			}
			this.files = this.files;
			
			if(this.galleryIndex > 0)
				this.galleryIndex--;
		},
		upload:function(evt) {
			let that    = this;
			let maxSize = this.attributeIdMap[this.attributeId].length;
			
			let updateTotal = function() {
				let total = 0;
				for(let i = 0, j = evt.target.files.length; i < j; i++) {
					total += evt.target.files[i].hasProgress;
				}
				that.progress = Math.floor(total / evt.target.files.length);
			}
			
			for(let i = 0, j = evt.target.files.length; i < j; i++) {
				
				// check file
				let file = evt.target.files[i];
				
				if(maxSize !== 0 && Math.floor(file.size/1024) > maxSize) {
					file.hasProgress = 100;
					that.$root.genericError(that.capApp.tooLarge.replace(
						'{NAME}',file.name).replace('{SIZE}',that.getSizeReadable(maxSize))
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
				}
				xhr.onload = function(event) {
					let res = JSON.parse(xhr.response);
					
					if(typeof res.error !== 'undefined') {
						that.$root.genericError('import failed');
						return;
					}
					
					that.files.push({
						id:res.id,
						name:file.name,
						size:Math.floor(file.size/1024),
						changed:0
					});
					that.files = that.files;
				}
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