console.info('RUNNING: logging.js')

// Built-in modules
const fs = require('fs')
const zlib = require('zlib')
const util = require('util')
const path = require('path')

// 3rd-party dependencies
const getFolderSize = require('get-folder-size')
const moment = require('moment')
const { _ } = require('lodash')
const del = require('del')
const prompts = require('prompts')

// In-house modules
const { Pingu } = require('./pingu.js')
const { config } = require('./config.js')
const { MyUtil } = require('./my-util.js')
const { Outage, TargetOutage, PingsLog, RequestError } = require('./ping-formats.js')

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

// TODO: optimise / simplify this
let readJSONLogIntoSession = (logFileUri)=>{

	let getPingFromIcmpTarget = (session, icmpSeq, targetIPV4)=>{
		for (let target of session.pingTargets){
			if (target.IPV4 === targetIPV4){
				for (let ping of target.pingList){
					if (icmpSeq === ping.icmpSeq){
						return ping
					}
				}
			}
		}

		return Error('getPingFromIcmpTarget - Could not find ping with that icmpSeq and target IP.')
	}

	let onFileRead = (dataStr)=>{
		let fileData = JSON.parse(dataStr)

		let newSession = new Pingu(Object.assign(fileData.opt, {
			activeLogUri: logFileUri
		}))

		fileData.combinedPingList = _.sortBy(fileData.combinedPingList, ['icmpSeq', 'targetIPV4', 'timeResponseReceived'])

		newSession.pingTargets = _.cloneDeep(fileData.targetList)

		// ~ separate combined ping list into newSession targets
		if (fileData.combinedPingList.length >= 1){
			for (let ping of fileData.combinedPingList){
				for (let target of newSession.pingTargets){
					target.pingList = []
					if (target.IPV4 === ping.targetIPV4){
						target.pingList.push(ping)
					}
				}
			}	
		}

		// ~ Recreate RequestErrors from accessors
		for (let target of newSession.pingTargets){
			if (target.requestErrorList.length <= 0){ continue }
			for (let requestError of target.requestErrorList){

				console.debug('requestError', requestError)
				// Turn error name back into type error
				requestError.errorType = RequestError.errorTypes[requestError.errorType.accessor]
			}
		}

		// ~ Recreate Ping Errors from accessors
		for (let target of newSession.pingTargets){
			for (let ping of target.pingList){
				if (!ping.errorType){ continue }
				// Turn error name back into type error
				ping.errorType = RequestError.errorTypes[ping.errorType.accessor]
			}
		}
		
		// ~ recreate TargetOutage pings from their icmp&target
		// Perf: bad
		for (let target of newSession.pingTargets){
			for (let to of target.targetOutages ){
				for (let ping of to){
					let referencedPing = getPingFromIcmpTarget(newSession, ping.icmpSeq, target.IPV4)
					let ping = _.cloneDeep(referencedPing)
				}
			}
		}

		newSession.outages = fileData.outages // Or we could just recalculate these outages
		newSession.sessionStartTime = fileData.sessionStartTime
	
		return newSession
	}

	return fsReadFilePromise(logFileUri, 'utf8').then(onFileRead, (error)=>{
		throw new Error(error)
	})
}

