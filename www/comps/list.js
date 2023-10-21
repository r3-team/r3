import isDropdownUpwards  from './shared/layout.js';
import MyFilters          from './filters.js';
import MyForm             from './form.js';
import MyInputCollection  from './inputCollection.js';
import MyInputOffset      from './inputOffset.js';
import MyListAggregate    from './listAggregate.js';
import MyListColumnBatch  from './listColumnBatch.js';
import MyListCsv          from './listCsv.js';
import MyValueRich        from './valueRich.js';
import {consoleError}     from './shared/error.js';
import {srcBase64}        from './shared/image.js';
import {getCaption}       from './shared/language.js';
import {isAttributeFiles} from './shared/attribute.js';
import {getColumnTitle}   from './shared/column.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
import {
	getChoiceFilters,
	getRowsDecrypted
} from './shared/form.js';
import {
	colorAdjustBg,
	colorMakeContrastFont
} from './shared/generic.js';
import {
	fillRelationRecordIds,
	getFiltersEncapsulated,
	getQueryAttributesPkFilter,
	getQueryExpressions,
	getRelationsJoined
} from './shared/query.js';
import {
	routeChangeFieldReload,
	routeParseParams
} from './shared/router.js';
export {MyList as default};

let MyList = {
	name:'my-list',
	components:{
		MyFilters,
		MyInputCollection,
		MyInputOffset,
		MyListAggregate,
		MyListColumnBatch,
		MyListCsv,
		MyValueRich
	},
	template:`<div class="list" ref="content"
		v-click-outside="escape"
		@keydown="keyDown"
		:class="{asInput:isInput, readonly:inputIsReadonly, isSingleField:isSingleField }"
	>
		<!-- list as input field (showing record(s) from active field value) -->
		<template v-if="isInput">
			<div class="list-input-rows-wrap"
				@click="clickInputRow"
				:class="{ clickable:!inputMulti && !inputIsReadonly, 'multi-line':inputMulti }"
			>
				<table class="list-input-rows">
					<tr v-for="(r,i) in rowsInput">
						
						<!-- icons / checkboxes -->
						<td class="minimum">
							<div class="list-input-row-items nowrap">
								
								<!-- either field/attribute icon or gallery file from first column -->
								<slot name="input-icon"
									v-if="!hasGalleryIcon || r.values[0] === null"
								/>
								<my-value-rich class="context-list-input"
									v-else
									@focus="focus"
									:attribute-id="columns[0].attributeId"
									:class="{ clickable:inputAsCategory && !inputIsReadonly }"
									:basis="columns[0].basis"
									:display="columns[0].display"
									:length="columns[0].length"
									:value="r.values[0]"
									:wrap="columns[0].wrap"
								/>
								
								<!-- category input check box -->
								<my-button
									v-if="inputAsCategory"
									@trigger="inputTriggerRow(r)"
									:active="!inputIsReadonly"
									:image="displayRecordCheck(inputRecordIds.includes(r.indexRecordIds['0']))"
									:naked="true"
								/>
							</div>
						</td>
						
						<!-- values -->
						<td v-for="(b,bi) in columnBatches" :style="b.style">
							<div class="list-input-row-items">
								<template v-for="(ci,cii) in b.columnIndexes">
									<my-value-rich class="context-list-input"
										v-if="r.values[ci] !== null && (!hasGalleryIcon || bi !== 0 || cii !== 0)"
										@focus="focus"
										@trigger="inputTriggerRow(r)"
										:attribute-id="columns[ci].attributeId"
										:class="{ clickable:inputAsCategory && !inputIsReadonly }"
										:basis="columns[ci].basis"
										:bold="columns[ci].styles.includes('bold')"
										:clipboard="columns[ci].clipboard"
										:display="columns[ci].display"
										:italic="columns[ci].styles.includes('italic')"
										:key="ci"
										:length="columns[ci].length"
										:value="r.values[ci]"
										:wrap="columns[ci].wrap"
									/>
								</template>
							</div>
						</td>
						
						<!-- actions -->
						<td class="minimum">
							<div class="list-input-row-items nogap nowrap">
								<my-button image="open.png"
									v-if="hasUpdate"
									@trigger="clickOpen(r,false)"
									@trigger-middle="clickOpen(r,true)"
									:blockBubble="true"
									:captionTitle="capApp.inputHintOpen"
									:naked="true"
								/>
								<my-button image="cancel.png"
									v-if="!inputAsCategory"
									@trigger="inputTriggerRowRemove(i)"
									:active="!inputIsReadonly"
									:captionTitle="capApp.inputHintRemove"
									:naked="true"
								/>
							</div>
						</td>
					</tr>
				</table>
			</div>
			
			<!-- empty record input field -->
			<table class="list-input-rows"
				v-if="showInputAddLine"
				@click="clickInputEmpty"
				:class="{ clickable:!inputIsReadonly }"
			>
				<tr>
					<td class="minimum">
						<slot name="input-icon" />
					</td>
					<td>
						<div class="list-input-row-items">
							<input class="input" data-is-input="1" enterkeyhint="send"
								@click="focus"
								@focus="focus"
								@keyup="updatedTextInput"
								v-model="filtersQuick"
								:class="{ invalid:!inputValid }"
								:disabled="inputIsReadonly"
								:placeholder="inputLinePlaceholder"
								:tabindex="!inputIsReadonly ? 0 : -1"
							/>
						</div>
					</td>
					<td class="minimum">
						<div class="list-input-row-items nogap nowrap">
							<my-button image="add.png"
								v-if="!inputIsReadonly && hasCreate"
								@trigger="$emit('open-form',[],false)"
								@trigger-middle="$emit('open-form',[],true)"
								:blockBubble="true"
								:captionTitle="capApp.inputHintCreate"
								:naked="true"
							/>
							<my-button image="pageDown.png"
								:active="!inputIsReadonly"
								:naked="true"
							/>
						</div>
					</td>
				</tr>
			</table>
		</template>
		
		<!-- regular list view (either view or input dropdown) -->
		<template v-if="showTable && !inputAsCategory">
			
			<!-- list header line -->
			<div class="list-header" v-if="header">
				
				<!-- actions -->
				<div class="row gap nowrap">
					<my-button image="new.png"
						v-if="hasCreate"
						@trigger="$emit('open-form',[],false)"
						@trigger-middle="$emit('open-form',[],true)"
						:caption="showActionTitles ? capGen.button.new : ''"
						:captionTitle="capGen.button.newHint"
					/>
					<my-button image="edit.png"
						v-if="hasUpdateBulk"
						@trigger="selectRowsBulkEdit(selectedRows)"
						:active="selectedRows.length !== 0"
						:caption="showActionTitles ? capGen.button.editBulk.replace('{COUNT}',selectedRows.length) : '(' + String(selectedRows.length) + ')'"
						:captionTitle="capGen.button.editBulk.replace('{COUNT}',selectedRows.length)"
					/>
					<my-button image="fileSheet.png"
						v-if="csvImport || csvExport"
						@trigger="showCsv = !showCsv"
						:caption="showActionTitles ? capApp.button.csv : ''"
						:captionTitle="capApp.button.csvHint"
					/>
					<my-button image="shred.png"
						v-if="hasDeleteAny"
						@trigger="delAsk(selectedRows)"
						:active="selectedRows.length !== 0"
						:cancel="true"
						:caption="showActionTitles ? capGen.button.delete : ''"
						:captionTitle="capGen.button.deleteHint"
					/>
				</div>
				
				<div ref="empty" class="empty"></div>
				
				<div class="row gap nowrap">
					<img class="icon"
						v-if="iconId !== null"
						:src="srcBase64(iconIdMap[iconId].file)"
					/>
					
					<!-- offset -->
					<my-input-offset class-input="selector"
						v-if="hasPaging"
						@input="offset = $event;reloadInside()"
						:caption="!isMobile ? true : false"
						:limit="limit"
						:offset="offset"
						:total="count"
					/>
				</div>
				
				<div class="row gap nowrap default-inputs">
					<!-- auto renew / user filter / quick filter / query choices / page limits -->
					
					<my-button image="autoRenew.png"
						v-if="showAutoRenewIcon && autoRenew !== null"
						@trigger="showAutoRenew = !showAutoRenew"
						:caption="capApp.button.autoRenew.replace('{VALUE}',autoRenewInput)"
						:captionTitle="capApp.button.autoRenewHint.replace('{VALUE}',autoRenewInput)"
						:naked="true"
					/>
					
					<my-button image="refresh.png"
						v-if="showRefresh"
						@trigger="reloadInside('manual')"
						:captionTitle="capGen.button.refresh"
						:naked="true"
					/>
					
					<my-button image="filterCog.png"
						@trigger="toggleUserFilters"
						@trigger-right="filtersUser = [];reloadInside('filtersUser')"
						:caption="filtersUser.length !== 0 ? String(filtersUser.length) : ''"
						:captionTitle="capGen.button.filterHint"
						:naked="true"
					/>
					
					<input class="selector lookup" enterkeyhint="send" type="text"
						v-if="filterQuick"
						@keyup.enter="updatedFilterQuick"
						v-model="filtersQuick"
						:placeholder="capGen.threeDots"
						:title="capApp.quick"
					/>
					
					<my-input-collection class="selector"
						v-for="c in collections"
						@update:modelValue="$emit('set-collection-indexes',c.collectionId,$event)"
						:collectionId="c.collectionId"
						:columnIdDisplay="c.columnIdDisplay"
						:key="c.collectionId"
						:modelValue="collectionIdMapIndexes[c.collectionId]"
						:multiValue="c.multiValue"
					/>
					
					<select class="selector"
						v-if="hasChoices"
						@change="reloadInside('choice')"
						v-model="choiceId"
					>
						<option v-for="c in query.choices" :value="c.id">
							{{ getCaption(c.captions.queryChoiceTitle,c.name) }}
						</option>
					</select>
					
					<select class="selector"
						v-if="showPageLimit && hasPaging"
						v-model.number="limit"
						@change="reloadInside()"
					>
						<option v-for="o in limitOptions" :value="o">{{ o }}</option>
					</select>
				</div>
			</div>
			
			<div class="list-options-wrap" v-if="showAggregators || showCsv || showFilters || showAutoRenew">
				<!-- list header functions -->
				
				<!-- auto renew -->
				<div class="list-options" v-if="showAutoRenew">
					<div class="list-options-title">
						<img src="images/autoRenew.png" />
						<span>{{ capApp.autoRenew }}</span>
					</div>
					
					<div class="list-auto-renew-line default-inputs">
						<span>{{ capApp.autoRenewInput }}</span>
						<input class="short"
							v-model.number="autoRenewInput"
							:placeholder="capApp.autoRenewInputHint"
						/>
						<my-button image="save.png"
							@trigger="setAutoRenewTimer(false)"
							:active="autoRenewInput !== '' && autoRenewInput !== autoRenewInputLast"
						/>
					</div>
				</div>
				
				<!-- filters -->
				<div class="list-options" v-if="showFilters">
					<my-filters class="default-inputs"
						v-model="filtersUser"
						@apply="reloadInside('filtersUser')"
						@close="showFilters = false"
						:columns="columns"
						:joins="joins"
						:showReset="true"
						:userFilter="true"
					>
						<template #title>
							<div class="list-options-title">
								<img src="images/filterCog.png" />
								<span>{{ capGen.button.filterHint }}</span>
							</div>
						</template>
					</my-filters>
				</div>
				
				<!-- CSV -->
				<my-list-csv
					v-if="showCsv"
					@reload="get"
					:columns="columns"
					:expressions="expressions"
					:filters="filtersCombined"
					:isExport="csvExport"
					:isImport="csvImport"
					:joins="relationsJoined"
					:orders="orders"
					:query="query"
				/>
			</div>
			
			<!-- list results -->
			<div class="layoutWrap">
				<!-- list results as table or card layout -->
				<div
					:class="{ layoutCards:isCards, layoutTable:isTable, scrolls:isSingleField, 'input-dropdown-wrap':isInput, upwards:inputDropdownUpwards }"
					:id="usesPageHistory ? scrollFormId : null"
				>
					<table v-if="isTable" :class="{ 'input-dropdown':isInput, upwards:inputDropdownUpwards }">
						<thead v-if="header">
							<tr>
								<th v-if="hasBulkActions" class="minimum checkbox">
									<img class="clickable" tabindex="0"
										@click="selectRowsAllToggle"
										@keyup.enter.space.stop="selectRowsAllToggle"
										:src="rows.length !== 0 && selectedRows.length === rows.length ? 'images/checkboxSmall1.png' : 'images/checkboxSmall0.png'"
									/>
								</th>
								<th v-for="(b,i) in columnBatches">
									<my-list-column-batch
										@close="columnBatchIndexOption = -1"
										@del-aggregator="setAggregators"
										@del-order="setOrder(b,null)"
										@set-aggregator="setAggregators"
										@set-filters="filtersColumn = $event;reloadInside('filtersColumn')"
										@set-order="setOrder(b,$event)"
										@toggle="clickColumn(i)"
										:columnBatch="b"
										:columnIdMapAggr="columnIdMapAggr"
										:columns="columns"
										:columnSortPos="getColumnBatchSortPos(b)"
										:filters="filters"
										:filtersColumn="filtersColumn"
										:lastInRow="i === columnBatches.length - 1"
										:joins="relationsJoined"
										:orders="orders"
										:relationId="query.relationId"
										:rowCount="count"
										:show="columnBatchIndexOption === i"
									/>
								</th>
							</tr>
						</thead>
						<tbody>
							<!-- result row actions (only available if list is input) -->
							<tr v-if="showInputHeader" class="list-input-row-actions">
								<td colspan="999">
									<div class="sub-actions default-inputs">
										<select
											v-if="hasChoices"
											@change="reloadInside('choice')"
											v-model="choiceId"
										>
											<option v-for="c in query.choices" :value="c.id">
												{{ getCaption(c.captions.queryChoiceTitle,c.name) }}
											</option>
										</select>
										
										<my-input-offset
											@input="offset = $event;reloadInside()"
											:caption="false"
											:limit="limit"
											:offset="offset"
											:total="count"
										/>
										
										<input class="selector lookup small" enterkeyhint="send" type="text"
											v-if="filterQuick"
											@keyup.enter="updatedFilterQuick"
											v-model="filtersQuick"
											:placeholder="capGen.threeDots"
											:title="capApp.quick"
										/>
										
										<my-button image="checkbox1.png"
											v-if="showInputAddAll"
											@trigger="clickRowAll"
											:caption="capApp.button.all"
											:captionTitle="capApp.button.allHint"
											:naked="true"
										/>
									</div>
								</td>
							</tr>
							
							<!-- result rows -->
							<tr
								v-for="(r,ri) in rowsClear"
								@click="clickRow(r,false)"
								@click.middle="clickRow(r,true)"
								@keyup.enter.space="clickRow(r,false)"
								:class="{ rowSelect:rowSelect && !inputIsReadonly, active:popUpFormInline !== null && popUpFormInline.recordIds.includes(r.indexRecordIds['0']) }"
								:key="ri + '_' + r.indexRecordIds['0']"
								:ref="refTabindex+String(ri)"
								:tabindex="isInput ? '0' : '-1'"
							>
								<td v-if="hasBulkActions" @click.stop="" class="minimum checkbox">
									<img class="clickable" tabindex="0"
										@click="selectRow(ri)"
										@keyup.enter.space.stop="selectRow(ri)"
										:src="selectedRows.includes(ri) ? 'images/checkboxSmall1.png' : 'images/checkboxSmall0.png'"
									/>
								</td>
								
								<!-- row values per column batch -->
								<td v-for="b in columnBatches" :style="b.style">
									<div class="batch"
										:class="{ colored:b.columnIndexColor !== -1, vertical:b.vertical }"
										:style="b.columnIndexColor === -1 ? '' : displayColorColumn(r.values[b.columnIndexColor])"
									>
										<my-value-rich
											v-for="ind in b.columnIndexes.filter(v => v !== b.columnIndexColor && r.values[v] !== null)"
											@clipboard="$emit('clipboard')"
											:attributeId="columns[ind].attributeId"
											:basis="columns[ind].basis"
											:bold="columns[ind].styles.includes('bold')"
											:clipboard="columns[ind].clipboard"
											:display="columns[ind].display"
											:italic="columns[ind].styles.includes('italic')"
											:key="ind"
											:length="columns[ind].length"
											:value="r.values[ind]"
											:wrap="columns[ind].wrap"
										/>
									</div>
								</td>
							</tr>
							
							<!-- no results message -->
							<tr v-if="rows.length === 0">
								<td v-if="rowsFetching" colspan="999">
									<div class="fetching">
										<img src="images/load.gif">
										<span>{{ capApp.fetching }}</span>
									</div>
								</td>
								<td v-if="!rowsFetching" colspan="999">
									<div class="batch">{{ capGen.resultsNone }}</div>
								</td>
							</tr>
						</tbody>
						<tfoot>
							<!-- result aggregations -->
							<my-list-aggregate ref="aggregations"
								:columnBatches="columnBatches"
								:columnIdMapAggr="columnIdMapAggr"
								:columns="columns"
								:filters="filtersCombined"
								:leaveOneEmpty="hasBulkActions"
								:joins="relationsJoined"
								:relationId="query.relationId"
							/>
						</tfoot>
					</table>
					
					<!-- list results as cards -->
					<template v-if="isCards">
					
						<!-- actions -->
						<div class="top-actions default-inputs">
							<my-button
								v-if="hasBulkActions"
								@trigger="selectRowsAllToggle"
								:caption="capApp.button.all"
								:captionTitle="capApp.button.allHint"
								:image="rows.length !== 0 && selectedRows.length === rows.length ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
							
							<!-- sorting -->
							<template v-if="rowsClear.length !== 0">
								<span class="select">{{ capApp.orderBy }}</span>
								<select
									@change="cardsSetOrderBy($event.target.value)"
									v-model.number="cardsOrderByColumnIndex"
								>
									<option value="-1">-</option>
									<option
										v-for="(b,i) in columnBatches.filter(v => v.columnIndexSortBy !== -1)"
										:value="b.columnIndexSortBy"
									>
										{{ b.caption }}
									</option>
								</select>
								<my-button
									v-if="orders.length !== 0"
									@trigger="cardsToggleOrderBy"
									:image="orders[0].ascending ? 'triangleUp.png' : 'triangleDown.png'"
									:naked="true"
								/>
							</template>
							
							<!-- no results message -->
							<template v-if="rowsClear.length === 0">
								<div class="no-results" v-if="!rowsFetching">
									{{ capGen.resultsNone }}
								</div>
								<div class="no-results fetching" v-if="rowsFetching">
									<img src="images/load.gif">
									<span>{{ capApp.fetching }}</span>
								</div>
							</template>
						</div>
						
						<div class="cards">
							<div class="card"
								v-for="(r,ri) in rowsClear"
								@click="clickRow(r,false)"
								@click.middle="clickRow(r,true)"
								@keyup.enter.space="clickRow(r,false)"
								:class="{ rowSelect:rowSelect && !inputIsReadonly }"
								:key="ri + '_' + r.indexRecordIds['0']"
								:ref="refTabindex+String(ri)"
								:tabindex="isInput ? '0' : '-1'"
							>
								<div class="actions" v-if="hasBulkActions" @click.stop="">
									<my-button
										@trigger="selectRow(ri)"
										:image="selectedRows.includes(ri) ? 'checkbox1.png' : 'checkbox0.png'"
										:naked="true"
									/>
									<my-button image="delete.png"
										@trigger="delAsk([ri])"
										:naked="true"
									/>
								</div>
								<div class="header"></div>
								
								<!-- row values per column batch -->
								<table>
									<tr v-for="b in columnBatches">
										<td>{{ b.caption }}</td>
										<td>
											<div class="batch" :class="{ vertical:b.vertical }">
												<my-value-rich
													v-for="ind in b.columnIndexes.filter(v => r.values[v] !== null || columns[v].display === 'gallery')"
													@clipboard="$emit('clipboard')"
													:attributeId="columns[ind].attributeId"
													:basis="columns[ind].basis"
													:bold="columns[ind].styles.includes('bold')"
													:clipboard="columns[ind].clipboard"
													:display="columns[ind].display"
													:italic="columns[ind].styles.includes('italic')"
													:key="ind"
													:length="columns[ind].length"
													:value="r.values[ind]"
													:wrap="columns[ind].wrap"
												/>
											</div>
										</td>
									</tr>
								</table>
							</div>
						</div>
					</template>
					
					<div class="empty-space" @click="clickOnEmpty"></div>
				</div>
				
				<!-- inline form -->
				<my-form
					v-if="popUpFormInline !== null"
					@close="$emit('close-inline')"
					@record-deleted="get"
					@record-updated="get"
					@records-open="popUpFormInline.recordIds = $event"
					:attributeIdMapDef="popUpFormInline.attributeIdMapDef"
					:formId="popUpFormInline.formId"
					:hasHelp="false"
					:hasLog="false"
					:isPopUp="true"
					:isPopUpFloating="false"
					:moduleId="popUpFormInline.moduleId"
					:recordIds="popUpFormInline.recordIds"
					:style="popUpFormInline.style"
				/>
			</div>
		</template>
	</div>`,
	props:{
		autoRenew:      { required:false, default:null },                   // refresh list data every x seconds
		choices:        { type:Array,   required:false, default:() => [] }, // processed query choices
		collections:    { type:Array,   required:false, default:() => [] }, // consumed collections to filter by user input
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		columns:        { type:Array,   required:true },                    // processed list columns
		fieldId:        { type:String,  required:true },
		filters:        { type:Array,   required:true },                    // processed query filters
		iconId:         { required:false, default:null },
		layout:         { type:String,  required:false, default:'table' },  // list layout: table, cards
		limitDefault:   { type:Number,  required:false, default:10 },       // default list limit
		popUpFormInline:{ required:false, default:null },                   // form to show inside list
		query:          { type:Object,  required:true },                    // list query
		
		// toggles
		csvExport:      { type:Boolean, required:false, default:false },
		csvImport:      { type:Boolean, required:false, default:false },
		filterQuick:    { type:Boolean, required:false, default:false }, // enable quick filter
		formLoading:    { type:Boolean, required:false, default:false }, // trigger and control list reloads
		hasOpenForm:    { type:Boolean, required:false, default:false }, // list can open record in form
		hasOpenFormBulk:{ type:Boolean, required:false, default:false }, // list can open records in bulk form
		header:         { type:Boolean, required:false, default:true  }, // show list header
		isInput:        { type:Boolean, required:false, default:false }, // use list as input
		isHidden:       { type:Boolean, required:false, default:false }, // list is not visible and therefore not loaded/updated
		isSingleField:  { type:Boolean, required:false, default:false }, // list is single field within a parent (form/tab - not container!)
		usesPageHistory:{ type:Boolean, required:false, default:false }, // list uses page getters for filtering/sorting/etc.
		
		// list as input field
		inputAsCategory:{ type:Boolean, required:false, default:false },    // input is category selector (all records are shown, active ones are checked off)
		inputAutoSelect:{ type:Number,  required:false, default:0 },        // # of records to auto select (2 = first two, -3 = last three, 0 = none)
		inputIsNew:     { type:Boolean, required:false, default:false },    // input field belongs to new record
		inputIsReadonly:{ type:Boolean, required:false, default:false },    // input field is readonly
		inputMulti:     { type:Boolean, required:false, default:false },    // input has multiple records to represent (instead of just one)
		inputRecordIds: { type:Array,   required:false, default:() => [] }, // input record IDs, representing active values to show
		inputValid:     { type:Boolean, required:false, default:true }
	},
	emits:[
		'blurred','clipboard','close-inline','focused','open-form',
		'open-form-bulk','record-count-change','record-removed',
		'record-selected','records-selected-init','set-args',
		'set-collection-indexes'
	],
	data() {
		return {
			// list state
			autoRenewInput:null,        // current auto renew input value
			autoRenewInputLast:null,    // last set auto renew input value (to compare against)
			autoRenewTimer:null,        // interval timer for auto renew
			choiceId:null,              // currently active choice
			columnBatchIndexOption:-1,  // show options for column batch by index
			focused:false,
			inputAutoSelectDone:false,
			inputDropdownUpwards:false, // show dropdown above input
			orderOverwritten:false,     // sort options were changed by user
			rowsFetching:false,         // row values are being fetched
			selectedRows:[],            // bulk selected rows by row index
			showAggregators:false,      // show UI for aggregators
			showAutoRenew:false,        // show UI for auto list renew
			showCsv:false,              // show UI for CSV import/export
			showFilters:false,          // show UI for user filters
			showTable:false,            // show regular list table as view or input dropdown
			
			// list constants
			refTabindex:'input_row_', // prefix for vue references to tabindex elements
			
			// list card layout state
			cardsOrderByColumnIndex:-1,
			
			// list data
			columnIdMapAggr:{}, // aggregators by column ID
			count:0,            // total result set count
			limit:0,            // current result limit
			offset:0,           // current result offset
			orders:[],          // column orderings, copied on mount, changable by user
			rows:[],            // current result set
			filtersColumn:[],   // current user column filters
			filtersQuick:'',    // current user quick text filter
			filtersUser:[],     // current user filters
			
			// list input data
			rowsInput:[], // rows that reflect current input (following active record IDs)
			              // as opposed to list rows which show lookup data (regular list or input dropdown)
			
			// list layout
			layoutCheckTimer:null,
			layoutReducedElements:[],        // elements that needed to be reduced to fit the current window width
			layoutReducibleElementsInOrder:[ // elements that can be reduced, in order of priority
				'actionTitles',              // optional
				'refresh',                   // optional
				'pageLimit',                 // not important
				'autoRenewIcon'              // not important
			]
		};
	},
	computed:{
		// columns can be batched by using the same batch number
		// first column in batch is used for header caption and ordering
		columnBatches:(s) => {
			let batches   = [];
			let addColumn = (column,index) => {
				const hidden = column.display === 'hidden' || (s.isMobile && !column.onMobile);
				const atr    = s.attributeIdMap[column.attributeId];
				
				// first non-encrypted/non-file attribute in batch can be sorted by
				const noSort  = atr.encrypted || s.isAttributeFiles(atr.content);
				const isColor = atr.contentUse === 'color';
				
				if(column.batch !== null) {
					for(let i = 0, j = batches.length; i < j; i++) {
						if(batches[i].batch !== column.batch)
							continue;
						
						// do not add column if its hidden
						if(hidden) return;
						
						// add its own column index + sort setting + width to batch
						batches[i].columnIndexes.push(index);
						batches[i].columnIndexSortBy = batches[i].columnIndexSortBy !== -1 || noSort
							? batches[i].columnIndexSortBy : index;
						
						if(isColor)
							batches[i].columnIndexColor = index;
						
						if(!batches[i].vertical)
							batches[i].basis += column.basis;
						
						if(batches[i].vertical && column.basis > batches[i].basis)
							batches[i].basis = column.basis;
						
						return;
					}
				}
				
				// create new column batch with itself as first column
				// create even if first column is hidden as other columns in same batch might not be
				batches.push({
					basis:column.basis,
					batch:column.batch,
					caption:s.getColumnTitle(column),
					columnIndexes:!hidden ? [index] : [],
					columnIndexColor:!isColor ? -1 : index,
					columnIndexSortBy:noSort ? -1 : index,
					style:'',
					vertical:column.batchVertical
				});
			};
			for(let i = 0, j = s.columns.length; i < j; i++) {
				addColumn(s.columns[i],i);
			}
			
			// batches with no columns are removed
			for(let i = 0, j = batches.length; i < j; i++) {
				if(batches[i].columnIndexes.length === 0) {
					batches.splice(i,1);
					i--; j--;
					continue;
				}
				if(batches[i].basis !== 0)
					batches[i].style = `max-width:${batches[i].basis}px`;
			}
			return batches;
		},
		filtersCombined:(s) => {
			let filters = s.filters
				.concat(s.filtersParsedColumn)
				.concat(s.filtersParsedQuick)
				.concat(s.filtersParsedUser)
				.concat(s.choiceFilters);
			
			if(s.anyInputRows)
				filters.push(s.getQueryAttributesPkFilter(
					s.query.relationId,s.inputRecordIds,0,true
				));
			
			return filters;
		},
		hasDeleteAny:(s) => {
			for(let join of s.joins) {
				if(join.applyDelete)
					return true;
			}
			return false;
		},
		hasGalleryIcon:(s) => {
			return s.columns.length !== 0 &&
				s.columns[0].display === 'gallery' &&
				(s.columns[0].onMobile || !s.isMobile) &&
				(!s.isInput || s.rowsInput.length !== 0) &&
				s.attributeIdMap[s.columns[0].attributeId].content === 'files';
		},
		inputLinePlaceholder:(s) => {
			if(s.focused) return '';
			return s.anyInputRows ? s.capApp.inputPlaceholderAdd : s.capGen.threeDots;
		},
		limitOptions:(s) => {
			let out = [10,25,50,100,250,500,1000];
			
			if(!out.includes(s.limitDefault))
				out.unshift(s.limitDefault);
			
			return out.sort((a,b) => a-b);
		},
		pageCount:(s) => {
			if(s.count === 0) return 0;
			
			let cnt = Math.floor(s.count / s.limit);
			return s.count % s.limit !== 0 ? cnt+1 : cnt;
		},
		rowsClear:(s) => {
			let rows = [];
			for(let r of s.rows) {
				if(!s.inputRecordIds.includes(r.indexRecordIds['0']))
					rows.push(r);
			}
			return rows;
		},
		
		// filters
		filtersParsedColumn:(s) => s.getFiltersEncapsulated(
			JSON.parse(JSON.stringify(s.filtersColumn))
		),
		filtersParsedUser:(s) => s.getFiltersEncapsulated(
			JSON.parse(JSON.stringify(s.filtersUser))
		),
		filtersParsedQuick:(s) => {
			if(s.filtersQuick === '') return [];
			
			let out = [];
			let addFilter = (operator,atrId,atrIndex,dict) => {
				out.push({
					connector:out.length === 0 ? 'AND' : 'OR',
					operator:operator,
					side0:{ attributeId:atrId, attributeIndex:atrIndex, brackets:0 },
					side1:{ brackets:0, ftsDict:dict, value:s.filtersQuick }
				});
			};
			
			for(let c of s.columns) {
				let a = s.attributeIdMap[c.attributeId];
				if(c.subQuery || s.isAttributeFiles(a.content) ||
					(c.aggregator !== null && c.aggregator !== 'record')) {
					
					continue;
				}
				
				// check for available full text search
				let ftsAvailable = false;
				let r = s.relationIdMap[a.relationId];
				for(let ind of r.indexes) {
					if(ind.method === 'GIN' && ind.attributes.length === 1
						&& ind.attributes[0].attributeId === a.id) {
						
						ftsAvailable = true;
						break;
					}
				}
				
				if(!ftsAvailable) {
					addFilter('ILIKE',c.attributeId,c.index,null);
				}
				else {
					// add FTS filter for each active dictionary, use 'simple' otherwise
					for(let dict of s.settings.searchDictionaries) {
						addFilter('@@',c.attributeId,c.index,dict);
					}
					if(s.settings.searchDictionaries.length === 0)
						addFilter('@@',c.attributeId,c.index,'simple');
				}
			}
			return s.getFiltersEncapsulated(out);
		},
		
		// simple
		anyInputRows:     (s) => s.inputRecordIds.length !== 0,
		autoSelect:       (s) => s.inputIsNew && s.inputAutoSelect !== 0 && !s.inputAutoSelectDone,
		choiceFilters:    (s) => s.getChoiceFilters(s.choices,s.choiceId),
		choiceIdDefault:  (s) => s.fieldOptionGet(s.fieldId,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		expressions:      (s) => s.getQueryExpressions(s.columns),
		hasBulkActions:   (s) => !s.isInput && s.rows.length !== 0 && (s.hasUpdateBulk || s.hasDeleteAny),
		hasChoices:       (s) => s.query.choices.length > 1,
		hasCreate:        (s) => s.joins.length !== 0 && s.joins[0].applyCreate && s.hasOpenForm,
		hasPaging:        (s) => s.query.fixedLimit === 0,
		hasUpdate:        (s) => s.joins.length !== 0 && s.joins[0].applyUpdate && s.hasOpenForm,
		hasUpdateBulk:    (s) => s.joins.length !== 0 && s.joins[0].applyUpdate && s.hasOpenFormBulk,
		isCards:          (s) => s.layout === 'cards',
		isTable:          (s) => s.layout === 'table',
		joins:            (s) => s.fillRelationRecordIds(s.query.joins),
		relationsJoined:  (s) => s.getRelationsJoined(s.joins),
		rowSelect:        (s) => s.isInput || s.hasUpdate,
		showActionTitles: (s) => !s.layoutReducedElements.includes('actionTitles'),
		showPageLimit:    (s) => !s.layoutReducedElements.includes('pageLimit'),
		showInputAddLine: (s) => !s.inputAsCategory && (!s.anyInputRows || (s.inputMulti && !s.inputIsReadonly)),
		showInputAddAll:  (s) => s.inputMulti && s.rowsClear.length > 0,
		showInputHeader:  (s) => s.isInput && (s.filterQuick || s.hasChoices || s.showInputAddAll || s.offset !== 0 || s.count > s.limit),
		showRefresh:      (s) => !s.layoutReducedElements.includes('refresh'),
		showAutoRenewIcon:(s) => !s.layoutReducedElements.includes('autoRenewIcon'),
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic,
		isMobile:      (s) => s.$store.getters.isMobile,
		moduleLanguage:(s) => s.$store.getters.moduleLanguage,
		scrollFormId:  (s) => s.$store.getters.constants.scrollFormId,
		settings:      (s) => s.$store.getters.settings
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyForm = MyForm;
	},
	mounted() {
		this.showTable = !this.isInput;
		
		// react to field resize
		if(!this.Input) {
			window.addEventListener('resize',this.resized);
			this.resized();
		}
		
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(val) return;
			this.inputAutoSelectDone = false;
			this.reloadOutside();
		});
		this.$watch('isHidden',(val) => {
			if(!val) this.reloadOutside();
		});
		this.$watch(() => [this.choices,this.columns,this.filters],(newVals,oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.reloadOutside();
			}
		});
		this.$watch('inputRecordIds',(val) => {
			if(!this.isInput || this.inputAsCategory)
				return;
			
			// update input if record IDs are different (different count or IDs)
			if(val.length !== this.rowsInput.length)
				return this.reloadOutside();
			
			for(let i = 0, j = this.rowsInput.length; i < j; i++) {
				if(!val.includes(this.rowsInput[i].indexRecordIds[0]))
					return this.reloadOutside();
			}
		});
		if(this.usesPageHistory) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals)) {
					this.paramsUpdated();
					this.reloadOutside();
					this.orderOverwritten = true;
				}
			});
		}
		
		if(this.usesPageHistory) {
			// set initial states via route parameters
			this.paramsUpdated();     // load existing parameters from route query
			this.paramsUpdate(false); // overwrite parameters (in case defaults are set)
		} else {
			// sub lists are initiated once
			this.choiceId = this.choiceIdDefault;
			this.limit    = this.limitDefault;
			this.orders   = JSON.parse(JSON.stringify(this.query.orders));
		}
		
		// set initial auto renew timer
		if(this.autoRenew !== null) {
			this.autoRenewInput = this.fieldOptionGet(this.fieldId,'autoRenew',this.autoRenew);
			this.setAutoRenewTimer(false);
		}
		
		// load cached list options
		this.filtersColumn   = this.fieldOptionGet(this.fieldId,'filtersColumn',[]);
		this.filtersQuick    = this.fieldOptionGet(this.fieldId,'filtersQuick','');
		this.filtersUser     = this.fieldOptionGet(this.fieldId,'filtersUser',[]);
		this.columnIdMapAggr = this.fieldOptionGet(this.fieldId,'columnIdMapAggr',{});
	},
	beforeUnmount() {
		this.setAutoRenewTimer(true);
	},
	unmounted() {
		if(!this.Input)
			window.removeEventListener('resize',this.resized);
	},
	methods:{
		// externals
		colorAdjustBg,
		colorMakeContrastFont,
		consoleError,
		fieldOptionGet,
		fieldOptionSet,
		fillRelationRecordIds,
		getCaption,
		getChoiceFilters,
		getColumnTitle,
		getFiltersEncapsulated,
		getQueryAttributesPkFilter,
		getQueryExpressions,
		getRelationsJoined,
		getRowsDecrypted,
		isAttributeFiles,
		isDropdownUpwards,
		routeChangeFieldReload,
		routeParseParams,
		srcBase64,
		
		// presentation
		displayRecordCheck(state) {
			if(this.inputMulti)
				return state ? 'checkbox1.png' : 'checkbox0.png';
			
			return state ? 'radio1.png' : 'radio0.png';
		},
		displayColorColumn(color) {
			if(color === null) return '';
			
			let bg   = this.colorAdjustBg(color);
			let font = this.colorMakeContrastFont(bg);
			return `background-color:${bg};color:${font};`;
		},
		layoutAdjust() {
			if(typeof this.$refs.empty === 'undefined')
				return;
			
			this.layoutCheckTimer = null;
			const enoughSpace = this.$refs.empty.offsetWidth > 10;
			
			if(enoughSpace || this.layoutReducedElements.length === this.layoutReducibleElementsInOrder.length)
				return;
			
			// space insufficient and still elements available to reduce
			for(const elm of this.layoutReducibleElementsInOrder) {
				if(this.layoutReducedElements.includes(elm))
					continue;
				
				this.layoutReducedElements.push(elm);
				
				// recheck after adjustment, in case further reduction is required
				this.$nextTick(this.layoutAdjust);
				break;
			}
		},
		resized() {
			if(this.layoutCheckTimer !== null)
				clearTimeout(this.layoutCheckTimer);
			
			this.layoutCheckTimer = setTimeout(() => {
				this.layoutReducedElements = [];   // reset reduced elements for new window size
				this.$nextTick(this.layoutAdjust); // wait for layout to settle before adjustments
			},300);
		},
		updateDropdownDirection() {
			let headersPx  = 200; // rough height in px of all headers (menu/form) combined
			let rowPx      = 40;  // rough height in px of one dropdown list row
			let dropdownPx = rowPx * (this.rows.length+1); // +1 for action row
			
			this.inputDropdownUpwards =
				this.isDropdownUpwards(this.$el,dropdownPx,headersPx);
		},
		
		// reloads
		reloadOutside() {
			// outside state has changed, reload list or list input
			if(!this.isInput)
				return this.get();
			
			this.getInput();
		},
		reloadInside(entity) {
			// inside state has changed, reload list (not relevant for list input)
			switch(entity) {
				case 'dropdown':      // fallthrough
				case 'filterQuick':   // fallthrough
				case 'filtersColumn': // fallthrough
				case 'filtersUser': this.offset = 0; break;
				case 'choice':
					this.offset = 0;
					this.fieldOptionSet(this.fieldId,'choiceId',this.choiceId);
				break;
				case 'order':
					this.offset = 0;
					this.orderOverwritten = true;
				break;
				case 'manuel': break; // manual reload
				default: break; // no special treatment
			}
			
			// update route parameters, reloads list via watcher
			// enables browser history for fullpage list navigation
			//  special cases: column/quick/user filters & manuel reloads (no page param change)
			if(this.usesPageHistory && !['filtersColumn','filtersQuick','filtersUser','manual'].includes(entity))
				return this.paramsUpdate(true);
			
			this.get();
		},
		
		// parsing
		paramsUpdate(pushHistory) {
			// fullpage lists update their form arguments, this results in history change
			// history change then triggers form load
			let orders = [];
			for(let i = 0, j = this.orders.length; i < j; i++) {
				let o = this.orders[i];
				
				if(typeof o.expressionPos !== 'undefined')
					// sort by expression position
					orders.push(`expr_${o.expressionPos}_${o.ascending ? 'asc' : 'desc'}`);
				else
					// sort by attribute
					orders.push(`${o.index}_${o.attributeId}_${o.ascending ? 'asc' : 'desc'}`);
			}
			
			let args = [];
			if(this.choiceId    !== null) args.push(`choice=${this.choiceId}`);
			if(this.limit       !== 0)    args.push(`limit=${this.limit}`);
			if(this.offset      !== 0)    args.push(`offset=${this.offset}`);
			if(orders.length    !== 0)    args.push(`orderby=${orders.join(',')}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated() {
			// apply query parameters
			// initial filter choice is set to first available choice (if there are any)
			// initial order by parameter follows query order
			//  if user overwrites order, initial order is empty
			let params = {
				choice:     { parse:'string',   value:this.choiceIdDefault },
				limit:      { parse:'int',      value:this.limitDefault },
				offset:     { parse:'int',      value:0 },
				orderby:    { parse:'listOrder',value:!this.orderOverwritten ? JSON.stringify(this.query.orders) : '[]' }
			};
			this.routeParseParams(params);
			
			if(this.choiceId !== params['choice'].value)
				this.choiceId = params['choice'].value;
			
			this.limit  = params['limit'].value;
			this.offset = params['offset'].value;
			this.orders = JSON.parse(params['orderby'].value);
			
			// apply first order for card layout selector
			this.cardsOrderByColumnIndex = -1;
			for(let i = 0, j = this.columns.length; i < j; i++) {
				if(this.getColumnPosInOrder(i) !== -1) {
					this.cardsOrderByColumnIndex = i;
					break;
				}
			}
		},
		
		// user actions, generic
		blur() {
			this.focused   = false;
			this.showTable = false;
			this.$emit('blurred');
		},
		clickColumn(columnBatchIndex) {
			this.columnBatchIndexOption = this.columnBatchIndexOption === columnBatchIndex
				? -1 : columnBatchIndex;
		},
		clickOpen(row,middleClick) {
			if(this.hasUpdate)
				this.$emit('open-form',[row],middleClick);
		},
		clickOnEmpty() {
			this.$emit('close-inline');
		},
		clickInputEmpty() {
			if(!this.inputIsReadonly)
				this.toggleDropdown();
		},
		clickInputRow() {
			if(!this.inputAsCategory && !this.showInputAddLine && !this.inputIsReadonly)
				this.toggleDropdown();
		},
		clickRow(row,middleClick) {
			if(!this.isInput)
				return this.clickOpen(row,middleClick);
			
			const recordId = row.indexRecordIds['0'];
			
			if(!this.inputAsCategory) {
				if(!this.inputRecordIds.includes(recordId)) {
					if(this.inputMulti) this.rowsInput.push(row);
					else                this.rowsInput = [row];
				}
				this.showTable    = false;
				this.filtersQuick = '';
			}
			this.toggleRecordId(recordId,middleClick);
		},
		clickRowAll() {
			for(let r of this.rows) {
				this.clickRow(r,false);
			}
		},
		escape() {
			if(this.isInput) {
				this.blur();
				this.showTable = false;
			}
		},
		focus() {
			if(!this.inputIsReadonly && this.isInput && !this.inputAsCategory && !this.showTable) {
				this.focused      = true;
				this.filtersQuick = '';
				this.$emit('focused');
			}
		},
		keyDown(e) {
			let focusTarget = null;
			let arrow       = false;
			
			switch(e.code) {
				case 'ArrowDown':  arrow = true; focusTarget = e.target.nextElementSibling;     break;
				case 'ArrowLeft':  arrow = true; focusTarget = e.target.previousElementSibling; break;
				case 'ArrowRight': arrow = true; focusTarget = e.target.nextElementSibling;     break;
				case 'ArrowUp':    arrow = true; focusTarget = e.target.previousElementSibling; break;
				case 'Escape':     e.preventDefault(); this.escape(); break;
			}
			
			// arrow key used and tab focus target is available
			if(arrow && focusTarget !== null && focusTarget.tabIndex !== -1) {
				e.preventDefault();
				return focusTarget.focus();
			}
			
			// arrow key used in regular list input
			if(arrow && this.isInput && !this.inputAsCategory) {
				
				// show dropdown
				if(!this.showTable) {
					e.preventDefault();
					return this.toggleDropdown();
				}
				
				// focus first/last input element
				if(this.showTable && this.rows.length !== 0) {
					e.preventDefault();
					
					if(e.target !== this.$refs[this.refTabindex+'0'][0])
						return this.$refs[this.refTabindex+'0'][0].focus();
					
					return this.$refs[this.refTabindex+String(this.rows.length-1)][0].focus();
				}
			}
		},
		setAggregators(columnId,aggregator) {
			if(aggregator !== null) this.columnIdMapAggr[columnId] = aggregator;
			else                    delete(this.columnIdMapAggr[columnId]);
			
			this.fieldOptionSet(this.fieldId,'columnIdMapAggr',this.columnIdMapAggr);
			this.$refs.aggregations.get();
		},
		setAutoRenewTimer(justClear) {
			// clear last timer
			if(this.autoRenewTimer !== null)
				clearInterval(this.autoRenewTimer);
			
			if(justClear)
				return;
			
			if(this.autoRenewInput < 10)
				this.autoRenewInput = 10;
			
			// set new timer
			this.autoRenewInputLast = this.autoRenewInput;
			this.autoRenewTimer = setInterval(this.get,this.autoRenewInput * 1000);
			
			// store timer option for field
			this.fieldOptionSet(this.fieldId,'autoRenew',this.autoRenewInput);
		},
		setOrder(columnBatch,directionAsc) {
			// remove initial sorting when changing anything
			if(!this.orderOverwritten)
				this.orders = [];
			
			const pos = this.getColumnPosInOrder(columnBatch.columnIndexSortBy);
			
			// remove sort if direction null or same sort option was chosen
			if(pos !== -1 && (directionAsc === null || this.orders[pos].ascending === directionAsc)) {
				this.orders.splice(pos,1);
			}
			else {
				if(pos === -1) {
					// add new sort
					const col = this.columns[columnBatch.columnIndexSortBy];
					if(col.subQuery) {
						this.orders.push({
							expressionPos:columnBatch.columnIndexSortBy, // equal to expression index
							ascending:directionAsc
						});
					}
					else {
						this.orders.push({
							attributeId:col.attributeId,
							index:col.index,
							ascending:directionAsc
						});
					}
				}
				else if(this.orders[pos].ascending !== directionAsc) {
					// overwrite sort direction
					this.orders[pos].ascending = directionAsc;
				}
			}
			this.reloadInside('order');
		},
		toggleDropdown() {
			this.showTable = !this.showTable;
			
			if(this.showTable) {
				this.filtersQuick = '';
				this.reloadInside('dropdown');
				
				const inputEl = this.$refs.content.querySelector('[data-is-input="1"]');
				if(inputEl !== null)
					inputEl.focus();
			}
		},
		toggleUserFilters() {
			this.showFilters = !this.showFilters;
		},
		toggleRecordId(id,middleClick) {
			if(this.inputRecordIds.includes(id))
				this.$emit('record-removed',id);
			else
				this.$emit('record-selected',id,middleClick);
		},
		updatedTextInput(event) {
			if(event.code === 'Tab' || event.code === 'Escape')
				return;
			
			// any input opens table (dropdown) if not open already
			if(!this.showTable) {
				this.showTable = true;
				this.reloadInside('dropdown');
			}
			else if(event.code === 'Enter') {
				
				// if open already, enter can select first result
				if(this.rows.length !== 0)
					this.clickRow(this.rows[0],false);
				
				this.showTable = false;
			}
			else if(event.code !== 'Escape') {
				
				// table already open, no enter/escape -> reload
				this.reloadInside('dropdown');
			}
		},
		updatedFilterQuick() {
			if(this.isInput && !this.showTable)
				this.showTable = true;
			
			this.reloadInside('filtersQuick');
		},
		
		// user actions, cards layout
		cardsSetOrderBy(columnIndexSortByString) {
			const columnIndexSortBy = parseInt(columnIndexSortByString);
			this.orders = [];
			
			if(columnIndexSortBy !== -1) {
				const col = this.columns[columnIndexSortBy];
				if(col.subQuery) {
					this.orders.push({
						expressionPos:columnIndexSortBy, // equal to expression index
						ascending:true
					});
				}
				else {
					this.orders.push({
						attributeId:col.attributeId,
						index:col.index,
						ascending:true
					});
				}
			}
			this.reloadInside('order');
		},
		cardsToggleOrderBy() {
			this.orders[0].ascending = !this.orders[0].ascending;
			this.reloadInside('order');
		},
		
		// user actions, inputs
		inputTriggerRow(row) {
			if(this.inputAsCategory && !this.inputIsReadonly)
				this.toggleRecordId(row.indexRecordIds['0'],false);
			
			this.focus();
		},
		inputTriggerRowRemove(i) {
			this.$emit('record-removed',this.rowsInput[i].indexRecordIds['0']);
			this.rowsInput.splice(i,1);
			this.blur();
		},
		
		// bulk selection
		selectRow(rowIndex) {
			let pos = this.selectedRows.indexOf(rowIndex);
			if(pos === -1) this.selectedRows.push(rowIndex);
			else           this.selectedRows.splice(pos,1);
		},
		selectReset() {
			this.selectedRows = [];
		},
		selectRowsAllToggle() {
			if(this.rows.length === this.selectedRows.length) {
				this.selectedRows = [];
				return;
			}
			
			this.selectedRows = [];
			for(let i = 0, j = this.rows.length; i < j; i++) {
				this.selectedRows.push(i);
			}
		},
		selectRowsBulkEdit(rowIndexes) {
			let rows = [];
			for(let rowIndex of rowIndexes) {
				rows.push(this.rows[rowIndex]);
			}
			if(this.hasUpdateBulk && rows.length !== 0)
				this.$emit('open-form-bulk',rows,false);
		},
		
		// helpers
		getColumnBatchSortPos(columnBatch) {
			return !this.orderOverwritten
				? -1 : this.getColumnPosInOrder(columnBatch.columnIndexSortBy);
		},
		getColumnPosInOrder(columnIndex) {
			if(columnIndex === -1)
				return -1;
			
			let col = this.columns[columnIndex];
			for(let i = 0, j = this.orders.length; i < j; i++) {
				
				if(col.subQuery) {
					if(this.orders[i].expressionPos === columnIndex)
						return i;
					
					continue;
				}
				
				if(this.orders[i].attributeId === col.attributeId
					&& this.orders[i].index === col.index) {
					
					return i;
				}
			}
			return -1;
		},
		
		// backend calls
		delAsk(rowIndexes) {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png',
					params:[rowIndexes]
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del(rowIndexes) {
			let requests = [];
			for(let j of this.joins) {
				if(!j.applyDelete)
					continue;
				
				// specific rows selected
				for(let rowIndex of rowIndexes) {
					let r = this.rows[rowIndex];
					
					if(r.indexRecordIds[j.index] === 0)
						continue;
					
					requests.push(ws.prepare('data','del',{
						relationId:j.relationId,
						recordId:r.indexRecordIds[j.index]
					}));
				}
			}
			ws.sendMultiple(requests,true).then(
				this.get,
				this.$root.genericError
			);
		},
		get() {
			// do nothing if nothing is shown, form is loading or list is in a non-visible tab
			if(!this.showTable || this.formLoading || this.isHidden)
				return;
			
			// fix invalid offset (can occur when limit is changed)
			if(this.offset !== 0 && this.offset % this.limit !== 0)
				this.offset -= this.offset % this.limit;
			
			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.relationsJoined,
				expressions:this.expressions,
				filters:this.filtersCombined,
				orders:this.orders,
				limit:this.limit,
				offset:this.offset
			},true).then(
				res => {
					const count = res.payload.count;
					this.rowsFetching = true;
					
					this.getRowsDecrypted(res.payload.rows,this.expressions).then(
						rows => {
							this.count        = count;
							this.rows         = rows;
							this.rowsFetching = false;
							this.selectReset();
							
							this.$emit('record-count-change',this.count);
							
							// update aggregations as well
							if(typeof this.$refs.aggregations !== 'undefined')
								this.$refs.aggregations.get();
							
							if(this.isInput) {
								this.$nextTick(this.updateDropdownDirection);
							} else {
								this.fieldOptionSet(this.fieldId,'filtersColumn',this.filtersColumn);
								this.fieldOptionSet(this.fieldId,'filtersQuick',this.filtersQuick);
								this.fieldOptionSet(this.fieldId,'filtersUser',this.filtersUser);
							}
						},
						this.consoleError
					);
					
				},
				this.$root.genericError
			);
		},
		getInput() {
			// nothing to get if form is currently loading
			if(this.formLoading)
				return;
			
			// reload record representation
			// must happen even if no GET is executed (clear inputs)
			this.rowsInput = [];    // clear input rows
			this.showTable = false; // if list is reloaded, close dropdown
			
			// for inputs we only need data if:
			// * field is category input (always shows everything)
			// * auto select is active
			// * input has records to get data for
			if(!this.inputAsCategory && !this.autoSelect && !this.anyInputRows)
				return;
			
			// apply existing filters, except user filters (not relevant here)
			let filters = JSON.parse(JSON.stringify(this.filters));
			if(!this.inputAsCategory && this.anyInputRows)
				filters.push(this.getQueryAttributesPkFilter(
					this.query.relationId,this.inputRecordIds,0,false
				));
			
			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.relationsJoined,
				expressions:this.expressions,
				filters:filters,
				orders:this.orders
			},false).then(
				res => {
					// apply results to input rows if input is category or specific record IDs were retrieved
					if(this.inputAsCategory || this.anyInputRows)
						this.getRowsDecrypted(res.payload.rows,this.expressions).then(
							rows => this.rowsInput = rows,
							this.consoleError
						);
					
					// remove invalid records (due to field filters)
					let recordIdsValid = [];
					let recordsRemoved = 0;
					for(let i = 0, j = res.payload.rows.length; i < j; i++) {
						recordIdsValid.push(res.payload.rows[i].indexRecordIds['0']);
					}
					
					for(let i = 0, j = this.inputRecordIds.length; i < j; i++) {
						if(!recordIdsValid.includes(this.inputRecordIds[i])) {
							this.$emit('record-removed',this.inputRecordIds[i]);
							recordsRemoved++;
						}
					}
					
					// auto-selection of records
					// only if nothing was selected or entire selection was invalid
					if(this.autoSelect && (this.inputRecordIds.length - recordsRemoved) === 0) {
						
						// select first/last X records
						let ids = [];
						if(this.inputAutoSelect > 0) {
							for(let i = 0; i < this.inputAutoSelect; i++) {
								if(res.payload.rows.length - 1 < i)
									break;
								
								ids.push(res.payload.rows[i].indexRecordIds['0']);
							}
						}
						else {
							for(let i = 0; i > this.inputAutoSelect; i--) {
								if(res.payload.rows.length - 1 + i < 0)
									break;
								
								ids.push(res.payload.rows[res.payload.rows.length - 1 + i].indexRecordIds['0']);
							}
						}
						if(ids.length !== 0)
							this.$emit('records-selected-init',this.inputMulti ? ids : ids[0]);
						
						this.inputAutoSelectDone = true;
					}
				},
				this.$root.genericError
			);
		}
	}
};