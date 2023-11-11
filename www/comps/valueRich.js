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
	openLink
} from './shared/generic.js';
export {MyValueRich as default};

let MyValueRich = {
	name:'my-value-rich',
	template:`<div class="value-rich"
		@focus="$emit('focus')"
		@click="$emit('trigger')"
		@keyup.space.enter="$emit('trigger')"
		:class="{ bold:bold, color:isColor, files:isFiles, italic:italic, wrap:wrap }"
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
		
		<!-- drawing -->
		<img class="drawing" v-if="isDrawing && value !== null" :src="JSON.parse(value).image" />
		
		<template v-if="isGallery">
			<img class="gallery-item"
				v-for="f in files"
				:src="getAttributeFileThumbHref(attributeId,f.id,f.name,f.version,token)"
				:style="styleImage"
			/>
			
			<img class="gallery-item placeholder" src="images/noPic.png"
				v-if="files.length === 0"
			/>
		</template>
	</div>`,
	props:{
		attributeId:{ type:String,  required:true },
		basis:      { type:Number,  required:false, default:0 },         // size basis (usually column width)
		bold:       { type:Boolean, required:false, default:false },
		clipboard:  { type:Boolean, required:false, default:false },     // copy-to-clipboard action
		display:    { type:String,  required:false, default:'default' }, // variant (url, gallery, password ...)
		italic:     { type:Boolean, required:false, default:false },
		length:     { type:Number,  required:false, default:0 },         // string length limit
		value:      { required:true },
		wrap:       { type:Boolean, required:false, default:false }      // wrap string value
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
			isColor:false,
			isDrawing:false,
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
		files:(s) => !s.isFiles || s.value === null ? [] : s.value,
		link: (s) => !s.isLink || s.value === null ? false : s.getLinkMeta(s.display,s.value),
		
		// styles
		style:(s) => {
			let out = [];
			if(s.basis !== 0)    out.push(`max-width:${s.basis}px`);
			else if(s.isGallery) out.push(`max-width:40px`);
			
			if(s.isColor)
				out.push(`background-color:${s.colorAdjustBg(s.value)}`);
			
			return out.join(';');
		},
		styleImage:(s) => `width:${(99 - s.files.length) / s.files.length}%`,
		
		// store
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
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
		getUnixFormat,
		getUnixShifted,
		getUtcTimeStringFromUnix,
		openLink,
		
		copyToClipboard() {
			navigator.clipboard.writeText(
				!this.isPassword ? this.stringValueFull : this.value
			);
			this.$emit('clipboard');
		},
		setValue() {
			let directValue = false;
			let atr = this.attributeIdMap[this.attributeId];
			switch(atr.content) {
				case 'boolean':
					this.stringValue = this.value ? this.capGen.option.yes : this.capGen.option.no;
					return this.isString = true;
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
						case 'color':   return this.isColor   = true; break;
						case 'drawing': return this.isDrawing = true; break;
						case 'richtext':
							if(this.value !== null)
								this.stringValueFull = this.getHtmlStripped(this.value);
						break;
						default: directValue = true; break;
					}
					switch(this.display) {
						case 'password':
							this.isPassword      = true;
							this.stringValueFull = '**********';
							directValue = false;
						break;
						case 'email': // fallthrough
						case 'phone': // fallthrough
						case 'url':
							this.isLink = true;
						break;
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
				break;
				
				// decimals
				case 'numeric': // fallthrough
				case 'double precision':
				case 'real':
					const hasFraction = this.value % 1 !== 0;
					let strNum        = String(this.value);
					let strFraction   = '';
					
					if(hasFraction)
						[strNum,strFraction] = strNum.split('.');
					
					strNum = strNum.replace(/\B(?=(\d{3})+(?!\d))/g,this.settings.numberSepThousand);
					
					this.stringValueFull = hasFraction
						? strNum + this.settings.numberSepDecimal + strFraction
						: strNum;
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