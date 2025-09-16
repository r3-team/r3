import MyStore         from '../../stores/store.js';
//import {transliterate} from '../../externals/transliteration.js';

// generates a PDF file from HTML inputs inside a new window
export function generatePdf(filename,format,orientation,marginX,marginY,
	htmlHeader,htmlBody,htmlFooter,cssStyles,callbackResult,closeWhenDone
) {
	import('../../externals/transliteration.js').then((tr) => {
		const capGen     = MyStore.getters.captions.generic;
		const win        = window.open('');
		const marginYMin = 50;
		
		win.r3_callbackResult = callbackResult;
		win.r3_closeWhenDone  = closeWhenDone;
	
		let marginLeft   = Array.isArray(marginX) && marginX.length === 2 ? marginX[0] : marginX;
		let marginRight  = Array.isArray(marginX) && marginX.length === 2 ? marginX[1] : marginX;
		let marginTop    = Array.isArray(marginY) && marginY.length === 2 ? marginY[0] : marginY;
		let marginBottom = Array.isArray(marginY) && marginY.length === 2 ? marginY[1] : marginY;
	
		// apply transliteration
		// ignore all non-latin characters supported by WinAnsiEncoding (all jsPDF fonts are encoded as such)
		tr.transliterate.config({ignore:[
			'€','£','¥','$','¤','@','©','™','®','§','&','ƒ','^','ˆ','~','˜',
			'Æ','Ä','Á','Â','À','Å','Ã','Ç','Ð','É','Ê','Ë','È','Í','Î','Ï',
			'Ì','Ł','Ñ','Ó','Ô','Ö','Ò','Õ','Ø','Š','Ú','Û','Ü','Ù','Ý','Ÿ',
			'Ž','á','â','ä','æ','à','å','ã','ç','¢','é','ê','ë','è','í','î',
			'ï','ì','ñ','ó','ô','ö','ò','ø','õ','ð','š','ú','û','ü','ù','ý',
			'ÿ','ž','˘','ˇ','¦','¸','˛','°','¨','˙','·','-','−','¯','ı','…',
			'ß','«','»','‹','›','<','>','¬','ł','μ','½','¼','¾','‰','ª','º',
			'¹','²','³','±','¿','Þ','°','"','˝','`','„','“','”','‘','’','‚',
			'\''
		]});
		htmlHeader = tr.transliterate(htmlHeader);
		htmlBody   = tr.transliterate(htmlBody);
		htmlFooter = tr.transliterate(htmlFooter);
	
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
					<button onclick="self.close()" style="cursor:pointer;display:flex;align-items:center;line-height:24px;box-shadow:1px 1px 3px #666;">
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
			<script type="text/javascript" src="externals/html2canvas.js"><\/script>
			<script type="text/javascript" src="externals/jspdf.js"><\/script>
			<script type="text/javascript">
				// collect elements to use for PDF document
				let header = document.getElementById('pdf-header');
				let body   = document.getElementById('pdf-body');
				let footer = document.getElementById('pdf-footer');
				
				// generate new PDF document
				const docOptions = {
					compress:true,
					format:'${format}',
					hotfixes:['px_scaling'],
					orientation:'${orientation}',
					unit:'px'
				};
				const { jsPDF } = window.jspdf;
				const doc = new jsPDF(docOptions);
				
				// document working variables
				const headerFooterOffset = 20; // margin from page top if header or from content if footer
				const pageWidth  = doc.internal.pageSize.width - ${marginLeft} - ${marginRight};
				const headerPosY = headerFooterOffset;
				const footerPosY = (doc.internal.pageSize.height - ${marginBottom}) + headerFooterOffset;
				
				const addPageMeta = function(element,elementPosY,pageCur,pageCount) {
					return new Promise((resolve,reject) => {
						// replace placeholders in HTML
						let htmlOrg = element.innerHTML;
						let html    = element.innerHTML;
						html = html.replace('{PAGE_CUR}',pageCur);
						html = html.replace('{PAGE_END}',pageCount);
						element.innerHTML = html;
						
						doc.html(element,{
							autoPaging:false,
							callback:() => {
								// recover original HTML so that placeholders can be reused
								element.innerHTML = htmlOrg;
								resolve();
							},
							width:pageWidth,
							windowWidth:pageWidth,
							x:${marginLeft},
							y:elementPosY
						});
					});
				};
				
				// create document
				// bug: if document created from HTML is > 1 page, adobe reader reports page errors starting with page 2
				// fix: manually add pages that would exist if HTML is rendered (must be added before rendering the HTML)
				// ugly solution: render document once, count pages, render again with the required pages added beforehand
				new jsPDF(docOptions).html(body,{
					autoPaging:'text',
					margin:[${marginTop},${marginRight},${marginBottom},${marginLeft}],
					width:pageWidth,
					windowWidth:pageWidth,
					callback:res => {
						// add pages that are required by the rendered HTML (start with page 2)
						for(let i = 2, j = res.internal.getNumberOfPages(); i <= j; i++) {
							doc.addPage('${format}','${orientation}');
						}
						
						// create document proper
						doc.html(body,{
							autoPaging:'text',
							margin:[${marginTop},${marginRight},${marginBottom},${marginLeft}],
							width:pageWidth,
							windowWidth:pageWidth,
							callback:async () => {
								for(let i = 1, j = doc.internal.getNumberOfPages(); i <= j; i++) {
									doc.setPage(i);
									await addPageMeta(header,headerPosY,i,j);
									await addPageMeta(footer,footerPosY,i,j);
								}
								
								// document done
								if(window.r3_callbackResult !== undefined)
									window.r3_callbackResult(doc.output('blob'));
								
								if(window.r3_closeWhenDone)
									return self.close();
								
								// enable document save action
								document.getElementById('pdf-download').onclick  = () => doc.save('${filename}');
								document.getElementById('pdf-download-icon').src = 'images/download.png';
							}
						});
					}
				});
			<\/script>
		`);
	}).catch(console.warn);

};