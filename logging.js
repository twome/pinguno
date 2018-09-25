console.info('RUNNING: logging.js')

// Built-in modules
const fs = require('fs')
const zlib = require('zlib')
const util = require('util')

// 3rd-party dependencies
const getFolderSize = require('get-folder-size')
const moment = require('moment')
const { _ } = require('lodash')

// In-house modules
const { config } = require('./config.js')
const { MyUtil } = require('./my-util.js')
const { Outage, TargetOutage, PingsLog } = require('./ping-formats.js')

const fsWriteFilePromise = util.promisify(fs.writeFile)
const fsReadFilePromise = util.promisify(fs.readFile)

let writeNewSessionLog = (instance)=>{
	const combinedTargets = instance.combineTargetsForExport()
	const content = JSON.stringify(combinedTargets, null, instance.opt.pingLogIndent)
	const fileCreationDate = new Date()
	
	// Turn ISO string into filesystem-compatible string (also strip milliseconds)
	const filename = MyUtil.isoDateToFileSystemName(fileCreationDate) + ' ' + instance.opt.logStandardFilename + '.json'

	fs.mkdir(instance.opt.logsDir, undefined, (err)=>{
		if (err){ 
			// We just want to make sure the folder exists so this doesn't matter
		}

		const fileUri = instance.opt.logsDir + '/' + filename 

		// Keep track of this session's log so we can come back and update it
		instance.activeLogUri = fileUri

		return fsWriteFilePromise(fileUri, content, 'utf8').then((file)=>{
			console.info('Wrote log to ' + fileUri)
		}, (error)=>{
			console.error(error)
		})
	})
}

// Read, extend, and overwrite this sessions existing log file
let extendExistingSessionLog = (instance)=>{
	// TODO: clean this up; write as simply to a new PingsLog as you can
	let onFileRead = (data)=>{
		let original = JSON.parse(data)

		let liveData = instance.combineTargetsForExport()

		let latestPingInOriginal = _.sortBy(original.combinedPingList, ['timeResponseReceived', 'targetIPV4']).reverse()[0]

		// This assumes original has exact same structure as live data
		let firstUnwrittenPingIndex = original.combinedPingList.indexOf(latestPingInOriginal) + 1
		let firstUnwrittenPing = liveData.combinedPingList[firstUnwrittenPingIndex]
		
		let toWrite = _.cloneDeep(original)
		// Make sure there's any new pings *after* the most recently saved
		if ( !firstUnwrittenPing ){
			// noop - just update timestamp and re-save same data (we already do this anyway)
			if ( config.nodeVerbose >= 2 ){
				console.info('No new pings found to update existing session\'s log with.')
			}
		} else {
			let onlyNewPings = liveData.combinedPingList.slice(firstUnwrittenPingIndex)

			toWrite.combinedPingList = _.concat(original.combinedPingList, onlyNewPings)
			toWrite.combinedPingList = _.sortBy(toWrite.combinedPingList, ['timeResponseReceived', 'targetIPV4'])
		}
		
		toWrite.dateLogLastUpdated = new Date()
		toWrite.outages = liveData.outages
		
		// POSSIBLE BUG: This just completely overwrites the original targets (incl TargetOutages and RequestErrorList)
		toWrite.targetList = liveData.targetList

		// TODO: use PingsLog for this and writeNewSessionLog's structures
		
		toWrite = JSON.stringify(toWrite, null, instance.opt.pingLogIndent)
		
		return fsWriteFilePromise(instance.activeLogUri, toWrite, 'utf8').then((file)=>{
			console.info('Updated log at ' + instance.activeLogUri)
			return instance.activeLogUri
		}, (error)=>{
			throw new Error(error) 
		})
	}

	return fsReadFilePromise(instance.activeLogUri, 'utf8').then(onFileRead, (error)=>{
		throw new Error(error)
	})
}

// Save current session to disk as JSON
// POSSIBLE BUG: this runs almost assuming sync, not sure if need a flag or something to make sure not actively worked on
let alreadyNotifiedLogUri = false
let saveSessionLogJSON = (instance)=>{	
	if ( instance.activeLogUri ){ 
		if (!alreadyNotifiedLogUri){
			console.log('Writing to file. Active log URI found, using that URI.')
			alreadyNotifiedLogUri = true
		}
		extendExistingSessionLog(instance)
	} else {
		if (!alreadyNotifiedLogUri){
			console.log('Writing to new log file.')			
			alreadyNotifiedLogUri = true
		}
		writeNewSessionLog(instance) 
	}
}


