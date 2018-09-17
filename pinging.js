console.log('RUNNING: pinging.js')

// TODO: distinguish between UI info messages and temporary/dev console logs within the code (for code-searching and eventually clear rendering of UI messages)

// Built-in modules
const { spawn } = require('child_process')
const fs = require('fs')
const util = require('util')
const zlib = require('zlib')
const os = require('os')

// 3rd-party dependencies
const { _ } = require('lodash')
const getFolderSize = require('get-folder-size')
const prettyJson = require('prettyjson')
const moment = require('moment')
// const netPing = require('net-ping')

// In-house modules
const { Enum } = require('./enum.js')
const { MyUtil } = require('./my-util.js')
const { PingData, PingError, Outage, TargetOutage, PingsLog } = require('./ping-formats.js')

const fsWriteFilePromise = util.promisify(fs.writeFile)
const fsReadFilePromise = util.promisify(fs.readFile)

const connectionState = new Enum(['CONNECTED', 'DISCONNECTED', 'PENDING_RESPONSE'])

class Pingu {
	constructor(options){
		this.appHumanName = 'Pingu' // must be filesystem-compatible
		this.appHumanSubtitle = 'ISP Uptime Logger'
		this.appHomepageUrl = 'https://twome.name/pingu'
		this.appSourceRepoUrl = 'https://gitlab.com/twome/pingu'

		this.pingPacketSizeBytes = 56 // macOS default
		this.timeoutLimit = 2000 // Linux default is 2 x average RTT
		// NB: Currently using default timeout limit times
		this.pingIntervalMs = 3000
		this.badLatencyThresholdMs = 250
		
		this.connectionStatusIntervalMs = 3000
		this.writeToFileIntervalMs = 2 * 1000

		this.pingTargets = [
			{
				humanName: 'Google',
				IPV4: '8.8.8.8',
				connected: null,
				pingList: [],
				pingErrorList: []
			},
			{
				humanName: 'Level3',
				IPV4: '4.2.2.2',
				connected: null,
				pingList: [],
				pingErrorList: []
			}
		]
		this.logStandardFilename = 'pingu log'
		this.logsDir = './logs'
		this.summariesDir = './logs/human-readable' // Human-readable summary .txt files
		this.archiveDir = this.logsDir + '/compressed'
		this.activeLogUri = null // URI string
		this.compressAnyJsonLogs = false // Option to allow users to compress non-standard-named JSON logs

		this.sessionStartTime = new Date() //TODO: set this Date when running the "start pinging" method

		this.lastFailure = null
		this.lastDateConnected = null
		this.internetConnected = null
		this.firstPingSent = false
		this.outages = []
	}

	updateInternetConnectionStatus(){
		this.updateTargetsConnectionStatus()

		// If at least one target responds, we assume we have a working general internet connection
		for (let target of this.pingTargets){
			if (target.connected === connectionState.CONNECTED){
				this.lastDateConnected = new Date()
				return this.internetConnected = connectionState.CONNECTED
			}
		}

		return this.internetConnected = connectionState.DISCONNECTED
	}

	isBadResponse(ping){
	 	return ping.timeout || ping.roundTripTimeMs > this.badLatencyThresholdMs  
	}

	isRoughlyWithinTimeframe(dateToTest, timeframeStart, timeframeEnd, leniencyMs){
		for (let param of [dateToTest, timeframeStart, timeframeEnd]){
			if ( (! param instanceof Date) || (! typeof param.getTime === 'function') ){
				throw Error('isRoughlyWithinTimeframe - param ' + param + 'is not a Date object')
			}
		}

		dateToTest = dateToTest.getTime() // convert to total UTC ms since epoch for comparison
		timeframeStart = timeframeStart.getTime()
		timeframeEnd = timeframeEnd.getTime()

		let isAfterStart = dateToTest >= ( timeframeStart - leniencyMs )
		let isBeforeEnd = dateToTest <= ( timeframeEnd + leniencyMs )
		return isAfterStart && isBeforeEnd
	}

