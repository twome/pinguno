// Built-in
const path = require('path')

// 3rd-party
const { DateTime } = require('luxon')

// Forcibly wrap a string by inserting newline characters if any line exceeds X characters length
export let hardWrapToCharLength = (source, charLength)=>{
	let inputLines = source.split(`\n`)
	let truncatedLines = []
	for (let i = 0; i < inputLines.length; i = i + 1){
		let line = inputLines[i]
		if (line.length > charLength){
			let truncated = line.slice(0, charLength)
			let remainder = line.slice(charLength, line.length)
			inputLines.splice(i + 1, 0, remainder) // Push the remaining content to a new input line
			truncatedLines.push(truncated)
		} else {
			truncatedLines.push(line)
		}
	}
	let continuous = []
	for (let line of truncatedLines){
		continuous.push(line + `\n`) // Add 1 newline per line
	}
	let ret = continuous.join('') // Combine into 1 string
	ret = ret.slice(0, ret.length - 1) // Trim the final newline we added
	return ret
}

export let isoDateToFileSystemName = (date)=>{
	// Destroys information (milliseconds)
	return date.toISOString().replace(':','').replace(':','-').replace(/\.\d{3}/,'').replace('T', '_')
}

export let strSplice = (str, insertionIndex, deleteLength, ...newItems)=>{
	let arr = str.split('')
	arr.splice(insertionIndex, deleteLength, ...newItems)
	let newStr = arr.join('')
	return newStr
}

export let fileSystemDateStrToIsoDate = (dateStr)=>{
	let str = dateStr.replace('_', 'T')
	str = this.strSplice(str, 13, 0, ':')
	str = this.strSplice(str, 16, 1, ':')
	str = this.strSplice(str, 19, 0, '.000')
	return this.utcIsoStringToDateObj(str)
}

export let filenameFromUri = (uri)=>{
	return uri.substring(uri.lastIndexOf('/') + 1)
}

export let utcIsoStringToDateObj = (utcIsoString)=>{
	return DateTime.fromISO(utcIsoString).toJSDate()
}

export let parseJsonAndReconstitute = (obj, classList)=>{
	// classList must be live classes

	return JSON.parse(obj, (key, value)=>{
		if (! value || typeof value !== 'object'){ 
			return value
		} 
		let liveClass = classList[value._class]
		if ( classList.includes(liveClass) ){
			return reconstituteClassFromSimpleParse(liveClass, liveClass.revivalPropTypes, value)
		} else {
			return value
		}
	})
}

// NB: only works with shallow properties
export let reconstituteClassFromSimpleParse = (liveClass, typePropList, simpleParseObj)=>{
	if (!typePropList || typePropList.length <= 0){
		throw Error('No revivalPropTypes available for class ' + liveClass._class)
	}

	let ret = new liveClass()
	ret = Object.assign(ret, simpleParseObj)
	typePropList.forEach((val) => {
		if (typeof ret[val.reviveFn] === 'function'){
			// We can specify a 'reviveFn' instead of a 'type' if we need a customised revival function for this particular property
			ret[val.propKey] = val.reviveFn(simpleParseObj[val.propKey])
		} else {
			ret[val.propKey] = reconstituteTypeFromSimpleParse(val.typeClass, simpleParseObj[val.propKey]) 	
		}
	})
	return ret
}

export let reconstituteTypeFromSimpleParse = (type, simpleParseVal)=>{
	if (type === Date){
		console.debug('=== reconstituteTypeFromSimpleParse - Casting string to Date')
		return utcIsoStringToDateObj(simpleParseVal)
	} else {
		throw Error('Unsupported type provided to reconstituteTypeFromSimpleParse: ' + type)
	}
}
/*
	DeFault (hence 'df') all `options` properties to their default values, and warn if an 
	unknown/unexpected argument-object property is defined (eg if a property is misspelled)

	This can be used within the parameter definition of a function, like so:
	let df = defaultAndValidateArgs
	let fn = (optionsObj, opt = df(optionsObj, {
		color: 'green'
	},{
		color: (value)=>{
			
		}
	}))=>{
		
	}
*/
export let defaultAndValidateArgs = (options, defaultOptions, validateFns)=>{
	if (typeof options !== 'object' || typeof options !== 'undefined'){ throw Error('`options` must be an object') }
	if (typeof defaultOptions !== 'object' || typeof defaultOptions !== 'undefined'){ throw Error('`defaultOptions` must be an object') }
	options = options || {}
	defaultOptions = defaultOptions || {}

	// Warn about all options keys that are not present in defaultOptions
	Object.keys(options).filter(key => defaultOptions[key] === undefined).forEach(key => {
		console.warn(`Unknown options-object property: ${key}`)
		delete options[key]
	})
	if (typeof validateFns === 'object'){
		Object.keys(validateFns).forEach(key => {
			let validationResult = validateFns[key](options[key])
			if (validationResult instanceof Error){
				throw validationResult
			} else if (!validationResult){
				throw Error(`Argument for ${key} failed to validate & the validation fn returned a non-Error type: ${validationResult}`)
			}
		}) // Run any optional validation functions 
	} else if (validateFns){
		throw Error('`validateFns` needs to be an object, with keys that correspond to the keys of the `options` object, and with values that are validation functions.')
	}
	return Object.assign(defaultOptions, options)
}

export let isValidURL = (str)=>{
	try {
		new URL(str)
		return true
	} catch (err){
		return false
	}
}