// Read, extend, and overwrite this sessions existing log file
let extendExistingSessionLog = (instance)=>{
	// TODO: clean this up; write as simply to a new PingsLog as you can

	// TODO: only need to determine whether there's any new data
	// ~ sort by ICMP, then try find an ICMP higher than the latest we have

	// TODO: Long-term, we probably don't really need to "resume" session; they can be idempotent and we can just 
	// wholesale replace them 

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
		toWrite.opt = instance.opt
		
		// TODO: remove humanName from errors (just store error name)

		// Remove all duplicated or recreatable data
		let strippedTargetList = _.cloneDeep(liveData.targetList)
		for (let target of strippedTargetList){
			for (let reqError of target.requestErrorList){
				delete reqError.errorType.humanName
			}

			for (let targetOutage of target.targetOutages){
				for (let ping of targetOutage.pingList){
					for (let key of Object.keys(ping)){
						if (!['icmpSeq'].includes(key)){
							delete ping[key]
						}
					}	
				}
			}
		}
		// POSSIBLE BUG: This just completely overwrites the original targets (incl TargetOutages and RequestErrorList)
		toWrite.targetList = strippedTargetList

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
			template = template + 'Response size: ' + (ping.responseSize >= 1 ? ping.responseSize + ' bytes' : '(unknown)') + ', '
			template = template + 'TTL hops left: ' + (ping.ttlHops >= 1 ? ping.ttlHops + ' hops' : '(unknown)') + ', '
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

	// No `` template literal for appHomepageUrl because we want to use the implicit toString() to convert from URL type
	template = template + `\n\n${instance.appHumanName} - ${instance.appHumanSubtitle}` + `\n` + instance.appHomepageUrl
	
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
		const input = fs.createReadStream(path.join(logsDir, filename))
		const output = fs.createWriteStream(path.join(archiveDir, filename + '.gz'))

		input.pipe(gzip).pipe(output)

		console.info('Compressed "' + filename + '" to gzipped archive.')
	})
	
}

let compressAllLogsToArchive = (logsDir, archiveDir, logStandardFilename, compressAnyJsonLogs)=>{
	fs.readdir(logsDir, 'utf8', (err, files)=>{
		if (err){
			throw new Error(err)
		}

		for (let uri of files){
			// Only compress *our* JSON log files unless user specifies looser approach
			let usesOurStandardName = path.basename(uri, '.json') === path.standardize(logStandardFilename)
			let isJSONFile = path.extname(uri) === '.json'
			if ( usesOurStandardName || ( compressAnyJsonLogs && isJSONFile ) ){
				compressLogToArchive(uri, archiveDir, logsDir)
			} 
		}
	})

	return true
}

let deleteAllLogs = (logsDir, summariesDir)=>{	
	
	let actuallyDelete = ()=>{
		del([
			path.join(logsDir, '*.json'), 
			path.join(summariesDir, '*.txt')
		]).then(paths => {
			console.info('\n ------------ \n Deleted files and folders: \n ')
			if (paths.length > 0){
				console.info(paths.join('\n'))	
			} else {
				console.info('(No files deleted)')	
			}
			return paths
		}, (err)=>{
			console.error('Hit error while trying to delete logs.')
			throw Error(err)
		})	
	}

	let inputValidation = (value)=>{
		return value === 'delete' ? true : 'Confirmation failed (type "delete" without quote marks).'
	}

	// TODO: maybe just switch to a simple y/N confirm?
	// Require the user to manually confirm deletion
	let deletionPromptResponse = prompts({
    	type: 'text',
    	name: 'confirmDeleteResponse',
    	message: 'Please enter the word "delete" to confirm you want to delete all of Pingu\'s saved logs.',
    	validation: inputValidation // TODO: Why does this seem to do absolutely nothing?
	})

	deletionPromptResponse.then((val)=>{
		let validated = inputValidation(val.confirmDeleteResponse)

		if (validated === true){
			// Give a little moment to allow second thoughts
			console.warn('\n ------------ \n Deleting all uncompressed pingu logs in 5 seconds \n Press Ctrl+C twice to cancel. \n ------------ \n ')
			setTimeout(actuallyDelete, 5000)	
		} else {
			console.warn('Failed prompt:', validated)
			return false
		}		
	}, (err)=>{
		console.error('prompts - Prompt error encountered: ', err)
		return err
	})
}

exports.compressAllLogsToArchive = compressAllLogsToArchive
exports.compressLogToArchive = compressLogToArchive
exports.saveSessionLogHuman = saveSessionLogHuman
exports.saveSessionLogJSON = saveSessionLogJSON
exports.deleteAllLogs = deleteAllLogs
exports.readJSONLogIntoSession = readJSONLogIntoSession