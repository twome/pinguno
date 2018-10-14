// Built-in modules
const fs = require('fs')
const zlib = require('zlib')
const util = require('util')
const path = require('path')

// 3rd-party dependencies
const { DateTime } = require('luxon')
const { _ } = require('lodash')
const del = require('del')
const prompts = require('prompts')

// In-house modules
import { Pinguno } from './pinguno.js'
const { config } = require('./config.js')
import { MyUtil } from './my-util.js'
import { PingsLog, RequestError } from './ping-formats.js'

const fsWriteFilePromise = util.promisify(fs.writeFile)
const fsReadFilePromise = util.promisify(fs.readFile)

// TODO: optimise / simplify this
let readJSONLogIntoSession = (logFileUri)=>{

	let onFileRead = (dataStr)=>{
		let fileData = JSON.parse(dataStr)

		let newSession = new Pinguno(Object.assign(fileData.opt, {
			activeLogUri: logFileUri
		}))

		// Cast JSON strings to class instances
		fileData.dateLogCreated = MyUtil.utcIsoStringToDateObj(fileData.dateLogCreated)
		fileData.dateLogLastUpdated = MyUtil.utcIsoStringToDateObj(fileData.dateLogLastUpdated)
		fileData.sessionStartTime = MyUtil.utcIsoStringToDateObj(fileData.sessionStartTime)
		fileData.sessionEndTime = MyUtil.utcIsoStringToDateObj(fileData.sessionEndTime)
		for (let ping of fileData.combinedPingList){
			ping.timeResponseReceived = MyUtil.utcIsoStringToDateObj(ping.timeResponseReceived)
		}
		for (let outage of fileData.outages){
			outage.startDate = MyUtil.utcIsoStringToDateObj(outage.startDate)
			outage.endDate = MyUtil.utcIsoStringToDateObj(outage.endDate)
		}
		for (let target of fileData.targetList){
			for (let requestError of target.requestErrorList){
				requestError.timeResponseReceived = MyUtil.utcIsoStringToDateObj(requestError.timeResponseReceived)
				requestError.timeRequestSent = MyUtil.utcIsoStringToDateObj(requestError.timeRequestSent)
			}
		}

		fileData.combinedPingList = _.sortBy(fileData.combinedPingList, ['icmpSeq', 'targetIPV4', 'timeResponseReceived'])

		newSession.pingTargets = _.cloneDeep(fileData.targetList)

		// ~ separate combined ping list into newSession targets
		if (fileData.combinedPingList.length >= 1){
			for (let ping of fileData.combinedPingList){
				for (let target of newSession.pingTargets){
					target.pingList = (target.pingList && target.pingList.length >= 1) ? target.pingList : []
					if (target.IPV4 === ping.targetIPV4){
						target.pingList.push(ping)
					}
				}
			}	
		}

		// Recreate RequestErrors from accessors
		for (let target of newSession.pingTargets){
			if (target.requestErrorList.length <= 0){ continue }
			for (let requestError of target.requestErrorList){
				// Turn error name back into type error
				requestError.errorType = RequestError.errorTypes[requestError.errorType.accessor]
			}
		}

		// Recreate Ping Errors from accessors
		for (let target of newSession.pingTargets){
			for (let ping of target.pingList){
				if (!ping.errorType){ continue }
				// Turn error name back into type error
				ping.errorType = RequestError.errorTypes[ping.errorType.accessor]
			}
		}
		
		// Recreate TargetOutage pings from their ICMP & target
		// Perf: bad
		for (let target of newSession.pingTargets){
			for (let targetOutage of target.targetOutages ){
				if (targetOutage.pingList.length <= 0){ continue }
				for (let pingIndex in targetOutage.pingList){
					let referencedPing = Pinguno.getPingFromIcmpTarget(newSession, targetOutage.pingList[pingIndex].icmpSeq, target.IPV4)
					targetOutage.pingList[pingIndex] = _.cloneDeep(referencedPing)
				}
			}
		}

		// newSession.outages = fileData.outages 
		newSession.updateOutages(newSession.pingTargets, newSession.targetList) // Recalculate these outages
		newSession.updateSessionStats()
		newSession.updateGlobalConnectionStatus()

		newSession.sessionStartTime = fileData.sessionStartTime
		newSession.sessionEndTime = fileData.sessionEndTime
	
		return newSession
	}

	return fsReadFilePromise(logFileUri, 'utf8').then(onFileRead, (error)=>{
		throw new Error(error)
	})
}

