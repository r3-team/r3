import MyInputColor from './inputColor.js';
export {MyInputDraw as default};

let MyInputDraw = {
	name:'my-input-draw',
	components:{ MyInputColor },
	template:`<div class="input-draw">
		<div class="actions">
			<div class="row gap centered">
				<slot name="input-icon" />
				<my-button image="drawing.png"
					v-if="!readonly"
					@trigger="strokeWidth = strokeWidthDef"
					:active="strokeWidth !== strokeWidthDef"
					:naked="true"
				/>
				<input type="range" class="input-draw-range"
					v-if="!readonly"
					v-model.number="strokeWidth"
					:max="strokeWidthMax"
					:min="strokeWidthMin"
				/>
				<my-button image="search.png"
					@trigger="zoomInput = zoomInputDef"
					:active="zoomInput !== zoomInputDef"
					:naked="true"
				/>
				<input type="range" class="input-draw-range"
					v-model.number="zoomInput"
					:max="zoomInputMax"
					:min="zoomInputMin"
				/>
			</div>
			<div class="row gap centered">
				<template v-if="isMobile || dragModeForce">
					<my-button image="drag.png"
						:active="false"
						:naked="true"
					/>
					<my-bool v-model="dragModeForce" :grow="false" />
				</template>
				<my-button image="colors.png"
					v-if="!readonly"
					@trigger="strokeColor = strokeColorDef"
					:active="strokeColor !== strokeColorDef"
					:naked="true"
				/>
				<my-input-color
					v-if="!readonly"
					v-model="strokeColor"
					:downwards="true"
					:readonly="readonly"
				/>
			</div>
			<div class="row gap">
				<my-button image="undo.png"
					v-if="!readonly"
					@trigger="undo"
					:active="strokes.length !== 0"
					:captionTitle="capGen.button.undo"
					:naked="true"
				/>
				<my-button image="cancel.png"
					v-if="!readonly"
					@trigger="clear"
					:active="strokes.length !== 0"
					:captionTitle="capGen.button.clear"
					:naked="true"
				/>
			</div>
		</div>
		<div class="canvasWrap" ref="canvasWrap">
			<canvas height="300" width="300" oncontextmenu="return false;" ref="canvas"
				@pointerdown="pointerDown"
				@pointermove="pointerMove"
				@pointerup="pointerUp"
				@wheel.passive="wheel"
				:class="{ dragMode:dragMode }"
			/>
		</div>
	</div>`,
	props:{
		formLoading:{ type:Boolean, required:true },
		isHidden:   { type:Boolean, required:true },
		modelValue: { required:true },
		readonly:   { type:Boolean, required:true }
	},
	watch:{
		formLoading(val) {
			if(!val) this.reset();
		},
		isHidden(val){
			if(!val) this.reset();
		},
		zoomInput(val) {
			this.canvasRedraw();
		}
	},
	data() {
		return {
			canvasCtx:null,          // canvas context to draw in
			dragMode:false,
			dragModeForce:false,     // for mobile device, toggle drag mode
			dragOffsetX:0,
			dragOffsetY:0,
			pointerActive:false,
			pointerStartCords:null,  // starting coords of pointer as array [x,y]
			strokeColor:'000000',
			strokeColorDef:'000000',
			strokeWidth:3,
			strokeWidthDef:3,
			strokeWidthMax:12,
			strokeWidthMin:1,
			strokes:[],              // strokes on canvas
			timerDrag:null,
			timerResize:null,
			timerUpdate:null,
			zoomInput:0,
			zoomInputDef:0,
			zoomInputMax:9,
			zoomInputMin:-9
		};
	},
	emits:['update:modelValue'],
	computed:{
		zoom:(s) => 1 + (s.zoomInput / 10),
		
		// stores
		capGen:  (s) => s.$store.getters.captions.generic,
		isMobile:(s) => s.$store.getters.isMobile
	},
	mounted() {
		this.canvasCtx = this.$refs.canvas.getContext('2d');
		this.canvasCtx.lineCap  = 'round';
		this.canvasCtx.lineJoin = 'round';
		
		window.addEventListener('resize',this.resized);
	},
	unmounted() {
		window.removeEventListener('resize',this.resized);
	},
	methods:{
		reset() {
			this.strokes = this.modelValue === null ? [] : JSON.parse(this.modelValue).data;
			this.$nextTick(this.resized);
		},
		
		// events
		dragged() {
			if(this.timerDrag !== null)
				clearTimeout(this.timerDrag);
			
			this.timerDrag = setTimeout(this.canvasRedraw,0.5);
		},
		resized() {
			if(this.timerResize !== null)
				clearTimeout(this.timerResize);
			
			this.timerResize = setTimeout(this.canvasRedraw,200);
		},
		updated() {
			if(this.timerUpdate !== null)
				clearTimeout(this.timerUpdate);
			
			this.timerUpdate = setTimeout(this.update,200);
		},
		
		// helper
		getCursorPosition(evt) {
			return [
				evt.clientX - evt.target.getBoundingClientRect().x,
				evt.clientY - evt.target.getBoundingClientRect().y
			];
		},
		
		// canvas draw
		canvasBeginPath(zoom,posX,posY,color,width) {
			this.canvasCtx.strokeStyle = `#${color}`;
			this.canvasCtx.lineWidth   = width*this.zoom;
			this.canvasCtx.beginPath();
			this.canvasCtx.moveTo(
				(posX*zoom) + this.dragOffsetX,
				(posY*zoom) + this.dragOffsetY
			);
		},
		canvasLineTo(zoom,posX,posY) {
			this.canvasCtx.lineTo(
				(posX * zoom) + this.dragOffsetX,
				(posY * zoom) + this.dragOffsetY
			);
		},
		canvasRedraw() {
			if(this.isHidden) return;
			
			this.$refs.canvas.width  = this.$refs.canvasWrap.clientWidth;
			this.$refs.canvas.height = this.$refs.canvasWrap.clientHeight;
			this.canvasReset();
			
			// performance optimization: draw strokes after a new line started (or at the very end)
			let strokeWaiting = false;
			for(const s of this.strokes) {
				switch(s[0]) {
					case 'b': // start a new path
						if(strokeWaiting)
							this.canvasStroke();
					
						this.canvasBeginPath(this.zoom,s[1],s[2],s[3],s[4]);
						strokeWaiting = false;
					break;
					case 'l': // (continuously) draw existing path
						this.canvasLineTo(this.zoom,s[1],s[2]);
						strokeWaiting = true;
					break;
				}
			}
			// finish last path
			if(strokeWaiting)
				this.canvasStroke();
		},
		canvasReset() {
			this.canvasCtx.clearRect(0,0,
				this.$refs.canvas.width,
				this.$refs.canvas.height);
		},
		canvasStroke() {
			this.canvasCtx.stroke();
		},
		
		// actions
		clear() {
			this.canvasReset();
			this.strokes = [];
			this.updated();
		},
		pointerDown(evt) {
			this.dragMode          = evt.button === 2 || this.dragModeForce;
			this.pointerActive     = true;
			this.pointerStartCords = this.getCursorPosition(evt);
		},
		pointerMove(evt) {
			if(!this.pointerActive)
				return;
			
			if(this.dragMode && this.pointerStartCords !== null) {
				const [posXStart,posYStart] = this.pointerStartCords;
				const [posX,posY]           = this.getCursorPosition(evt);
				this.dragOffsetX -= posXStart - posX;
				this.dragOffsetY -= posYStart - posY;
				this.pointerStartCords = [posX,posY];
				this.dragged();
				return;
			}
			
			if(!this.readonly) {
				// path is started on the first pointer move event (otherwise: empty path)
				if(this.pointerStartCords !== null) {
					const [posXStart,posYStart] = this.pointerStartCords;
					this.canvasBeginPath(
						1,
						posXStart - this.dragOffsetX,
						posYStart - this.dragOffsetY,
						this.strokeColor,
						this.strokeWidth
					);
					this.strokes.push([
						'b',
						(posXStart - this.dragOffsetX) / this.zoom,
						(posYStart - this.dragOffsetY) / this.zoom,
						this.strokeColor,
						this.strokeWidth
					]);
					this.pointerStartCords = null;
				}
				
				const [posX,posY] = this.getCursorPosition(evt);
				this.canvasLineTo(
					1,
					posX - this.dragOffsetX,
					posY - this.dragOffsetY
				);
				this.canvasStroke();
				this.strokes.push([
					'l',
					(posX - this.dragOffsetX) / this.zoom,
					(posY - this.dragOffsetY) / this.zoom
				]);
				this.updated();
			}
		},
		pointerUp(evt) {
			this.dragMode          = false;
			this.pointerActive     = false;
			this.pointerStartCords = null;
		},
		undo() {
			for(let i = this.strokes.length-1; i >= 0; i--) {
				if(this.strokes[i][0] === 'b') {
					this.strokes.splice(i,this.strokes.length - i + 1);
					this.canvasRedraw();
					this.update();
					break;
				}
			}
		},
		update() {
			const empty = this.strokes.length === 0 || this.$refs.canvas === null;
			
			this.$emit('update:modelValue', empty ? null : JSON.stringify({
				data:this.strokes,
				image:this.$refs.canvas.toDataURL()
			}));
		},
		wheel(evt) {
			const wheelUp = evt.wheelDelta > 0;
			
			if(!wheelUp && this.zoomInput > this.zoomInputMin)
				this.zoomInput -= 1;
			
			if(wheelUp && this.zoomInput < this.zoomInputMax)
				this.zoomInput += 1;
		}
	}
};