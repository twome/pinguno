let collectPropertyAcrossInstancesDeep = (instanceList, keysArr, instanceNameProp)=>{
	let collection = []

	for (let instance of instanceList){
		let here = instance
		for (let key of keysArr){
			here = here[key] // Dive deeper into the path of keys
		}
		// Optionally return 
		if (instanceNameProp){ here = {here, name: instance[instanceNameProp]} }
		collection.push(here)
	}

	return collection
}


export { collectPropertyAcrossInstancesDeep }