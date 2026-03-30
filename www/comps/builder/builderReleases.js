import {getTemplateReleaseLog} from '../shared/builderTemplate.js';
import {deepIsEqual}           from '../shared/generic.js';
import {getUnixFormat}         from '../shared/time.js';

const MyBuilderReleaseLogs = {
	name:'my-builder-release-logs',
	template:`<tr class="grouping">
		<td colspan="3">
			<div class="row gap-large">
				<my-label v-if="showAll" :caption="title" />
				<my-button
					v-if="!showAll"
					@trigger="show = !show"
					:caption="title"
					:image="show ? 'triangleDown.png' : 'triangleRight.png'"
					:naked="true"
				/>
				<my-button
					v-if="(show || showAll) && !isZero"
					@trigger="lock = !lock"
					:active="!readonly"
					:caption="capGen.button.unlock"
					:image="lock ? 'checkbox0.png' : 'checkbox1.png'"
				/>
				<my-button image="delete.png"
					v-if="(show || showAll) && !isZero"
					@trigger="$emit('delete',build)"
					:active="isEdit"
					:cancel="true"
					:caption="capGen.button.delete"
				/>
			</div>
		</td>
	</tr>
	<template v-for="(c,i) in categories">
		<tr v-if="(show || showAll) && (isEdit || logsByCategoryIndex[i].length !== 0)">
			<td class="minimum"> </td>
			<td class="minimum topAligned">
				<my-button image="add.png" @trigger="add(i)" v-if="isEdit" :caption="c" :naked="true" />
				<my-label  image="dash.png" v-if="!isEdit" :caption="c" />
			</td>
			<td class="topAligned">
				<draggable handle=".dragAnchor" itemKey="id" animation="100" class="builder-release-logs"
					v-model="logsByCategoryIndex[i]"
					@change="update"
					:fallbackOnBody="true"
					:group="String(build) + '_' + String(i)"
				>
					<template #item="{element,index}">
						<div class="builder-release-log">
							<img v-if="isEdit" class="dragAnchor" src="images/drag.png" />
							<textarea class="long startAsOneLine" v-if="isEdit" v-model="element.content" @input="updateAfterWait"></textarea>
							<my-label image="dot.png" v-if="!isEdit" :caption="element.content" />
							<my-button image="cancel.png" @trigger="del(i,index)" v-if="isEdit" :naked="true" />
						</div>
					</template>
				</draggable>
			</td>
		</tr>
	</template>`,
	emits:['delete','update:modelValue'],
	props:{
		build:     { type:Number,  required:true },
		buildApp:  { type:Number,  required:true },
		categories:{ type:Array,   required:true },
		date:      { type:Number,  required:true },
		modelValue:{ type:Array,   required:true },
		moduleName:{ type:String,  required:true },
		readonly:  { type:Boolean, required:true },
		showAll:   { type:Boolean, required:true }
	},
	watch:{
		modelValue:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	data() {
		return {
			lock:this.build !== 0,
			show:this.build === 0,
			logsByCategoryIndex:[],
			timerUpdateDelay:null
		};
	},
	computed:{
		isEdit:s => !s.readonly && !s.lock,
		isZero:s => s.build === 0,
		title: s => s.isZero ? s.capGen.versionAppNew : `${s.moduleName} - v${s.build} (${s.capGen.appName} ${s.buildApp}) - ${s.getUnixFormat(s.date,s.settings.dateFormat)}`,

		// stores
		capGen:  s => s.$store.getters.captions.generic,
		settings:s => s.$store.getters.settings
	},
	methods:{
		// externals
		getTemplateReleaseLog,
		getUnixFormat,

		// actions
		add(categoryIndex) {
			this.logsByCategoryIndex[categoryIndex].push(this.getTemplateReleaseLog(categoryIndex));
		},
		del(categoryIndex,entryIndex) {
			this.logsByCategoryIndex[categoryIndex].splice(entryIndex,1);
			this.update();
		},
		reset() {
			let out = [];
			for(const c of this.categories) {
				out.push([]);
			}
			for(const l of this.modelValue) {
				if(out[l.category] !== undefined)
					out[l.category].push(l);
			}
			this.logsByCategoryIndex = out;
		},
		update() {
			let out = [];
			for(const c of this.logsByCategoryIndex) {
				for(const l of c) {
					out.push(l);
				}
			}
			this.$emit('update:modelValue',out);
		},
		updateAfterWait() {
			if(this.timerUpdateDelay !== null)
				clearTimeout(this.timerUpdateDelay);

			this.timerUpdateDelay = setTimeout(this.update,300);
		}
	}
};

export default {
	name:'my-builder-releases',
	components:{ MyBuilderReleaseLogs },
	template:`<div class="builder-releases contentBox grow">
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/versionHistory.png" />
				<h1 class="title">{{ capGen.versionHistory }}</h1>
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
			<div class="area nowrap">
				<my-button
					@trigger="showAll = !showAll"
					:caption="capGen.button.showAll"
					:image="showAll ? 'checkbox1.png' : 'checkbox0.png'"
				/>
				<my-button image="open.png"
					@trigger="openModule"
					:active="!isChanged"
					:caption="capApp.button.goToCategories"
				/>
			</div>
			<div class="area nowrap"></div>
		</div>
		
		<div class="content no-padding default-inputs" v-if="module">
			<table class="builder-releases-table">
				<tbody>
					<my-builder-release-logs :key="0"
						v-model="releases[0].logs"
						:build="releases[0].build"
						:buildApp="releases[0].buildApp"
						:categories
						:date="releases[0].dateCreated"
						:moduleName="module.name"
						:readonly
						:showAll
					/>
					<my-builder-release-logs
						@delete="del"
						v-for="r in releases.slice().filter((v,i) => i !== 0).reverse()"
						v-model="r.logs"
						:build="r.build"
						:buildApp="r.buildApp"
						:categories
						:date="r.dateCreated"
						:key="r.build"
						:moduleName="module.name"
						:readonly
						:showAll
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
			releases:false,
			releasesCopy:false, // copy of releases from schema when component last reset
			showAll:false
		};
	},
	watch:{
		releasesSchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	computed:{
		// simple
		categories:    s => s.module === false ? [] : s.module.releaseLogCategories,
		isChanged:     s => !s.deepIsEqual(s.releases,s.releasesSchema),
		module:        s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		releasesSchema:s => s.module === false ? [] : s.module.releases,
		
		// stores
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capApp:     s => s.$store.getters.captions.builder.releases,
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
		del(build) {
			this.releases = this.releases.filter(v => v.build !== build);
		},
		openModule() {
			this.$router.push('/builder/module/'+this.id);
		},
		reset(manuelReset) {
			if(manuelReset || !this.deepIsEqual(this.releasesCopy,this.releasesSchema)) {
				this.releases     = JSON.parse(JSON.stringify(this.releasesSchema));
				this.releasesCopy = JSON.parse(JSON.stringify(this.releasesSchema));
			}
		},

		// backend calls
		set() {
			if(!this.isChanged)
				return;

			ws.send('module','set',{ ...this.module, ...{releases:this.releases} },true).then(
				() => { this.$root.schemaReload(this.id); },
				this.$root.genericError
			);
		}
	}
};