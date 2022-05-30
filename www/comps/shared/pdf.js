import MyStore from '../../stores/store.js';

// generates a PDF file from HTML inputs inside a new window
export function generatePdf(filename,format,orientation,marginX,marginY,htmlHeader,htmlBody,htmlFooter,cssStyles) {
	const capGen = MyStore.getters.captions.generic;
	const win    = window.open('');
	
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
			<div style="max-width:1200px;margin-top:30px;padding:${marginY}px ${marginX}px;border:1px solid #555;border-radius:5px;box-shadow:1px 1px 3px #666;">
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
			const pageWidth  = doc.internal.pageSize.width - (${marginX} * 2);
			const headerPosY = headerFooterOffset;
			const footerPosY = doc.internal.pageSize.height - ${marginY} + headerFooterOffset;
			
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
						x:${marginX},
						y:elementPosY
					});
				});
			};
			
			// create document
			// bug: if document created from HTML is > 1 page, adobe reader reports page errors starting with page 2
			// fix: manually add pages that would exist if HTML is rendered (must be added before rendering the HTML)
			// ugly soluton: render document once, count pages, render again with the required pages added beforehand
			new jsPDF(docOptions).html(body,{
				autoPaging:'text',
				margin:[${marginY},${marginX},${marginY},${marginX}],
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
						margin:[${marginY},${marginX},${marginY},${marginX}],
						width:pageWidth,
						windowWidth:pageWidth,
						callback:async () => {
							for(let i = 1, j = doc.internal.getNumberOfPages(); i <= j; i++) {
								doc.setPage(i);
								await addPageMeta(header,headerPosY,i,j);
								await addPageMeta(footer,footerPosY,i,j);
							}
							
							// document ready, enable download
							document.getElementById('pdf-download').onclick  = () => doc.save('${filename}');
							document.getElementById('pdf-download-icon').src = 'images/download.png';
						}
					});
				}
			});
		<\/script>
	`);
	win.document.close();
};