	updateOutages(combinedPingList, targetList){
		let instance = this
		// TODO: check inputs
		let pingLogTargets

		if (combinedPingList && combinedPingList.length && targetList && targetList.length ){
			console.debug('updateOutages - Using provided ping / target lists')
			pingLogTargets = this.separatePingListIntoTargets(combinedPingList, targetList)
		} else {
			console.info('No ping-list/target-list provided to updateOutages - using active session ping history by default.')
			console.debug('updateOutages - Using active-session ping / target lists')
			pingLogTargets = this.pingTargets
		}

		// Add TargetOutages (streaks of bad-response pings) to each target
		for (let target of pingLogTargets){

			target.targetOutages = []
			
			let currentStreak = []
			// Assumes list is chronological
			for (let ping of target.pingList){
				if (this.isBadResponse(ping)){
					currentStreak.push(ping)
				} else {
					if ( currentStreak.length >= 1){
						target.targetOutages.push(new TargetOutage(currentStreak))	
					}
					currentStreak = []
				}
			}
		}

		let fullOutages = []
		let baseTarget = pingLogTargets[0]
		let checkingTarget

		if (pingLogTargets.length === 1){
			// There are no other targets that need to have concurrent outages, so every target outage is a full outage
			return baseTarget.targetOutages
		}
		
		for (let baseTargetOutage of baseTarget.targetOutages){

			// Min/max times this current outage could be (bound by current single-target outage)
			let thisOutageExtremes = {
				start: baseTargetOutage.startDate,
				end: baseTargetOutage.endDate
			}

			let checkOutageListWithinExtremes = function(targetOutageList, extremes){
				let targetOutagesThatIntersectExtremes = []

				for (let targetOutage of targetOutageList){
					// console.log('--- current targetOutage start/end', targetOutage.startDate, targetOutage.endDate)
					let pingsWithinExtremes = []

					for (let ping of targetOutage.pingList){

						if (instance.isRoughlyWithinTimeframe(ping.timeResponseReceived, extremes.start, extremes.end, instance.badLatencyThresholdMs)){
							// If we haven't already pushed this TO to list of extremes, then do so
							if (targetOutagesThatIntersectExtremes.indexOf(targetOutage) <= -1){ 
								targetOutagesThatIntersectExtremes.push(targetOutage) 
							}
							pingsWithinExtremes.push(ping)
						}
					}
					// console.debug('--- pingsWithinExtremes.length')
					// console.debug(pingsWithinExtremes.length)
					if (pingsWithinExtremes.length === 0 ){
						// console.debug('no pings within extremes for this TO')
						// This TargetOutage doesn't intersect with the current full-outage's time boundaries; try the next one.  
						continue
					}

					// FRAGILE: this assumes pings are already in chron order
					thisOutageExtremes.start = pingsWithinExtremes[0].timeResponseReceived
					thisOutageExtremes.end = _.last(pingsWithinExtremes).timeResponseReceived

					// Within this TargetOutage, if there's an intersection with the current extremes, dive one level deeper
					if (pingsWithinExtremes.length >= 1){
						if (checkingTarget === _.last(pingLogTargets)){
							// We're at the last target within this time-span
							fullOutages.push(new Outage(thisOutageExtremes.start, thisOutageExtremes.end))
						} else {
							checkingTarget = pingLogTargets[pingLogTargets.indexOf(checkingTarget) + 1]
							checkOutageListWithinExtremes(checkingTarget.targetOutages, thisOutageExtremes)
						}
					}
				}		
			}

			// Initiate checking each subsequent target for this outage
			checkingTarget = pingLogTargets[pingLogTargets.indexOf(baseTarget) + 1]
			checkOutageListWithinExtremes(checkingTarget.targetOutages, thisOutageExtremes)
		}	

		this.outages = fullOutages
		return this.outages
	}

	readCombinedListFromFile(fileUri, onReadFile){

		fs.readFile(fileUri, (err, fileData)=>{
			if (err) throw err

			// NB: parseJsonAndReconstitute doesn't do anything at the moment! The saved JSON data is not in a normal class format
			// so the function has no accurate targets to operate on.
			fileData = MyUtil.parseJsonAndReconstitute(fileData, [PingData, PingError, TargetOutage, Outage])

			// TEMP: Cast stringified dates to Date instances
			fileData.dateLogCreated = MyUtil.utcIsoStringToDateObj(fileData.dateLogCreated)
			fileData.dateLogLastUpdated = MyUtil.utcIsoStringToDateObj(fileData.dateLogLastUpdated)
			fileData.sessionStartTime = MyUtil.utcIsoStringToDateObj(fileData.sessionStartTime)
			for (let pingIndex in fileData.combinedPingList){
				let dateAsString = fileData.combinedPingList[pingIndex].timeResponseReceived
				fileData.combinedPingList[pingIndex].timeResponseReceived = MyUtil.utcIsoStringToDateObj(dateAsString)
			}
			
			onReadFile(fileData)
		})
	}

