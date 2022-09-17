import {
	getAttributeFileThumbHref,
	getAttributeFileVersionHref
} from './shared/attribute.js';
import {
	getUnixFormat,
	getUtcTimeStringFromUnix
} from './shared/time.js';
import {
	getHtmlStripped,
	getLinkMeta,
	openLink
} from './shared/generic.js';
export {MyValueRich as default};

let MyValueRich = {
	name:'my-value-rich',
	template:`<div class="value-rich"
		@focus="$emit('focus')"
		@click="$emit('trigger')"
		@keyup.space.enter="$emit('trigger')"
		:class="{ color:isColor, files:isFiles, wrap:wrap }"
		:style="style"
	>
		<!-- copy to clipboard action -->
		<my-button image="copyClipboard.png"
			v-if="clipboard && !isFiles && !isGallery"
			@trigger="copyToClipboard"
			:active="value !== null"
			:blockBubble="true"
			:captionTitle="capGen.button.copyClipboard"
			:naked="true"
		/>
		
		<!-- link open action -->
		<my-button
			v-if="isLink"
			@trigger="openLink(link.href,link.blank)"
			@trigger-middle="openLink(link.href,link.blank)"
			:active="value !== null"
			:blockBubble="true"
			:image="link.image"
			:naked="true"
		/>
		
		<!-- string value -->
		<span v-if="isString" :title="stringValueFull">
			{{ stringValue }}
		</span>
		
		<!-- files -->
		<a target="_blank"
			v-if="isFiles && !isGallery"
			v-for="f in files"
			:href="getAttributeFileVersionHref(attributeId,f.id,f.name,token,f.version)"
			:key="f.id"
		>
			<my-button image="download.png"
				:blockBubble="true"
				:caption="f.name.length < 18 ? f.name : f.name.substr(0,14)+'...'"
				:captionTitle="f.name"
				:naked="true"
			/>
		</a>
		
		<template v-if="isGallery">
			<img class="gallery-item"
				v-for="f in files"
				:src="getAttributeFileThumbHref(attributeId,f.id,f.name,token)"
				:style="styleGallery"
			/>
			
			<img class="gallery-item placeholder" src="images/noPic.png"
				v-if="files.length === 0"
				:style="styleGallery"
			/>
		</template>
	</div>`,
	props:{
		attributeId:{ type:String,  required:true },
		basis:      { type:Number,  required:false, default:0 },         // size basis (usually column width)
		clipboard:  { type:Boolean, required:false, default:false },     // copy-to-clipboard action
		display:    { type:String,  required:false, default:'default' }, // variant (color, url, gallery, ...)
		length:     { type:Number,  required:false, default:0 },         // string length limit
		value:      { required:true },
		wrap:       { type:Boolean, required:false, default:false }      // wrap string value
	},
	emits:['clipboard','focus','trigger'],
	watch:{
		value:{
			handler:function() { this.setValue(); },
			immediate:true
		}
	},
	data:function() {
		return {
			isColor:false,
			isFiles:false,
			isGallery:false,
			isLink:false,
			isPassword:false,
			isString:false,
			stringValue:'',    // processed value, shown directly
			stringValueFull:'' // processed value, shown as title, no length limit
		};
	},
	computed:{
		files:function() {
			return !this.isFiles || this.value === null
				? [] : this.value;
		},
		link:function() {
			return !this.isLink || this.value === null
				? false : this.getLinkMeta(this.display,this.value);
		},
		
		// styles
		style:function() {
			return !this.isColor ? '' : 'background-color:#'+this.value;
		},
		styleGallery:function() {
			return !this.isGallery || this.basis === 0 ? '' :
				`width:${this.basis}px;height:${this.basis}px;`;
		},
		
		// store
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		token:         function() { return this.$store.getters['local/token']; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		dateFormat:    function() { return this.$store.getters.settings.dateFormat; }
	},
	methods:{
		// externals
		getAttributeFileThumbHref,
		getAttributeFileVersionHref,
		getHtmlStripped,
		getLinkMeta,
		getUnixFormat,
		getUtcTimeStringFromUnix,
		openLink,
		
		copyToClipboard:function() {
			navigator.clipboard.writeText(
				!this.isPassword ? this.stringValueFull : this.value
			);
			this.$emit('clipboard');
		},
		setValue:function() {
			// special values based on attribute content
			switch(this.attributeIdMap[this.attributeId].content) {
				case 'boolean':
					this.stringValue = this.value ? this.capGen.option.yes : this.capGen.option.no;
					this.isString = true;
					return;
				break;
				case 'files':
					this.isFiles = true;
					
					if(this.display === 'gallery')
						this.isGallery = true;
					
					return;
				break;
			}
			
			// text values, apply display variant
			switch(this.display) {
				
				// show value as color
				case 'color':
					this.isColor = true;
					return;
				break;
				
				// show value as string
				case 'email': // fallthrough, all links, all default strings
				case 'phone': // fallthrough, all links, all default strings
				case 'url':   // fallthrough, all links, all default strings
					this.isLink = true;
				case 'default':
					this.isString = true;
					
					if(this.value !== null)
						this.stringValueFull = this.value;
				break;
				
				case 'password':
					this.isString        = true;
					this.isPassword      = true;
					this.stringValueFull = '**********';
				break;
				
				case 'richtext':
					this.isString = true;
					
					if(this.value !== null)
						this.stringValueFull = this.getHtmlStripped(this.value);
				break;
				
				// date / time
				case 'date':
					this.isString = true;
					this.stringValueFull = this.getUnixFormat(this.value,this.dateFormat);
				break;
				case 'datetime':
					this.isString = true;
					this.stringValueFull = this.getUnixFormat(this.value,this.dateFormat + ' H:i');
				break;
				case 'time':
					this.isString = true;
					this.stringValueFull = this.getUtcTimeStringFromUnix(this.value);
				break;
			}
			
			// set final string value with applied text length limit
			if(this.length !== 0 && this.stringValueFull.length > this.length)
				this.stringValue = `${this.stringValueFull.substring(0,this.length-3)}...`;
			else
				this.stringValue = this.stringValueFull;
		}
	}
};