import {getAttributeFileHref} from './shared/attribute.js';
import {
	getNilUuid,
	getSizeReadable
} from './shared/generic.js';
export {MyInputFiles as default};

let MyInputFiles = {
	name:'my-input-files',
	template:`<div class="input-files">
		
		<!-- file list view -->
		<div class="item" v-if="!showGallery" v-for="f in files">
			
			<slot name="input-icon" />
			<input
				@input="update(f.id,$event.target.value)"
				:disabled="readonly"
				:value="f.name"
			/>
			
			<my-button image="cancel.png"
				v-if="!readonly"
				@trigger="remove(f.id)"
				:naked="true"
			/>
			
			<my-button image="form.png"
				v-if="!readonly"
				@trigger="fileRequest(f.id,f.hash,f.name,false)"
				@trigger-shift="fileRequest(f.id,f.hash,f.name,true)"
				:naked="true"
			/>
			
			<a target="_blank"
				:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
			>
				<my-button image="download.png"
					:naked="true"
				/>
			</a>
			<div class="size">{{ getSizeReadable(f.size) }}</div>
		</div>
		
		<!-- gallery view -->
		<div class="gallery" v-if="showGallery && files.length !== 0" >
			
			<template v-for="(f,i) in files.filter((v,i) => galleryIndex === i)">
				
				<my-button class="img-remove" image="cancel.png"
					v-if="!readonly"
					@trigger="remove(f.id)"
					:cancel="true"
				/>
				<a class="slide" target="_blank"
					:href="getAttributeFileHref(attributeId,f.id,f.name,token)"
					:style="'background-image:url('+getAttributeFileHref(attributeId,f.id,f.name,token)+')'"
				/>
			</template>
			
			<div class="gallery-navigation" v-if="files.length > 1">
				<my-button image="arrowLeft.png"
					@trigger="galleryIndex--"
					:active="galleryIndex !== 0"
				/>
				<my-button
					@trigger="galleryIndex !== 0 ? galleryIndex = 0 : galleryIndex = files.length -1"
					:caption="(galleryIndex+1) + '/' + files.length"
				/>
				<my-button image="arrowRight.png"
					@trigger="galleryIndex++"
					:active="galleryIndex < files.length-1"
				/>
			</div>
		</div>
		
		<!-- nothing here -->
		<div class="item" v-if="modelValue === null">
			<slot name="input-icon" />
			<slot name="input-empty" />
		</div>
		
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
			galleryIndex:0,
			progress:100
		};
	},
	computed:{
		files:{
			get:	function() {
				return this.modelValue === null
					? [] : this.modelValue.files;
			},
			set:function(v) {
				if(v.length === 0)
					return this.$emit('update:modelValue',null);
				
				this.$emit('update:modelValue',{files:v});
			}
		},
		
		// store
		token:         function() { return this.$store.getters['local/token']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.input; }
	},
	methods:{
		// externals
		getAttributeFileHref,
		getNilUuid,
		getSizeReadable,
		
		// actions
		fileRequest:function(fileId,fileHash,fileName,chooseApp) {
			ws.send('file','request',{
				attributeId:this.attributeId,
				chooseApp:chooseApp,
				fileId:fileId,
				fileHash:fileHash,
				fileName:fileName
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
					that.$root.genericError(that.capApp.fileTooLarge.replace(
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
						size:Math.floor(file.size/1024)
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