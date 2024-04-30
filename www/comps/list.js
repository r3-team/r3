import isDropdownUpwards  from './shared/layout.js';
import MyFilters          from './filters.js';
import MyForm             from './form.js';
import MyInputCollection  from './inputCollection.js';
import MyInputOffset      from './inputOffset.js';
import MyListAggregate    from './listAggregate.js';
import MyListColumnBatch  from './listColumnBatch.js';
import MyListCsv          from './listCsv.js';
import MyListOptions      from './listOptions.js';
import MyValueRich        from './valueRich.js';
import {consoleError}     from './shared/error.js';
import {getCaption}       from './shared/language.js';
import {isAttributeFiles} from './shared/attribute.js';
import {
	getColumnBatches,
	getColumnTitle,
	getOrderIndexesFromColumnBatch
} from './shared/column.js';
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
		MyListOptions,
		MyValueRich
	},
	template:`<div class="list" ref="content"
		v-click-outside="escape"
		@keydown="keyDown"
		:class="{ asInput:isInput, readonly:inputIsReadonly, isSingleField:isSingleField }"
	>
		<!-- hover menus -->
		<div class="app-sub-window under-header"
			v-if="showHover"
			@click.self.stop="closeHover"
		>
			<div class="contentBox float" :class="{ 'list-csv':showCsv,'list-filters':showFilters, 'list-options':showOptions }">
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
				<div class="content grow default-inputs">
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
					<my-filters class="default-inputs"
						v-if="showFilters"
						v-model="filtersUser"
						@apply="get"
						:columns="columns"
						:joins="joins"
						:showReset="true"
						:userFilter="true"
					/>
					<my-list-options
						v-if="showOptions"
						@reset="reloadInside('filtersUser')"
						@set-cards-captions="setCardsCaptions"
						@set-column-batch-sort="setColumnBatchSort"
						@set-column-ids-by-user="$emit('set-column-ids-by-user',$event)"
						@set-layout="setLayout"
						:cardsCaptions="cardsCaptions"
						:columns="columns"
						:columnsAll="columnsAll"
						:columnBatches="columnBatches"
						:columnBatchSort="columnBatchSort"
						:layout="layout"
						:moduleId="moduleId"
					/>
					<div class="row gap centered default-inputs" v-if="showAutoRenew">
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
			</div>
		</div>
		
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
									:wrap="columns[0].flags.wrap"
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
										:bold="columns[ci].flags.bold"
										:clipboard="columns[ci].flags.clipboard"
										:display="columns[ci].display"
										:italic="columns[ci].flags.italic"
										:key="ci"
										:length="columns[ci].length"
										:value="r.values[ci]"
										:wrap="columns[ci].flags.wrap"
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
							<input class="input" data-is-input="1" data-is-input-empty="1" enterkeyhint="send"
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
			
			<!-- list header -->
			<div class="list-header" v-if="header && showHeader">
				
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
				
				<!-- empty element for header collapse calculation -->
				<div ref="empty" class="empty"></div>
				
				<div class="row gap nowrap centered list-header-title" v-if="showTitle">
					<span v-if="caption !== ''">{{ caption }}</span>
				</div>
				
				<div class="row gap nowrap">
					<my-input-offset
						v-if="hasPaging"
						@input="offset = $event;reloadInside()"
						:arrows="showOffsetArrows"
						:caption="showResultsCount && count > 1"
						:limit="limit"
						:offset="offset"
						:total="count"
					/>
				</div>
				
				<div class="row gap nowrap default-inputs">
					<!-- other actions -->
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
						:multiValue="c.multiValue"
						:previewCount="showCollectionCnt"
						:showTitle="showCollectionTitles"
					/>
					
					<select class="auto"
						v-if="hasChoices"
						@change="reloadInside('choice')"
						v-model="choiceId"
					>
						<option v-for="c in query.choices" :value="c.id">
							{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
						</option>
					</select>
					
					<my-button image="listCog.png"
						@trigger="showOptions = !showOptions"
						:captionTitle="capGen.options"
						:naked="true"
					/>
					<my-button image="toggleUp.png"
						@trigger="toggleHeader"
						:captionTitle="capApp.button.collapseHeader"
						:naked="true"
					/>
				</div>
			</div>
			
			<!-- list content -->
			<div class="list-content" :class="{ showsInlineForm:popUpFormInline !== null }">
			
				<!-- list results as table or card layout -->
				<div
					:class="{ layoutCards:isCards, layoutTable:isTable, rowsColored:settings.listColored, scrolls:isSingleField, 'input-dropdown-wrap':isInput, upwards:inputDropdownUpwards }"
					:id="usesPageHistory ? scrollFormId : null"
				>
					<table v-if="isTable" :class="{ asInput:isInput, 'input-dropdown':isInput, upwards:inputDropdownUpwards }">
						<thead v-if="header">
							<tr :class="{ atTop:!showHeader }">
								<th v-if="hasBulkActions" class="minimum checkbox">
									<img class="clickable" tabindex="0"
										@click="selectRowsAllToggle"
										@keyup.enter.space.stop="selectRowsAllToggle"
										:src="rows.length !== 0 && selectedRows.length === rows.length ? 'images/checkboxSmall1.png' : 'images/checkboxSmall0.png'"
									/>
								</th>
								<th v-for="(b,i) in columnBatches">
									<div class="row centered">
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
											:filters="filters"
											:filtersColumn="filtersColumn"
											:lastInRow="i === columnBatches.length - 1"
											:joins="relationsJoined"
											:orders="orders"
											:orderOverwritten="orderOverwritten"
											:relationId="query.relationId"
											:rowCount="count"
											:show="columnBatchIndexOption === i"
										/>
										<my-button image="toggleDown.png"
											v-if="!showHeader && i === columnBatches.length-1"
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
								<td colspan="999">
									<div class="sub-actions default-inputs">
										<select
											v-if="hasChoices"
											@change="reloadInside('choice')"
											v-model="choiceId"
										>
											<option v-for="c in query.choices" :value="c.id">
												{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
											</option>
										</select>
										
										<my-input-offset
											@input="offset = $event;reloadInside()"
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
									<div class="columnBatch"
										:class="{ colored:b.columnIndexColor !== -1, vertical:b.vertical }"
										:style="b.columnIndexColor === -1 ? '' : displayColorColumn(r.values[b.columnIndexColor])"
									>
										<my-value-rich
											v-for="ind in b.columnIndexes.filter(v => v !== b.columnIndexColor && r.values[v] !== null)"
											@clipboard="$emit('clipboard')"
											:attributeId="columns[ind].attributeId"
											:basis="columns[ind].basis"
											:bold="columns[ind].flags.bold"
											:clipboard="columns[ind].flags.clipboard"
											:display="columns[ind].display"
											:italic="columns[ind].flags.italic"
											:key="ind"
											:length="columns[ind].length"
											:value="r.values[ind]"
											:wrap="columns[ind].flags.wrap"
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
						<div class="card-actions default-inputs" v-if="hasResults" :class="{ atTop:!showHeader }">
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
						
						<div class="cards" @click="clickOnEmpty" :id="usesPageHistory ? scrollFormId : null">
							
							<!-- no results message -->
							<template v-if="!hasResults">
								<div class="card no-results" v-if="!rowsFetching">
									{{ capGen.resultsNone }}
								</div>
								<div class="card no-results fetching" v-if="rowsFetching">
									<img src="images/load.gif">
									<span>{{ capApp.fetching }}</span>
								</div>
							</template>
							
							<div class="card"
								v-for="(r,ri) in rowsClear"
								@click.stop="clickRow(r,false)"
								@click.middle.stop="clickRow(r,true)"
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
									<tr v-for="b in columnBatches">
										<td class="caption" v-if="cardsCaptions">{{ b.caption }}</td>
										<td>
											<div class="columnBatch listCards" :class="{ vertical:b.vertical }">
												<my-value-rich
													v-for="ind in b.columnIndexes.filter(v => r.values[v] !== null)"
													@clipboard="$emit('clipboard')"
													:attributeId="columns[ind].attributeId"
													:basis="columns[ind].basis"
													:bold="columns[ind].flags.bold"
													:clipboard="columns[ind].flags.clipboard"
													:display="columns[ind].display"
													:italic="columns[ind].flags.italic"
													:key="ind"
													:length="columns[ind].length"
													:value="r.values[ind]"
													:wrap="columns[ind].flags.wrap"
												/>
											</div>
										</td>
									</tr>
								</table>
							</div>
						</div>
					</template>
				</div>
				
				<!-- inline form -->
				<my-form class="inline"
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
		caption:        { type:String,  required:false, default:'' },       // caption to display in list header
		choices:        { type:Array,   required:false, default:() => [] }, // processed query choices
		collections:    { type:Array,   required:false, default:() => [] }, // consumed collections to filter by user input
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		columns:        { type:Array,   required:true },                    // list columns, processed
		columnsAll:     { type:Array,   required:false, default:() => [] }, // list columns, all
		fieldId:        { type:String,  required:true },
		filters:        { type:Array,   required:true },                    // processed query filters
		layoutDefault:  { type:String,  required:false, default:'table' },  // default list layout: table, cards
		limitDefault:   { type:Number,  required:false, default:10 },       // default list limit
		moduleId:       { type:String,  required:true },
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
		loadWhileHidden:{ type:Boolean, required:false, default:false },
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
		'set-column-ids-by-user','set-collection-indexes'
	],
	data() {
		return {
			// list state
			autoRenewInput:null,        // current auto renew input value
			autoRenewInputLast:null,    // last set auto renew input value (to compare against)
			autoRenewTimer:null,        // interval timer for auto renew
			choiceId:null,              // currently active choice
			columnBatchIndexOption:-1,  // show options for column batch by index
			columnBatchSort:[[],[]],
			focused:false,
			inputAutoSelectDone:false,
			inputDropdownUpwards:false, // show dropdown above input
			layout:'table',             // current list layout (table, cards)
			orderOverwritten:false,     // sort options were changed by user
			rowsFetching:false,         // row values are being fetched
			selectedRows:[],            // bulk selected rows by row index
			showAutoRenew:false,        // show UI for auto list renew
			showCsv:false,              // show UI for CSV import/export
			showFilters:false,          // show UI for user filters
			showHeader:true,            // show UI for list header
			showOptions:false,          // show UI for list options
			showTable:false,            // show regular list table as view or input dropdown
			
			// list constants
			refTabindex:'input_row_', // prefix for vue references to tabindex elements
			
			// list card layout state
			cardsOrderByColumnBatchIndex:-1,
			cardsCaptions:true,
			
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
			
			// list header
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
				'resultsCount',              // not important
				'autoRenewIcon'              // not important
			]
		};
	},
	computed:{
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
		hoverCaption:(s) => {
			if     (s.showAutoRenew) return s.capApp.autoRenew;
			else if(s.showCsv)       return s.capApp.button.csv;
			else if(s.showFilters)   return s.capGen.button.filterHint;
			else if(s.showOptions)   return s.capGen.options;
			return '';
		},
		hoverIconSrc:(s) => {
			if     (s.showAutoRenew) return 'images/autoRenew.png';
			else if(s.showCsv)       return 'images/fileSheet.png';
			else if(s.showFilters)   return 'images/filterCog.png';
			else if(s.showOptions)   return 'images/listCog.png';
			return '';
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
		anyInputRows:        (s) => s.inputRecordIds.length !== 0,
		autoSelect:          (s) => s.inputIsNew && s.inputAutoSelect !== 0 && !s.inputAutoSelectDone,
		choiceFilters:       (s) => s.getChoiceFilters(s.choices,s.choiceId),
		choiceIdDefault:     (s) => s.fieldOptionGet(s.fieldId,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		columnBatches:       (s) => s.getColumnBatches(s.moduleId,s.columns,[],s.orders,s.columnBatchSort[0],true),
		expressions:         (s) => s.getQueryExpressions(s.columns),
		hasBulkActions:      (s) => !s.isInput && s.rows.length !== 0 && (s.hasUpdateBulk || s.hasDeleteAny),
		hasChoices:          (s) => s.query.choices.length > 1,
		hasCreate:           (s) => s.joins.length !== 0 && s.joins[0].applyCreate && s.hasOpenForm,
		hasPaging:           (s) => s.query.fixedLimit === 0,
		hasResults:          (s) => s.rowsClear.length !== 0,
		hasUpdate:           (s) => s.joins.length !== 0 && s.joins[0].applyUpdate && s.hasOpenForm,
		hasUpdateBulk:       (s) => s.joins.length !== 0 && s.joins[0].applyUpdate && s.hasOpenFormBulk,
		isCards:             (s) => s.layout === 'cards',
		isTable:             (s) => s.layout === 'table',
		joins:               (s) => s.fillRelationRecordIds(s.query.joins),
		relationsJoined:     (s) => s.getRelationsJoined(s.joins),
		rowSelect:           (s) => s.isInput || s.hasUpdate,
		showActionTitles:    (s) => s.headerElements.includes('actionTitles'),
		showAutoRenewIcon:   (s) => s.headerElements.includes('autoRenewIcon'),
		showCollectionTitles:(s) => s.headerElements.includes('collectionTitles'),
		showHover:           (s) => s.showAutoRenew || s.showCsv || s.showFilters || s.showOptions,
		showInputAddLine:    (s) => !s.inputAsCategory && (!s.anyInputRows || (s.inputMulti && !s.inputIsReadonly)),
		showInputAddAll:     (s) => s.inputMulti && s.hasResults,
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
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
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
		this.showTable = !this.isInput;
		
		// react to field resize
		if(!this.isInput) {
			window.addEventListener('resize',this.resized);
			this.resized();
		}
		
		// setup watchers
		this.$watch('columns',this.reset);
		this.$watch('formLoading',(val) => {
			if(val) return;
			this.inputAutoSelectDone = false;
			this.reloadOutside();
		});
		this.$watch('isHidden',(val) => {
			if(!val) {
				this.reloadOutside();
				this.resized();
			}
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
		this.columnBatchSort = this.fieldOptionGet(this.fieldId,'columnBatchSort',[[],[]]);
		this.columnIdMapAggr = this.fieldOptionGet(this.fieldId,'columnIdMapAggr',{});
		this.filtersColumn   = this.fieldOptionGet(this.fieldId,'filtersColumn',[]);
		this.filtersUser     = this.fieldOptionGet(this.fieldId,'filtersUser',[]);
		this.showHeader      = this.fieldOptionGet(this.fieldId,'header',true);
		this.layout          = this.fieldOptionGet(this.fieldId,'layout',this.layoutDefault);
		this.cardsCaptions   = this.fieldOptionGet(this.fieldId,'cardsCaptions',true);
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
		getColumnBatches,
		getColumnTitle,
		getFiltersEncapsulated,
		getOrderIndexesFromColumnBatch,
		getQueryAttributesPkFilter,
		getQueryExpressions,
		getRelationsJoined,
		getRowsDecrypted,
		isAttributeFiles,
		isDropdownUpwards,
		routeChangeFieldReload,
		routeParseParams,
		
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
		headerAdjust() {
			this.headerCheckTimer = null;
			
			if(typeof this.$refs.empty === 'undefined' || this.$refs.empty.offsetWidth > 10 || this.headerElements.length === 0)
				return;
			
			// space insufficient and still elements available to reduce
			this.headerElements.shift();       // remove next element
			this.$nextTick(this.headerAdjust); // recheck after change
		},
		resized() {
			if(this.headerCheckTimer !== null)
				clearTimeout(this.headerCheckTimer);
			
			this.headerCheckTimer = setTimeout(() => {
				// reset elements, then wait for layout to settle to check
				this.headerElements = JSON.parse(JSON.stringify(this.headerElementsAvailableInOrder));
				this.$nextTick(this.headerAdjust);
			},200);
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
				default:       break; // no special treatment
			}
			
			// update route parameters, reloads list via watcher
			// enables browser history for fullpage list navigation
			//  special cases: column/quick/user filters & manuel reloads (no page param change)
			if(this.usesPageHistory && !['filtersColumn','filtersQuick','filtersUser','manual'].includes(entity))
				return this.paramsUpdate(true);
			
			this.get();
		},
		reset() {
			this.count = 0;
			this.rows  = [];
		},
		
		// parsing
		paramsUpdate(pushHistory) {
			// fullpage lists update their form arguments, this results in history change
			// history change then triggers form load
			let orders = [];
			for(let o of this.orders) {
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
			this.cardsOrderByColumnBatchIndex = -1;
			for(let i = 0, j = this.columnBatches.length; i < j; i++) {
				if(this.columnBatches[i].orderIndexesUsed.length !== 0) {
					this.cardsOrderByColumnBatchIndex = i;
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
		closeHover() {
			this.showAutoRenew = false;
			this.showCsv       = false;
			this.showFilters   = false;
			this.showOptions   = false;
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
			if(!this.isTable) return;
			
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
			
			if(!Number.isInteger(this.autoRenewInput) || this.autoRenewInput < 10)
				this.autoRenewInput = 10;
			
			// set new timer
			this.autoRenewInputLast = this.autoRenewInput;
			this.autoRenewTimer = setInterval(this.get,this.autoRenewInput * 1000);
			
			// store timer option for field
			this.fieldOptionSet(this.fieldId,'autoRenew',this.autoRenewInput);
		},
		setCardsCaptions(v) {
			this.cardsCaptions = v;
			this.fieldOptionSet(this.fieldId,'cardsCaptions',v);
		},
		setColumnBatchSort(value) {
			this.columnBatchSort = value;
			this.fieldOptionSet(this.fieldId,'columnBatchSort',value);
		},
		setLayout(layout) {
			this.layout = layout;
			this.fieldOptionSet(this.fieldId,'layout',this.layout);
			
			this.$nextTick(() => {
				if(this.isTable && typeof this.$refs.aggregations !== 'undefined')
					this.$refs.aggregations.get()
			});
		},
		setOrder(columnBatch,directionAsc) {
			// remove initial sorting when changing anything
			if(!this.orderOverwritten)
				this.orders = [];
			
			const orderIndexesUsed = this.getOrderIndexesFromColumnBatch(columnBatch,this.columns,this.orders);
			const notOrdered       = orderIndexesUsed.length === 0;
			if(notOrdered) {
				if(directionAsc === null)
					return; // not ordered and nothing to order, no change
				
				for(const columnIndexSort of columnBatch.columnIndexesSortBy) {
					const col = this.columns[columnIndexSort];
					if(col.subQuery) {
						this.orders.push({
							expressionPos:columnIndexSort, // equal to expression index
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
			} else {
				if(directionAsc === null) {
					this.orders = this.orders.filter((v,i) => !orderIndexesUsed.includes(i));
				} else {
					for(const orderIndex of orderIndexesUsed) {
						if(this.orders[orderIndex].ascending !== directionAsc)
							this.orders[orderIndex].ascending = directionAsc;
					}
				}
			}
			this.reloadInside('order');
		},
		toggleDropdown() {
			this.showTable = !this.showTable;
			
			if(this.showTable) {
				this.filtersQuick = '';
				this.reloadInside('dropdown');
				
				const inputEl = this.$refs.content.querySelector('[data-is-input-empty="1"]');
				if(inputEl !== null)
					inputEl.focus();
			}
		},
		toggleHeader() {
			this.showHeader = !this.showHeader;
			this.fieldOptionSet(this.fieldId,'header',this.showHeader);
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
		cardsSetOrderBy(columnBatchIndexStr) {
			const columnBatchIndex = parseInt(columnBatchIndexStr);
			this.cardsOrderByColumnBatchIndex = columnBatchIndex;
			this.orders = [];
			
			if(columnBatchIndex === -1) return;
			
			this.setOrder(this.columnBatches[columnBatchIndex],true);
			this.reloadInside('order');
		},
		cardsToggleOrderBy() {
			const wasAsc = this.orders[0].ascending;
			this.orders = [];
			this.setOrder(this.columnBatches[this.cardsOrderByColumnBatchIndex],!wasAsc);
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
			if(!this.showTable || this.formLoading || (this.isHidden && !this.loadWhileHidden))
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
							if(this.isTable && typeof this.$refs.aggregations !== 'undefined')
								this.$refs.aggregations.get();
							
							if(this.isInput) {
								this.$nextTick(this.updateDropdownDirection);
							} else {
								this.fieldOptionSet(this.fieldId,'filtersColumn',this.filtersColumn);
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