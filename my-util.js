const { DateTime } = require('luxon')

class MyUtil {
	// Forcibly wrap a string by inserting newline characters if any line exceeds X characters length
	static hardWrapToCharLength(source, charLength){
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

	static isoDateToFileSystemName(date){
		// Destroys information (milliseconds)
		return date.toISOString().replace(':','').replace(':','-').replace(/\.\d{3}/,'').replace('T', '_')
	}

	static strSplice(str, insertionIndex, deleteLength, ...newItems){
		let arr = str.split('')
		arr.splice(insertionIndex, deleteLength, ...newItems)
		let newStr = arr.join('')
		return newStr
	}

	static fileSystemDateStrToIsoDate(dateStr){
		let str = dateStr.replace('_', 'T')
		str = this.strSplice(str, 13, 0, ':')
		str = this.strSplice(str, 16, 1, ':')
		str = this.strSplice(str, 19, 0, '.000')
		return this.utcIsoStringToDateObj(str)
	}

	static filenameFromUri(uri){
		return uri.substring(uri.lastIndexOf('/') + 1)
	}

	static utcIsoStringToDateObj(utcIsoString){
		return DateTime.fromISO(utcIsoString).toJSDate()
	}

	static parseJsonAndReconstitute(obj, classList){
		// classList must be live classes

		return JSON.parse(obj, (key, value)=>{
			if (! value || typeof value !== 'object'){ 
				return value
			} 
			let liveClass = classList[value._class]
			if ( classList.includes(liveClass) ){
				return MyUtil.reconstituteClassFromSimpleParse(liveClass, liveClass.revivalPropTypes, value)
			} else {
				return value
			}
		})
	}

	// NB: only works with shallow properties
	static reconstituteClassFromSimpleParse(liveClass, typePropList, simpleParseObj){
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
				ret[val.propKey] = MyUtil.reconstituteTypeFromSimpleParse(val.typeClass, simpleParseObj[val.propKey]) 	
			}
		})
		return ret
	}

	static reconstituteTypeFromSimpleParse(type, simpleParseVal){
		if (type === Date){
			console.debug('=== reconstituteTypeFromSimpleParse - Casting string to Date')
			return MyUtil.utcIsoStringToDateObj(simpleParseVal)
		} else {
			throw Error('Unsupported type provided to reconstituteTypeFromSimpleParse: ' + type)
		}
	}
}

exports.MyUtil = MyUtil