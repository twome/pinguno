class MyUtil {
	static isoDateToFileSystemName(date){
		// Destroys information (milliseconds)
		return date.toISOString().replace(':','').replace(':','-').replace(/\.\d{3}/,'').replace('T', '_')
	}

	static filenameFromUri(uri){
		return uri.substring(uri.lastIndexOf('/') + 1)
	}
}

exports.MyUtil = MyUtil