// Interleave the ping-targets with their individual ping-lists into one shared ping list
let combineTargetsForExport = (instance)=>{
	let exporter = new PingsLog({
		sessionStartTime: instance.sessionStartTime,
		sessionEndTime: instance.sessionEndTime,
		targetList: _.cloneDeep(instance.pingTargets),
		outages: instance.outages
	})

	// Remove ping lists from individual targets and concat them all into combinedPingList
	for (let target of exporter.targetList){
		for (let ping of target.pingList){
			// Add targetIPV4 to pings to identify their target now that they have no parent
			ping.targetIPV4 = target.IPV4
		}
		exporter.combinedPingList = _.concat(exporter.combinedPingList, target.pingList)
	}
	for (let target of exporter.targetList){
		delete target.pingList
		delete target.connected // "Connection" is live info and derived from pingList anyway
	}

	// Sort the aggregate ping list by 1) ICMP sequence number 2) by target IP 3) chronologically
	let pingListSorted = _.sortBy(exporter.combinedPingList, [(o)=>{return o.icmpSeq}, (o)=>{return o.targetIPV4}, (o)=>{return o.timeResponseReceived} ])
	exporter.combinedPingList = pingListSorted

	exporter.outages = _.cloneDeep(instance.outages)
	exporter.opt = _.cloneDeep(instance.opt)

	// Remove all duplicated or recreatable data
	let strippedTargetList = _.cloneDeep(exporter.targetList)
	for (let target of strippedTargetList){
		for (let reqError of target.requestErrorList){
			// Only need errorType.accessor to uniquely identify error
			delete reqError.errorType.humanName
		}

		for (let targetOutage of target.targetOutages){
			for (let ping of targetOutage.pingList){
				for (let key of Object.keys(ping)){
					if (!['icmpSeq'].includes(key)){
						// ICMP sequence and target (parent) is all we need to deduce exactly which ping this is
						delete ping[key]
					}
				}	
			}
		}
	}
	exporter.targetList = strippedTargetList

	return exporter
}

let writeNewSessionLog = (instance)=>{
	const combinedTargets = combineTargetsForExport(instance)
	
	// Turn ISO string into filesystem-compatible string (also strip milliseconds)
	const fileCreationDate = new Date()
	const filename = MyUtil.isoDateToFileSystemName(fileCreationDate) + ' ' + instance.opt.logStandardFilename + '.json'

	let onMakeDirectory = (err)=>{
		if (err){ 
			// We just want to make sure the folder exists so this doesn't matter
		}

		const fileUri = path.join(instance.logsDir, filename)
		// Keep track of this session's log so we can come back and update it
		instance.activeLogUri = fileUri

		const content = JSON.stringify(combinedTargets, null, instance.opt.pingLogIndent)
		return fsWriteFilePromise(fileUri, content, 'utf8').then((file)=>{
			console.info('Wrote new log file to ' + fileUri)
			return fileUri
		}, (error)=>{
			console.error(error)
			return error
		})
	}

	return fs.mkdir(instance.logsDir, undefined, onMakeDirectory)
}

// Read, extend, and overwrite this sessions existing log file
let overwriteExistingSessionLog = (instance)=>{
	if (!instance.sessionDirty){
		// Nothing's changed, so don't bother writing. Consumer will need to test for non-Promise return value
		// noop - just update timestamp and re-save same data (we already do this anyway)
		if ( config.NODE_VERBOSE >= 2 ){
			console.info('No new pings found to update existing session\'s log with.')
		}
		return Error('No new data to write')
	} 

	let toWrite = combineTargetsForExport(instance)

	toWrite.dateLogLastUpdated = new Date()

	toWrite = JSON.stringify(toWrite, null, instance.opt.pingLogIndent)
	return fsWriteFilePromise(instance.activeLogUri, toWrite, 'utf8').then((file)=>{
		if (process.env.NODE_ENV !== 'development'){
			console.info('Overwrote log at ' + instance.activeLogUri)	
		} 
		return instance.activeLogUri
	}, (error)=>{
		console.error(error)
		return error
	})
}