	updateTargetsConnectionStatus(){

		for (let target of this.pingTargets){
			let latestPing = this.latestPing(target)

			let anyResponse = latestPing && (typeof latestPing.roundTripTimeMs === 'number' )
			let responseWithinThreshold = latestPing && (latestPing.roundTripTimeMs <= this.badLatencyThresholdMs)

			if (anyResponse && responseWithinThreshold){
				this.lastDateConnected = new Date()
				return target.connected = connectionState.CONNECTED
			} else if ( latestPing && !latestPing.timeout ){
				return target.connected = connectionState.PENDING_RESPONSE
			} else {
				this.lastFailure = new Date()
				return target.connected = connectionState.DISCONNECTED
			}
			
			// console.log(target.humanName + ' connected?: ' + target.connected.humanName)
		}
	}

	latestPing(target){
		if (target){
			return target.pingList[target.pingList.length - 1]	
		} else {
			console.info('latestPing - No target specified so finding the latest ping from any target')

			let latestPerTarget = []
			
			for (let target in this.targets ){
				let sorted = _.sortBy(target.pingList, p => p.icmpSeq)
				latestPerTarget.push(_.last(sorted))
			}	

			return _.last(_.sortBy(latestPerTarget, p => p.icmpSeq))
		}
	}

	writeSessionLog(){
		const combinedTargets = this.combineTargetsForExport()
		const content = JSON.stringify(combinedTargets)
		const fileCreationDate = new Date()
		
		// Turn ISO string into filesystem-compatible string (also strip milliseconds)
		const filename = MyUtil.isoDateToFileSystemName(fileCreationDate) + ' ' + this.logStandardFilename + '.json'

		fs.mkdir(this.logsDir, undefined, (err)=>{
			if (err){ 
				// We just want to make sure the folder exists so this doesn't matter
			}

			const fileUri = this.logsDir + '/' + filename 

			// Keep track of this session's log so we can come back and update it
			this.activeLogUri = fileUri

			return fsWriteFilePromise(fileUri, content, 'utf8').then((file)=>{
				console.log('Wrote log to ' + fileUri)
			}, (error)=>{
				console.error(error)
			})
		})
	}

	// Write to this sessions existing log file
	updateSessionLog(){

		let onFileRead = (data)=>{
			let original = JSON.parse(data)

			let liveData = this.combineTargetsForExport()

			let latestPingInOriginal = _.sortBy(original.combinedPingList, ['timeResponseReceived', 'targetIPV4']).reverse()[0]

			// This assumes original has exact same structure as live data
			let firstUnwrittenPingIndex = original.combinedPingList.indexOf(latestPingInOriginal) + 1
			let firstUnwrittenPing = liveData.combinedPingList[firstUnwrittenPingIndex]
			
			let toWrite = _.cloneDeep(original)
			// Make sure there's any new pings *after* the most recently saved
			if ( !firstUnwrittenPing ){
				console.warn('No new pings found to update existing session\'s log with.')
				// Just update timestamp and re-save same data
				
			} else {
				let onlyNewPings = liveData.combinedPingList.slice(firstUnwrittenPingIndex)

				toWrite.combinedPingList = _.concat(original.combinedPingList, onlyNewPings)
				toWrite.combinedPingList = _.sortBy(toWrite.combinedPingList, ['timeResponseReceived', 'targetIPV4'])
			}
			
			toWrite.dateLogLastUpdated = new Date()
			toWrite.outages = liveData.outages
			
			toWrite = JSON.stringify(toWrite)
			
			return fsWriteFilePromise(this.activeLogUri, toWrite, 'utf8').then((file)=>{
				console.log('Updated log at ' + this.activeLogUri)
				return this.activeLogUri
			}, (error)=>{
				throw new Error(error) 
			})
		}

		return fsReadFilePromise(this.activeLogUri, 'utf8').then(onFileRead, (error)=>{
			throw new Error(error)
		})
	}

	separatePingListIntoTargets(pingList, targetList){
		let fullTargets = []
		for (let ping of pingList){
			if (fullTargets[ping.targetIPV4]){
				fullTargets[ping.targetIPV4].pingList.push(ping)
			} else {
				fullTargets[ping.targetIPV4] = {
					IPV4: ping.targetIPV4,
					pingList: [ping]
				}
			}
		}

		if (targetList){
			for (let target of targetList){
				target.pingList = fullTargets[target.IPV4].pingList
				fullTargets.push(target)
				delete fullTargets[target.IPV4]
			}
		}

		return fullTargets
	}

