import isDropdownUpwards  from './shared/layout.js';
import MyFilters          from './filters.js';
import MyInputOffset      from './inputOffset.js';
import MyListCsv          from './listCsv.js';
import MyValueRich        from './valueRich.js';
import {getChoiceFilters} from './shared/form.js';
import {srcBase64}        from './shared/image.js';
import {getCaption}       from './shared/language.js';
import {
	isAttributeFiles
} from './shared/attribute.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
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
		MyInputOffset,
		MyListCsv,
		MyValueRich
	},
	template:`<div class="list"
		@keydown="keyDown"
		v-click-outside="escape"
		:class="{shade:!isInput, isFullPage:isFullPage, asInput:isInput, inputAddShown:showInputAddLine, readonly:inputIsReadonly }"
	>
		<!-- list as input field (showing record(s) from active field value) -->
		<template v-if="isInput">
			<table class="list-input-rows" :class="{ 'multi-line':inputMulti }">
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
					<td
						v-for="(b,bi) in columnBatches"
						:style="b.style"
					>
						<div class="list-input-row-items">
							<template v-for="(ci,cii) in b.columnIndexes">
								<my-value-rich class="context-list-input"
									v-if="r.values[ci] !== null && (!hasGalleryIcon || bi !== 0 || cii !== 0)"
									@focus="focus"
									@trigger="inputTriggerRow(r)"
									:attribute-id="columns[ci].attributeId"
									:class="{ clickable:inputAsCategory && !inputIsReadonly }"
									:basis="b.columnIndexes.length === 1 ? columns[ci].basis : 0"
									:display="columns[ci].display"
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
						<div class="list-input-row-items nowrap">
							<my-button image="cancel.png"
								v-if="!inputIsReadonly && !inputAsCategory"
								@trigger="inputTriggerRowRemove(i)"
								:captionTitle="capApp.inputHintRemove"
								:naked="true"
							/>
							<my-button image="open.png"
								v-if="inputOpenForm && hasUpdate"
								@trigger="$emit('form-open',r.indexRecordIds['0'])"
								:captionTitle="capApp.inputHintOpen"
								:naked="true"
							/>
							
							<!-- show dropdown toggle if single input -->
							<my-button image="arrowDown.png"
								v-if="!inputAsCategory && !showInputAddLine && !inputIsReadonly"
								@trigger="toggleDropdown"
								:naked="true"
							/>
						</div>
					</td>
				</tr>
			</table>
			
			<template v-if="showInputAddLine">
				<!-- empty record input field -->
				
				<div class="list-input-row-empty">
					<table class="list-input-rows">
						<tr>
							<td class="minimum">
								<slot name="input-icon" />
							</td>
							<td>
								<div class="list-input-row-items">
									<input class="input"
										@click="focus"
										@focus="focus"
										@keyup="updatedTextInput"
										v-model="quickFilter"
										:class="{ invalid:!inputValid }"
										:disabled="inputIsReadonly"
										:placeholder="inputLinePlaceholder"
										:tabindex="!inputIsReadonly ? 0 : -1"
									/>
								</div>
							</td>
							<td class="minimum">
								<div class="list-input-row-items nowrap">
									<my-button image="add.png"
										v-if="inputOpenForm && hasCreate"
										@trigger="$emit('form-open-new')"
										:captionTitle="capApp.inputHintCreate"
										:naked="true"
									/>
									<my-button image="arrowDown.png"
										v-if="!inputIsReadonly"
										@trigger="toggleDropdown"
										:captionTitle="capApp.inputHintSelect"
										:naked="true"
									/>
								</div>
							</td>
						</tr>
					</table>
				</div>
			</template>
		</template>
		
		<template v-if="showTable && !inputAsCategory">
			<!-- regular list view (either view or input dropdown) -->
			
			<div class="top lower" v-if="header">
				<!-- list header line -->
				
				<div class="area nowrap">
					<!-- actions -->
					
					<my-button image="new.png"
						v-if="hasCreate"
						@trigger="$emit('record-selected',0,false)"
						@trigger-middle="$emit('record-selected',0,true)"
						:caption="!isMobile ? capGen.button.new : ''"
						:captionTitle="capGen.button.newHint"
						:darkBg="true"
					/>
					<my-button image="sheet.png"
						v-if="csvImport || csvExport"
						@trigger="showCsv = !showCsv"
						:caption="!isMobile ? capApp.button.csv : ''"
						:captionTitle="capApp.button.csvHint"
						:darkBg="true"
					/>
					<my-button image="delete.png"
						v-if="hasBulkActions"
						@trigger="delAsk(selectedRows)"
						:active="selectedRows.length !== 0"
						:cancel="true"
						:caption="!isMobile ? capGen.button.delete : ''"
						:captionTitle="capGen.button.deleteHint"
						:darkBg="true"
					/>
				</div>
				
				<div class="area nowrap">
					<img class="icon"
						v-if="iconId !== null"
						:src="srcBase64(iconIdMap[iconId].file)"
					/>
					
					<!-- offset -->
					<my-input-offset class-input="selector"
						v-if="allowPaging"
						@input="offset = $event;reloadInside()"
						:caption="!isMobile ? true : false"
						:darkBg="true"
						:limit="limit"
						:offset="offset"
						:total="count"
					/>
				</div>
				
				<div class="area nowrap default-inputs">
					<!-- auto renew / user filter / quick filter / query choices / page limits -->
					
					<my-button image="autoRenew.png"
						v-if="!isMobile && autoRenew !== null"
						@trigger="showAutoRenew = !showAutoRenew"
						:caption="capApp.button.autoRenew.replace('{VALUE}',autoRenewInput)"
						:captionTitle="capApp.button.autoRenewHint.replace('{VALUE}',autoRenewInput)"
						:darkBg="true"
					/>
					
					<my-button image="filter.png"
						v-if="isFullPage"
						@trigger="toggleUserFilters"
						:caption="filtersUser.length !== 0 ? String(filtersUser.length) : ''"
						:captionTitle="capGen.button.filterHint"
						:darkBg="true"
					/>
					
					<input class="selector lookup" type="text"
						v-if="filterQuick"
						@keyup.enter="updatedFilterQuick"
						v-model="quickFilter"
						:title="capApp.quick"
						placeholder="..."
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
						v-if="isFullPage && allowPaging && !isMobile"
						v-model.number="limit"
						@change="reloadInside()"
					>
						<option v-for="o in limitOptions" :value="o">{{ o }}</option>
					</select>
				</div>
			</div>
			
			<div v-if="showCsv || showFilters || showAutoRenew">
				<!-- list header functions -->
				
				<!-- auto renew -->
				<div class="list-header default-inputs" v-if="showAutoRenew">
					<div class="list-header-title">
						<img src="images/autoRenew.png" />
						<span>{{ capApp.autoRenew }}</span>
					</div>
					
					<div class="list-auto-renew-line">
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
				
				<div class="list-header" v-if="showFilters">
					<my-filters
						v-model="filtersUser"
						@apply="reloadInside('filtersUser')"
						@reset="reloadInside('filtersUser')"
						:addOnStart="true"
						:columns="columns"
						:joins="joins"
						:showApply="true"
						:showReset="true"
					>
						<template #title>
							<div class="list-header-title">
								<img src="images/filter.png" />
								<span>{{ capGen.filters }}</span>
							</div>
						</template>
					</my-filters>
				</div>
				
				<my-list-csv class="default-inputs"
					v-if="showCsv"
					@reload="get"
					:columns="columns"
					:expressions="expressions"
					:filters="filters.concat(filtersParsedQuick).concat(filtersParsedUser)"
					:isExport="csvExport"
					:isImport="csvImport"
					:joins="getRelationsJoined(joins)"
					:orders="orders"
					:query="query"
				/>
			</div>
			
			<div class="layoutTable"
				v-if="layout === 'table'"
				:class="{ 'input-dropdown-wrap':isInput, upwards:inputDropdownUpwards }"
				:id="isFullPage ? scrollFormId : null"
			>
				<!-- list results as HTML table -->
				
				<table :class="{ 'input-dropdown':isInput, upwards:inputDropdownUpwards }">
					<thead v-if="header">
						<!-- attribute headers -->
						<tr>
							<th v-if="hasBulkActions" class="minimum checkbox">
								<img class="clickable" tabindex="0"
									@click="selectRowsAllToggle"
									@keyup.enter.space.stop="selectRowsAllToggle"
									:src="rows.length !== 0 && selectedRows.length === rows.length ? 'images/checkbox1.png' : 'images/checkbox0.png'"
								/>
							</th>
							<th class="clickable"
								v-for="b in columnBatches"
								@click.left="clickColumn(b)"
								@click.right.prevent="clickColumnRight(b)"
								:style="b.style"
							>
								{{ b.caption+displaySortDir(b) }}
							</th>
						</tr>
					</thead>
					<tbody>
						<!-- result row actions (only available if list is input) -->
						<tr v-if="showInputHeader">
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
									
									<input class="selector lookup small" type="text" placeholder="..."
										v-if="filterQuick"
										@keyup.enter="updatedFilterQuick"
										v-model="quickFilter"
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
							:class="{ rowSelect:rowSelect && !inputIsReadonly }"
							:key="ri + '_' + r.indexRecordIds['0']"
							:ref="refTabindex+String(ri)"
							:tabindex="isInput ? '0' : '-1'"
						>
							<td v-if="hasBulkActions" @click.stop="" class="minimum checkbox">
								<img class="clickable" tabindex="0"
									@click="selectRow(ri)"
									@keyup.enter.space.stop="selectRow(ri)"
									:src="selectedRows.includes(ri) ? 'images/checkbox1.png' : 'images/checkbox0.png'"
								/>
							</td>
							
							<!-- row values per column batch -->
							<td
								v-for="b in columnBatches"
								:style="b.style"
							>
								<div class="batch">
									<my-value-rich class="context-list-table"
										v-for="ind in b.columnIndexes.filter(v => r.values[v] !== null)"
										:attribute-id="columns[ind].attributeId"
										:basis="b.columnIndexes.length === 1 ? columns[ind].basis : 0"
										:display="columns[ind].display"
										:key="ind"
										:length="columns[ind].length"
										:value="r.values[ind]"
										:wrap="columns[ind].wrap"
									/>
								</div>
							</td>
						</tr>
						
						<!-- no results -->
						<tr v-if="rows.length === 0">
							<td colspan="999">
								{{ capGen.resultsNone }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<!-- list results as cards -->
			<div class="layoutCards"
				v-if="layout === 'cards'"
				:id="isFullPage ? scrollFormId : null"
			>
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
							@change="selectOrderBy($event.target.value)"
							v-model.number="orderByColumnBatchIndex"
						>
							<option value="-1">-</option>
							<option
								v-for="(b,i) in columnBatches"
								:value="i"
							>
								{{ b.caption }}
							</option>
						</select>
						<my-button
							v-if="orders.length !== 0"
							@trigger="toggleOrderBy"
							:image="orders[0].ascending ? 'triangleUp.png' : 'triangleDown.png'"
							:naked="true"
						/>
					</template>
					
					<!-- no results -->
					<div class="no-results" v-if="rowsClear.length === 0">
						{{ capGen.resultsNone }}
					</div>
				</div>
				
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
						<my-button class="not-spaced"
							@trigger="selectRow(ri)"
							:image="selectedRows.includes(ri) ? 'checkbox1.png' : 'checkbox0.png'"
							:naked="true"
						/>
						<my-button class="not-spaced" image="delete.png"
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
								<div class="batch">
									<my-value-rich class="context-list-cards"
										v-for="ind in b.columnIndexes.filter(v => r.values[v] !== null || columns[v].display === 'gallery')"
										:attribute-id="columns[ind].attributeId"
										:basis="b.columnIndexes.length === 1 ? columns[ind].basis : 0"
										:display="columns[ind].display"
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
	</div>`,
	props:{
		autoRenew:   { required:false,default:null },                    // refresh list data every x seconds
		choices:     { type:Array,   required:false, default:() => [] }, // processed query choices
		columns:     { type:Array,   required:true },                    // processed list columns
		fieldId:     { type:String,  required:true },
		filters:     { type:Array,   required:true },                    // processed query filters
		handleError: { type:Function,required:true },
		iconId:      { required:false,default:null },
		layout:      { type:String,  required:false, default:'table' },  // list layout: table, cards
		limitDefault:{ type:Number,  required:false, default:10 },       // default list limit
		query:       { type:Object,  required:true },                    // list query
		
		// toggles
		allowPaging:{ type:Boolean, required:false, default:true },  // enable paging
		csvExport:  { type:Boolean, required:false, default:false },
		csvImport:  { type:Boolean, required:false, default:false },
		filterQuick:{ type:Boolean, required:false, default:false }, // enable quick filter
		formLoading:{ type:Boolean, required:false, default:false }, // trigger and control list reloads
		header:     { type:Boolean, required:false, default:true  }, // show list header
		isFullPage: { type:Boolean, required:false, default:false }, // list fill entire form
		isInput:    { type:Boolean, required:false, default:false }, // use list as input
		rowSelect:  { type:Boolean, required:false, default:false }, // list rows can be selected (to open record in form)
		
		// list as input field
		inputAsCategory:{ type:Boolean, required:false, default:false },    // input is category selector (all records are shown, active ones are checked off)
		inputAutoSelect:{ type:Number,  required:false, default:0 },        // # of records to auto select (2 = first two, -3 = last three, 0 = none)
		inputIsNew:     { type:Boolean, required:false, default:false },    // input field belongs to new record
		inputIsReadonly:{ type:Boolean, required:false, default:false },    // input field is readonly
		inputOpenForm:  { type:Boolean, required:false, default:false },    // input can open another form
		inputMulti:     { type:Boolean, required:false, default:false },    // input has multiple records to represent (instead of just one)
		inputRecordIds: { type:Array,   required:false, default:() => [] }, // input record IDs, representing active values to show
		inputValid:     { type:Boolean, required:false, default:true  }
	},
	emits:[
		'blurred','focused','form-open','form-open-new',
		'record-removed','record-selected','records-selected-init','set-args'
	],
	data:function() {
		return {
			// list state
			autoRenewInput:null,     // current auto renew input value
			autoRenewInputLast:null, // last set auto renew input value (to compare against)
			autoRenewTimer:null,     // interval timer for auto renew
			choiceId:null,
			focused:false,
			inputAutoSelectDone:false,
			inputDropdownUpwards:false, // show dropdown above input
			orderOverwritten:false,
			selectedRows:[],     // bulk selected rows by row index
			showAutoRenew:false, // show UI for auto list renew
			showCsv:false,       // show UI for CSV import/export
			showFilters:false,   // show UI for user filters
			showTable:false,     // show regular list table as view or input dropdown
			
			// list card layout state
			orderByColumnBatchIndex:-1,
			
			// list data
			count:0,         // total result set count
			limit:0,         // current result limit
			offset:0,        // current result offset
			orders:[],       // column orderings, copied on mount, changable by user
			rows:[],         // current result set
			filtersUser:[],  // current user filters, based on complex conditions
			quickFilter:'',  // current quick text filter
			
			// list constants
			refTabindex:'input_row_', // prefix for vue references to tabindex elements
			
			// list input data
			rowsInput:[]     // rows that reflect current input (following active record IDs)
			                 // as opposed to list rows which show lookup data (regular list or input dropdown)
		};
	},
	computed:{
		// columns can be batched by using the same batch number
		// first column in batch is used for header caption and ordering
		columnBatches:function() {
			let out  = [];
			let that = this;
			
			let addColumn = function(column,index) {
				
				let hidden = column.display === 'hidden' || (that.isMobile && !column.onMobile);
				
				if(column.batch !== null) {
					for(let i = 0, j = out.length; i < j; i++) {
						
						if(out[i].batch === column.batch) {
							// batch already exists, do not create new one
							
							// do not add column if its hidden
							if(hidden) return;
							
							out[i].columnIndexes.push(index);
							out[i].width += column.basis;
							return;
						}
					}
				}
				
				// create new column batch with itself as first column
				// create even if first column is hidden as other columns in same batch might not be
				out.push({
					batch:column.batch,
					caption:that.getColumnCaption(column),
					columnIndexes:!hidden ? [index] : [],
					style:'',
					width:column.basis
				});
			};
			for(let i = 0, j = this.columns.length; i < j; i++) {
				addColumn(this.columns[i],i);
			}
			
			// finalize batches
			for(let i = 0, j = out.length; i < j; i++) {
				
				// remove batches that have no columns
				if(out[i].columnIndexes.length === 0) {
					out.splice(i,1);
					i--; j--;
					continue;
				}
				
				// finalize style
				if(out[i].width !== 0)
					out[i].style = `max-width:${out[i].width}px;`;
			}
			return out;
		},
		choiceIdDefault:function() {
			// default is user field option, fallback is first choice in list
			return this.fieldOptionGet(
				this.fieldId,'choiceId',
				this.choices.length === 0 ? null : this.choices[0].id
			);
		},
		hasBulkActions:function() {
			if(this.isInput || this.rows.length === 0)
				return false;
			
			for(let i = 0, j = this.joins.length; i < j; i++) {
				if(this.joins[i].applyDelete)
					return true;
			}
			return false;
		},
		hasChoices:function() {
			return this.query.choices.length > 1;
		},
		hasGalleryIcon:function() {
			return this.columns.length !== 0 &&
				this.columns[0].display === 'gallery' &&
				(this.columns[0].onMobile || !this.isMobile) &&
				(!this.isInput || this.rowsInput.length !== 0) &&
				this.attributeIdMap[this.columns[0].attributeId].content === 'files'
			;
		},
		hasCreate:function() {
			if(this.joins.length === 0) return false;
			return this.joins[0].applyCreate && this.rowSelect;
		},
		hasUpdate:function() {
			if(this.joins.length === 0) return false;
			return this.joins[0].applyUpdate && this.rowSelect;
		},
		inputLinePlaceholder:function() {
			if(this.focused) return '';
			
			return this.anyInputRows
				? this.capApp.inputPlaceholderAdd
				: this.capGen.threeDots;
		},
		limitOptions:function() {
			let out = [10,25,50,100,250,500,1000];
			
			if(!out.includes(this.limitDefault))
				out.unshift(this.limitDefault);
			
			return out.sort((a,b) => a-b);
		},
		pageCount:function() {
			if(this.count === 0) return 0;
			
			let cnt = Math.floor(this.count / this.limit);
			return this.count % this.limit !== 0 ? cnt+1 : cnt;
		},
		rowsClear:function() {
			let rows = [];
			for(let i = 0, j = this.rows.length; i < j; i++) {
				if(!this.inputRecordIds.includes(this.rows[i].indexRecordIds['0']))
					rows.push(this.rows[i]);
			}
			return rows;
		},
		showInputAddLine:function() {
			return !this.inputAsCategory && (
				!this.anyInputRows || (this.inputMulti && !this.inputIsReadonly)
			);
		},
		showInputAddAll:function() {
			return this.inputMulti && this.rowsClear.length > 0;
		},
		showInputHeader:function() {
			return this.isInput && (
				this.filterQuick ||
				this.hasChoices ||
				this.showInputAddAll ||
				this.offset !== 0 ||
				this.count > this.limit
			);
		},
		
		// filters
		filtersParsedUser:function() {
			return this.getFiltersEncapsulated(
				JSON.parse(JSON.stringify(this.filtersUser))
			);
		},
		filtersParsedQuick:function() {
			if(this.quickFilter === '')
				return [];
			
			let out = [];
			for(let i = 0, j = this.columns.length; i < j; i++) {
				let c = this.columns[i];
				
				if(c.aggregator !== null && c.aggregator !== 'record')
					continue;
				
				out.push({
					connector:i === 0 ? 'AND' : 'OR',
					operator:'ILIKE',
					side0:{
						attributeId:c.attributeId,
						attributeIndex:c.index,
						brackets:0
					},
					side1:{
						brackets:0,
						value:this.quickFilter
					}
				});
			}
			return this.getFiltersEncapsulated(out);
		},
		
		// simple
		anyInputRows:   function() { return this.inputRecordIds.length !== 0; },
		autoSelect:     function() { return this.inputIsNew && this.inputAutoSelect !== 0 && !this.inputAutoSelectDone; },
		choiceFilters:  function() { return this.getChoiceFilters(this.choices,this.choiceId); },
		expressions:    function() { return this.getQueryExpressions(this.columns); },
		joins:          function() { return this.fillRelationRecordIds(this.query.joins); },
		
		// stores
		relationIdMap:   function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:  function() { return this.$store.getters['schema/attributeIdMap']; },
		iconIdMap:       function() { return this.$store.getters['schema/iconIdMap']; },
		capApp:          function() { return this.$store.getters.captions.list; },
		capGen:          function() { return this.$store.getters.captions.generic; },
		isMobile:        function() { return this.$store.getters.isMobile; },
		moduleLanguage:  function() { return this.$store.getters.moduleLanguage; },
		scrollFormId:    function() { return this.$store.getters.scrollFormId; }
	},
	mounted:function() {
		this.showTable = !this.isInput;
		
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(val) return;
			this.inputAutoSelectDone = false;
			this.reloadOutside();
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
		if(this.isFullPage) {
			this.$watch(() => [this.$route.path,this.$route.query],(newVals,oldVals) => {
				if(this.routeChangeFieldReload(newVals,oldVals)) {
					this.paramsUpdated();
					this.reloadOutside();
				}
			});
		}
		
		// if fullpage: set initial states via route parameters
		if(this.isFullPage) {
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
	},
	beforeUnmount:function() {
		this.setAutoRenewTimer(true);
	},
	methods:{
		// externals
		fieldOptionGet,
		fieldOptionSet,
		fillRelationRecordIds,
		getCaption,
		getChoiceFilters,
		getFiltersEncapsulated,
		getQueryAttributesPkFilter,
		getQueryExpressions,
		getRelationsJoined,
		isAttributeFiles,
		isDropdownUpwards,
		routeChangeFieldReload,
		routeParseParams,
		srcBase64,
		
		// presentation
		displayRecordCheck:function(state) {
			if(this.inputMulti)
				return state ? 'checkbox1.png' : 'checkbox0.png';
			
			return state ? 'radio1.png' : 'radio0.png';
		},
		displaySortDir:function(columnBatch) {
			let colIndex = this.getFirstSortableColumnIndexInBatch(columnBatch);
			
			if(colIndex === -1)
				return '';
				
			let orderPos = this.getColumnPosInOrder(colIndex);
			
			if(orderPos !== -1) {
				let postfix = this.orders.length === 1 ? '' : (orderPos+1);
				return (this.orders[orderPos].ascending ? ' \u25B2' : ' \u25BC') + postfix;
			}
			return '';
		},
		updateDropdownDirection:function() {
			let headersPx  = 200; // rough height in px of all headers (menu/form) combined
			let rowPx      = 40;  // rough height in px of one dropdown list row
			let dropdownPx = rowPx * (this.rows.length+1); // +1 for action row
			
			this.inputDropdownUpwards =
				this.isDropdownUpwards(this.$el,dropdownPx,headersPx);
		},
		
		// reloads
		reloadOutside:function() {
			// outside state has changed, reload list or list input
			if(!this.isInput)
				return this.get();
			
			this.getInput();
		},
		reloadInside:function(entity) {
			// inside state has changed, reload list (not relevant for list input)
			switch(entity) {
				case 'dropdown':    // fallthrough
				case 'filterQuick': // fallthrough
				case 'filtersUser': this.offset = 0; break;
				case 'choice':
					this.offset = 0;
					this.fieldOptionSet(this.fieldId,'choiceId',this.choiceId);
				break;
				case 'order':
					this.offset = 0;
					this.orderOverwritten = true;
				break;
				default: break; // no special treatment
			}
			
			// reload full page list by updating route parameters
			// enables browser history for fullpage list navigation
			//  special case: user filters do not have route parameters (need direct reload)
			if(this.isFullPage && entity !== 'filtersUser')
				return this.paramsUpdate(true);
			
			this.get();
		},
		
		// parsing
		paramsUpdate:function(pushHistory) {
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
			if(this.quickFilter !== '')   args.push(`quickfilter=${this.quickFilter}`);
			
			this.$emit('set-args',args,pushHistory);
		},
		paramsUpdated:function() {
			// apply query parameters
			// initial filter choice is set to first available choice (if there are any)
			// initial order by parameter follows query order
			//  if user overwrites order, initial order is empty
			let params = {
				choice:     { parse:'string',   value:this.choiceIdDefault },
				limit:      { parse:'int',      value:this.limitDefault },
				offset:     { parse:'int',      value:0 },
				orderby:    { parse:'listOrder',value:!this.orderOverwritten ? JSON.stringify(this.query.orders) : '[]' },
				quickfilter:{ parse:'string',   value:'' }
			};
			this.routeParseParams(params);
			
			if(this.choiceId !== params['choice'].value)
				this.choiceId = params['choice'].value;
			
			this.limit       = params['limit'].value;
			this.offset      = params['offset'].value;
			this.orders      = JSON.parse(params['orderby'].value);
			this.quickFilter = params['quickfilter'].value;
			
			// apply first order for card layout selector
			this.orderByColumnBatchIndex = -1;
			for(let i = 0, j = this.columnBatches.length; i < j; i++) {
				
				let colIndex = this.getFirstSortableColumnIndexInBatch(this.columnBatches[i]);
				if(colIndex === -1)
					continue;
				
				if(this.getColumnPosInOrder(colIndex) !== -1) {
					this.orderByColumnBatchIndex = i;
					break;
				}
			}
		},
		
		// user actions, generic
		blur:function() {
			this.focused   = false;
			this.showTable = false;
			this.$emit('blurred');
		},
		escape:function() {
			if(this.isInput) {
				this.blur();
				this.showTable = false;
			}
		},
		focus:function() {
			if(!this.inputIsReadonly && this.isInput && !this.inputAsCategory && !this.showTable) {
				this.focused     = true;
				this.quickFilter = '';
				this.$emit('focused');
			}
		},
		keyDown:function(e) {
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
					
					if(e.target !== this.$refs[this.refTabindex+'0'])
						return this.$refs[this.refTabindex+'0'].focus();
					
					return this.$refs[this.refTabindex+String(this.rows.length-1)].focus();
				}
			}
		},
		toggleDropdown:function() {
			this.showTable = !this.showTable;
			
			if(this.showTable) {
				this.quickFilter = '';
				this.reloadInside('dropdown');
			}
		},
		toggleUserFilters:function() {
			this.showFilters = !this.showFilters;
			
			if(!this.showFilters) {
				this.filtersUser = [];
				this.reloadInside('filtersUser');
			}
		},
		toggleRecordId:function(id,middleClick) {
			if(this.inputRecordIds.includes(id))
				this.$emit('record-removed',id);
			else
				this.$emit('record-selected',id,middleClick);
		},
		updatedTextInput:function(event) {
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
		updatedFilterQuick:function() {
			if(this.isInput && !this.showTable)
				this.showTable = true;
			
			this.reloadInside('filterQuick');
		},
		
		// user actions, table layout
		clickColumn:function(columnBatch) {
			let colIndex = this.getFirstSortableColumnIndexInBatch(columnBatch);
			
			if(colIndex === -1)
				return;
			
			let col      = this.columns[colIndex];
			let orderPos = this.getColumnPosInOrder(colIndex);
			if(orderPos === -1) {
				
				// not ordered by this column -> add as ascending order
				if(col.subQuery) {
					this.orders.push({
						expressionPos:colIndex, // equal to expression index
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
			else if(this.orders[orderPos].ascending) {
				
				// ordered ascending by this column -> change to descending
				this.orders[orderPos].ascending = false;
			}
			else {
				// ordered descending by this column -> remove
				this.orders.splice(orderPos,1);
			}
			this.reloadInside('order');
		},
		clickColumnRight:function(columnBatch) {
			let colIndex = this.getFirstSortableColumnIndexInBatch(columnBatch);
			
			if(colIndex === -1)
				return;
			
			let orderPos = this.getColumnPosInOrder(colIndex);
			if(orderPos === -1)
				return;
			
			this.orders.splice(orderPos,1);
			this.reloadInside('order');
		},
		clickRow:function(row,middleClick) {
			let recordId = row.indexRecordIds['0'];
			
			if(this.isInput && !this.inputAsCategory) {
				
				if(!this.inputRecordIds.includes(recordId)) {
					if(this.inputMulti) this.rowsInput.push(row);
					else                this.rowsInput = [row];
				}
				
				this.showTable   = false;
				this.quickFilter = '';
			}
			
			if(this.rowSelect)
				this.toggleRecordId(recordId,middleClick);
		},
		clickRowAll:function() {
			for(let i = 0, j = this.rows.length; i < j; i++) {
				this.clickRow(this.rows[i],false);
			}
		},
		
		// user actions, card layout
		selectOrderBy:function(colBatchIndexString) {
			let colBatchIndex = parseInt(colBatchIndexString);
			this.orders = [];
			
			if(colBatchIndex !== -1) {
				let colBatch = this.columnBatches[colBatchIndex];
				let colIndex = this.getFirstSortableColumnIndexInBatch(colBatch);
				
				if(colIndex === -1)
					return;
				
				let col = this.columns[colIndex];
				
				if(col.subQuery) {
					this.orders.push({
						expressionPos:colIndex, // equal to expression index
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
		setAutoRenewTimer:function(justClear) {
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
		toggleOrderBy:function() {
			this.orders[0].ascending = !this.orders[0].ascending;
			this.reloadInside('order');
		},
		
		// user actions, inputs
		inputTriggerRow:function(row) {
			if(this.inputAsCategory && !this.inputIsReadonly)
				this.toggleRecordId(row.indexRecordIds['0'],false);
			
			this.focus();
		},
		inputTriggerRowRemove:function(i) {
			this.$emit('record-removed',this.rowsInput[i].indexRecordIds['0']);
			this.rowsInput.splice(i,1);
			this.blur();
		},
		
		// bulk selection
		selectRow:function(rowIndex) {
			let pos = this.selectedRows.indexOf(rowIndex);
			
			if(pos === -1)
				this.selectedRows.push(rowIndex);
			else
				this.selectedRows.splice(pos,1);
		},
		selectReset:function() {
			this.selectedRows = [];
		},
		selectRowsAllToggle:function() {
			if(this.rows.length === this.selectedRows.length) {
				this.selectedRows = [];
				return;
			}
			
			this.selectedRows = [];
			
			for(let i = 0, j = this.rows.length; i < j; i++) {
				this.selectedRows.push(i);
			}
		},
		
		// helpers
		getFirstSortableColumnIndexInBatch:function(columnBatch) {
			// if only 1 column is available in batch, return it
			if(columnBatch.columnIndexes.length === 1)
				return columnBatch.columnIndexes[0];
			
			for(let i = 0, j = columnBatch.columnIndexes.length; i < j; i++) {
				let col = this.columns[columnBatch.columnIndexes[i]];
				let atr = this.attributeIdMap[col.attributeId];
				
				if(!this.isAttributeFiles(atr.content))
					return columnBatch.columnIndexes[i];
			}
			
			// if no sortable columns are available, return false
			return -1;
		},
		getColumnCaption:function(c) {
			let a = this.attributeIdMap[c.attributeId];
			
			// 1st preference: dedicated column title
			if(typeof c.captions.columnTitle[this.moduleLanguage] !== 'undefined')
				return c.captions.columnTitle[this.moduleLanguage];
			
			// 2nd preference: dedicated attribute title
			if(typeof a.captions.attributeTitle[this.moduleLanguage] !== 'undefined')
				return a.captions.attributeTitle[this.moduleLanguage];
			
			// if nothing else is available: attribute name
			return a.name;
		},
		getColumnPosInOrder:function(columnIndex) {
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
		delAsk:function(idsToDelete) {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png',
					params:[idsToDelete]
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del:function(idsToDelete) {
			let trans = new wsHub.transactionBlocking();
			
			for(let i = 0, j = this.joins.length; i < j; i++) {
				
				let j = this.joins[i];
				
				if(!j.applyDelete)
					continue;
				
				// specific rows selected
				for(let x = 0, y = idsToDelete.length; x < y; x++) {
					
					let r = this.rows[idsToDelete[x]];
					
					if(r.indexRecordIds[j.index] === 0)
						continue;
					
					trans.add('data','del',{
						relationId:j.relationId,
						recordId:r.indexRecordIds[j.index]
					});
				}
			}
			trans.send(this.handleError,this.delOk);
		},
		delOk:function(res) {
			this.get();
		},
		
		get:function() {
			// nothing to get if nothing is shown or form is currently loading
			if(!this.showTable || this.formLoading)
				return;
			
			// fix invalid offset (can occur when limit is changed)
			if(this.offset !== 0 && this.offset % this.limit !== 0)
				this.offset -= this.offset % this.limit;
			
			// build live filters from user inputs + input records (if set)
			let filters = this.filters
				.concat(this.filtersParsedQuick)
				.concat(this.filtersParsedUser)
				.concat(this.choiceFilters)
			;
			
			if(this.anyInputRows)
				filters.push(this.getQueryAttributesPkFilter(
					this.query.relationId,this.inputRecordIds,0,true
				));
			
			let trans = new wsHub.transactionBlocking();
			trans.add('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.joins),
				expressions:this.expressions,
				filters:filters,
				orders:this.orders,
				limit:this.limit,
				offset:this.offset
			},this.getOk);
			trans.send(this.handleError);
		},
		getOk:function(res) {
			this.count = res.payload.count;
			this.rows  = res.payload.rows;
			this.selectReset();
			
			if(this.isInput)
				this.$nextTick(this.updateDropdownDirection);
		},
		
		getInput:function() {
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
			
			let trans = new wsHub.transaction();
			trans.add('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.joins),
				expressions:this.expressions,
				filters:filters,
				orders:this.orders
			},this.getInputOk);
			trans.send(this.handleError);
		},
		getInputOk:function(res) {
			// apply results to input rows if category or specific record IDs were retrieved
			if(this.inputAsCategory || this.anyInputRows)
				this.rowsInput = res.payload.rows;
			
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
		}
	}
};