import MyBuilderCaption    from './builderCaption.js';
import MyBuilderDocColumns from './builderDocColumns.js';
import MyBuilderDocSets    from './builderDocSets.js';
import MyBuilderQuery      from './builderQuery.js';
import MyInputColorWrap    from '../inputColorWrap.js';
import MyInputDecimal      from '../inputDecimal.js';
import MyInputRange        from '../inputRange.js';
import {getUuidV4}         from '../shared/crypto.js';
import {copyValueDialog}   from '../shared/generic.js';
import {
	isAttributeFiles,
	isAttributeRelationship
} from '../shared/attribute.js';
import {
	MyBuilderDocBorder,
	MyBuilderDocMarginPadding
} from './builderDocInput.js';
import {
	getDocColumnIcon,
	getDocColumnTitle,
	getDocFieldIcon,
	getDocFieldTitle
} from '../shared/builderDoc.js';
import {
	getTemplateDocColumn,
	getTemplateDocField,
	getTemplateQuery
} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-doc-field',
	components:{
		MyBuilderCaption,
		MyBuilderDocBorder,
		MyBuilderDocColumns,
		MyBuilderDocMarginPadding,
		MyBuilderDocSets,
		MyBuilderQuery,
		MyInputColorWrap,
		MyInputDecimal,
		MyInputRange
	},
	inject:['dragData','dragFieldIdSet'],
	template:`<div class="builder-doc-field" ref="field"
		@click.stop
		@dragenter="dragEnter"
		@dragleave="dragLeave"
		@dragend.stop="dragEnd"
		@dragstart.stop="dragStart"
		@dragover="dragOver"
		@drop="drop"
		@mousedown.stop="mousedown"
		@mouseup.stop="mouseup"
		:class="classMain"
		:draggable="!isRoot && !readonly"
		:style
		:title
		:key="field.id"
	>
		<template v-if="isFlow">
			<div class="builder-doc-padding-margin-hor" v-if="field.padding.t > 0" :style="stylePaddingT"></div>
			<div class="builder-doc-padding-margin-ver" v-if="field.padding.r > 0" :style="stylePaddingR"></div>
			<div class="builder-doc-padding-margin-hor" v-if="field.padding.b > 0" :style="stylePaddingB"></div>
			<div class="builder-doc-padding-margin-ver" v-if="field.padding.l > 0" :style="stylePaddingL"></div>
		</template>
		
		<div class="builder-doc-field-title-bar" v-if="!isWithFields && !isDragPreview">
			<img :src="'images/' + getDocFieldIcon(field)" @click="tabTargetField = 'properties'" />
			<span>F{{ entityIdMapRef.field[field.id] }}</span>
			<img v-if="isWithQuery"  @click="tabTargetField = 'content'" src="images/database.png" />
			<img v-if="!field.state" @click.stop="field.state = true"    src="images/visible0.png" />
			<span>{{ title }}</span>
		</div>
		<div class="builder-doc-bg-text" v-if="isWithFields">F{{ entityIdMapRef.field[field.id] }}</div>

		<my-builder-doc-columns
			v-if="isWithQuery && isOptionsShow"
			v-model="field.columns"
			@setColumnIdOptions="columnIdOptions = $event"
			:builderLanguage
			:columnIdOptions
			:dragType="dragTypeColumn"
			:elmOptions="$refs.columnOptions"
			:joins
			:joinsParent="query.joins"
			:moduleId
			:parentSizeX="sizeX"
			:readonly
			:sizeXMax
			:zoom
		/>

		<div class="builder-doc-fields" ref="fields"
			v-if="isWithFields"
			:class="classFields"
			:style="styleChildren"
		>
			<my-builder-doc-field
				v-for="(f,i) in field.fields"
				v-model="f"
				@dragChildEnd="dragChildEnd(f.id)"
				@dragChildEnter="dragChildEnter(i)"
				@remove="remove(f.id)"
				@setFieldIdOptions="$emit('setFieldIdOptions',$event)"
				@setFieldIdOptionsParent="$emit('setFieldIdOptions',field.id)"
				:builderLanguage
				:elmOptions
				:entityIdMapRef
				:fieldIdOptions
				:parentSizeX="sizeX"
				:parentSizeY="sizeY"
				:gridParentSnap="isGrid ? field.sizeSnap : 0"
				:isChildFlow="isFlow"
				:isChildGrid="isGrid"
				:joins
				:key="f.id"
				:moduleId
				:readonly
				:zoom
			/>
		</div>

		<!-- options -->
		<teleport v-if="isOptionsShow" :to="elmOptions">
			<div class="top lower" :class="{ clickable:columnIdOptions !== null }" @click="columnIdOptions = null">
				<div class="area">
					<img class="icon" src="images/dash.png" />
					<img class="icon" :src="'images/' + getDocFieldIcon(field)" />
					<h2>{{ titleBar }}</h2>
				</div>
				<div class="area">
					<my-button image="visible1.png" @trigger="copyValueDialog(field.content,field.id,field.id)" :caption="capGen.id" />
					<my-button image="upward.png"   @trigger="$emit('setFieldIdOptionsParent')" :active="isChild" :caption="capApp.button.selectParent" />
					<my-button image="delete.png"   @trigger="$emit('remove')" :active="!isRoot && !readonly" />
					<my-button image="cancel.png"
						@trigger="$emit('setFieldIdOptions',null)"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
			
			<!-- column properties -->
			<div ref="columnOptions" v-show="columnIdOptions !== null"></div>

			<!-- field properties -->
			<template v-if="columnIdOptions === null">
				<my-tabs
					v-if="isTabsNeeded"
					v-model="tabTargetField"
					:entries="['properties','content']"
					:entriesIcon="['images/edit.png','images/database.png']"
					:entriesText="[capGen.properties,capGen.content]"
				/>

				<!-- content -->
				<div class="content grow" v-if="tabTargetField === 'content'">
					<my-builder-query
						@index-removed="removeIndex($event)"
						@update:modelValue="field.query = $event"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage
						:filtersDisable
						:modelValue="query"
						:moduleId
						:readonly
					/>
					<div class="builder-doc-templates">
						<div class="builder-doc-template" draggable="true"
							@dragstart="dragStartColumnTemplate($event,c)"
							v-for="c in columnsTemplate"
							:key="c.id"
						>
							<div class="builder-doc-button">
								<img :src="'images/' + getDocColumnIcon(c)" />
							</div>
							<span>{{ getDocColumnTitle(c) }}</span>
						</div>
					</div>
				</div>

				<!-- properties -->
				<template v-if="!isTabsNeeded || tabTargetField === 'properties'">
					<table class="generic-table-vertical default-inputs">
						<tbody>
							<tr>
								<td>{{ capGen.showDefault1 }}</td>
								<td><my-bool v-model="field.state" :readonly /></td>
							</tr>
							
							<template v-if="!isRoot">
								<tr v-if="isResizeInGrid">
									<td>{{ capGen.sizeX }}</td>
									<td>
										<div class="row gap centered">
											<my-input-range   class="short" v-model="field.sizeX" :readonly :min="gridParentSnap" :max="sizeXMax" :step="gridParentSnap" />
											<my-input-decimal class="short" v-model="field.sizeX" :readonly :min="gridParentSnap" :max="sizeXMax" :allowNull="false" :length="5" :lengthFract="2" />
											<span>mm</span>
										</div>
									</td>
								</tr>
								<tr v-if="isResizeInFlow || isResizeInGrid">
									<td>{{ capGen.sizeY }}</td>
									<td>
										<div class="row gap centered">
											<my-input-range   class="short" v-model="field.sizeY" :readonly :min="gridParentSnap" :max="sizeYMax" :step="gridParentSnap" v-if="isResizeInGrid" />
											<my-input-decimal class="short" v-model="field.sizeY" :readonly :min="gridParentSnap" :max="sizeYMax" :allowNull="false" :length="5" :lengthFract="2" />
											<span>mm</span>
										</div>
									</td>
								</tr>
							</template>

							<template v-if="isGrid">
								<tr>
									<td>{{ capApp.grid.sizeSnap }}</td>
									<td>
										<div class="row gap centered">
											<my-input-range   class="short" v-model="field.sizeSnap" :readonly :min="0.5" :max="10" :step="0.1" />
											<my-input-decimal class="short" v-model="field.sizeSnap" :readonly :min="0.5" :max="10" :allowNull="false" :length="4" :lengthFract="2" />
											<span>mm</span>
										</div>
									</td>
								</tr>
							</template>

							<template v-if="isFlow">
								<tr v-if="!isRoot">
									<td>{{ capGen.direction }}</td>
									<td>
										<div class="column gap">
											<div class="row gap">
												<select v-model="field.direction">
													<option value="row">{{ capGen.row }}</option>
													<option value="column">{{ capGen.column }}</option>
												</select>
												<my-button
													@trigger="field.direction = field.direction === 'row' ? 'column' : 'row'"
													:captionTitle="capGen.direction+': '+field.direction"
													:image="field.direction === 'row' ? 'flexRow.png' : 'flexColumn.png'"
												/>
											</div>
											<my-label image="flexRow.png" v-if="field.direction === 'row'" :caption="capApp.warning.flowRow" />
										</div>
									</td>
								</tr>
								<tr>
									<td>{{ capGen.gap }}</td>
									<td>
										<div class="row gap centered">
											<my-input-range   class="short" v-model="field.gap" :readonly :min="0" :max="20" :step="0.1" />
											<my-input-decimal class="short" v-model="field.gap" :readonly :min="0" :allowNull="false" :length="5" :lengthFract="2" />
											<span>mm</span>
										</div>
									</td>
								</tr>
							</template>

							<template v-if="isData">
								<tr>
									<td>{{ capGen.lengthChars }}</td>
									<td>
										<my-input-decimal class="short" v-if="field.length !== 0" v-model="field.length" :min="3" :readonly :allowNull="false" :lengthFract="0" />
										<my-button v-else @trigger="field.length = 50" :caption="capGen.noLimit" :naked="true" />
									</td>
								</tr>
								<tr>
									<td>{{ capGen.prefix }}</td>
									<td><input v-model="field.textPrefix" :disabled="readonly" /></td>
								</tr>
								<tr>
									<td>{{ capGen.postfix }}</td>
									<td><input v-model="field.textPostfix" :disabled="readonly" /></td>
								</tr>
							</template>

							<template v-if="isText">
								<tr>
									<td colspan="2">
										<my-builder-caption
											v-model="field.captions.docFieldText"
											:contentName="capGen.text"
											:language="builderLanguage"
											:longInput="true"
											:multiLine="true"
											:readonly
										/>
									</td>
								</tr>
								<tr><td><b>{{ capGen.placeholders }}</b></td></tr>
								<tr><td>{PAGE_CUR}</td><td>{{ capApp.placeholders['{PAGE_CUR}'] }}</td></tr>
								<tr><td>{PAGE_END}</td><td>{{ capApp.placeholders['{PAGE_END}'] }}</td></tr>
								<tr><td>{DATE_TODAY}</td><td>{{ capApp.placeholders['{DATE_TODAY}'] }}</td></tr>
								<tr><td>{DATETIME_NOW}</td><td>{{ capApp.placeholders['{DATETIME_NOW}'] }}</td></tr>
								<tr><td>{TIME_NOW}</td><td>{{ capApp.placeholders['{TIME_NOW}'] }}</td></tr>
							</template>

							<template v-if="!isRoot && (isFlow || isGrid)">
								<tr>
									<td>{{ capApp.shrinkY }}</td>
									<td><my-bool v-model="field.shrinkY" :readonly /></td>
								</tr>
							</template>

							<my-builder-doc-margin-padding
								v-if="isList || isFlow"
								v-model:t="field.padding.t"
								v-model:r="field.padding.r"
								v-model:b="field.padding.b"
								v-model:l="field.padding.l"
								@update:all="field.padding = $event"
								:defaults="{t:3,r:3,b:3,l:3}"
								:label="capGen.spacingCell"
								:readonly
							/>
							<my-builder-doc-border
								v-if="isWithBorder"
								v-model:cell="field.border.cell"
								v-model:color="field.border.color"
								v-model:draw="field.border.draw"
								v-model:size="field.border.size"
								v-model:styleCap="field.border.styleCap"
								v-model:styleJoin="field.border.styleJoin"
								:allowCell="false"
								:readonly
							/>
						</tbody>
					</table>

					<!-- list properties -->
					<div class="content grow" v-if="isList">
						<h2>{{ capGen.rows }}</h2>
						<div class="builder-doc-sub-settings">
							<my-tabs
								v-model="tabTargetListArea"
								:entries="tabTargetListAreas.entries"
								:entriesText="tabTargetListAreas.labels"
							/>
							<template v-if="tabTargetListArea === 'body'">
								<table class="generic-table-vertical default-inputs">
									<tbody>
										<tr>
											<td>{{ capApp.rowMinHeight }}</td>
											<td>
												<div class="row gap centered">
													<my-input-decimal class="short" v-model="field.bodyRowSizeY" :readonly :min="0" :allowNull="false" :length="5" :lengthFract="2" />
													<span>mm</span>
												</div>
											</td>
										</tr>
										<tr>
											<td>{{ capGen.colorFillRowsOdd }}</td>
											<td><my-input-color-wrap v-model="field.bodyRowColorFillOdd" :allowNull="true" :readonly /></td>
										</tr>
										<tr>
											<td>{{ capGen.colorFillRowsEven }}</td>
											<td><my-input-color-wrap v-model="field.bodyRowColorFillEven" :allowNull="true" :readonly /></td>
										</tr>
										<my-builder-doc-border
											v-model:cell="field.bodyBorder.cell"
											v-model:color="field.bodyBorder.color"
											v-model:draw="field.bodyBorder.draw"
											v-model:size="field.bodyBorder.size"
											v-model:styleCap="field.bodyBorder.styleCap"
											v-model:styleJoin="field.bodyBorder.styleJoin"
											:allowCell="true"
											:readonly
										/>
									</tbody>
								</table>
								<my-builder-doc-sets
									v-model="field.sets"
									:allowData="true"
									:joins
									:readonly
									:showListBody="true"
								/>
							</template>
							<template v-if="tabTargetListArea === 'header'">
								<table class="generic-table-vertical default-inputs">
									<tbody>
										<tr>
											<td colspan="2"><my-button-check v-model="field.headerRowShow" :caption="capApp.headerRowShow" :readonly /></td>
										</tr>
										<template v-if="field.headerRowShow">
											<tr>
												<td colspan="2"><my-button-check v-model="field.headerRowRepeat" :caption="capApp.headerRowRepeat" :readonly /></td>
											</tr>
											<tr>
												<td>{{ capGen.colorFill }}</td>
												<td><my-input-color-wrap v-model="field.headerRowColorFill" :allowNull="true" :readonly /></td>
											</tr>
											<my-builder-doc-border
												v-model:cell="field.headerBorder.cell"
												v-model:color="field.headerBorder.color"
												v-model:draw="field.headerBorder.draw"
												v-model:size="field.headerBorder.size"
												v-model:styleCap="field.headerBorder.styleCap"
												v-model:styleJoin="field.headerBorder.styleJoin"
												:allowCell="true"
												:readonly
											/>
										</template>
									</tbody>
								</table>
								<my-builder-doc-sets
									v-if="field.headerRowShow"
									v-model="field.sets"
									:allowData="true"
									:joins
									:readonly
									:showListHeader="true"
								/>
							</template>
							<template v-if="tabTargetListArea === 'footer'">
								<table class="generic-table-vertical default-inputs">
									<tbody>
										<tr>
											<td>{{ capGen.colorFill }}</td>
											<td><my-input-color-wrap v-model="field.footerRowColorFill" :allowNull="true" :readonly /></td>
										</tr>
										<my-builder-doc-border
											v-model:cell="field.footerBorder.cell"
											v-model:color="field.footerBorder.color"
											v-model:draw="field.footerBorder.draw"
											v-model:size="field.footerBorder.size"
											v-model:styleCap="field.footerBorder.styleCap"
											v-model:styleJoin="field.footerBorder.styleJoin"
											:allowCell="true"
											:readonly
										/>
									</tbody>
								</table>
								<my-builder-doc-sets
									v-model="field.sets"
									:allowData="true"
									:joins
									:readonly
									:showListFooter="true"
								/>
							</template>
						</div>
					</div>

					<!-- overwrites -->
					<my-builder-doc-sets
						v-if="isData"
						v-model="field.sets"
						:allowData="true"
						:joins
						:readonly
						:showText="true"
					/>
					<my-builder-doc-sets
						v-model="field.sets"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:showFont="true"
					/>
				</template>
			</template>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,        required:true },
		elmOptions:     { required:true },
		entityIdMapRef: { type:Object,        required:true },
		fieldIdOptions: { type:[String,null], required:true },
		gridParentSnap: { type:Number,        required:false, default:0 },
		joins:          { type:Array,         required:true },
		modelValue:     { type:Object,        required:true },
		moduleId:       { type:String,        required:true },
		parentSizeX:    { type:Number,        required:true },
		parentSizeY:    { type:Number,        required:true },
		isChildGrid:    { type:Boolean,       required:false, default:false },
		isChildFlow:    { type:Boolean,       required:false, default:false },
		isRoot:         { type:Boolean,       required:false, default:false },
		readonly:       { type:Boolean,       required:true },
		zoom:           { type:Number,        required:true }
	},
	data() {
		return {
			beingDragged:false,
			borderSizeEmpty:0.2, // default border size, if 0 is given but border is drawn
			columnIdOptions:null,
			dragType:'doc-field',
			draggedInSameParent:false,
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged','formState',
				'getter','globalSearch','javascript','languageCode','login','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','role','variable'
			],
			gridFieldSizeMinX:0,
			gridFieldSizeMinY:5,
			tabTargetField:'properties',
			tabTargetListArea:'body',
			pixelToMm:25.4 / 96,
			sizeXOnMousedown:0,  // to check whether element was resized
			sizeYOnMousedown:0   // to check whether element was resized
		};
	},
	watch:{
		dragFieldId(v) {
			if(v !== this.field.id)
				this.dragPreviewRemove();
		}
	},
	emits:['dragChildEnd','dragChildEnter','remove','setFieldIdOptions','setFieldIdOptionsParent','update:modelValue'],
	computed:{
		classFields:s => {
			return {
				layoutFlowColumn:s.isFlow && s.field.direction === 'column',
				layoutFlowRow:s.isFlow && s.field.direction === 'row',
				layoutGrid:s.isGrid
			};
		},
		classMain:s => {
			return {
				clickable:true,
				dragPreview:s.isDragPreview,
				dragSource:s.beingDragged,
				isList:s.isList,
				resizableBoth:s.isResizeInGrid,
				resizableHeight:s.isResizeInFlow,
				selected:s.isOptionsShow && s.columnIdOptions === null
			};
		},
		columnsTemplate:s => {
			if(!s.isWithQuery)
				return [];

			let out = [];
			for(const j of s.query.joins) {
				const r = s.relationIdMap[j.relationId];
				for(const a of r.attributes) {
					if(s.isAttributeRelationship(a.content))
						continue;

					out.push(s.getTemplateDocColumn(a.id,j.index,false));
				}
			}
			out.push(s.getTemplateDocColumn(null,0,true));
			return out;
		},
		tabTargetListAreas:s => {
			return {
				entries:['body','header','footer'],
				labels:[s.capGen.content,s.capGen.header,s.capGen.footer]
			}
		},
		styleBorder:s => {
			if(!s.isWithBorder || s.field.border.draw === '')
				return '';

			const color = s.field.border.color === null ? '000000' : s.field.border.color;
			let out = `border:${s.borderSize*s.zoom}mm solid #${color};`;

			if(s.bordersAll)
				return out;

			if(s.borderSizeT === 0) out += 'border-top:none;';
			if(s.borderSizeR === 0) out += 'border-right:none;';
			if(s.borderSizeB === 0) out += 'border-bottom:none;';
			if(s.borderSizeL === 0) out += 'border-left:none;';
			return out;
		},
		styleChildren:s => s.isGrid
			? `background-size:${s.field.sizeSnap*s.zoom}mm ${s.field.sizeSnap*s.zoom}mm;`
			: `gap:${s.field.gap*s.zoom}mm;
				padding:${s.field.padding.t*s.zoom}mm ${s.field.padding.r*s.zoom}mm ${s.field.padding.b*s.zoom}mm ${s.field.padding.l*s.zoom}mm;`,

		// inputs
		field:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// styling
		bordersAll:   s => s.isWithBorder && s.field.border.draw === '1',
		borderSize:   s => s.isWithBorder && s.field.border.draw !== '' ? (s.field.border.size !== 0 ? s.field.border.size : s.borderSizeEmpty) : 0,
		borderSizeT:  s => s.isWithBorder && (s.bordersAll || s.field.border.draw.includes('T')) ? s.borderSize : 0,
		borderSizeR:  s => s.isWithBorder && (s.bordersAll || s.field.border.draw.includes('R')) ? s.borderSize : 0,
		borderSizeB:  s => s.isWithBorder && (s.bordersAll || s.field.border.draw.includes('B')) ? s.borderSize : 0,
		borderSizeL:  s => s.isWithBorder && (s.bordersAll || s.field.border.draw.includes('L')) ? s.borderSize : 0,
		borderX:      s => s.borderSizeL+s.borderSizeR,
		borderY:      s => s.borderSizeT+s.borderSizeB,
		padding:      s => s.isFlow ? s.field.padding : { t:0, r:0, b:0, l:0 },
		paddingX:     s => s.padding.l+s.padding.r,
		paddingY:     s => s.padding.t+s.padding.b,
		sizeX:        s => s.field.sizeX !== 0 ? s.field.sizeX-s.borderX-s.paddingX : s.parentSizeX-s.borderX-s.paddingX,
		sizeY:        s => s.field.sizeY !== 0 ? s.field.sizeY-s.borderY-s.paddingY : s.parentSizeY-s.borderY-s.paddingY,
		sizeXMax:     s => !s.isChildFlow ? s.parentSizeX - s.field.posX : 9999,
		sizeYMax:     s => !s.isChildFlow ? s.parentSizeY - s.field.posY : 9999,
		style:        s => `${s.styleHeight}${s.styleGrid}${s.styleBorder}`,
		styleGrid:    s => s.isChildGrid ? `position:absolute;top:${s.field.posY*s.zoom}mm;left:${s.field.posX*s.zoom}mm;width:${s.field.sizeX*s.zoom}mm;` : '',
		styleHeight:  s => s.isRoot ? 'flex:1 1 auto;' : `height:${s.field.sizeY*s.zoom}mm;`,
		stylePaddingT:s => `top:0mm;left:0mm;height:${s.field.padding.t*s.zoom}mm`,
		stylePaddingR:s => `top:0mm;right:0mm;width:${s.field.padding.r*s.zoom}mm`,
		stylePaddingB:s => `bottom:0mm;left:0mm;height:${s.field.padding.b*s.zoom}mm`,
		stylePaddingL:s => `top:0mm;left:0mm;width:${s.field.padding.l*s.zoom}mm`,

		// simple
		attribute:     s => s.isData ? s.attributeIdMap[s.field.attributeId] : null,
		dragFieldId:   s => s.dragData.fieldId,
		dragTypeColumn:s => `doc-column_${s.field.id}`,
		isChild:       s => s.isChildFlow || s.isChildGrid,
		isData:        s => s.field.content === 'data',
		isDataFiles:   s => s.isData && s.isAttributeFiles(s.attribute.content),
		isDragPreview: s => s.field.content === s.dragContent,
		isFlow:        s => ['flow','flowBody'].includes(s.field.content),
		isGrid:        s => ['grid','gridFooter','gridHeader'].includes(s.field.content),
		isList:        s => s.field.content === 'list',
		isText:        s => s.field.content === 'text',
		isOptionsShow: s => s.fieldIdOptions === s.field.id,
		isResizeInFlow:s => !s.isRoot && s.isChildFlow && (s.isFlow || s.isGrid || s.isDataFiles),
		isResizeInGrid:s => !s.isRoot && s.isChildGrid,
		isTabsNeeded:  s => s.isList,
		isWithBorder:  s => s.isFlow || s.isGrid,
		isWithFields:  s => s.isFlow || s.isGrid,
		isWithQuery:   s => s.isList,
		query:         s => s.field.query !== null ? s.field.query : s.getTemplateQuery(),
		title:         s => s.getDocFieldTitle(s.field),
		titleBar:      s => `${s.capGen.field}: ${s.title}`,

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		capApp:        s => s.$store.getters.captions.builder.doc,
		capGen:        s => s.$store.getters.captions.generic,
		dragContent:   s => s.$store.getters.constants.dragFieldContent
	},
	methods:{
		// externals
		copyValueDialog,
		getDocColumnIcon,
		getDocColumnTitle,
		getDocFieldIcon,
		getDocFieldTitle,
		getTemplateDocColumn,
		getTemplateDocField,
		getTemplateQuery,
		getUuidV4,
		isAttributeFiles,
		isAttributeRelationship,

		// presentation
		getSizeAfterSnap(isChildGrid,posChild,sizeChild,sizeParent,sizeMin,sizeSnap) {
			// limit size to parent size
			if(isChildGrid && posChild + sizeChild > sizeParent)
				sizeChild = sizeParent - posChild;

			// force minimum sizes
			if(sizeChild < sizeMin)
				sizeChild = sizeMin;

			// snap size to grid
			if(isChildGrid)
				sizeChild = Math.max(sizeSnap, Math.round(sizeChild / sizeSnap) * sizeSnap);

			return sizeChild;
		},

		// actions
		mousedown(e) {
			const rect = this.$refs.field.getBoundingClientRect();
			this.sizeXOnMousedown = rect.width  * this.pixelToMm / this.zoom;
			this.sizeYOnMousedown = rect.height * this.pixelToMm / this.zoom;
		},
		mouseup(e) {
			const rect  = this.$refs.field.getBoundingClientRect();
			const sizeX = rect.width  * this.pixelToMm / this.zoom;
			const sizeY = rect.height * this.pixelToMm / this.zoom;

			// size not changed, assume direct click to access field options
			if(this.sizeXOnMousedown === sizeX && this.sizeYOnMousedown === sizeY) {
				this.columnIdOptions = null;
				return this.$emit('setFieldIdOptions',this.field.id);
			}
			
			if(this.isChildGrid) {
				const sizeXClean = this.getSizeAfterSnap(this.isChildGrid,this.field.posX,sizeX,this.parentSizeX,this.gridFieldSizeMinX,this.gridParentSnap);
				const sizeYClean = this.getSizeAfterSnap(this.isChildGrid,this.field.posY,sizeY,this.parentSizeY,this.gridFieldSizeMinY,this.gridParentSnap);
				if(sizeXClean !== sizeX || sizeYClean !== sizeY) {
					this.field.sizeX = sizeXClean;
					this.field.sizeY = sizeYClean;
				}
			} else {
				this.field.sizeX = sizeX;
				this.field.sizeY = sizeY;
			}
		},
		removeIndex(index) {
			for(let i = 0, j = this.field.columns.length; i < j; i++) {
				if(!this.field.columns[i].subQuery && this.field.columns[i].attributeIndex === index) {
					this.field.columns.splice(i,1);
					i--; j--;
				}
			}
		},

		// field actions
		remove(fieldId) {
			const pos = this.field.fields.findIndex(v => v.id === fieldId);
			if(pos !== -1)
				this.field.fields.splice(pos,1);
		},

		// drag & drop
		dragPreviewGetIndex() {
			return this.field.fields.findIndex(v => v.content === this.dragContent);
		},
		dragPreviewRemove() {
			if(this.isFlow) {
				const ind = this.dragPreviewGetIndex();
				if(ind !== -1) this.field.fields.splice(ind,1);
			}
		},
		dragPreviewUpdate(index) {
			if(this.isFlow && this.dragFieldId === this.field.id) {
				this.dragPreviewRemove();
				this.field.fields.splice(index,0,this.getTemplateDocField(this.dragContent,null,null));
			}
		},

		// drag templates
		dragStartColumnTemplate(e,column) {
			let c = JSON.parse(JSON.stringify(column));
			c.id = this.getUuidV4();
			e.dataTransfer.setData('application/json',JSON.stringify(c));
			e.dataTransfer.setDragImage(e.srcElement,0,0);
			e.dataTransfer.setData(`doc-column`,'');                  // for drop on page
			e.dataTransfer.setData(`doc-column_${this.field.id}`,''); // for drop on column field
		},

		// drag source
		dragEnd(e) {
			if(e.dataTransfer.dropEffect !== 'none')
				this.$emit('dragChildEnd');

			this.beingDragged = false;
		},
		dragStart(e) {
			if(this.fieldIdOptions !== null)
				this.$emit('setFieldIdOptions',null);

			// store field for later drop & adjust ghost image to start at mouse position
			e.dataTransfer.setData('application/json',JSON.stringify(this.field));
			e.dataTransfer.setData(this.dragType,'');
			e.dataTransfer.setDragImage(e.srcElement,0,0);

			// store field index for removal from the source on later drop
			// timeout serves to make sure that ghost image is taken before hidden CSS is applied
			setTimeout(() => this.beingDragged = true,50);
		},

		// drag source child
		dragChildEnd(fieldId) {
			if(this.draggedInSameParent)
				return this.draggedInSameParent = false;

			const pos = this.field.fields.findIndex(v => v.id === fieldId);
			if(pos !== -1)
				this.field.fields.splice(pos,1);
		},
		dragChildEnter(index) {
			this.dragPreviewUpdate(index);
		},

		// drag target
		dragOver(e) {
			if(e.dataTransfer.types.includes(this.dragType))
				e.preventDefault();
		},
		dragEnter(e) {
			if(!e.dataTransfer.types.includes(this.dragType))
				return e.stopPropagation();

			if(!this.isWithFields) {
				if(!this.isDragPreview)
					this.$emit('dragChildEnter');
				
				return;
			}
			e.stopPropagation();

			if(this.dragFieldId !== this.field.id) {
				this.dragFieldIdSet(this.field.id);
				this.dragPreviewUpdate(this.field.fields.length);
			}
		},
		dragLeave(e) {
			if(this.isWithFields || !e.dataTransfer.types.includes(this.dragType))
				e.stopPropagation();
		},
		drop(e) {
			if(!this.isWithFields || !e.dataTransfer.types.includes(this.dragType))
				return;
			
			e.stopPropagation();
			this.dragFieldIdSet(null);
			
			const field         = JSON.parse(e.dataTransfer.getData('application/json'));
			const fieldsElm     = this.$refs.fields;
			const fieldsElmRect = fieldsElm.getBoundingClientRect();
			const gridSizeX     = fieldsElmRect.width  * this.pixelToMm / this.zoom;
			const gridSizeY     = fieldsElmRect.height * this.pixelToMm / this.zoom;

			if(this.isGrid) {
				// find position in grid
				field.posX = (e.clientX - fieldsElmRect.left) * this.pixelToMm / this.zoom;
				field.posY = (e.clientY - fieldsElmRect.top)  * this.pixelToMm / this.zoom;
	
				// snap position to grid
				field.posX = Math.round(field.posX / this.field.sizeSnap) * this.field.sizeSnap;
				field.posY = Math.round(field.posY / this.field.sizeSnap) * this.field.sizeSnap;

				// if field has no size, set to half of grid width
				if(field.sizeX === 0) field.sizeX = gridSizeX / 2;
				if(field.sizeY === 0) field.sizeY = this.gridFieldSizeMinY;

				field.sizeX = this.getSizeAfterSnap(true,field.posX,field.sizeX,gridSizeX,this.gridFieldSizeMinX,this.field.sizeSnap);
				field.sizeY = this.getSizeAfterSnap(true,field.posY,field.sizeY,gridSizeY,this.gridFieldSizeMinY,this.field.sizeSnap);
			}

			if(this.isFlow) {
				field.sizeX = 0;

				// only flow/grid fields can have height in flow parents
				if(field.content !== 'flow' && field.content !== 'grid')
					field.sizeY = 0;
			}

			// remove existing field if dragged within the same parent
			const fieldIndexOld = this.field.fields.findIndex(v => v.id === field.id);
			this.draggedInSameParent = fieldIndexOld !== -1;
			if(this.draggedInSameParent)
				this.field.fields.splice(fieldIndexOld,1);

			// add field at position of preview
			const indPreview = this.dragPreviewGetIndex();
			if(indPreview !== -1) this.field.fields.splice(indPreview,1,field);
			else                  this.field.fields.push(field);
		}
	}
};