	combineTargetsForExport(){
		console.debug('∆∆∆ combineTargetsForExport')
		console.debug(this.outages)

		let exporter = new PingsLog({
			sessionStartTime: this.sessionStartTime,
			targetList: _.cloneDeep(this.pingTargets),
			outages: this.outages
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
		let pingListSorted = _.sortBy(exporter.combinedPingList, [(o)=>{return o.timeResponseReceived}, (o)=>{return o.targetIPV4}])
		exporter.combinedPingList = pingListSorted

		return exporter
	}

	tellArchiveSize(){
		if (! fs.existsSync(this.logsDir)){
			console.info('No pre-existing archive folder.')
			return false
		}
		getFolderSize(this.logsDir, (err, size)=>{
		  if (err) { throw err }
		 
		  const sizeInMB = (size / 1024 / 1024).toFixed(2)
		  console.info(`Archive size: ${sizeInMB} MB`)
		})
	}

	exportSessionToTextSummary(){
		// This will overwrite any file with the same session start time
		let summaryUri = this.summariesDir + '/' + MyUtil.isoDateToFileSystemName(this.sessionStartTime) + ' pingu summary.txt'

		let template = `Pingu internet connectivity log` +
		`\nSession started: ${moment(this.sessionStartTime).format('MMMM Do YYYY hh:mm:ss ZZ')}` +
		`\nPing interval time (in milliseconds): ${this.pingIntervalMs}` +
		`\nMaximum round-trip time before considering a connection "down" (in milliseconds): ${this.badLatencyThresholdMs}` +
		`\nPing targets:`
		
		for (let target of this.pingTargets){
			template = template + '\n  - ' + target.humanName + ' (IP: ' + target.IPV4 + ')'
		}

		template = template + '\n\nFull internet connection outages (when all target IP addresses took too long to respond):'

		if (this.outages.length >= 1){
			for (let outage of this.outages){
				let humanOutageDuration = outage.durationSec >= this.pingIntervalMs ? outage.durationSec : '<' + (this.pingIntervalMs / 1000)
				template = template + '\n    - ' + moment(outage.startDate).format('MMMM Do YYYY hh:mm:ss ZZ') + ', duration: ' + humanOutageDuration + ' seconds'
			}
		} else {
			template = template + '\n  [No outages]'
		}

		template = template + '\n\nAll pings:'

		let combinedPingList = this.combineTargetsForExport().combinedPingList

		for (let ping of combinedPingList ){

			template = template + '\n  - [' + moment(ping.timeResponseReceived).format('YYYY-MM-DD hh:mm:ss.SSS ZZ') + '] '
			template = template + 'IP ' + ping.targetIPV4 + ' | '
			if (!ping.timeout){
				template = template + 'Round-trip time: ' + ping.roundTripTimeMs + ' ms, '
				template = template + 'Response size: ' + ping.responseSize + ' bytes, '	
				template = template + 'ICMP: ' + ping.icmpSeq
			} else {
				template = template + 'Response timed out, ICMP: ' + ping.timeoutIcmp
			}
		}

		template = template + `\n\n${this.appHumanName} - ${this.appHumanSubtitle}` + `\n${this.appHomepageUrl}`
		
		template = template + `\nFree & open-source (gratis & libre)`

		fs.mkdir(this.summariesDir, undefined, (err)=>{
			if (err) {
				// Ignore; just wanted to ensure folder exists here.
			}
			
			return fsWriteFilePromise(summaryUri, template, 'utf8').then((file)=>{
				console.log('Wrote human-readable text summary to ' + summaryUri)
				return summaryUri
			}, (error)=>{
				throw new Error(error)
			})
		})
	}

	compressLogToArchive(filename){
		
		fs.mkdir(this.archiveDir, undefined, (err)=>{
			if (err) {
				// Ignore; just wanted to ensure folder exists here.
			}

			const gzip = zlib.createGzip()
			const input = fs.createReadStream(this.logsDir + '/' + filename)
			const output = fs.createWriteStream(this.archiveDir + '/' + filename + '.gz')

			input.pipe(gzip).pipe(output)

			console.info('Compressed "' + filename + '" to gzipped archive.')
		})
		
	}

	compressAllLogsToArchive(){
		fs.readdir(this.logsDir + '/', 'utf8', (err, files)=>{
			if (err){
				throw new Error(err)
			}

			for (let uri of files){
				// Only compress *our* JSON log files unless user specifies looser approach
				if ( uri.match(this.logStandardFilename + '\.json$') || ( this.compressAnyJsonLogs && uri.match('\.json$') ) ){
					this.compressLogToArchive(uri)
				} 
			}
		})
		
	}

	startPinging(pingTargets){
		const regPingHandlers = (pingTarget)=>{
			console.info(`Registering ping handler for target: ${pingTarget.humanName} (${pingTarget.IPV4})`)

			const pingProcess = spawn('ping', [
				'-i', 
				app.pingIntervalMs / 1000, 
				pingTarget.IPV4
			]);

			app.firstPingSent = true

			pingProcess.stdout.on('data', (data)=>{
			  	// TEMP - TODO check if this is a junk message and if so discard or store differently
			  	// FRAGILE
			  	let dataAppearsStructurable = true

			  	if (dataAppearsStructurable){
			  		let pingAsStructure = PingData.pingTextToStructure(data.toString(), new Date())

				  	pingTarget.pingList.push(new PingData(pingAsStructure))	
			  	} 
			  
			});

			pingProcess.stderr.on('data', (data)=>{
			  	pingTarget.pingErrorList.push(new PingError(data.toString(), new Date()))
			});

			pingProcess.on('close', (code)=>{
			  	console.info(`Child process (ping) exited with code ${code}`);
			});
		}

		for ( let pingTarget of pingTargets ){
			regPingHandlers(pingTarget)
		}
	}

}

let app = new Pingu()

app.startPinging(app.pingTargets)

app.tellArchiveSize()

let connectionStatusTick = setInterval(()=>{
	app.updateInternetConnectionStatus()
	console.log(moment().format('MMMM Do YYYY hh:mm:ss') + ' Internet connected?: ' + app.updateInternetConnectionStatus().humanName)
}, app.connectionStatusIntervalMs)

let updateOutagesTick = setInterval(()=>{	
	app.updateOutages()
}, 2 * 1000)

// POSSIBLE BUG: this runs almost assuming sync, not sure if need a flag or something to make sure not actively worked on
let writeToFileTick = setInterval(()=>{
	if ( app.activeLogUri ) { 
		console.log('Writing to file. Active log URI found, using that URI.')
		app.updateSessionLog()
	} else {
		console.log('Writing to new log file.')
		app.writeSessionLog() 
	}
}, app.writeToFileIntervalMs)

let exportSessionToTextSummaryTick = setInterval(()=>{
	app.exportSessionToTextSummary()
}, 10 * 1000)









// let npSession = netPing.createSession({
// 	timeout: app.timeoutLimit,
// 	packetSize: app.pingPacketSizeBytes
// })

// let npCurrentIcmp = null

// let npPingHost = (ipv4)=>{
// 	let results = {
// 		npCurrentIcmp: npCurrentIcmp === null ? 0 : npCurrentIcmp + 1
// 	}

// 	npSession.pingHost(ipv4, (err, target, sent, rcvd)=>{
// 		if (err){
// 			if (err instanceof netPing.RequestTimedOutError){
// 				// this was a timeout
// 				console.debug('this was a timeout ' + new Date())
// 				console.debug(err)
// 				console.debug(err.source)
// 				console.debug(err.message)
// 			} else {
// 				console.debug(err)
// 				console.debug(err.source)
// 				console.debug(err.message)
// 			}
// 		} else {
// 			console.debug('sent: ', sent, 'rcvd: ', rcvd)
// 			console.debug('rtt: ', rcvd - sent)
// 			console.debug('net-ping: ' + target + ' alive')
// 			console.debug(target)
// 		}
// 	})
// }

// npSession.on ('error', (err)=>{
// 	console.debug('The underlying raw socket emitted an error')
// 	console.error(err.toString())
// 	npSession.close()
// })

// let npPingGoogle = ()=>{
// 	return npPingHost('8.8.8.8')
// }

// setInterval(npPingGoogle, app.pingIntervalMs)










// let compressLogToArchiveTick = setInterval(()=>{
// 	app.compressLogToArchive(MyUtil.filenameFromUri(app.activeLogUri))
// }, 20 * 1000)

// let compressAllLogsToArchiveTick = setInterval(()=>{
// 	app.compressAllLogsToArchive()
// }, 5 * 1000)


// TEMP: USING PRE-COOKED DATA
// let updateOutagesTick = setInterval(()=>{
// 	app.readCombinedListFromFile('./logs/test-data_frequent-disconnects.json', (fileData)=>{
// 		app.updateOutages(fileData.combinedPingList, fileData.targetList)
// 	})
// }, 2 * 1000)

