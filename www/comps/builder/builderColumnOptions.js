import MyBuilderCaption from './builderCaption.js';
import MyBuilderQuery   from './builderQuery.js';
import {
	getIndexAttributeIdsByJoins,
	isAttributeFiles,
	isAttributeString
} from '../shared/attribute.js';
import {
	getCaptionByIndexAttributeId
} from '../shared/query.js';
export {MyBuilderColumnOptions as default};

let MyBuilderColumnOptions = {
	name:'my-builder-column-options',
	components:{
		MyBuilderCaption,
		MyBuilderQuery
	},
	template:`<div class="builder-column-options">
		<table class="generic-table-vertical tight fullWidth default-inputs">
			<tr v-if="hasCaptions">
				<td>{{ capGen.title }}</td>
				<td>
					<my-builder-caption
						@update:modelValue="set('captions',{columnTitle:$event})"
						:language="builderLanguage"
						:modelValue="column.captions.columnTitle"
					/>
				</td>
			</tr>
			<template v-if="!onlyData">
				<tr>
					<td>{{ capApp.onMobile }}</td>
					<td>
						<my-bool
							@update:modelValue="set('onMobile',$event)"
							:modelValue="column.onMobile"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnLength }}</td>
					<td>
						<input
							v-if="column.length !== 0"
							@change="setInt('length',$event.target.value,false)"
							:value="column.length"
						/>
						<my-button
							v-else
							@trigger="setInt('length',50,false)"
							:caption="capApp.columnLength0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnStyles }}</td>
					<td>
						<div class="row gap">
							<my-bool
								@update:modelValue="setStyle('bold',$event)"
								:caption0="capApp.option.style.bold"
								:caption1="capApp.option.style.bold"
								:modelValue="column.styles.includes('bold')"
							/>
							<my-bool
								@update:modelValue="setStyle('italic',$event)"
								:caption0="capApp.option.style.italic"
								:caption1="capApp.option.style.italic"
								:modelValue="column.styles.includes('italic')"
							/>
						</div>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnSize }}</td>
					<td>
						<input
							v-if="column.basis !== 0"
							@change="setInt('basis',$event.target.value,false)"
							:value="column.basis"
						/>
						<my-button
							v-else
							@trigger="setInt('basis',25,false)"
							:caption="capApp.columnSize0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnWrap }}</td>
					<td>
						<my-bool
							@update:modelValue="set('wrap',$event)"
							:modelValue="column.wrap"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnClipboard }}</td>
					<td>
						<my-bool
							@update:modelValue="set('clipboard',$event)"
							:modelValue="column.clipboard"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('display',$event.target.value)"
							:value="column.display"
						>
							<option value="default">{{ capApp.option.display.default }}</option>
							<option v-if="isString" value="email"   >{{ capApp.option.display.email }}</option>
							<option v-if="isString" value="password">{{ capApp.option.display.password }}</option>
							<option v-if="isString" value="phone"   >{{ capApp.option.display.phone }}</option>
							<option v-if="isString" value="url"     >{{ capApp.option.display.url }}</option>
							<option v-if="isFiles"  value="gallery" >{{ capApp.option.display.gallery }}</option>
							<option value="hidden">{{ capApp.option.display.hidden }}</option>
						</select>
					</td>
				</tr>
			</template>
			<tr>
				<td colspan="999"><b>{{ capApp.columnHeaderData }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.distincted }}</td>
				<td>
					<my-bool
						@update:modelValue="set('distincted',$event)"
						:modelValue="column.distincted"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.groupBy }}</td>
				<td>
					<my-bool
						@update:modelValue="set('groupBy',$event)"
						:modelValue="column.groupBy"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.aggregator }}</td>
				<td>
					<select
						@input="set('aggregator',$event.target.value)"
						:value="column.aggregator"
					>
						<option value="">-</option>
						<option value="record">{{ capGen.option.aggRecord }}</option>
						<option value="avg">{{ capGen.option.aggAvg }}</option>
						<option value="count">{{ capGen.option.aggCount }}</option>
						<option value="list">{{ capGen.option.aggList }}</option>
						<option value="max">{{ capGen.option.aggMax }}</option>
						<option value="min">{{ capGen.option.aggMin }}</option>
						<option value="sum">{{ capGen.option.aggSum }}</option>
						<option value="array">{{ capGen.option.aggArray }}</option>
					</select>
				</td>
			</tr>
			<tr v-if="isSubQuery">
				<td>{{ capApp.subQueryAttribute }}</td>
				<td>
					<select
						@change="setIndexAttribute($event.target.value)"
						:value="column.index+'_'+column.attributeId"
					>
						<option value="0_null">-</option>
						<option v-for="ia in indexAttributeIds" :value="ia">
							{{ getCaptionByIndexAttributeId(ia) }}
						</option>
					</select>
				</td>
			</tr>
		</table>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		column:         { type:Object,  required:true },
		hasCaptions:    { type:Boolean, required:true },
		moduleId:       { type:String,  required:true },
		onlyData:       { type:Boolean, required:true }  // no display/formatting options
	},
	emits:['set'],
	computed:{
		attribute:(s) => typeof s.attributeIdMap[s.column.attributeId] === 'undefined'
			? false : s.attributeIdMap[s.column.attributeId],
		indexAttributeIds:(s) => !s.isSubQuery
			? [] : s.getIndexAttributeIdsByJoins(s.column.query.joins),
		
		// simple
		isFiles:   (s) => s.isAttributeFiles(s.attribute.content),
		isString:  (s) => s.isAttributeString(s.attribute.content),
		isSubQuery:(s) => s.column.subQuery,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		isAttributeFiles,
		isAttributeString,
		
		// actions
		set(name,val) {
			if(val === '') val = null;
			this.$emit('set',name,val);
		},
		setInt(name,val,allowNull) {
			if(val !== '')
				return this.$emit('set',name,parseInt(val));
			
			if(allowNull) return this.$emit('set',name,null);
			else          return this.$emit('set',name,0);
		},
		setIndexAttribute(indexAttributeId) {
			let v = indexAttributeId.split('_');
			
			if(v[1] === 'null') {
				this.set('index',0);
				this.set('attributeId',null);
				return;
			}
			this.set('index',parseInt(v[0]));
			this.set('attributeId',v[1]);
		},
		setStyle(name,val) {
			let styles = JSON.parse(JSON.stringify(this.column.styles));
			let pos    = styles.indexOf(name);
			
			if(pos === -1 && val)  styles.push(name);
			if(pos !== -1 && !val) styles.splice(pos,1);
			
			this.set('styles',styles);
		}
	}
};