// Save current session to disk as JSON
// POSSIBLE BUG: this runs almost assuming sync, not sure if need a flag or something to make sure not actively worked on
let alreadyNotifiedLogUri = false
let saveSessionLogJSON = (instance)=>{	
	let outcome
	if ( instance.activeLogUri ){ 
		if (!alreadyNotifiedLogUri){
			console.log('Writing to file. Active log URI found, using that URI.')
			alreadyNotifiedLogUri = true
		}
		outcome = overwriteExistingSessionLog(instance)
	} else {
		if (!alreadyNotifiedLogUri){
			console.log('Writing to new log file.')			
			alreadyNotifiedLogUri = true
		}
		outcome = writeNewSessionLog(instance) 
	}
	return outcome
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
	let summaryUri = instance.summariesDir + '/' + MyUtil.isoDateToFileSystemName(instance.sessionStartTime) + ' pinguno summary.txt'

	let template = `Pinguno internet connectivity log` +
	`\nSession started: ${DateTime.fromJSDate(instance.sessionStartTime).toISO()}` +
	`\nSession ended (approx): ${DateTime.fromJSDate(instance.sessionEndTime).toISO()}` +
	`\nSession timezone (all displayed times are in this zone): ${DateTime.fromJSDate(instance.sessionStartTime).toFormat('ZZ')}` +
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
			template = template + '\n    - ' + DateTime.fromJSDate(outage.startDate).toISO() + ', duration: ' + humanOutageDuration + ' seconds'
		}
	} else {
		template = template + `\n${ind}[No outages]`
	}

	template = template + '\n\nAll pings:'

	let combinedPingList = combineTargetsForExport(instance).combinedPingList

	let encounteredErrorTypes = []

	for (let ping of combinedPingList ){

		template = template + `\n` + DateTime.fromJSDate(ping.timeResponseReceived).toFormat('yyyy-LL-dd HH:mm:ss.SSS') + ' | '
		template = template + 'IP: ' + ping.targetIPV4 + ', '
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

	// TODO: Potentially also allow tab character for indenting instead of just spaces

	// Wrap the final output to x characters for display in bad/old/command-line apps
	if (options.wrapAtCharLength){
		template = MyUtil.hardWrapToCharLength(template, options.wrapAtCharLength)
	}

	return { template, summaryUri }
}

// Save a human-readable text summary of current session to disk
// This must be a SUBSET of the JSON data, so that we can fully recreate human-readable summaries from saved or compressed JSON archives

let saveSessionLogHuman = (instance)=>{
	let formatted = formatSessionAsHumanText(instance, {
		indentSize: instance.opt.indentSize,
		summariesDir: instance.summariesDir,
		badLatencyThresholdMs: instance.opt.badLatencyThresholdMs,
		pingIntervalMs: instance.opt.pingIntervalMs,
		wrapAtCharLength: instance.opt.wrapHumanLogAtCharLength
	})

	let onMakeDirectory = (err)=>{
		if (err) {
			// Ignore; just wanted to ensure folder exists here.
		}
		
		return fsWriteFilePromise(formatted.summaryUri, formatted.template, 'utf8').then((file)=>{
			if (process.env.NODE_ENV !== 'development'){
				console.info('Wrote human-readable text summary to ' + formatted.summaryUri)	
			}
			return formatted.summaryUri
		}, (error)=>{
			throw new Error(error)
		})
	}

	fs.mkdir(instance.summariesDir, undefined, onMakeDirectory)
}

let compressLogToArchive = (filename, archiveDir, logsDir)=>{

	let onMakeDirectory = (err)=>{
		if (err) {
			// Ignore; just wanted to ensure folder exists here.
		}

		const gzip = zlib.createGzip()
		const input = fs.createReadStream(path.join(logsDir, filename))
		const output = fs.createWriteStream(path.join(archiveDir, filename + '.gz'))

		input.pipe(gzip).pipe(output)

		console.info('Compressed "' + filename + '" to gzipped archive.')
	}
	
	fs.mkdir(archiveDir, undefined, onMakeDirectory)
	
}

