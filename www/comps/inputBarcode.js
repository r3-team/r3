export {MyInputBarcode as default};

let MyInputBarcode = {
	name:'my-input-barcode',
	template:`<div class="input-barcode">
		<div class="input-barcode-actions">
			<input class="input-iframe-input" data-is-input="1"
				v-model="input"
				:disabled="readonly"
				:placeholder="capGen.threeDots"
			/>
			<my-button image="copyClipboard.png"
				v-if="clipboard"
				@trigger="$emit('copyToClipboard')"
				:active="isActive"
				:naked="true"
			/>
			<my-button image="fileImage.png"
				@trigger="open"
				:naked="true"
			/>
		</div>
		<div class="input-barcode-preview">
		</div>

		<!-- snap dialog -->
		<div class="app-sub-window" @click.self="close" v-if="showDialog">
			<div class="contentBox float input-barcode-dialog">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/fileImage.png" />
						<div class="caption">{{ capApp.title }}</div>
					</div>
					<div class="area">
						<my-button image="cancel.png"
							@trigger="close"
							:cancel="true"
						/>
					</div>
				</div>
				
				<div class="content gap">
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
		clipboard: { type:Boolean, required:true },
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:true }
	},
	data() {
		return {
			config:{fps:20,qrbox:{ width:300, height:300 }},
			devices:[],
			deviceIdSelected:null,
			scanner:null,
			showDialog:false
		};
	},
	computed:{
		input:{
			get()  { return this.modelValue === null ? '' : this.modelValue.text; },
			set(v) {
				this.$emit('update:modelValue',v);
			}
		},

		// simple
		isActive:(s) => s.modelValue !== null,

		// stores
		capApp:(s) => s.$store.getters.captions.input.scanner,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
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
					this.config,
					this.scanned,
					() => {} // constant scan errors while running
				).catch(console.warn);
			});
		},
		handleHotkeys(e) {
			if(e.key === 'Escape' && this.showDialog)
				this.close();
		},
		open() {
			this.deviceIdSelected = null;
			this.devices          = [];
			this.showDialog       = true;

			Html5Qrcode.getCameras().then(devices => {
				if(devices.length === 1) this.deviceInit(devices[0].id);
				else                     this.devices = devices;
			}).catch(console.warn);
		},
        scanned(text,res) {
			this.input = JSON.stringify({
				format:res.result.format.format,
				text:text
			});
			this.close();
        }
	}
};