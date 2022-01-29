import {getDependentModules} from '../shared/builder.js';
import {srcBase64}           from '../shared/image.js';
export {MyBuilderIconInput as default};

let MyBuilderIconInput = {
	name:'my-builder-icon-input',
	template:`<div class="builder-icon-input">
		<div class="iconLine input-custom" :tabindex="readonly ? -1 : 0"
			@click="click"
			:class="{ clickable:!readonly, disabled:readonly }"
		>
			<img class="builder-icon"
				v-if="iconSelected"
				:src="srcBase64(iconSelected.file)"
			/>
			<img class="builder-icon not-set" src="images/noPic.png"
				v-if="!iconSelected"
			/>
		</div>
		
		<div class="app-sub-window" v-if="showInput && iconIdMap !== null" @click.self="close">
			<div class="build-icon-input-window shade">
				<div class="contentBox">
					<div class="top">
						<div class="area">
							<img class="icon"
								v-if="iconSelected"
								:src="srcBase64(iconSelected.file)"
							/>
							<img class="icon" src="images/noPic.png"
								v-if="!iconSelected"
							/>
						</div>
						<div class="area">
							<my-button image="cancel.png"
								@trigger="close"
								:cancel="true"
								:darkBg="true"
							/>
						</div>
					</div>
					<div class="content">
						<div class="module" :class="{ first:i === 0 }"
							v-for="(mod,i) in getDependentModules(module,modules).filter(v => v.icons.length !== 0)"
						>
							<span>{{ mod.name }}</span>
							
							<img class="builder-icon clickable"
								v-for="icon in mod.icons"
								@click="select(icon.id)"
								:src="srcBase64(icon.file)"
							/>
						</div>
						<div class="actions">
							<my-button image="remove.png"
								@trigger="select(null)"
								:active="iconSelected !== false"
								:caption="capGen.button.clear"
								:cancel="true"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		module:        { type:Object,  required:true},
		iconIdSelected:{ required:true },
		readonly:      { type:Boolean, required:false, default:false }
	},
	emits:['input'],
	data:function() {
		return {
			showInput:false
		};
	},
	computed:{
		iconSelected:function() {
			return this.iconIdSelected === null
				? false : this.iconIdMap[this.iconIdSelected];
		},
		
		// stores
		modules:  function() { return this.$store.getters['schema/modules']; },
		iconIdMap:function() { return this.$store.getters['schema/iconIdMap']; },
		capGen:   function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDependentModules,
		srcBase64,
		
		// actions
		click:function() {
			if(!this.readonly)
				this.showInput = !this.showInput;
		},
		close:function() {
			this.showInput = false;
		},
		select:function(iconId) {
			this.$emit('input',iconId);
		}
	}
};