// Take all JSON logs in the logs directory and compress them all into one .gz archive
let compressAllLogsToArchive = (logsDir, archiveDir, logStandardFilename, compressAnyJsonLogs)=>{

	let onReadDir = (err, files)=>{
		if (err){
			throw new Error(err)
		}

		let allURIsToCompress = []
		for (let uri of files){
			// Only compress *our* JSON log files unless user specifies looser approach
			let usesOurStandardName = !! path.basename(uri, '.json').match(path.normalize(logStandardFilename))
			let isJSONFile = path.extname(uri) === '.json'
			if ( usesOurStandardName || ( compressAnyJsonLogs && isJSONFile ) ){
				if (config.NODE_VERBOSE >= 1){ console.info('Compressing file: ' + uri) }
				allURIsToCompress.push(uri)
			} 
		}

		// Take the date part of filenames, parse them back into JS Dates, then pack them into a list of
		// contents so we can time-sort the contents
		let timesAndContents = []
		allURIsToCompress.forEach((uri)=>{
			let timeSortStr = uri.slice(0, uri.indexOf(logStandardFilename)).trim()
			let sortDate = MyUtil.fileSystemDateStrToIsoDate(timeSortStr).getTime()
			
			timesAndContents.push([timeSortStr, sortDate, fsReadFilePromise(path.join(logsDir, uri), 'utf8')])
		})

		// Sort by date (number in ms), then map to just the text contents (as promises)
		timesAndContents = _.sortBy(timesAndContents, arr => {
			return arr[1] 
		})

		let justTheText = timesAndContents.map(val => val[2])
		let len = timesAndContents.length
		let finalFilename = `${timesAndContents[0][0]} to ${timesAndContents[len - 1][0]} ${logStandardFilename} - ${len} compressed sessions.json.gz` 

		let onCompress = (err, compressed)=>{
			if (err){
				throw Error(err)
			} else if (compressed){
				if (config.NODE_VERBOSE >= 2){console.debug('Compressed all logs to string:', compressed)}
				let finalFullPath = path.join(archiveDir, finalFilename)

				let onMakeDirectory = (err)=>{
					if (err){ 
						// Do nothing
					}
					return fsWriteFilePromise(finalFullPath, compressed, 'utf8').then(()=>{
						console.info('Wrote compressed logs to file: ' + finalFullPath)					
						return finalFullPath	
					}, (err)=>{
						throw Error(err)
					})
				}

				fs.mkdir(archiveDir, undefined, onMakeDirectory)
			}
		}

		Promise.all(justTheText).then((arr)=>{
			let arrToCompress = []
			arr.forEach((val, i)=>{
				arrToCompress.push({
					file: allURIsToCompress[i],
					// We parse the text content (even though it slows things down) so JSON.stringify() doesn't need to escape the text
					contents: JSON.parse(val) 
				})
			})

			let stringToCompress = JSON.stringify(arrToCompress, null, 2)

			zlib.gzip(stringToCompress, undefined, onCompress)
		})
	}

	fs.readdir(logsDir, 'utf8', onReadDir)
}

let deleteAllLogs = (logsDir, summariesDir)=>{	

	console.info('Attempting to delete all logs at:', logsDir, summariesDir)
	
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
		message: 'Please enter the word "delete" to confirm you want to delete all of Pinguno\'s saved lonogs.',
		validation: inputValidation
	})

	deletionPromptResponse.then((val)=>{
		let validated = inputValidation(val.confirmDeleteResponse)

		if (validated === true){
			// Give a little moment to allow second thoughts
			console.warn('\n ------------ \n Deleting all uncompressed Pinguno logs in 5 seconds \n Press Ctrl+C twice to cancel. \n ------------ no\n ')
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

export {
	compressAllLogsToArchive,
	compressLogToArchive,
	saveSessionLogHuman,
	saveSessionLogJSON,
	deleteAllLogs,
	combineTargetsForExport,
	readJSONLogIntoSession
}