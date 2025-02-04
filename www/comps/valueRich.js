import {srcBase64} from './shared/image.js';
import {
	getAttributeFileThumbHref,
	getAttributeFileVersionHref
} from './shared/attribute.js';
import {
	getUnixFormat,
	getUnixShifted,
	getUtcTimeStringFromUnix
} from './shared/time.js';
import {
	colorAdjustBg,
	getHtmlStripped,
	getLinkMeta,
	openDataImageAsNewTag,
	getNumberFormatted,
	openLink
} from './shared/generic.js';
export {MyValueRich as default};

let MyValueRich = {
	name:'my-value-rich',
	template:`<div class="value-rich"
		@focus="$emit('focus')"
		@click="$emit('trigger')"
		@keyup.space.enter="$emit('trigger')"
		:class="{ alignEnd:alignEnd, alignMid:alignMid, bold:bold, color:isColor, files:isFiles, italic:italic, monospace:monospace, wrap:wrap }"
		:style="style"
	>
		<!-- copy to clipboard action -->
		<my-button image="copyClipboard.png"
			v-if="clipboard && !isFiles"
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

		<!-- rating icon -->
		<img class="value-rich-rating-icon"
			v-if="isRating && value !== null"
			:src="attributeIdMap[attributeId].iconId !== null ? srcBase64(iconIdMap[attributeIdMap[attributeId].iconId].file) : 'images/star1.png'"
		/>
		
		<!-- string value -->
		<span v-if="isString" :title="stringValueFull">
			{{ stringValue }}
		</span>
		
		<!-- boolean value -->
		<template v-if="isBoolean && value !== null">
			<img class="boolean"
				v-if="settings.boolAsIcon"
				:class="{ ok:value }"
				:src="value ? 'images/ok.png' : 'images/cancel.png'"
			/>
			<span v-else>{{ value ? capGen.option.yes : capGen.option.no }}</span>
		</template>

		<!-- barcode -->
		<img class="barcode clickable"
			v-if="isBarcode && isGallery && value !== null"
			@click.left.stop="openDataImageAsNewTag(JSON.parse(value).image)"
			:class="{ previewLarge:previewLarge }"
			:src="JSON.parse(value).image"
		/>
		
		<!-- drawing -->
		<img class="drawing clickable"
			v-if="isDrawing && value !== null"
			@click.left.stop="openDataImageAsNewTag(JSON.parse(value).image)"
			:class="{ previewLarge:previewLarge }"
			:src="JSON.parse(value).image"
		/>
		
		<!-- files -->
		<a target="_blank"
			v-if="isFiles && !isGallery"
			v-for="f in files.filter((v,i) => length === 0 || length > i)"
			:href="getAttributeFileVersionHref(attributeId,f.id,f.name,f.version,token)"
			:key="f.id"
		>
			<my-button image="download.png"
				:blockBubble="true"
				:caption="f.name.length < 18 ? f.name : f.name.substr(0,14)+'...'"
				:captionTitle="f.name"
				:naked="true"
			/>
		</a>
		
		<!-- files as gallery -->
		<img class="gallery-item"
			v-if="isFiles && isGallery"
			v-for="f in files.filter((v,i) => length === 0 || length > i)"
			:class="{ previewLarge:previewLarge }"
			:src="getAttributeFileThumbHref(attributeId,f.id,f.name,f.version,token)"
			:style="styleImage"
		/>
	</div>`,
	props:{
		alignEnd:    { type:Boolean, required:false, default:false },
		alignMid:    { type:Boolean, required:false, default:false },
		attributeId: { type:String,  required:true },
		basis:       { type:Number,  required:false, default:0 },         // size basis (usually column width)
		bold:        { type:Boolean, required:false, default:false },
		clipboard:   { type:Boolean, required:false, default:false },     // copy-to-clipboard action
		display:     { type:String,  required:false, default:'default' }, // variant (url, gallery, password ...)
		italic:      { type:Boolean, required:false, default:false },
		length:      { type:Number,  required:false, default:0 },         // max. length if string, max. entries shown if files
		monospace:   { type:Boolean, required:false, default:false },
		previewLarge:{ type:Boolean, required:false, default:false },
		value:       { required:true },
		wrap:        { type:Boolean, required:false, default:false }      // wrap string value
	},
	emits:['clipboard','focus','trigger'],
	watch:{
		value:{
			handler() { this.setValue(); },
			immediate:true
		}
	},
	data() {
		return {
			isBarcode:false,
			isBoolean:false,
			isColor:false,
			isDrawing:false,
			isFiles:false,
			isGallery:false,
			isLink:false,
			isPassword:false,
			isRating:false,
			isString:false,
			stringValue:'',    // processed value, shown directly
			stringValueFull:'' // processed value, shown as title, no length limit
		};
	},
	computed:{
		files:(s) => !s.isFiles || s.value === null ? [] : s.value,
		link: (s) => {
			if(!s.isLink || s.value === null) return false;
			
			return s.getLinkMeta(s.display, s.isBarcode ? JSON.parse(s.value).text : s.value);
		},
		
		// styles
		style:(s) => {
			let out = [];
			if(s.basis !== 0) out.push(`max-width:${s.basis}px`);
			
			if(s.isColor)
				out.push(`background-color:${s.colorAdjustBg(s.value)}`);
			
			return out.join(';');
		},
		styleImage:(s) => `width:${100 / (s.length === 0 || s.files.length < s.length ? s.files.length : s.length)}%`,
		
		// store
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		token:         (s) => s.$store.getters['local/token'],
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		colorAdjustBg,
		getAttributeFileThumbHref,
		getAttributeFileVersionHref,
		getHtmlStripped,
		getLinkMeta,
		getNumberFormatted,
		getUnixFormat,
		getUnixShifted,
		getUtcTimeStringFromUnix,
		openDataImageAsNewTag,
		openLink,
		srcBase64,
		
		copyToClipboard() {
			let value = !this.isPassword ? this.stringValueFull : this.value;

			if(this.isBarcode && this.value !== null)
				value = JSON.parse(this.value).text;

			navigator.clipboard.writeText(value);
			this.$emit('clipboard');
		},
		setValue() {
			let directValue = false;
			let atr = this.attributeIdMap[this.attributeId];
			switch(atr.content) {
				case 'boolean':
					return this.isBoolean = true;
				break;
				case 'files':
					this.isGallery = this.display === 'gallery';
					return this.isFiles = true;
				break;
				
				// text
				case 'text': // fallthrough
				case 'varchar':
					
					// handle different uses and display options
					switch(atr.contentUse) {
						case 'barcode':
							this.isBarcode = true;

							if(this.value !== null)
								this.stringValueFull = JSON.parse(this.value).text;
						break;
						case 'color':   return this.isColor   = true; break;
						case 'drawing': return this.isDrawing = true; break;
						case 'richtext':
							if(this.value !== null)
								this.stringValueFull = this.getHtmlStripped(this.value);
						break;
						default: directValue = true; break;
					}
					switch(this.display) {
						case 'gallery': return this.isGallery = this.display === 'gallery'; break;
						case 'password':
							this.isPassword      = true;
							this.stringValueFull = '**********';
							directValue = false;
						break;
						case 'email': // fallthrough
						case 'phone': // fallthrough
						case 'url': this.isLink = true; break;
					}
				break;
				
				// integers
				case 'integer': // fallthrough
				case 'bigint':
					switch(atr.contentUse) {
						case 'date': // shift to local offset to show correct date
							this.stringValueFull = this.value === null ? ''
								: this.getUnixFormat(this.getUnixShifted(this.value,true),this.settings.dateFormat);
						break;
						case 'datetime': this.stringValueFull = this.getUnixFormat(this.value,this.settings.dateFormat + ' H:i'); break;
						case 'time':     this.stringValueFull = this.getUtcTimeStringFromUnix(this.value);                        break;
						default: directValue = true; break;
					}
					if(this.display === 'rating')
						this.isRating = true;
				break;
				
				// decimals
				case 'numeric': // fallthrough
				case 'double precision':
				case 'real':
					this.stringValueFull = this.getNumberFormatted(this.value,atr);
				break;
				
				// others (UUID)
				default: directValue = true; break;
			}
			
			// only string values left
			this.isString = true;
			
			if(directValue && this.value !== null)
				this.stringValueFull = this.value;
			
			// set final string value with applied text length limit
			if(this.length !== 0 && this.stringValueFull.length > this.length)
				this.stringValue = `${this.stringValueFull.substring(0,this.length-3)}...`;
			else
				this.stringValue = this.stringValueFull;
		}
	}
};