import MyBuilderCaption       from './builderCaption.js';
import MyBuilderIconInput     from './builderIconInput.js';
import MyBuilderSchemaLookup  from './builderSchemaLookup.js';
import {getUuidV4}            from '../shared/crypto.js';
import {copyValueDialog}      from '../shared/generic.js';
import {getTemplateAttribute} from '../shared/builderTemplate.js';
import {dialogDeleteAsk}      from '../shared/dialog.js';
import {getHasAnyReferences}  from '../shared/schemaLookup.js';
import {getDependentModules}  from '../shared/builder.js';
import {
	getAttributeContentUse,
	getAttributeIcon,
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeFloat,
	isAttributeInteger,
	isAttributeNumeric,
	isAttributeRegconfig,
	isAttributeRelationship,
	isAttributeRelationship11,
	isAttributeRelationshipN1,
	isAttributeString,
	isAttributeUuid
} from '../shared/attribute.js';

export default {
	name:'my-builder-attribute',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput,
		MyBuilderSchemaLookup
	},
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-attribute float" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" :src="'images/'+getAttributeIcon(values.content,values.contentUse,false,false)" />
					<h1 class="title">{{ title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set(false)"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="save_new.png"
						@trigger="set(true)"
						:active="canSave"
						:caption="isNew ? capGen.button.createNew : capGen.button.saveNew"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
				</div>
				<div class="area">
					<my-button image="visible1.png"
						@trigger="copyValueDialog(values.name,attributeId,attributeId)"
						:active="!isNew"
						:caption="capGen.id"
					/>
					<my-button image="builderLookup.png"
						@trigger="showLookup = true"
						:active="!isNew"
						:caption="capGen.references"
					/>
					<my-button image="delete.png"
						@trigger="delCheck"
						:active="!isNew && !isId && !readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>

			<div class="content default-inputs no-padding">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td>
								<input v-focus v-model="values.name" :disabled="readonly || isId" />
								<p class="textError" v-if="nameTaken">{{ capGen.error.nameTaken }}</p>
							</td>
							<td>{{ capApp.nameHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<div class="row gap centered">
									<my-builder-caption
										v-model="values.captions.attributeTitle"
										:language="builderLanguage"
										:readonly
									/>
									<my-button image="languages.png"
										@trigger="$emit('next-language')"
										:active="module.languages.length > 1"
									/>
								</div>
							</td>
							<td>{{ capApp.titleHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.icon }}</td>
							<td><my-builder-icon-input v-model="values.iconId" :module :readonly /></td>
							<td>{{ capApp.iconHint }}</td>
						</tr>
						<tr v-if="!isId">
							<td>{{ capApp.usedFor }}</td>
							<td>
								<div class="row centered gap">
									<select v-model="usedFor" :disabled="readonly" @change="changedUsedFor">
										<optgroup :label="capGen.standard">
											<option value="text"     :disabled="!isNew && (!isString || isDrawing || isBarcode)">{{ capApp.option.text }}</option>
											<option value="textarea" :disabled="!isNew && (!isString || isDrawing || isBarcode)">{{ capApp.option.textarea }}</option>
											<option value="richtext" :disabled="!isNew && (!isString || isDrawing || isBarcode)">{{ capApp.option.richtext }}</option>
											<option value="number"   :disabled="!isNew && !isInteger">{{ capApp.option.number }}</option>
											<option value="decimal"  :disabled="!isNew && !isNumeric">{{ capApp.option.decimal }}</option>
											<option value="color"    :disabled="!isNew && (!isString || isDrawing || isBarcode)">{{ capApp.option.color }}</option>
											<option value="iframe"   :disabled="!isNew && (!isString || isDrawing || isBarcode)">{{ capApp.option.iframe }}</option>
											<option value="drawing"  :disabled="!isNew && !isDrawing">{{ capApp.option.drawing }}</option>
											<option value="boolean"  :disabled="!isNew && !isBoolean">{{ capApp.option.boolean }}</option>
											<option value="files"    :disabled="!isNew && !isFiles">{{ capApp.option.files }}</option>
										</optgroup>
										<optgroup :label="capApp.datetimes" :disabled="!isNew && !isInteger">
											<option value="datetime">{{ capApp.option.datetime }}</option>
											<option value="date">{{ capApp.option.date }}</option>
											<option value="time">{{ capApp.option.time }}</option>
										</optgroup>
										<optgroup :label="capGen.relationships" :disabled="!isNew && !isRelationship">
											<option value="relationshipN1">{{ capApp.option.relationshipN1 }}</option>
											<option value="relationship11">{{ capApp.option.relationship11 }}</option>
										</optgroup>
										<optgroup :label="capApp.barcodes" :disabled="!isNew && !isBarcode">
											<option value="barcode" :disabled="!isNew && !isBarcode">{{ capApp.option.barcode }}</option>
											<option value="barcode_qrcode" :disabled="!isNew && !isBarcode">{{ capGen.codeQr }}</option>
											<option value="barcode_codabar" :disabled="!isNew && !isBarcode">CODABAR</option>
											<option value="barcode_code39" :disabled="!isNew && !isBarcode">CODE 39</option>
											<option value="barcode_code128" :disabled="!isNew && !isBarcode">CODE 128</option>
											<option value="barcode_ean8" :disabled="!isNew && !isBarcode">EAN 8</option>
											<option value="barcode_ean13" :disabled="!isNew && !isBarcode">EAN 13</option>
											<option value="barcode_itf" :disabled="!isNew && !isBarcode">ITF</option>
											<option value="barcode_upc_a" :disabled="!isNew && !isBarcode">UPC A</option>
											<option value="barcode_upc_e" :disabled="!isNew && !isBarcode">UPC E</option>
										</optgroup>
										<optgroup :label="capApp.expert" :disabled="!isNew && !isFloat && !isUuid">
											<option value="float"     :disabled="!isNew && !isFloat">{{ capApp.option.float }}</option>
											<option value="uuid"      :disabled="!isNew && !isUuid">{{ capApp.option.uuid }}</option>
											<option value="regconfig" :disabled="!isNew && !isRegconfig">{{ capApp.option.regconfig }}</option>
										</optgroup>
									</select>
									<my-button
										:active="false"
										:image="getAttributeIcon(values.content,values.contentUse,false,false)"
										:naked="true"
									/>
								</div>
							</td>
							<td>{{ capApp.usedForHint[usedFor] }}</td>
						</tr>

						<!-- relationship settings -->
						<template v-if="isRelationship">
							<tr>
								<td>{{ capApp.relationshipId }}</td>
								<td>
									<select
										v-model="values.relationshipId"
										:disabled="!isNew || readonly"
									>
										<option :value="null">-</option>
										<option v-for="rel in module.relations" :value="rel.id">
											{{ rel.name }}
										</option>

										<!-- relations from other modules -->
										<optgroup
											v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.relations.length !== 0)"
											:label="mod.name"
										>
											<option v-for="rel in mod.relations" :value="rel.id">
												{{ mod.name + ': ' + rel.name }}
											</option>
										</optgroup>
									</select>
								</td>
								<td></td>
							</tr>
							<tr>
								<td>{{ capApp.onDelete }}</td>
								<td>
									<select v-model="values.onDelete" :disabled="readonly">
										<option value="NO ACTION">NO ACTION</option>
										<option value="CASCADE">CASCADE</option>
										<option value="SET NULL">SET NULL</option>
										<option value="RESTRICT">RESTRICT</option>
									</select>
								</td>
								<td>{{ capApp.option.relationshipActionsHints[values.onDelete] }}</td>
							</tr>
							<tr>
								<td>{{ capApp.onUpdate }}</td>
								<td>
									<select v-model="values.onUpdate" :disabled="readonly">
										<option value="NO ACTION">NO ACTION</option>
										<option value="CASCADE">CASCADE</option>
										<option value="SET NULL">SET NULL</option>
										<option value="RESTRICT">RESTRICT</option>
									</select>
								</td>
								<td>{{ capApp.option.relationshipActionsHintsOnUpdate }}</td>
							</tr>
						</template>

						<!-- bigint -->
						<tr v-if="isInteger && !isTime">
							<td>{{ isDate || isDatetime ? capApp.bigintDates : capApp.bigint }}</td>
							<td><my-bool v-model="bigint" :readonly /></td>
							<td>{{ isDate || isDatetime ? capApp.bigintDatesHint : capApp.bigintHint }}</td>
						</tr>

						<!-- double precision -->
						<tr v-if="isFloat">
							<td>{{ capApp.doublePrecision }}</td>
							<td><my-bool v-model="doublePrecision" :readonly="readonly" /></td>
							<td>{{ capApp.doublePrecisionHint }}</td>
						</tr>

						<!-- text/files length -->
						<tr v-if="hasLength && !hasLengthFract">
							<td>{{ lengthTitle }}</td>
							<td>
								<input type="number"
									@input="updateLengths('length',$event.target)"
									:disabled="readonly"
									:value="values.length"
								/>
							</td>
							<td></td>
						</tr>

						<!-- decimal length -->
						<tr v-if="hasLengthFract">
							<td>{{ capApp.lengthNumeric }}</td>
							<td>
								<table>
									<tbody>
										<tr>
											<td>{{ capApp.lengthFract0 }}</td>
											<td>{{ capApp.lengthFract1 }}</td>
										</tr>
										<tr>
											<td>
												<input type="number"
													@input="updateLengths('length',$event.target)"
													:disabled="readonly"
													:value="values.length - values.lengthFract"
												/>
											</td>
											<td>
												<input type="number"
													@input="updateLengths('lengthFract',$event.target)"
													:disabled="readonly"
													:value="values.lengthFract"
												/>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
							<td v-if="values.length !== 0 || values.lengthFract !== 0">
								{{ capApp.lengthFractHint.replace('{C0}','9'.repeat(values.length - values.lengthFract)).replace('{C1}','9'.repeat(values.lengthFract)) }}
							</td>
							<td v-else>{{ capApp.lengthFractHintMax }}</td>
						</tr>

						<!-- encrypted -->
						<tr v-if="canEncrypt">
							<td>{{ capApp.encrypted }}</td>
							<td><my-bool v-model="values.encrypted" :readonly /></td>
							<td>{{ capApp.encryptedHint }}</td>
						</tr>

						<!-- nullable -->
						<tr v-if="!isId">
							<td>{{ capApp.nullable }}</td>
							<td><my-bool v-model="values.nullable" :readonly="readonly || isId" :reversed="true" /></td>
							<td>{{ capApp.nullableHint }}</td>
						</tr>

						<!-- defaults -->
						<tr v-if="!isId && !isFiles && !isRelationship">
							<td>{{ capApp.defaults }}</td>
							<td>
								<div class="column gap">
									<select v-model="defaultsOption" @change="updateDefaultsOption" :disabled="readonly">
										<option value="fixed">[{{ capApp.option.defaults.fixed }}]</option>
										<option value="date"     :disabled="!isDate">{{ capApp.option.defaults.date }}</option>
										<option value="datetime" :disabled="!isDatetime">{{ capApp.option.defaults.datetime }}</option>
										<option value="uuid"     :disabled="!isUuid">{{ capApp.option.defaults.uuid }}</option>
									</select>
									<input placeholder="..."
										v-if="defaultsOption === 'fixed'"
										v-model="values.def"
										:disabled="readonly"
									/>
								</div>
							</td>
							<td>{{ capApp.defaultsHint }}</td>
						</tr>

						<!-- expert info -->
						<tr>
							<td>{{ capApp.content }}</td>
							<td><input :value="values.content" disabled="disabled" /></td>
							<td>{{ capApp.contentHint }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- schema lookup dialog -->
		<my-builder-schema-lookup entity="attribute"
			v-if="showLookup"
			@close="showLookup = false"
			:entityId="attributeId"
			:entityName="values.name"
			:module
			:warningMsg="hasReferences ? capGen.dialog.referencesBlockDeletion : null"
		/>
	</div>`,
	props:{
		attributeId:    { required:true },
		builderLanguage:{ type:String,  required:true },
		readonly:       { type:Boolean, required:true },
		relation:       { type:Object,  required:true }
	},
	emits:['close','next-language','new-record'],
	data() {
		return {
			defaultsOption:'fixed',
			hasReferences:false,
			showLookup:false,

			// attribute values
			values:null,
			valuesOrg:null
		};
	},
	computed:{
		// indirect inputs (update attribute values)
		bigint:{
			get()  { return this.values.content === 'bigint'; },
			set(v) { this.values.content = v ? 'bigint' : 'integer'; }
		},
		doublePrecision:{
			get()  { return this.values.content === 'double precision'; },
			set(v) { this.values.content = v ? 'double precision' : 'real'; }
		},
		usedFor:{
			get() { return this.getAttributeContentUse(this.values.content, this.values.contentUse); },
			set(v) {
				switch(v) {
					// text uses
					case 'richtext': // fallthrough
					case 'text':     // fallthrough
					case 'textarea':
						if(this.isNew) {
							this.values.content = 'text';
							this.values.length  = 0;
						}
						// textarea/richtext are specific content uses
						this.values.contentUse = v === 'text' ? 'default' : v;
					break;
					case 'color':
						this.values.content    = 'varchar';
						this.values.contentUse = 'color';
						this.values.length     = 6;
					break;
					case 'drawing':
						this.values.content    = 'text';
						this.values.contentUse = 'drawing';
						this.values.length     = 0;
					break;
					case 'iframe':
						this.values.content    = 'text';
						this.values.contentUse = 'iframe';
						this.values.length     = 0;
					break;

					// boolean uses
					case 'boolean':
						this.values.content    = 'boolean';
						this.values.contentUse = 'default';
					break;

					// integer uses
					case 'date':     // fallthrough
					case 'datetime': // fallthrough
					case 'time':
						if(this.isNew)
							this.values.content = v === 'time' ? 'integer' : 'bigint';

						this.values.contentUse = v;
					break;
					case 'number':
						this.values.content    = this.isNew ? 'integer' : this.values.content;
						this.values.contentUse = 'default';
					break;

					// numeric uses
					case 'decimal':
						this.values.content    = 'numeric';
						this.values.contentUse = 'default';
					break;

					// files uses
					case 'files':
						this.values.content    = 'files';
						this.values.contentUse = 'default';
					break;

					// float uses
					case 'float':
						this.values.content    = this.isNew ? 'real' : this.values.content;
						this.values.contentUse = 'default';
					break;

					// code uses
					case 'barcode': // fallthrough
					case 'barcode_codabar': // fallthrough
					case 'barcode_code39': // fallthrough
					case 'barcode_code128': // fallthrough
					case 'barcode_ean8': // fallthrough
					case 'barcode_ean13': // fallthrough
					case 'barcode_itf': // fallthrough
					case 'barcode_qrcode': // fallthrough
					case 'barcode_upc_a': // fallthrough
					case 'barcode_upc_e':
						this.values.content    = 'text';
						this.values.contentUse = v;
						this.values.length     = 0;
					break;

					// relationship uses
					case 'relationship11': // fallthrough
					case 'relationshipN1':
						this.values.content    = v === 'relationship11' ? '1:1' : 'n:1';
						this.values.contentUse = 'default';
					break;

					// regconfig uses
					case 'regconfig':
						this.values.content    = 'regconfig';
						this.values.contentUse = 'default';
					break;

					// UUID uses
					case 'uuid':
						this.values.content    = 'uuid';
						this.values.contentUse = 'default';
					break;
				}

				// reset defaults
				this.values.def     = '';
				this.defaultsOption = 'fixed';
			}
		},

		lengthTitle:s => {
			if(s.isString)  return s.capApp.lengthText;
			if(s.isNumeric) return s.capApp.lengthNumeric;
			return s.capApp.lengthFiles;
		},
		nameTaken:s => {
			for(let a of s.relation.attributes) {
				if(a.id !== s.attributeId && a.name === s.values.name)
					return true;
			}
			return false;
		},

		// simple
		canEncrypt:    s => s.relation.encryption && s.values.content === 'text',
		canSave:       s => !s.readonly && s.hasChanges && !s.nameTaken,
		hasChanges:    s => s.values.name !== '' && JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		hasLength:     s => ['decimal','files','richtext','text','textarea'].includes(s.usedFor),
		hasLengthFract:s => ['decimal'].includes(s.usedFor),
		isId:          s => !s.isNew && s.values.name === 'id',
		isNew:         s => s.attributeId === null,
		title:         s => s.isNew ? s.capApp.new : s.capApp.edit.replace('{NAME}',s.values.name),

		// content
		isBoolean:       s => s.isAttributeBoolean(s.values.content),
		isFiles:         s => s.isAttributeFiles(s.values.content),
		isFloat:         s => s.isAttributeFloat(s.values.content),
		isInteger:       s => s.isAttributeInteger(s.values.content),
		isNumeric:       s => s.isAttributeNumeric(s.values.content),
		isRegconfig:     s => s.isAttributeRegconfig(s.values.content),
		isRelationship:  s => s.isAttributeRelationship(s.values.content),
		isRelationship11:s => s.isAttributeRelationship11(s.values.content),
		isRelationshipN1:s => s.isAttributeRelationshipN1(s.values.content),
		isString:        s => s.isAttributeString(s.values.content),
		isUuid:          s => s.isAttributeUuid(s.values.content),

		// content use
		isBarcode: s => s.isString  && s.values.contentUse.includes('barcode'),
		isColor:   s => s.isString  && s.values.contentUse === 'color',
		isDate:    s => s.isInteger && s.values.contentUse === 'date',
		isDatetime:s => s.isInteger && s.values.contentUse === 'datetime',
		isDrawing: s => s.isString  && s.values.contentUse === 'drawing',
		isIframe:  s => s.isString  && s.values.contentUse === 'iframe',
		isNumber:  s => s.isInteger && s.values.contentUse === 'default',
		isRichtext:s => s.isString  && s.values.contentUse === 'richtext',
		isText:    s => s.isString  && s.values.contentUse === 'default',
		isTextarea:s => s.isString  && s.values.contentUse === 'textarea',
		isTime:    s => s.isInteger && s.values.contentUse === 'time',

		// stores
		moduleIdMap:   s => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.attribute,
		capGen:        s => s.$store.getters.captions.generic,
		module:        s => s.moduleIdMap[s.relation.moduleId]
	},
	mounted() {
		this.reset();
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		copyValueDialog,
		dialogDeleteAsk,
		getAttributeContentUse,
		getAttributeIcon,
		getDependentModules,
		getHasAnyReferences,
		getTemplateAttribute,
		getUuidV4,
		isAttributeBoolean,
		isAttributeFiles,
		isAttributeFloat,
		isAttributeInteger,
		isAttributeNumeric,
		isAttributeRegconfig,
		isAttributeRelationship,
		isAttributeRelationship11,
		isAttributeRelationshipN1,
		isAttributeString,
		isAttributeUuid,

		// actions
		changedUsedFor() {
			if(!this.isRelationship && this.values.relationshipId !== null)
				this.values.relationshipId = null;
		},
		close() {
			this.$emit('close');
		},
		reset() {
			this.values = this.attributeId !== null
				? JSON.parse(JSON.stringify(this.attributeIdMap[this.attributeId]))
				: this.getTemplateAttribute(this.relation.moduleId,this.relation.id,'');

			this.resetOrg();

			// set defaults option
			switch(this.values.def) {
				case 'EXTRACT(EPOCH FROM CURRENT_DATE)': this.defaultsOption = 'date';     break;
				case 'EXTRACT(EPOCH FROM NOW())':        this.defaultsOption = 'datetime'; break;
				case 'GEN_RANDOM_UUID()':                this.defaultsOption = 'uuid';     break;
			}
		},
		resetOrg() {
			this.valuesOrg = JSON.parse(JSON.stringify(this.values));
		},
		updateDefaultsOption() {
			switch(this.defaultsOption) {
				case 'date':     this.values.def = 'EXTRACT(EPOCH FROM CURRENT_DATE)'; break;
				case 'datetime': this.values.def = 'EXTRACT(EPOCH FROM NOW())';        break;
				case 'uuid':     this.values.def = 'GEN_RANDOM_UUID()';                break;
				default:         this.values.def = '';                                 break;
			}
		},
		updateLengths(name,target) {
			var newValue = target.value === '' ? 0  : parseInt(target.value);
			var oldValue = this.values[name];

			if(newValue < 0) {
				newValue = 0;
				target.value = 0;
			}

			switch(name) {
				case 'length':
					if(this.hasLengthFract)
						newValue += this.values.lengthFract;

					if(this.isString)
						this.values.content = newValue === 0 ? 'text' : 'varchar';
				break;
				case 'lengthFract':
					this.values.length += newValue - oldValue;
				break;
			}
			this.values[name] = newValue;
		},

		// backend calls
		delCheck() {
			this.hasReferences = this.getHasAnyReferences(this.module,'attribute',this.attributeId);
			if(this.hasReferences)
				return this.showLookup = true;

			this.dialogDeleteAsk(this.del,this.capApp.dialog.delete);
		},
		del() {
			ws.send('attribute','del',this.attributeId,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$emit('close');
				},
				this.$root.genericError
			);
		},
		set(saveAndNew) {
			if (!this.canSave)
				return;

			if(this.values.encrypted && !this.canEncrypt)
				this.values.encrypted = false;

			ws.sendMultiple([
				ws.prepare('attribute','set',this.values),
				ws.prepare('schema','check',{ moduleId:this.module.id })
			],true).then(
				() => {
					this.$root.schemaReload(this.module.id);

					if(saveAndNew) {
						this.$emit('new-record');
						this.values.id   = this.getUuidV4();
						this.values.name = '';
						this.resetOrg();
						return;
					}
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};
