import {getTemplateHistory} from '../shared/builderTemplate.js';
import {deepIsEqual}        from '../shared/generic.js';

const MyBuilderHistoryRelease = {
	name:'my-builder-history-release',
	template:`<tr>
		<td colspan="3">
			<my-button
				@trigger="show = !show"
				:caption="title"
				:image="show ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
		</td>
	</tr>
	<tr v-if="show" v-for="(c,i) in categories">
		<td class="minimum"> </td>
		<td class="minimum topAligned">
			<my-button image="add.png"
				@trigger="add(i)"
				:caption="c"
				:naked="true"
			/>
		</td>
		<td>
			<draggable handle=".dragAnchor" itemKey="id" animation="100" class="builder-history-release"
				v-model="history[i]"
				@change="update"
				:fallbackOnBody="true"
				:group="String(build) + '_' + String(i)"
			>
				<template #item="{element,index}">
					<div class="builder-history-release-entry">
						<img class="dragAnchor" src="images/drag.png" />
						<input class="long" v-model="element.content" @input="updateAfterWait" :disabled="readonly" />
						<my-button image="delete.png"
							@trigger="del(i,index)"
							:cancel="true"
						/>
					</div>
				</template>
			</draggable>
		</td>
	</tr>`,
	emits:['update'],
	props:{
		build:     { type:Number,  required:true },
		categories:{ type:Array,   required:true },
		modelValue:{ type:Array,   required:true },
		readonly:  { type:Boolean, required:true }
	},
	data() {
		return {
			show:this.build === 0,
			timerUpdateDelay:null
		};
	},
	computed:{
		// inputs
		history:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		isNew:s => s.build === 0,
		title:s => s.isNew ? s.capGen.versionAppNew : `${s.capGen.versionApp} (${s.build})`,
		
		// stores
		capApp:s => s.$store.getters.captions.builder.history,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateHistory,

		// actions
		add(categoryIndex) {
			this.history[categoryIndex].push(this.getTemplateHistory(categoryIndex,this.build));
		},
		del(categoryIndex,entryIndex) {
			this.history[categoryIndex].splice(entryIndex,1);
			this.update();
		},
		update() {
			this.$emit('update');
		},
		updateAfterWait() {
			if(this.timerUpdateDelay !== null)
				clearTimeout(this.timerUpdateDelay);

			this.timerUpdateDelay = setTimeout(this.update,300);
		}
	}
};

export default {
	name:'my-builder-history',
	components:{ MyBuilderHistoryRelease },
	template:`<div class="builder-history contentBox grow">
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/versionHistory.png" />
				<h1 class="title">{{ capGen.versionHistory }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="save.png"
					@trigger="set"
					:active="isChanged && !readonly"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset(true)"
					:active="isChanged"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content no-padding default-inputs" v-if="module">
			<table class="generic-table bright">
				<tbody>
					<my-builder-history-release
						v-for="build in buildsSorted"
						v-model="releaseBuildMap[build]"
						@update="update"
						:build="parseInt(build)"
						:categories
						:readonly
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	data() {
		return {
			filter:'',
			history:false,
			historyCopy:false, // copy of history from schema when component last reset
			releaseBuildMap:{}
		};
	},
	watch:{
		historySchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	computed:{
		// simple
		buildsSorted: s => ['0', ...Object.keys(s.releaseBuildMap).filter(v => v !== '0').reverse()],
		categories:   s => s.module === false ? [] : s.module.historyCategories,
		historySchema:s => s.module === false ? [] : s.module.history,
		isChanged:    s => !s.deepIsEqual(s.history,s.historySchema),
		module:       s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capApp:     s => s.$store.getters.captions.builder.history,
		capGen:     s => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	methods:{
		// externals
		deepIsEqual,

		// actions
		reset(manuelReset) {
			if(manuelReset || !this.deepIsEqual(this.historyCopy,this.historySchema)) {
				this.history     = JSON.parse(JSON.stringify(this.historySchema));
				this.historyCopy = JSON.parse(JSON.stringify(this.historySchema));

				// for every release build number, one array of history entries per category
				const templ = [];
				for(const c of this.categories) {
					templ.push([]);
				}

				this.releaseBuildMap = { '0':JSON.parse(JSON.stringify(templ)) };
				for(const h of this.history) {
					if(this.releaseBuildMap[h.releaseBuild] === undefined)
						this.releaseBuildMap[h.releaseBuild] = JSON.parse(JSON.stringify(templ));

					if(h.category < this.categories.length)
						this.releaseBuildMap[h.releaseBuild][h.category].push(h);
				}
			}
		},
		update() {
			let out = [];
			for(const build in this.releaseBuildMap) {
				for(let i = 0, j = this.categories.length; i < j; i++) {
					for(const h of this.releaseBuildMap[build][i]) {
						out.push(h);
					}
				}
			}
			this.history = out;
		},

		// backend calls
		set() {
			if(!this.isChanged)
				return;

			ws.send('module','set',{ ...this.module, ...{history:this.history} },true).then(
				() => { this.$root.schemaReload(this.id); },
				this.$root.genericError
			);
		}
	}
};