import MyStore      from '../../stores/store.js';
import {getNilUuid} from './generic.js';

// generates a PDF file from HTML inputs inside a new window
// optionally uploads generated file to files attribute
export function generatePdf(utf8_mode,filename,format,orientation,marginX,
	marginY,htmlHeader,htmlBody,htmlFooter,cssStyles,attributeId,recordId) {

	if(utf8_mode === undefined || utf8_mode === null || utf8_mode === '') utf8_mode = 'basic';

	return new Promise((resolve,reject) => {
		const uploadFile = attributeId !== undefined && recordId !== undefined;
		const callbackResult = (blob) => {

			if(!uploadFile)
				return resolve();
			
			let formData = new FormData();
			let xhr      = new XMLHttpRequest();
			xhr.onload = event => {
				const res = JSON.parse(xhr.response);
				if(typeof res.error !== 'undefined')
					return reject(res.error);
				
				let value = {fileIdMapChange:{}};
				value.fileIdMapChange[res.id] = {
					action:'create',
					name:filename,
					version:-1
				};
				ws.send('data','set',{0:{
					relationId:MyStore.getters['schema/attributeIdMap'][attributeId].relationId,
					recordId:recordId,
					attributes:[{attributeId:attributeId,value:value}]
				}},true).then(() => resolve(),reject);
			};
			formData.append('token',MyStore.getters['local/token']);
			formData.append('attributeId',attributeId);
			formData.append('fileId',getNilUuid());
			formData.append('file',blob);
			xhr.open('POST','data/upload',true);
			xhr.send(formData);
		};

		const capGen     = MyStore.getters.captions.generic;
		const win        = window.open('');
		const marginYMin = 50;
		
		win.r3_callbackResult = callbackResult;
		win.r3_closeWhenDone  = uploadFile;
	
		let marginLeft   = Array.isArray(marginX) && marginX.length === 2 ? marginX[0] : marginX;
		let marginRight  = Array.isArray(marginX) && marginX.length === 2 ? marginX[1] : marginX;
		let marginTop    = Array.isArray(marginY) && marginY.length === 2 ? marginY[0] : marginY;
		let marginBottom = Array.isArray(marginY) && marginY.length === 2 ? marginY[1] : marginY;
	
		// apply minimums for vertical margins
		// jsPDF will not display headers/footers with tiny top/bottom margins
		if(htmlHeader !== null && htmlHeader !== '' && marginTop    < marginYMin) marginTop    = marginYMin;
		if(htmlFooter !== null && htmlFooter !== '' && marginBottom < marginYMin) marginBottom = marginYMin;
	
		win.document.open();
		win.document.write(`
			<!DOCTYPE html>
			<head>
				<title>${MyStore.getters.pageTitleFull}</title>
				<meta charset="utf-8" />
				<meta name="author" content="GVH" />
				<link rel="icon" type="image/x-icon" href="images/icon_fav.ico" />
				<style>${cssStyles}</style>
			</head>
			<body>
				<!-- actions -->
				<div style="display:flex;gap:12px;margin:20px 10px;">
					<button id="pdf-download" style="cursor:pointer;display:flex;align-items:center;line-height:24px;box-shadow:1px 1px 3px #666;">
						<img id="pdf-download-icon" src="images/load.gif" style="height:24px;margin-right:8px;" />
						<span>${capGen.button.save}</span>
					</button>
					<button onclick="r3_close()" style="cursor:pointer;display:flex;align-items:center;line-height:24px;box-shadow:1px 1px 3px #666;">
						<img src="images/cancel.png" style="height:24px;margin-right:8px;" />
						<span>${capGen.button.close}</span>
					</button>
				</div>
				
				<!-- document preview / parsing -->
				<div style="max-width:1200px;margin-top:30px;padding:${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;border:1px solid #555;border-radius:5px;box-shadow:1px 1px 3px #666;">
					<div id="pdf-header">${htmlHeader}</div>
					<div id="pdf-body">${htmlBody}</div>
					<div id="pdf-footer">${htmlFooter}</div>
				</div>
			</body>
			<script type="text/javascript" src="externals/dompurify.js"><\/script>
			<script type="text/javascript" src="externals/html2canvas.js"><\/script>
			<script type="text/javascript" src="externals/jspdf.js"><\/script>
			<script type="text/javascript" src="externals/transliteration.js"><\/script>
			<script type="text/javascript">
				const r3_close = (doc) => {
					if(window.r3_callbackResult !== undefined) {
						if(doc !== undefined) window.r3_callbackResult(doc.output('blob'));
						else                  window.r3_callbackResult();
					}
					window.close();
				};
				
				const r3_replace_fonts = async (doc,fontNamesAll) => {
					const convertFontBase64 = async (font) => {
						const buf        = await font.arrayBuffer();
						const uint8Array = new Uint8Array(buf);
						let binaryString = '';
						for (let i = 0; i < uint8Array.length; i++) {
							binaryString += String.fromCharCode(uint8Array[i]);
						}
						return btoa(binaryString);
					};
					
					let fetches          = [];
					let fontNamesFetched = [];
					for(const fontName of fontNamesAll) {
						if(fontNamesFetched.includes(fontName))
							continue;
	
						fetches.push(fetch('../../font/' + fontName + '.ttf'));
						fontNamesFetched.push(fontName);
					}
					const res = await Promise.all(fetches);
	
					for(let i = 0; i < fontNamesFetched.length; i++) {
						if(!res[i].ok) continue;
	
						const fontName = fontNamesFetched[i];
						const font     = await convertFontBase64(res[i]);
						doc.addFileToVFS(fontName, font);
					}
					for(let i = 0; i < fontNamesAll.length; i++) {
						// overwite standard jsPDF fonts
						switch(i) {
							case 0:  doc.addFont(fontNamesAll[i],'courier','normal');       break;
							case 1:  doc.addFont(fontNamesAll[i],'courier','bold');         break;
							case 2:  doc.addFont(fontNamesAll[i],'courier','bolditalic');   break;
							case 3:  doc.addFont(fontNamesAll[i],'courier','italic');       break;
							case 4:  doc.addFont(fontNamesAll[i],'helvetica','normal');     break;
							case 5:  doc.addFont(fontNamesAll[i],'helvetica','bold');       break;
							case 6:  doc.addFont(fontNamesAll[i],'helvetica','bolditalic'); break;
							case 7:  doc.addFont(fontNamesAll[i],'helvetica','italic');     break;
							case 8:  doc.addFont(fontNamesAll[i],'times','normal');         break;
							case 9:  doc.addFont(fontNamesAll[i],'times','bold');           break;
							case 10: doc.addFont(fontNamesAll[i],'times','bolditalic');     break;
							case 11: doc.addFont(fontNamesAll[i],'times','italic');         break;
						}
					}
				};
	
				// working variables
				var   bodyIndexPageCount = [];
				const utf8_mode           = '${utf8_mode}';
	
				// collect elements to use for PDF document
				let header = document.getElementById('pdf-header').getHTML();
				let body   = document.getElementById('pdf-body').getHTML();
				let footer = document.getElementById('pdf-footer').getHTML();
	
				// generate new PDF document
				const r3_genDoc = async () => {
					const addPageMeta = async (element,elementPosY,pageCur,pageCount) => {
						// replace placeholders in HTML
						const content = element
							.replace('{PAGE_CUR}',pageCur)
							.replace('{PAGE_END}',pageCount);
						
						await doc.html(content,{
							autoPaging:false,
							width:pageWidthUsable,
							windowWidth:pageWidthUsable,
							x:${marginLeft},
							y:elementPosY
						});
					};
	
					const { jsPDF } = window.jspdf;
					const docOptions = {
						compress:true,
						format:'${format}',
						hotfixes:['px_scaling'],
						orientation:'${orientation}',
						unit:'px'
					};
	
					const doc                = new jsPDF(docOptions);
					const pageMarginX        = ${marginLeft} + ${marginRight};
					const pageMarginY        = ${marginTop} + ${marginBottom};
					const pageHeightUsable   = doc.internal.pageSize.height - pageMarginY;
					const pageWidthUsable    = doc.internal.pageSize.width - pageMarginX;
					const headerFooterOffset = 20; // margin from page top if header or from content if footer
					const headerPosY         = headerFooterOffset;
					const footerPosY         = doc.internal.pageSize.height - ${marginBottom} + headerFooterOffset;
	
					switch(utf8_mode) {
						case 'transliterate':
							// instead of using a UTF8 font, jsPDF has fonts with WinAnsiEncoding, which are small and can be good enough with transliteration
	
							// configuration to not transliterate supported non-latin characters
							transliterate.config({ignore:[
								'€','£','¥','$','¤','@','©','™','®','§','&','ƒ','^','ˆ','~','˜',
								'Æ','Ä','Á','Â','À','Å','Ã','Ç','Ð','É','Ê','Ë','È','Í','Î','Ï',
								'Ì','Ł','Ñ','Ó','Ô','Ö','Ò','Õ','Ø','Š','Ú','Û','Ü','Ù','Ý','Ÿ',
								'Ž','á','â','ä','æ','à','å','ã','ç','¢','é','ê','ë','è','í','î',
								'ï','ì','ñ','ó','ô','ö','ò','ø','õ','ð','š','ú','û','ü','ù','ý',
								'ÿ','ž','˘','ˇ','¦','¸','˛','°','¨','˙','·','-','−','¯','ı','…',
								'ß','«','»','‹','›','<','>','¬','ł','μ','½','¼','¾','‰','ª','º',
								'¹','²','³','±','¿','Þ','°','\"','\˝','\`','\„','\“','\”','\‘',
								'\’','\‚',"'"
							]});
							header = transliterate(header);
							body   = transliterate(body);
							footer = transliterate(footer);
						break;
	
						case 'basic':
							// UTF8 fonts can be used to offer a wide range of characters - since we use .html() calls we do not have direct control over which fonts are requested though
							// jsPDF has 3 WinAnsiEncoding fonts that are used for .html() calls (Courier New, Helvetica, Times New Roman) with 4 styles each (normal, bold, bolditalic, italic)
							// Cousine, NotoSans, Tinos are large UTF8 fonts that support a wide range of characters
							// more direct replacements like Courier Prime (for Courier New) could be used, but they often have a tiny range of characters
							await r3_replace_fonts(doc,[
								'Cousine_','Cousine_B','Cousine_BI','Cousine_I',
								'NotoSans_','NotoSans_B','NotoSans_BI','NotoSans_I',
								'Tinos_','Tinos_B','Tinos_BI','Tinos_I'
							]);
						break;
	
						// for large character languages, replace all 12 jsPDF standard font variants with one UTF8 font
						// not perfect, but finding replacement font families for large languages is tricky + it blows up PDF size as they all need to be included (.html() can use any font at any time)
						case 'arabic':
							await r3_replace_fonts(doc,[
								'NotoSansArabic_','NotoSansArabic_B','NotoSansArabic_B','NotoSansArabic_',
								'NotoSansArabic_','NotoSansArabic_B','NotoSansArabic_B','NotoSansArabic_',
								'NotoSansArabic_','NotoSansArabic_B','NotoSansArabic_B','NotoSansArabic_'
							]);
						break;
						case 'japanese':
							await r3_replace_fonts(doc,[
								'NotoSansJP_','NotoSansJP_B','NotoSansJP_B','NotoSansJP_',
								'NotoSansJP_','NotoSansJP_B','NotoSansJP_B','NotoSansJP_',
								'NotoSansJP_','NotoSansJP_B','NotoSansJP_B','NotoSansJP_'
							]);
						break;
						case 'korean':
							await r3_replace_fonts(doc,[
								'NotoSansKR_','NotoSansKR_B','NotoSansKR_B','NotoSansKR_',
								'NotoSansKR_','NotoSansKR_B','NotoSansKR_B','NotoSansKR_',
								'NotoSansKR_','NotoSansKR_B','NotoSansKR_B','NotoSansKR_'
							]);
						break;
						case 'simplified_chinese':
							await r3_replace_fonts(doc,[
								'NotoSansSC_','NotoSansSC_B','NotoSansSC_B','NotoSansSC_',
								'NotoSansSC_','NotoSansSC_B','NotoSansSC_B','NotoSansSC_',
								'NotoSansSC_','NotoSansSC_B','NotoSansSC_B','NotoSansSC_'
							]);
						break;
						case 'thai':
							await r3_replace_fonts(doc,[
								'NotoSansThai_','NotoSansThai_B','NotoSansThai_B','NotoSansThai_',
								'NotoSansThai_','NotoSansThai_B','NotoSansThai_B','NotoSansThai_',
								'NotoSansThai_','NotoSansThai_B','NotoSansThai_B','NotoSansThai_'
							]);
						break;
					}
	
					// due to the buggy .html() implementation, we need to generate the PDF twice
					// once to count the number of pages that each .html() call requires
					//  and again to add the pages before each .html() is called
					const firstRun  = bodyIndexPageCount.length === 0;
					const partsBody = body.split('{PAGE_BREAK}');
	
					for(let i = 0; i < partsBody.length; i++) {
	
						// the page we start on
						// on initial HTML call, the start page is 1
						// on subsequent HTML calls, the start page is the one the last call ended on
						const pageNoStart = doc.getNumberOfPages();
	
						if(!firstRun) {
							// manually add number of pages that html() requires
							for(let a = 0; a < bodyIndexPageCount[i]; a++) {
								doc.addPage('${format}','${orientation}');
							}
						}
	
						await doc.html(partsBody[i],{
							autoPaging:'text',
							margin:[${marginTop},${marginRight},${marginBottom},${marginLeft}],
							// with y we place the new HTML content at the next page
							y:i === 0 ? 0 : (pageHeightUsable * pageNoStart) - 1,
							width:pageWidthUsable,
							windowWidth:pageWidthUsable
						});
	
						if(firstRun) {
							// store page count that this html() call adds to the doc
							bodyIndexPageCount[i] = doc.getNumberOfPages() - pageNoStart;
						}
					}
	
					if(firstRun)
						return r3_genDoc();
					
					// add headers & footers on each page
					for(let i = 1, j = doc.getNumberOfPages(); i <= j; i++) {
						doc.setPage(i);
						await addPageMeta(header,headerPosY,i,j);
						await addPageMeta(footer,footerPosY,i,j);
					}
					
					// document done
					if(window.r3_closeWhenDone)
						return r3_close(doc);
					
					// enable document save action
					document.getElementById('pdf-download').onclick  = () => doc.save('${filename}');
					document.getElementById('pdf-download-icon').src = 'images/download.png';
				};
				r3_genDoc();
			<\/script>
		`);
	});
};