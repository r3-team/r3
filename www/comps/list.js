import MyFilters                   from './filters.js';
import MyForm                      from './form.js';
import MyInputCollection           from './inputCollection.js';
import MyInputOffset               from './inputOffset.js';
import MyListAggregate             from './listAggregate.js';
import MyListColumnBatch           from './listColumnBatch.js';
import MyListCsv                   from './listCsv.js';
import MyListFilters               from './listFilters.js';
import MyListInputFlow             from './listInputFlow.js';
import MyListInputRows             from './listInputRows.js';
import MyListInputRowsEmpty        from './listInputRowsEmpty.js';
import MyListOptions               from './listOptions.js';
import {consoleError}              from './shared/error.js';
import {getRowsDecrypted}          from './shared/form.js';
import {getCaption}                from './shared/language.js';
import {layoutSettleSpace}         from './shared/layout.js';
import {isAttributeTextSearchable} from './shared/attribute.js';
import {
	getColumnBatches,
	getColumnTitle,
	getOrderIndexesFromColumnBatch
} from './shared/column.js';
import {
	checkDataOptions,
	colorAdjustBg,
	colorMakeContrastFont,
	deepIsEqual
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

export default {
	name:'my-list',
	components:{
		MyFilters,
		MyInputCollection,
		MyInputOffset,
		MyListAggregate,
		MyListColumnBatch,
		MyListCsv,
		MyListFilters,
		MyListInputFlow,
		MyListInputRows,
		MyListInputRowsEmpty,
		MyListOptions
	},
	template:`<div class="list" ref="content"
		@keydown="handleKeydownLocal"
		:class="{ asInput:isInput, readonly:inputIsReadonly, isDynamicSize:isDynamicSize, isSingleField:isSingleField }"
	>
		<!-- hover menus -->
		<div class="app-sub-window"
			v-if="showHover"
			@click.self.stop="closeHover"
			:class="{'under-header':!isMobile}"
		>
			<div class="contentBox float scroll" :class="{ 'list-csv':showCsv, 'list-filters-wrap':showFilters, 'list-options':showOptions }">
				<div class="top lower">
					<div class="area">
						<img class="icon" :src="hoverIconSrc" />
						<div class="caption">{{ hoverCaption }}</div>
					</div>
					<my-button image="cancel.png"
						@trigger="closeHover"
						:blockBubble="true"
						:cancel="true"
					/>
				</div>
				<div class="content grow default-inputs" :class="{ 'no-padding':showOptions }">
					<my-list-csv
						v-if="showCsv"
						@reload="get"
						:columns="columns"
						:columnBatches="columnBatches"
						:filters="filtersCombined"
						:isExport="csvExport"
						:isImport="csvImport"
						:joins="relationsJoined"
						:orders="orders"
						:query="query"
					/>
					<my-list-filters
						v-if="showFilters"
						@set-filters="setUserFilters"
						:columns="columnsAll"
						:columnBatches="columnBatchesAll"
						:filters="filtersUser"
						:joins="joins"
					/>
					<my-list-options
						v-if="showOptions"
						@reset-columns="resetColumns"
						@set-auto-renew="setAutoRenewTimer"
						@set-cards-captions="setLoginOption('cardsCaptions',$event)"
						@set-column-batch-sort="setColumnBatchSort"
						@set-column-ids-by-user="$emit('set-column-ids-by-user',$event)"
						@set-layout="setLoginOption('layout',$event)"
						@set-page-limit="setLoginOption('limit',$event)"
						:autoRenew="autoRenew"
						:cardsCaptions="cardsCaptions"
						:columns="columns"
						:columnsAll="columnsAll"
						:columnBatches="columnBatches"
						:columnBatchSort="columnBatchSort"
						:csvImport="csvImport"
						:hasPaging="hasPaging"
						:layout="layout"
						:limitDefault="limitDefault"
						:moduleId="moduleId"
						:pageLimit="limit"
					/>
				</div>
			</div>
		</div>
		
		<!-- list as input field (showing record(s) from active field value) -->
		<my-list-input-flow
			v-if="isInput && inputAsFlow"
			@clicked-open="clickOpen($event,false)"
			@clicked-open-middle="clickOpen($event,true)"
			@clicked-row="inputTriggerRow($event)"
			:columns="columns"
			:columnBatches="columnBatches"
			:readonly="inputIsReadonly"
			:recordIdsSelected="inputRecordIds"
			:rows="rowsInput"
			:showOpen="hasUpdate"
		>
			<template #input-icon><slot name="input-icon" /></template>
		</my-list-input-flow>

		<my-list-input-rows
			v-if="isInput && !inputAsFlow"
			@clicked="clickInputRow"
			@clicked-open="clickOpen($event,false)"
			@clicked-open-middle="clickOpen($event,true)"
			@clicked-row="inputTriggerRow($event)"
			@clicked-row-remove="inputTriggerRowRemove($event)"
			@focus="focus"
			:columns="columns"
			:columnBatches="columnBatches"
			:hasGalleryIcon="hasGalleryIcon"
			:multiInput="inputMulti"
			:readonly="inputIsReadonly"
			:recordIdsSelected="inputRecordIds"
			:rows="rowsInput"
			:showAllValues="showAllValues"
			:showOpen="hasUpdate"
		>
			<template #input-icon><slot name="input-icon" /></template>
		</my-list-input-rows>

		<my-list-input-rows-empty
			v-if="isInput && showInputAddLine"
			@clicked="clickInputEmpty"
			@clicked-open="escape();$emit('open-form',[],false)"
			@clicked-open-middle="escape();$emit('open-form',[],true)"
			@focus="focus"
			@key-pressed="updatedTextInput"
			@text-updated="filtersQuick = $event"
			:anyRows="anyInputRows"
			:focused="focused"
			:readonly="inputIsReadonly"
			:showCreate="hasCreate"
			:text="filtersQuick"
			:valid="inputValid"
		>
			<template #input-icon><slot name="input-icon" /></template>
		</my-list-input-rows-empty>
		
		<!-- regular list view (either view or input dropdown) -->
		<template v-if="!isInput || (dropdownShow && !showAllValues)">
			
			<!-- list header -->
			<div class="list-header" v-if="header && showHeader" :class="{ 'no-column-titles':!headerColumns }">
				
				<div class="row gap nowrap">
					<slot name="input-icon" />
					
					<!-- record actions -->
					<my-button image="new.png"
						v-if="hasCreate"
						@trigger="$emit('open-form',[],false)"
						@trigger-middle="$emit('open-form',[],true)"
						:caption="showActionTitles ? capGen.button.new : ''"
						:captionTitle="capGen.button.newHint"
					/>
					<my-button image="edit.png"
						v-if="hasUpdateBulk && (selectedRows.length !== 0 || headerElements.includes('actionsReadonly'))"
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
						v-if="hasDeleteAny && (selectedRows.length !== 0 || headerElements.includes('actionsReadonly'))"
						@trigger="delAsk(selectedRows)"
						:active="selectedRows.length !== 0"
						:cancel="true"
						:caption="showActionTitles ? capGen.button.delete : ''"
						:captionTitle="capGen.button.deleteHint"
					/>
				</div>
				
				<!-- empty element for header collapse calculation -->
				<div ref="empty" class="empty"></div>
				
				<div class="row gap nowrap centered list-header-title" v-if="showTitle">
					<span v-if="caption !== ''">{{ caption }}</span>
				</div>
				
				<div class="row gap nowrap">
					<my-input-offset
						v-if="hasPaging"
						@input="setOffsetParamAndReload($event,true)"
						:arrows="showOffsetArrows"
						:caption="showResultsCount && count > 1"
						:limit="limit"
						:offset="offset"
						:total="count"
					/>
				</div>
				
				<div class="row gap nowrap default-inputs">
					<my-button
						v-if="showRefresh"
						@trigger="get"
						:active="!rowsFetching"
						:captionTitle="capGen.button.refresh"
						:image="rowsFetching ? 'load.gif' : (autoRenew === -1 ? 'refresh.png' : 'autoRenew.png')"
						:naked="true"
					/>
					
					<my-button image="filterCog.png"
						v-if="headerActions"
						@trigger="showFilters = !showFilters"
						@trigger-right="setUserFilters([])"
						:caption="filtersUser.length !== 0 ? String(filtersUser.length) : ''"
						:captionTitle="capGen.button.filterHint"
						:naked="true"
					/>
					
					<input autocomplete="off" class="short" enterkeyhint="send" type="text"
						v-if="filterQuick"
						@keyup.enter="updatedFilterQuick"
						v-model="filtersQuick"
						:placeholder="capGen.threeDots"
						:title="capApp.quick"
					/>
					
					<my-input-collection
						v-for="c in collections"
						@update:modelValue="$emit('set-collection-indexes',c.collectionId,$event);resized()"
						:collectionId="c.collectionId"
						:columnIdDisplay="c.columnIdDisplay"
						:key="c.collectionId"
						:modelValue="collectionIdMapIndexes[c.collectionId]"
						:multiValue="c.flags.includes('multiValue')"
						:previewCount="showCollectionCnt"
						:showTitle="showCollectionTitles"
					/>
					
					<select class="dynamic"
						v-if="hasChoices"
						@change="setLoginOption('choiceId',$event.target.value)"
						:disabled="rowsFetching"
						:value="choiceId"
					>
						<option v-for="c in query.choices" :value="c.id">
							{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
						</option>
					</select>
					
					<my-button image="listCog.png"
						v-if="headerActions"
						@trigger="showOptions = !showOptions"
						:captionTitle="capGen.options"
						:naked="true"
					/>
					<my-button image="toggleUp.png"
						v-if="!isCards && headerActions && headerElements.includes('headerCollapse')"
						@trigger="toggleHeader"
						:captionTitle="capApp.button.collapseHeader"
						:naked="true"
					/>
				</div>
			</div>
			
			<!-- list content -->
			<div class="list-content" :class="{ showsInlineForm:popUpFormInline !== null }" :id="usesPageHistory ? scrollFormId : null">
			
				<!-- list results as table or card layout -->
				<teleport to="#dropdown" :disabled="!dropdownShow">
					<div
						@keydown="handleKeydownLocal"
						:class="{ 'list-cards':isCards, 'list-table':isTable, 'list-dropdown':dropdownShow, rowsColored:settings.listColored, scrolls:isSingleField}"
					>
						<table v-if="isTable" :class="{ asInput:isInput }">
							<thead v-if="header && headerColumns">
								<tr :class="{ atTop:!showHeader }">
									<th v-if="hasBulkActions" class="minimum checkbox">
										<img class="clickable" tabindex="0"
											@click="selectRowsAllToggle"
											@keyup.enter.space.stop="selectRowsAllToggle"
											:src="rows.length !== 0 && selectedRows.length === rows.length ? 'images/checkboxSmall1.png' : 'images/checkboxSmall0.png'"
										/>
									</th>
									<th v-for="(b,i) in columnBatches" :style="b.style">
										<my-list-column-batch
											@del-aggregator="setAggregators"
											@del-order="setOrder(b,null,false)"
											@set-aggregator="setAggregators"
											@set-filters="setLoginOption('filtersColumn',$event)"
											@set-order="setOrder(b,$event,false)"
											@set-order-only="setOrder(b,$event,true)"
											:columnBatch="b"
											:columnIdMapAggr="columnIdMapAggr"
											:columns="columns"
											:filters="filtersCombined"
											:filtersColumn="filtersColumn"
											:isOrderedOrginal="isOrderedOrginal"
											:joins="relationsJoined"
											:key="b.key"
											:orders="orders"
											:relationId="query.relationId"
											:rowCount="count"
											:simpleSortOnly="columnsSortOnly"
										/>
									</th>
									<!-- empty column for taking remaining space & header toggle action -->
									<th>
										<div class="headerToggle" v-if="!showHeader">
											<my-button image="toggleDown.png"
												@trigger="toggleHeader"
												:captionTitle="capApp.button.collapseHeader"
												:naked="true"
											/>
										</div>
									</th>
								</tr>
							</thead>
							<tbody>
								<!-- result row actions (only available if list is input) -->
								<tr v-if="showInputHeader" class="list-input-row-actions">
									<td colspan="999" class="sub-actions-wrap">
										<div class="sub-actions default-inputs">
											<select
												v-if="hasChoices"
												@change="setLoginOption('choiceId',$event.target.value)"
												:value="choiceId"
											>
												<option v-for="c in query.choices" :value="c.id">
													{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
												</option>
											</select>
											
											<my-input-offset
												@input="setOffsetParamAndReload($event,true)"
												:caption="false"
												:limit="limit"
												:offset="offset"
												:total="count"
											/>
											
											<input autocomplete="off" class="short" enterkeyhint="send" type="text"
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
									@click.ctrl.exact="clickRow(r,true)"
									@click.left.exact="clickRow(r,false)"
									@click.middle.exact="clickRow(r,true)"
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
									<td v-for="b in columnBatches">
										<div class="columnBatch"
											:class="{ colored:b.columnIndexColor !== -1, vertical:b.vertical }"
											:style="b.columnIndexColor === -1 ? '' : displayColorColumn(r.values[b.columnIndexColor])"
										>
											<my-value-rich
												v-for="ind in b.columnIndexes.filter(v => v !== b.columnIndexColor && r.values[v] !== null)"
												@clipboard="$emit('clipboard')"
												:alignEnd="columns[ind].flags.alignEnd"
												:alignMid="columns[ind].flags.alignMid"
												:attributeId="columns[ind].attributeId"
												:basis="columns[ind].basis"
												:bold="columns[ind].flags.bold"
												:boolAtrIcon="columns[ind].flags.boolAtrIcon"
												:clipboard="columns[ind].flags.clipboard"
												:display="columns[ind].display"
												:italic="columns[ind].flags.italic"
												:key="ind"
												:length="columns[ind].length"
												:monospace="columns[ind].flags.monospace"
												:noShrink="columns[ind].flags.noShrink"
												:noThousandsSep="columns[ind].flags.noThousandsSep"
												:previewLarge="columns[ind].flags.previewLarge"
												:value="r.values[ind]"
												:wrap="columns[ind].flags.wrap"
											/>
										</div>
									</td>
									<!-- empty column for taking remaining space -->
									<td></td>
								</tr>
								
								<!-- no results message -->
								<tr v-if="rows.length === 0">
									<td v-if="rowsFetching" colspan="999">
										<my-label image="load.gif" :caption="capApp.fetching" />
									</td>
									<td v-if="!rowsFetching" colspan="999">
										<div class="columnBatch">{{ capGen.resultsNone }}</div>
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
					
						<div class="empty-space"
							v-if="isTable"
							@click="clickOnEmpty"
						></div>
						
						<!-- list results as cards -->
						<template v-if="isCards">
						
							<!-- actions -->
							<div class="list-cards-actions default-inputs" v-if="hasResults" :class="{ atTop:!showHeader }">
								<div class="row centered">
									<my-button
										v-if="hasBulkActions"
										@trigger="selectRowsAllToggle"
										:caption="capApp.button.all"
										:captionTitle="capApp.button.allHint"
										:image="rows.length !== 0 && selectedRows.length === rows.length ? 'checkbox1.png' : 'checkbox0.png'"
										:naked="true"
									/>
								</div>
								
								<div class="row centered">
									<!-- sorting -->
									<template v-if="hasResults">
										<span class="select">{{ capApp.orderBy }}</span>
										<select @change="cardsSetOrderBy($event.target.value)" :value="cardsOrderByColumnBatchIndex">
											<option value="-1">-</option>
											<option v-for="(b,i) in columnBatches" :value="i">{{ b.caption }}</option>
										</select>	
										<my-button
											v-if="cardsOrderByColumnBatchIndex !== -1"
											@trigger="cardsToggleOrderBy"
											:image="orders[0].ascending ? 'triangleUp.png' : 'triangleDown.png'"
											:naked="true"
										/>
									</template>
								</div>
								
								<div class="row centered">
									<my-button image="toggleDown.png"
										v-if="!showHeader"
										@trigger="toggleHeader"
										:naked="true"
									/>
								</div>
							</div>
							
							<div class="list-cards-entries" @click="clickOnEmpty" :id="usesPageHistory ? scrollFormId : null">
								
								<!-- no results message -->
								<template v-if="!hasResults">
									<div class="list-cards-entry no-results" v-if="!rowsFetching">
										{{ capGen.resultsNone }}
									</div>
									<div class="list-cards-entry no-results" v-if="rowsFetching">
										<my-label image="load.gif" :caption="capApp.fetching" />
									</div>
								</template>
								
								<div class="list-cards-entry"
									v-for="(r,ri) in rowsClear"
									@click.ctrl.exact.stop="clickRow(r,true)"
									@click.left.stop.exact="clickRow(r,false)"
									@click.middle.exact.stop="clickRow(r,true)"
									@keyup.enter.space.stop="clickRow(r,false)"
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
									
									<!-- row values per column batch -->
									<table>
										<tbody>
											<tr v-for="b in columnBatches">
												<td class="caption" v-if="cardsCaptions">{{ b.caption }}</td>
												<td>
													<div class="columnBatch listCards" :class="{ vertical:b.vertical }">
														<my-value-rich
															v-for="ind in b.columnIndexes.filter(v => r.values[v] !== null)"
															@clipboard="$emit('clipboard')"
															:alignEnd="columns[ind].flags.alignEnd"
															:alignMid="columns[ind].flags.alignMid"
															:attributeId="columns[ind].attributeId"
															:basis="columns[ind].basis"
															:bold="columns[ind].flags.bold"
															:boolAtrIcon="columns[ind].flags.boolAtrIcon"
															:clipboard="columns[ind].flags.clipboard"
															:display="columns[ind].display"
															:italic="columns[ind].flags.italic"
															:key="ind"
															:length="columns[ind].length"
															:monospace="columns[ind].flags.monospace"
															:noShrink="columns[ind].flags.noShrink"
															:noThousandsSep="columns[ind].flags.noThousandsSep"
															:previewLarge="columns[ind].flags.previewLarge"
															:value="r.values[ind]"
															:wrap="columns[ind].flags.wrap"
														/>
													</div>
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</template>
					</div>
				</teleport>
				
				<!-- inline form -->
				<my-form class="inline list-inline-form"
					v-if="popUpFormInline !== null"
					@close="$emit('close-inline')"
					@refresh-parent="get"
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
		autoRenewDefault:{ required:false, default:null },                   // default for list refresh (number in seconds)
		caption:         { type:String,  required:false, default:'' },       // caption to display in list header
		choices:         { type:Array,   required:false, default:() => [] }, // processed query choices
		collections:     { type:Array,   required:false, default:() => [] }, // consumed collections to filter by user input
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		columns:         { type:Array,   required:true },                    // list columns, processed (applied filter values, only columns shown by user choice)
		columnsAll:      { type:Array,   required:false, default:() => [] }, // list columns, all
		dataOptions:     { type:Number,  required:false, default:0 },        // data permissions following form states
		filters:         { type:Array,   required:true },                    // processed query filters
		filtersInput:    { type:Array,   required:false, default:() => [] }, // processed query filters relevant for input lookup
		layoutDefault:   { type:String,  required:false, default:'table' },  // default list layout: table, cards
		limitDefault:    { type:Number,  required:false, default:10 },       // default list limit
		loginOptions:    { type:Object,  required:true },
		moduleId:        { type:String,  required:true },
		popUpFormInline: { required:false, default:null },                   // form to show inside list
		query:           { type:Object,  required:true },                    // list query
		
		// toggles
		blockDuringLoad:{ type:Boolean, required:false, default:true },  // list blocks user input during data retrieval
		columnsSortOnly:{ type:Boolean, required:false, default:false }, // list columns can only be sorted, not filtered or aggregated
		csvExport:      { type:Boolean, required:false, default:false },
		csvImport:      { type:Boolean, required:false, default:false },
		dropdownShow:   { type:Boolean, required:false, default:false },
		filterQuick:    { type:Boolean, required:false, default:false }, // enable quick filter
		formLoading:    { type:Boolean, required:false, default:false }, // control list reloads
		hasOpenForm:    { type:Boolean, required:false, default:false }, // list can open record in form
		hasOpenFormBulk:{ type:Boolean, required:false, default:false }, // list can open records in bulk form
		header:         { type:Boolean, required:false, default:true  }, // show list header
		headerActions:  { type:Boolean, required:false, default:true  }, // show list header actions (complex filters, list options, header collapse)
		headerColumns:  { type:Boolean, required:false, default:true  }, // show list column headers
		isDynamicSize:  { type:Boolean, required:false, default:false }, // list does not have minimum fixed height
		isInput:        { type:Boolean, required:false, default:false }, // list is used as input
		isHidden:       { type:Boolean, required:false, default:false }, // list is not visible and therefore not loaded/updated
		isSingleField:  { type:Boolean, required:false, default:false }, // list is single field within a parent (form/tab - not container!)
		loadWhileHidden:{ type:Boolean, required:false, default:false },
		usesPageHistory:{ type:Boolean, required:false, default:false }, // list uses page getters for filtering/sorting/etc.
		
		// list as input field
		inputAsCategory:{ type:Boolean, required:false, default:false },    // input is category selector (all records are shown, active ones are checked off)
		inputAsFlow:    { type:Boolean, required:false, default:false },    // input is a flow selector (all records are shown, all records up to, and incl. the selected one, are marked)
		inputAutoSelect:{ type:Number,  required:false, default:0 },        // # of records to auto select (2 = first two, -3 = last three, 0 = none)
		inputIsNew:     { type:Boolean, required:false, default:false },    // input field belongs to new record
		inputIsReadonly:{ type:Boolean, required:false, default:false },    // input field is readonly
		inputMulti:     { type:Boolean, required:false, default:false },    // input has multiple records to represent (instead of just one)
		inputRecordIds: { type:Array,   required:false, default:() => [] }, // input record IDs, representing active values to show
		inputValid:     { type:Boolean, required:false, default:true }
	},
	emits:[
		'clipboard','close-inline','dropdown-show','open-form','open-form-bulk',
		'record-count-change','record-removed','records-selected','records-selected-init',
		'set-args','set-column-ids-by-user','set-collection-indexes','set-login-option'
	],
	data() {
		return {
			// state
			autoRenewTimer:null,        // interval timer for auto renew
			cardsOrderByColumnBatchIndex:-1,
			filtersQuick:'',            // current user quick text filter
			focused:false,
			inputAutoSelectDone:false,
			rowsFetching:false,         // row values are being fetched
			selectedRows:[],            // bulk selected rows by row index
			showCsv:false,              // show UI for CSV import/export
			showFilters:false,          // show UI for user filters
			showOptions:false,          // show UI for list options
			
			// constants
			refTabindex:'input_row_', // prefix for vue references to tabindex elements
			
			// header
			headerCheckTimer:null,
			headerElements:[],               // elements that are shown, based on available space
			headerElementsAvailableInOrder:[ // elements that can be shown, in order of priority
				'collectionValuesAll',       // optional, show all collection filter values
				'collectionValuesFew',       // optional, show few collection filter values
				'listTitle',                 // optional
				'actionTitles',              // optional
				'refresh',                   // optional
				'offsetArrows',              // optional
				'collectionTitles',          // optional, show collection titles
				'headerCollapse',            // optional
				'actionsReadonly',           // optional
				'resultsCount'               // not important
			],
			
			// data
			count:0,     // total result set count
			offset:0,    // result offset
			rows:[],     // result set
			rowsInput:[] // rows that reflect current input (following active record IDs)
			             // as opposed to list rows which show lookup data (regular list or input dropdown)
		};
	},
	computed:{
		filtersCombined:(s) => {
			// already encapsulated filters: list, choice, quick, column
			let filters = s.filters
				.concat(s.filtersColumn)
				.concat(s.filtersQuickParsed)
				.concat(s.getFiltersEncapsulated(
					JSON.parse(JSON.stringify(s.filtersUser))
				));
			
			// remove IDs from input in result set if it´s an input
			if(s.anyInputRows)
				filters.push(s.getQueryAttributesPkFilter(
					s.query.relationId,s.inputRecordIds,0,true
				));
			
			return filters;
		},
		hasDeleteAny:(s) => {
			if(!s.checkDataOptions(1,s.dataOptions))
				return false;

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
		hoverCaption:(s) => {
			if     (s.showCsv)     return s.capApp.button.csv;
			else if(s.showFilters) return s.capGen.button.filterHint;
			else if(s.showOptions) return s.capGen.options;
			return '';
		},
		hoverIconSrc:(s) => {
			if     (s.showCsv)     return 'images/fileSheet.png';
			else if(s.showFilters) return 'images/filterCog.png';
			else if(s.showOptions) return 'images/listCog.png';
			return '';
		},
		pageCount:(s) => {
			if(s.count === 0) return 0;
			
			const cnt = Math.floor(s.count / s.limit);
			return s.count % s.limit !== 0 ? cnt+1 : cnt;
		},

		// filters
		filtersQuickColumns:(s) => {
			let out = [];
			for(const c of s.columns) {
				const a = s.attributeIdMap[c.attributeId];
				if(s.isAttributeTextSearchable(a.content,a.contentUse) && !c.subQuery && (c.aggregator === null || c.aggregator === 'record'))
					out.push(c);
			}
			return out;
		},
		filtersQuickParsed:(s) => {
			if(s.filtersQuick === '') return [];
			
			let out = [];
			for(const c of s.filtersQuickColumns) {
				out.push({
					connector:out.length === 0 ? 'AND' : 'OR',
					index:0,
					operator:'ILIKE',
					side0:{ attributeId:c.attributeId, attributeIndex:c.index, brackets:0 },
					side1:{ brackets:0, value:s.filtersQuick }
				});
			}
			return s.getFiltersEncapsulated(out);
		},
		
		// simple
		anyInputRows:        (s) => s.inputRecordIds.length !== 0,
		autoSelect:          (s) => s.inputIsNew && s.inputAutoSelect !== 0 && !s.inputAutoSelectDone,
		columnBatches:       (s) => s.getColumnBatches(s.moduleId,s.columns,[],s.orders,s.columnBatchSort[0],true),
		columnBatchesAll:    (s) => s.getColumnBatches(s.moduleId,s.columnsAll,[],s.orders,[],true),
		expressions:         (s) => s.getQueryExpressions(s.columns),
		hasBulkActions:      (s) => !s.isInput && s.rows.length !== 0 && (s.hasUpdateBulk || s.hasDeleteAny),
		hasChoices:          (s) => s.query.choices.length > 1,
		hasCreate:           (s) => s.checkDataOptions(4,s.dataOptions) && s.joins.length !== 0 && s.joins[0].applyCreate && s.hasOpenForm,
		hasPaging:           (s) => s.query.fixedLimit === 0,
		hasResults:          (s) => s.rowsClear.length !== 0,
		hasUpdate:           (s) => s.checkDataOptions(2,s.dataOptions) && s.joins.length !== 0 && s.joins[0].applyUpdate && s.hasOpenForm,
		hasUpdateBulk:       (s) => s.checkDataOptions(2,s.dataOptions) && s.joins.length !== 0 && s.joins[0].applyUpdate && s.hasOpenFormBulk,
		isCards:             (s) => s.layout === 'cards',
		isOrderedOrginal:    (s) => s.deepIsEqual(s.query.orders,s.orders),
		isTable:             (s) => s.layout === 'table',
		joins:               (s) => s.fillRelationRecordIds(s.query.joins),
		ordersOriginal:      (s) => JSON.parse(JSON.stringify(s.query.orders)),
		relationsJoined:     (s) => s.getRelationsJoined(s.joins),
		rowSelect:           (s) => s.isInput || s.hasUpdate,
		rowsClear:           (s) => s.rows.filter(v => !s.inputRecordIds.includes(v.indexRecordIds['0'])),
		showActionTitles:    (s) => s.headerElements.includes('actionTitles'),
		showAllValues:       (s) => s.inputAsFlow || s.inputAsCategory,
		showCollectionTitles:(s) => s.headerElements.includes('collectionTitles'),
		showHover:           (s) => s.showCsv || s.showFilters || s.showOptions,
		showInputAddAll:     (s) => s.inputMulti && s.hasResults,
		showInputAddLine:    (s) => !s.showAllValues && (!s.anyInputRows || (s.inputMulti && !s.inputIsReadonly)),
		showInputHeader:     (s) => s.isInput && (s.filterQuick || s.hasChoices || s.showInputAddAll || s.offset !== 0 || s.count > s.limit),
		showOffsetArrows:    (s) => s.headerElements.includes('offsetArrows'),
		showRefresh:         (s) => s.headerElements.includes('refresh'),
		showResultsCount:    (s) => s.headerElements.includes('resultsCount'),
		showTitle:           (s) => s.headerElements.includes('listTitle'),
		showCollectionCnt:   (s) => {
			if(s.headerElements.includes('collectionValuesAll')) return 999;
			if(s.headerElements.includes('collectionValuesFew')) return 2;
			return 0;
		},

		// login options
		autoRenew:      (s) => s.$root.getOrFallback(s.loginOptions,'autoRenew',(s.autoRenewDefault === null ? -1 : s.autoRenewDefault)), // refresh list data every X seconds, -1 if disabled
		cardsCaptions:  (s) => s.$root.getOrFallback(s.loginOptions,'cardsCaptions',true),
		choiceId:       (s) => s.$root.getOrFallback(s.loginOptions,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		columnBatchSort:(s) => s.$root.getOrFallback(s.loginOptions,'columnBatchSort',[[],[]]),
		columnIdMapAggr:(s) => s.$root.getOrFallback(s.loginOptions,'columnIdMapAggr',{}),      // aggregators by column ID
		filtersColumn:  (s) => s.$root.getOrFallback(s.loginOptions,'filtersColumn',[]),        // column filters
		filtersUser:    (s) => s.$root.getOrFallback(s.loginOptions,'filtersUser',[]),          // user filters
		showHeader:     (s) => s.$root.getOrFallback(s.loginOptions,'header',true),             // show UI for list header
		limit:          (s) => s.$root.getOrFallback(s.loginOptions,'limit',s.limitDefault),    // result limit
		layout:         (s) => s.$root.getOrFallback(s.loginOptions,'layout',s.layoutDefault),  // list layout (table, cards)
		orders:         (s) => s.$root.getOrFallback(s.loginOptions,'orders',s.ordersOriginal), // order by definitions for query
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		appResized:    (s) => s.$store.getters.appResized,
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic,
		isMobile:      (s) => s.$store.getters.isMobile,
		scrollFormId:  (s) => s.$store.getters.constants.scrollFormId,
		settings:      (s) => s.$store.getters.settings
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyForm = MyForm;
	},
	mounted() {
		if(!this.isInput)
			this.resized();
		
		// setup watchers
		this.$watch('appResized',this.resized);
		this.$watch('limit',this.get);
		this.$watch('dropdownShow',v => {
			if(v) this.setOffsetAndReload(0);
			this.focusOnInput();
		});
		this.$watch('formLoading',v => {
			if(v) return;
			this.inputAutoSelectDone = false;
			this.reloadOutside();
		});
		this.$watch('isHidden',v => {
			if(v) return;
			this.reloadOutside();
			this.resized();
		});
		this.$watch('loadWhileHidden',v => {
			if(!v) return;
			this.reloadOutside();
			this.resized();
		});
		this.$watch(() => [this.filters,this.filtersColumn,this.filtersUser],(newVals,oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i])) {
					this.offset = 0;
					this.removeInvalidFilters();
					return this.reloadOutside();
				}
			}
		});
		if(!this.isInput) {
			this.$watch(() => [this.columns,this.columnsAll,this.orders],(newVals,oldVals) => {
				for(let i = 0, j = newVals.length; i < j; i++) {
					if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i])) {
						// if columns change, kill row data, otherwise content does not match columns
						this.count = 0;
						this.rows  = [];
						this.removeInvalidFilters(); // if columns change, column filters can become invalid
						this.removeInvalidOrders();
						return this.get();
					}
				}
			});
		}
		if(this.isInput && !this.showAllValues) {
			this.$watch('inputRecordIds',v => {
				// update input if record IDs are different (different count or IDs)
				// input rows are usually taken from selection, but record IDs can also be set by functions, requiring reload of these record rows
				if(v.length !== this.rowsInput.length)
					return this.getInput();
				
				for(const r of this.rowsInput) {
					if(!v.includes(r.indexRecordIds[0]))
						return this.getInput();
				}
			});
		}
		if(this.usesPageHistory) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals))
					this.paramsUpdated(true);
			});

			// load initial route parameters
			this.paramsUpdated(false);
		}

		this.setAutoRenewTimer(this.autoRenew);
		this.removeInvalidFilters();
		this.removeInvalidOrders();
	},
	beforeUnmount() {
		this.clearAutoRenewTimer();
	},
	methods:{
		// externals
		checkDataOptions,
		colorAdjustBg,
		colorMakeContrastFont,
		consoleError,
		deepIsEqual,
		fillRelationRecordIds,
		getCaption,
		getColumnBatches,
		getColumnTitle,
		getFiltersEncapsulated,
		getOrderIndexesFromColumnBatch,
		getQueryAttributesPkFilter,
		getQueryExpressions,
		getRelationsJoined,
		getRowsDecrypted,
		isAttributeTextSearchable,
		layoutSettleSpace,
		routeChangeFieldReload,
		routeParseParams,

		handleKeydownLocal(ev) {
			let focusTarget = null;
			let arrow       = false;
			
			switch(ev.code) {
				case 'ArrowDown':  arrow = true; focusTarget = ev.target.nextElementSibling;     break;
				case 'ArrowLeft':  arrow = true; focusTarget = ev.target.previousElementSibling; break;
				case 'ArrowRight': arrow = true; focusTarget = ev.target.nextElementSibling;     break;
				case 'ArrowUp':    arrow = true; focusTarget = ev.target.previousElementSibling; break;
				case 'Escape':     this.escape(ev); break;
			}

			// arrow key used and tab focus target is available
			if(arrow && focusTarget !== null && focusTarget.tabIndex !== -1) {
				ev.preventDefault();
				return focusTarget.focus();
			}
			
			// arrow key used in regular list input
			if(arrow && this.isInput && !this.showAllValues) {
				
				// show dropdown
				if(!this.dropdownShow) {
					ev.preventDefault();
					return this.$emit('dropdown-show',true);
				}
				
				// focus first/last input element
				if(this.dropdownShow && this.rows.length !== 0) {
					ev.preventDefault();

					return ev.target !== this.$refs[this.refTabindex+'0'][0]
						? this.$refs[this.refTabindex+'0'][0].focus()
						: this.$refs[this.refTabindex+String(this.rows.length-1)][0].focus();
				}
			}
		},
		
		// presentation
		displayColorColumn(color) {
			if(color === null) return '';
			
			let bg   = this.colorAdjustBg(color);
			let font = this.colorMakeContrastFont(bg);
			return `background-color:${bg};color:${font};`;
		},
		resized() {
			if(this.headerCheckTimer !== null)
				clearTimeout(this.headerCheckTimer);
			
			this.headerCheckTimer = setTimeout(() => {
				this.headerElements = JSON.parse(JSON.stringify(this.headerElementsAvailableInOrder));
				this.$nextTick(() => this.layoutSettleSpace(this.headerElements,this.$refs.empty));
			},200);
		},
		
		// reloads
		reloadAggregations(nextTick) {
			if(!this.isTable || typeof this.$refs.aggregations === 'undefined' || this.$refs.aggregations === null)
				return;

			if(nextTick) this.$nextTick(this.$refs.aggregations.get);
			else         this.$refs.aggregations.get();
		},
		reloadOutside() {
			if(this.isInput) this.getInput();
			else             this.get();
		},
		
		// parsing
		paramsUpdate(pushHistory) {
			if(this.usesPageHistory)
				this.$emit('set-args',this.offset !== 0 ? [`offset=${this.offset}`] : [],pushHistory);
		},
		paramsUpdated(reloadIfChanged) {
			let params = { offset:{ parse:'int', value:0 } };
			this.routeParseParams(params);
			
			if(this.offset !== params.offset.value) {
				this.offset = params.offset.value;

				if(reloadIfChanged)
					this.get();
			}
		},
		
		// user actions, generic
		clearAutoRenewTimer() {
			if(this.autoRenewTimer !== null)
				clearInterval(this.autoRenewTimer);
		},
		clickOpen(row,middleClick) {
			if(this.hasUpdate) {
				this.$emit('open-form',[row],middleClick);
				this.escape();
			}
		},
		clickOnEmpty() {
			this.$emit('close-inline');
		},
		clickInputEmpty() {
			if(!this.inputIsReadonly && !this.dropdownShow)
				this.$emit('dropdown-show',true);
		},
		clickInputRow() {
			if(!this.inputIsReadonly && !this.showAllValues && !this.showInputAddLine)
				this.$emit('dropdown-show',!this.dropdownShow);
		},
		clickRow(row,middleClick) {
			if(!this.isInput)
				return this.clickOpen(row,middleClick);
			
			if(this.inputMulti) this.rowsInput.push(row);
			else                this.rowsInput = [row];

			this.$emit('dropdown-show',false);
			this.filtersQuick = '';
			this.$emit('records-selected',[row.indexRecordIds['0']]);
		},
		clickRowAll() {
			let ids = [];
			for(const row of this.rows) {
				ids.push(row.indexRecordIds['0']);
			}
			this.rowsInput = this.rowsInput.concat(this.rows);
			this.filtersQuick = '';
			this.$emit('dropdown-show',false);
			this.$emit('records-selected',ids);
		},
		closeHover() {
			this.showCsv     = false;
			this.showFilters = false;
			this.showOptions = false;
		},
		escape(ev) {
			const somethingToClose = (this.isInput && this.dropdownShow) || this.showHover;

			if(this.isInput) {
				this.focused = false;
				if(this.dropdownShow)
					this.$emit('dropdown-show',false);
			}
			if(this.showHover) {
				this.showCsv     = false;
				this.showFilters = false;
				this.showOptions = false;
			}
			if(somethingToClose && ev !== undefined) {
				ev.stopPropagation();
				ev.preventDefault();
			}
		},
		focus() {
			if(!this.inputIsReadonly && this.isInput && !this.showAllValues && !this.dropdownShow) {
				this.focused      = true;
				this.filtersQuick = '';
			}
		},
		focusOnInput() {
			const inputEl = this.$refs.content.querySelector('[data-is-input-empty="1"]');
			if(inputEl !== null)
				inputEl.focus();
		},
		resetColumns() {
			this.setColumnBatchSort([[],[]]);
			// setting columns will reload data & aggregations
			this.$nextTick(() => this.$emit('set-column-ids-by-user',[]));
		},
		setAggregators(columnId,aggregator) {
			if(!this.isTable) return;
			let v = JSON.parse(JSON.stringify(this.columnIdMapAggr));
			
			if(aggregator !== null) v[columnId] = aggregator;
			else                    delete(v[columnId]);
			
			this.$emit('set-login-option','columnIdMapAggr',v);
			this.reloadAggregations(true);
		},
		setAutoRenewTimer(v) {
			this.clearAutoRenewTimer();

			// we use -1 instead of null to define disabled auto renew
			// NULL is removed as field option, making it impossible to disable the default setting
			if(v !== -1) {
				// apply min. interval
				if(v < 10) v = 10;

				this.autoRenewTimer = setInterval(this.get,v * 1000);
			}

			if(v !== this.autoRenew)
				this.$emit('set-login-option','autoRenew',v);
		},
		setColumnBatchSort(v) {
			this.$emit('set-login-option','columnBatchSort',v);
			this.reloadAggregations(true);
		},
		setColumnFilters(v) {
			this.$emit('set-login-option','filtersColumn',v);
		},
		setLoginOption(name,v) {
			this.$emit('set-login-option',name,v);
		},
		setOffsetAndReload(v) {
			this.offset = v;
			this.get();
		},
		setOffsetParamAndReload(v,pushHistory) {
			this.setOffsetAndReload(v);
			this.paramsUpdate(pushHistory);
		},
		setOrder(columnBatch,directionAsc,clearAllBefore) {
			// remove initial sorting (if active) when changing anything
			let orders = this.isOrderedOrginal ? [] : JSON.parse(JSON.stringify(this.orders));

			if(clearAllBefore)
				orders = [];
			
			const orderIndexesUsed = this.getOrderIndexesFromColumnBatch(columnBatch,this.columns,orders);
			const notOrdered       = orderIndexesUsed.length === 0;
			if(notOrdered) {
				if(directionAsc === null)
					return; // not ordered and nothing to order, no change
				
				for(const columnIndexSort of columnBatch.columnIndexesSortBy) {
					const col = this.columns[columnIndexSort];
					if(col.subQuery) {
						orders.push({
							ascending:directionAsc,
							expressionPos:columnIndexSort // equal to expression index
						});
					}
					else {
						orders.push({
							ascending:directionAsc,
							attributeId:col.attributeId,
							index:col.index
						});
					}
				}
			} else {
				if(directionAsc === null) {
					orders = orders.filter((v,i) => !orderIndexesUsed.includes(i));
				} else {
					for(const orderIndex of orderIndexesUsed) {
						if(orders[orderIndex].ascending !== directionAsc)
							orders[orderIndex].ascending = directionAsc;
					}
				}
			}
			// when last order is removed, revert to original
			this.setOrders(orders.length === 0 ? this.ordersOriginal : orders);
		},
		setOrders(v) {
			this.$emit('set-login-option','orders',v);
		},
		setUserFilters(v) {
			this.$emit('set-login-option','filtersUser',v);
		},
		toggleHeader() {
			this.$emit('set-login-option','header',!this.showHeader);
			this.$store.commit('appResized');
		},
		updatedTextInput(event) {
			if(event.code === 'Tab' || event.code === 'Escape')
				return;
			
			// any input opens table (dropdown) if not open already
			if(!this.dropdownShow) {
				this.$emit('dropdown-show',true);
			}
			else if(event.code === 'Enter') {
				
				// if open already, enter can select first result
				if(this.rows.length !== 0)
					this.clickRow(this.rows[0],false);
				
				this.$emit('dropdown-show',false);
			}
			else {
				// table already open -> reload
				this.setOffsetAndReload(0);
			}
		},
		updatedFilterQuick() {
			if(this.isInput && !this.dropdownShow)
				return this.$emit('dropdown-show',true);
			
			this.offset = 0;
			
			if(!this.rowsFetching)
				this.get();
		},
		
		// user actions, cards layout
		cardsSetOrderBy(columnBatchIndexStr) {
			const columnBatchIndex = parseInt(columnBatchIndexStr);
			this.cardsOrderByColumnBatchIndex = columnBatchIndex;
			if(columnBatchIndex !== -1)
				this.setOrder(this.columnBatches[columnBatchIndex],true,true);
		},
		cardsToggleOrderBy() {
			const wasAsc = this.orders[0].ascending;
			this.setOrder(this.columnBatches[this.cardsOrderByColumnBatchIndex],!wasAsc,true);
		},
		
		// user actions, inputs
		inputTriggerRow(row) {
			if(this.showAllValues && !this.inputIsReadonly) {
				const id = row.indexRecordIds['0'];

				if(this.inputRecordIds.includes(id)) this.$emit('record-removed', id);
				else                                 this.$emit('records-selected', [id]);
			}
			this.focus();
		},
		inputTriggerRowRemove(i) {
			this.$emit('record-removed',this.rowsInput[i].indexRecordIds['0']);
			this.rowsInput.splice(i,1);
			this.escape();
			this.$nextTick(this.focusOnInput);
		},

		// cleanup
		removeInvalidFilters() {
			const f = (filters,columns,fncUpdate) => {
				let out = [];
				let br0 = 0;
				let br1 = 0;
				for(const f of filters) {
					br0 += f.side0.brackets;
					br1 += f.side1.brackets;
	
					// only allow filters based on available columns
					for(const c of columns) {
						if(c.attributeId === f.side0.attributeId && c.index === f.side0.attributeIndex) {
							out.push(f)
							break;
						}
					}
				}
				if(br0 !== br1) // brackets do not match, remove all filters
					return fncUpdate([]);

				if(out.length !== filters.length) // some filters were removed, update
					fncUpdate(out);
			};
			f(this.filtersColumn,this.columns,this.setColumnFilters);
			f(this.filtersUser,this.columnsAll,this.setUserFilters);
		},
		removeInvalidOrders() {
			if(this.isOrderedOrginal) return;

			for(const o of this.orders) {
				// order by expression position (= index of retrieved columns), is only used for sub query columns
				if(typeof o.expressionPos !== 'undefined') {

					// order is invalid, if column index does not exist or column is not a sub query
					if(o.expressionPos > this.columns.length - 1 || !this.columns[o.expressionPos].subQuery)
						return this.setOrders(this.ordersOriginal);
					
					continue;
				}

				// order by attribute ID + relation index, check if corresponding column is displayed
				// only displayed columns are retrieved, any user-defined order must be visible to be removable by the user
				let columnFound = false;
				for(const c of this.columns) {
					if(o.index === c.index && o.attributeId === c.attributeId) {
						columnFound = true;
						break;
					}
				}

				// order is invalid if corresponding column is not displayed
				if(!columnFound)
					return this.setOrders(this.ordersOriginal);
			}
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
			if(this.formLoading || (this.isInput && !this.dropdownShow) || (this.isHidden && !this.loadWhileHidden))
				return;
			
			// fix invalid offset (can occur when limit is changed)
			if(this.offset !== 0 && this.offset % this.limit !== 0)
				return this.setOffsetParamAndReload(this.offset -= this.offset % this.limit,false);
			
			this.rowsFetching = true;
			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.relationsJoined,
				expressions:this.expressions,
				filters:this.filtersCombined,
				orders:this.orders,
				limit:this.limit,
				offset:this.offset
			},this.blockDuringLoad).then(
				res => {
					const count = res.payload.count;
					this.getRowsDecrypted(res.payload.rows,this.expressions).then(
						rows => {
							this.count = count;
							this.rows  = rows;
							this.selectReset();
							this.reloadAggregations(false);
							this.$emit('record-count-change',this.count);
						},
						this.consoleError
					);
					
				},
				this.$root.genericError
			).finally(() => this.rowsFetching = false);
		},
		getInput() {
			// nothing to get if form is currently loading
			if(this.formLoading)
				return;
			
			// reload record representation
			// must happen even if no GET is executed (clear inputs)
			// if list is reloaded, close dropdown
			this.rowsInput = [];

			if(this.dropdownShow)
				this.get();
			
			// for inputs we only need data if:
			// * field shows all values
			// * auto select is active
			// * input has records to get data for
			if(!this.showAllValues && !this.autoSelect && !this.anyInputRows)
				return;
			
			// apply input filters (all but choice filters, which should never affect input display)
			// input filters cannot be ignored even in readonly contexts (such as log viewer)
			//  reason: input filters may resolve 1:n relationships (like translations)
			let filters = JSON.parse(JSON.stringify(this.filtersInput));
			
			if(!this.showAllValues && this.anyInputRows)
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
					// apply results to input rows if all values are shown or specific record IDs were retrieved
					if(this.showAllValues || this.anyInputRows)
						this.getRowsDecrypted(res.payload.rows,this.expressions).then(
							rows => this.rowsInput = rows,
							this.consoleError
						);
					
					// remove invalid records (due to field filters)
					let recordIdsValid = [];
					let recordsRemoved = 0;
					for(const row of res.payload.rows) {
						recordIdsValid.push(row.indexRecordIds['0']);
					}
					
					for(const recordId of this.inputRecordIds) {
						if(!recordIdsValid.includes(recordId)) {
							this.$emit('record-removed',recordId);
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