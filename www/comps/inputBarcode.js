import { openDataImageAsNewTag } from './shared/generic.js';

export default {
	name:'my-input-barcode',
	template:`<div class="input-barcode">
		<div class="input-toolbar row gap" v-if="!hideInputs">
			<div class="row grow default-inputs">
				<slot name="input-icon" />
				<input class="dynamic" data-is-input="1"
					v-model="inputText"
					:class="{ monospace }"
					:disabled="readonly"
					:placeholder="capGen.threeDots"
				/>
			</div>
			<my-button image="barcode.png"
				v-if="isMixedCode && inputFormat !== null && !readonly"
				@trigger="update('format',null)"
				:captionTitle="capApp.formatResetHint"
				:naked="true"
			/>
			<my-button image="camera.png"
				v-if="!readonly"
				@trigger="openCamera"
				:captionTitle="capApp.capture"
				:naked="true"
			/>
			<my-button image="copyClipboard.png"
				v-if="clipboard"
				@trigger="$emit('copyToClipboard')"
				:active="isActive"
				:captionTitle="capGen.button.copyClipboard"
				:naked="true"
			/>
		</div>

		<!-- preview image -->
		<div class="input-barcode-preview" v-show="inputFormat !== null && modelValue !== null && !valueInvalid">
			<img class="input-barcode-preview clickable" ref="barcodePreview"
				@click.left="openImage"
				:class="{ 'max-size':inputFormat === 'QR_CODE' }"
				:title="inputFormat"
			/>
		</div>

		<!-- messages / options -->
		<div class="input-barcode-format default-inputs" v-if="(inputFormat === null && inputText !== '') || valueInvalid">
			<h2 v-if="valueInvalid">{{ capApp.formatInvalidValue }}</h2>
			<template v-if="isMixedCode">
				<h2>{{ capApp.formatMissing }}</h2>
				<select v-model="inputFormat">
					<option value="QR_CODE">QR Code</option>
					<option value="CODABAR">CODABAR</option>
					<option value="CODE_39">CODE 39</option>
					<option value="CODE_128">CODE 128</option>
					<option value="EAN_8">EAN 8</option>
					<option value="EAN_13">EAN 13</option>
					<option value="ITF">ITF</option>
					<option value="UPC_A">UPC A</option>
					<option value="UPC_E">UPC E</option>
				</select>
			</template>
		</div>

		<!-- camera dialog -->
		<div class="app-sub-window" @click.self="close" v-if="showDialog">
			<div class="contentBox float input-barcode-dialog">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/camera.png" />
						<div class="caption">{{ capApp.capture }}</div>
					</div>
					<div class="area">
						<my-button image="cancel.png"
							@trigger="close"
							:cancel="true"
						/>
					</div>
				</div>

				<div class="content gap" :class="{ 'no-padding':deviceIdSelected !== null }">
					<div id="input-barcode-target" class="input-barcode-target"
						v-if="deviceIdSelected !== null"
					></div>

					<template v-if="deviceIdSelected === null">
						<h2>{{ capApp.deviceSelect }}</h2>
						<span v-if="devices.length === 1"><i>{{ capApp.deviceMissing }}</i></span>
						<div class="input-barcode-devices">
							<div class="input-barcode-device clickable"
								v-for="d in devices"
								@click.self="deviceInit(d.id)"
							>
								{{ d.label }}
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>
	</div>`,
	emits:['copyToClipboard','update:modelValue'],
	props:{
		clipboard: { type:Boolean,       required:true },
		contentUse:{ type:String,        required:true },
		hideInputs:{ type:Boolean,       required:true },
		modelValue:{ type:[String,null], required:true },
		monospace: { type:Boolean,       required:true },
		readonly:  { type:Boolean,       required:true }
	},
	data() {
		return {
			devices:[],
			deviceIdSelected:null,
			scanner:null,
			showDialog:false,
			valueInvalid:false
		};
	},
	watch:{
		modelValue:{
			handler(v) { this.preview(); },
			immediate:false
		}
	},
	computed:{
		inputFormat:{
			get() {
				if (this.modelValue !== null)
					return JSON.parse(this.modelValue).format;

				switch (this.contentUse) {
					case 'barcode_codabar': return 'CODABAR'; break;
					case 'barcode_code39': return 'CODE_39'; break;
					case 'barcode_code128': return 'CODE_128'; break;
					case 'barcode_ean8': return 'EAN_8'; break;
					case 'barcode_ean13': return 'EAN_13'; break;
					case 'barcode_itf': return 'ITF'; break;
					case 'barcode_qrcode': return 'QR_CODE'; break;
					case 'barcode_upc_a': return 'UPC_A'; break;
					case 'barcode_upc_e': return 'UPC_E'; break;
				}
				return null;
			},
			set(v) { this.update('format',v); }
		},
		inputText:{
			get()  { return this.modelValue === null ? '' : JSON.parse(this.modelValue).text; },
			set(v) { this.update('text',v); }
		},
		scannerConfig: s => {
			let formats = [];
			if (s.isMixedCode || s.contentUse === 'barcode_codabar') formats.push(Html5QrcodeSupportedFormats.CODABAR);
			if (s.isMixedCode || s.contentUse === 'barcode_code39') formats.push(Html5QrcodeSupportedFormats.CODE_39);
			if (s.isMixedCode || s.contentUse === 'barcode_code128') formats.push(Html5QrcodeSupportedFormats.CODE_128);
			if (s.isMixedCode || s.contentUse === 'barcode_ean8') formats.push(Html5QrcodeSupportedFormats.EAN_8);
			if (s.isMixedCode || s.contentUse === 'barcode_ean13') formats.push(Html5QrcodeSupportedFormats.EAN_13);
			if (s.isMixedCode || s.contentUse === 'barcode_itf') formats.push(Html5QrcodeSupportedFormats.ITF);
			if (s.isMixedCode || s.contentUse === 'barcode_qrcode') formats.push(Html5QrcodeSupportedFormats.QR_CODE);
			if (s.isMixedCode || s.contentUse === 'barcode_upc_a') formats.push(Html5QrcodeSupportedFormats.UPC_A);
			if (s.isMixedCode || s.contentUse === 'barcode_upc_e') formats.push(Html5QrcodeSupportedFormats.UPC_E);

			return {
				fps: 20,
				formatsToSupport: formats,
				qrbox: { width: 300, height: 300 }
			};
		},

		// simple
		imageSrc:    s => s.modelValue === null ? null : JSON.parse(s.modelValue).image,
		isActive:    s => s.inputText !== '',
		isMixedCode: s => s.contentUse === 'barcode', // legacy option, allows all codes

		// stores
		capApp:s => s.$store.getters.captions.input.barcode,
		capGen:s => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);

		// ref elements are registered after mounted(), so preview must wait until then
		this.preview();
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		openDataImageAsNewTag,

		// presentation
		preview() {
			let format;
			switch(this.inputFormat) {
				case 'CODABAR':  format = 'CODABAR'; break;
				case 'CODE_39':  format = 'CODE39';  break;
				case 'CODE_128': format = 'CODE128'; break;
				case 'EAN_8':    format = 'EAN8';    break;
				case 'EAN_13':   format = 'EAN13';   break;
				case 'UPC_A':    format = 'UPC';     break;
				case 'UPC_E':    format = 'UPC';     break;
				case 'ITF':      format = 'ITF';     break;
				case 'QR_CODE':  format = 'QRCODE';  break;
				default:         format = null;      break;
			}

			if(format === null || this.inputText === '' || this.$refs.barcodePreview === undefined)
				return;

			// display image if exists
			if (this.imageSrc !== null)
				return this.$refs.barcodePreview.src = this.imageSrc;

			if(format !== 'QRCODE') {
				JsBarcode(this.$refs.barcodePreview, this.inputText, {
					format:format,
					lineColor:'#000',
					width:2,
					valid:(v) => {
						this.valueInvalid = !v;

						if(v === false)
							return this.$refs.barcodePreview.src = '';

						this.$nextTick(() => {
							this.update('image',this.$refs.barcodePreview.src);
						});
					}
				});
			}
			else {
				let qr = qrcode(0,'M');
				qr.addData(this.inputText);
				qr.make();
				const src = qr.createDataURL();
				this.$refs.barcodePreview.src = src;
				this.update('image',src);
				this.valueInvalid = false;
			}
		},

		// actions
		close() {
			if(this.scanner !== null)
				this.scanner.stop();

			this.showDialog = false;
		},
		deviceInit(id) {
			this.deviceIdSelected = id;
			this.$nextTick(() => {
				this.scanner = new Html5Qrcode('input-barcode-target');
				this.scanner.start(
					this.deviceIdSelected,
					this.scannerConfig,
					this.scanned,
					() => {} // constant scan errors while running
				).catch(console.warn);
			});
		},
		handleHotkeys(e) {
			if(e.key === 'Escape' && this.showDialog)
				this.close();
		},
		openCamera() {
			this.devices          = [];
			this.deviceIdSelected = null;
			this.showDialog       = true;

			Html5Qrcode.getCameras().then(devices => {
				if(devices.length === 1) this.deviceInit(devices[0].id);
				else                     this.devices = devices;
			}).catch(console.warn);
		},
		openImage() {
			if(this.modelValue !== null)
				this.openDataImageAsNewTag(JSON.parse(this.modelValue).image);
		},
		scanned(text,res) {
			this.$emit('update:modelValue',JSON.stringify({
				format: res.result.format.formatName,
				image: null,
				text: text
			}));
			this.close();
		},
		update(name,value) {
			let v = {
				format:this.inputFormat,
				image:null,
				text:this.inputText
			};
			v[name] = value;

			if(v.text === '') this.$emit('update:modelValue',null);
			else              this.$emit('update:modelValue',JSON.stringify(v));
		}
	}
};
