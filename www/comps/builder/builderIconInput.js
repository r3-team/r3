import {getDependentModules} from '../shared/builder.js';
import {srcBase64}           from '../shared/image.js';
export {MyBuilderIconInput as default};

let MyBuilderIconInput = {
	name:'my-builder-icon-input',
	template:`<div class="builder-icon-input">
		<div class="iconLine input-custom" :tabindex="readonly ? -1 : 0"
			@click="click"
			v-click-outside="escaped"
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
		
		<div class="anchor">
			<div class="dropdown shade"
				v-if="showDropdown && iconIdMap !== null"
			>
				<my-button image="cancel.png"
					v-if="iconIdSelected"
					@trigger="select(null)"
					:cancel="true"
				/>
				
				<div class="module"
					v-for="mod in getDependentModules(module,modules).filter(v => v.icons.length !== 0)"
				>
					<span>{{ mod.name }}</span>
					
					<img class="builder-icon clickable"
						v-for="icon in mod.icons"
						@click="select(icon.id)"
						:src="srcBase64(icon.file)"
					/>
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
			showDropdown:false
		};
	},
	computed:{
		iconSelected:function() {
			if(this.iconIdSelected === null) return false;
			
			return this.iconIdMap[this.iconIdSelected];
		},
		
		// stores
		modules:  function() { return this.$store.getters['schema/modules']; },
		iconIdMap:function() { return this.$store.getters['schema/iconIdMap']; }
	},
	methods:{
		// externals
		getDependentModules,
		srcBase64,
		
		// actions
		click:function() {
			if(!this.readonly)
				this.showDropdown = !this.showDropdown;
		},
		select:function(iconId) {
			this.$emit('input',iconId);
			this.showDropdown = false;
		},
		escaped:function() {
			this.showDropdown = false;
		}
	}
};