let formatSessionAsHumanText = (instance, options)=>{
	// Indent size in number of spaces
	let ind = typeof options.indentSize === 'number' ? Math.max(options.indentSize, 8) : 2
	let indString = ''
	for (let i = 0; i < ind; i = i + 1){
		indString = indString + ' '
	}
	ind = indString

	// This will overwrite any file with the same session start time
	let summaryUri = options.summariesDir + '/' + MyUtil.isoDateToFileSystemName(instance.sessionStartTime) + ' pingu summary.txt'

	let template = `Pingu internet connectivity log` +
	`\nSession started: ${moment(instance.sessionStartTime).format('MMMM Do YYYY hh:mm:ss ZZ')}` +
	`\nSession ended (approx): ${moment(instance.sessionEndTime).format('MMMM Do YYYY hh:mm:ss ZZ')}` +
	`\nPing interval time (in milliseconds): ${options.pingIntervalMs}` +
	`\nUnderlying ping engine used to get ping data: ${instance.pingEngine.humanName}` +
	`\nMaximum round-trip time before considering a connection "down" (in milliseconds): ${options.badLatencyThresholdMs}` +
	`\nPing targets:`
	
	for (let target of instance.pingTargets){
		template = template + `\n${ind}- ` + target.humanName + ' (IP: ' + target.IPV4 + ')'
	}

	template = template + '\n\nFull internet connection outages (when all target IP addresses took too long to respond):'

	if (instance.outages.length >= 1){
		for (let outage of instance.outages){
			let humanOutageDuration = (outage.durationSec >= options.pingIntervalMs / 1000) ? outage.durationSec : '<' + (options.pingIntervalMs / 1000)
			template = template + '\n    - ' + moment(outage.startDate).format('MMMM Do YYYY hh:mm:ss ZZ') + ', duration: ' + humanOutageDuration + ' seconds'
		}
	} else {
		template = template + `\n${ind}[No outages]`
	}

	template = template + '\n\nAll pings:'

	let combinedPingList = instance.combineTargetsForExport().combinedPingList

	let encounteredErrorTypes = []

	for (let ping of combinedPingList ){

		template = template + `\n${ind}- [` + moment(ping.timeResponseReceived).format('YYYY-MM-DD hh:mm:ss.SSS ZZ') + '] '
		template = template + 'IP ' + ping.targetIPV4 + ' | '
		if (!ping.failure){
			template = template + 'Round-trip time: ' + ping.roundTripTimeMs + ' ms, '
			template = template + 'Response size: ' + (ping.responseSize > 1 ? ping.responseSize + ' bytes' : '(unknown)') + ', '
		} else {
			let typeIsUniqueInList = true
			for (let encounteredErrorType of encounteredErrorTypes){
				// Need to use isEqual instead of === to deep-compare objects with different references
				if (_.isEqual(ping.errorType, encounteredErrorType)){ typeIsUniqueInList = false }
			}
			if ( typeIsUniqueInList ){
				encounteredErrorTypes.push(ping.errorType)
			}
			template = template + 'Error: ' + ping.errorType.accessor + ', '
		}
		template = template + 'ICMP: ' + ping.icmpSeq
	}

	if (encounteredErrorTypes.length){
		template = template + '\n\nEncountered errors:'

		for (let err of encounteredErrorTypes){
			template = template + `\n${ind}- Name: "` + err.accessor + '", '
			template = template + 'description: ' + err.humanName
		}
	}

	template = template + `\n\n${instance.appHumanName} - ${instance.appHumanSubtitle}` + `\n${instance.appHomepageUrl}`
	
	template = template + `\nFree & open-source (gratis & libre)`

	// TODO: Allow option to wrap the final output to x characters for display in bad/old/CL apps
	// TODO: Potentially also allow tab character for indenting instead of just spaces
	/*if (wrapAtCharLength){
		TODOwrapToCharLength(template, wrapAtCharLength)
	}*/

	return { template, summaryUri }
}

// Save a human-readable text summary of current session to disk
let saveSessionLogHuman = (instance)=>{
	let formatted = formatSessionAsHumanText(instance, {
		indentSize: instance.opt.indentSize,
		summariesDir: instance.opt.summariesDir,
		badLatencyThresholdMs: instance.opt.badLatencyThresholdMs,
		pingIntervalMs: instance.opt.pingIntervalMs,
	})

	fs.mkdir(instance.opt.summariesDir, undefined, (err)=>{
		if (err) {
			// Ignore; just wanted to ensure folder exists here.
		}
		
		return fsWriteFilePromise(formatted.summaryUri, formatted.template, 'utf8').then((file)=>{
			console.info('Wrote human-readable text summary to ' + formatted.summaryUri)
			return formatted.summaryUri
		}, (error)=>{
			throw new Error(error)
		})
	})
}

let compressLogToArchive = (filename, archiveDir, logsDir)=>{
	
	fs.mkdir(archiveDir, undefined, (err)=>{
		if (err) {
			// Ignore; just wanted to ensure folder exists here.
		}

		const gzip = zlib.createGzip()
		const input = fs.createReadStream(logsDir + '/' + filename)
		const output = fs.createWriteStream(archiveDir + '/' + filename + '.gz')

		input.pipe(gzip).pipe(output)

		console.info('Compressed "' + filename + '" to gzipped archive.')
	})
	
}

let compressAllLogsToArchive = (logsDir, archiveDir, logStandardFilename, compressAnyJsonLogs)=>{
	fs.readdir(logsDir + '/', 'utf8', (err, files)=>{
		if (err){
			throw new Error(err)
		}

		for (let uri of files){
			// Only compress *our* JSON log files unless user specifies looser approach
			if ( uri.match(logStandardFilename + '\.json$') || ( compressAnyJsonLogs && uri.match('\.json$') ) ){
				compressLogToArchive(uri, archiveDir, logsDir)
			} 
		}
	})

	return true
}

exports.compressAllLogsToArchive = compressAllLogsToArchive
exports.compressLogToArchive = compressLogToArchive
exports.saveSessionLogHuman = saveSessionLogHuman
exports.saveSessionLogJSON = saveSessionLogJSON