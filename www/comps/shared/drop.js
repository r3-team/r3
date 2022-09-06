export function getFilesFromDataItems(dataItems) {
	let files = [];
	
	function traverse(entry, path = '') {
		return new Promise(resolve => {
			if(!entry)
				resolve();
			
			if(entry.isFile)
				return entry.file(file => {
					files.push(file);
					resolve();
				});
			
			if(!entry.isDirectory)
				resolve();
			
			// entry is directory, start reader
			let reader = entry.createReader();
			
			new Promise(resolveSub => {
				let subEntriesPromises = [];
				let readEntries = () => {
					reader.readEntries(subEntries => {
						
						if(subEntries.length === 0) {
							// no more sub entries available, resolve
							resolveSub(Promise.all(subEntriesPromises));
						}
						else {
							// traverse any sub entry in the current directory
							for(let subEntry of subEntries) {
								subEntriesPromises.push(
									traverse(subEntry, path + entry.name + '/')
								);
							}
							
							// readEntries can in some cases deliver subsets of results
							// chrome only ever delivers 100 results at once
							// needs to be called as long as results are not 0
							readEntries();
						}
					});
				}
				// initial read of directory
				readEntries();
				
			}).then(resolve);
		});
	}
	
	return new Promise(resolve => {
		let entriesPromises = [];
		
		for(let i = 0, j = dataItems.length; i < j; i++) {
			entriesPromises.push(traverse(dataItems[i].webkitGetAsEntry()));
		}
		Promise.all(entriesPromises).then(() => {
			resolve(files);
		});
	});
};