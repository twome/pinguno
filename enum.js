class Enum {
	constructor(valueArr){

		// You can give this an array of strings which are converted to objects
		for (let val of valueArr){
			if (typeof val === 'string'){
				this[val] = {
					accessor: valueArr.indexOf(val) + 1, // Don't use zero-based indices in enums; for truthiness we want the first index to be index 1
					humanName: val
				}
			} else if (typeof val === 'object'){
				this[val.accessor] = {
					accessor: val.accessor,
					humanName: val.humanName || val.accessor
				}
			} else {
				throw new Error('Unknown type for Enum values: must be a string or object with properties "accessor" [and "humanName"]')
			}
		}

		Object.freeze(this)
	}
}

exports.Enum = Enum