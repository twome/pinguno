const moment = require('moment')

class MyUtil {
	static isoDateToFileSystemName(date){
		// Destroys information (milliseconds)
		return date.toISOString().replace(':','').replace(':','-').replace(/\.\d{3}/,'').replace('T', '_')
	}

	static filenameFromUri(uri){
		return uri.substring(uri.lastIndexOf('/') + 1)
	}

	static utcIsoStringToDateObj(utcIsoString){
		return moment(utcIsoString, moment.ISO_8601, true).toDate()
	}

	static parseJsonAndReconstitute(obj, classList){
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
	static reconstituteClassFromSimpleParse(liveClass, typePropList, simpleParseClass){
		if (!typePropList || typePropList.length <= 0){
			throw Error('No revivalPropTypes available for class ' + liveClass._class)
		}

		let ret = new liveClass()
		ret = Object.assign(ret, simpleParseClass)
		typePropList.forEach((val) => {
			ret[val.propKey] = reconstituteTypeFromSimpleParse(val.typeClass, simpleParseClass[val.propKey]) 
		})
		return ret
	}

	static reconstituteTypeFromSimpleParse(type, simpleParseVal){
		if (type === Date){
			console.debug('=== reconstituteTypeFromSimpleParse - Casting string to Date')
			return moment(simpleParseVal, moment.ISO_8601, true).toDate()
		} else {
			throw Error('Unsupported type provided to reconstituteTypeFromSimpleParse: ' + type)
		}
	}
}

exports.MyUtil = MyUtil