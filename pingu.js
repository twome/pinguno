console.info('RUNNING: pingu.js')

// Built-in modules
const { spawn } = require('child_process')
const fs = require('fs')
const util = require('util')
const zlib = require('zlib')
const os = require('os')

// 3rd-party dependencies
require('dotenv').config() // We only need side-effects: process.env
const { _ } = require('lodash')
const getFolderSize = require('get-folder-size')
const moment = require('moment')
const netPing = require('net-ping')
// const PubSub = require('pubsub-js') // Currently unused

// In-house modules
const { config } = require('./config.js')
const { Enum } = require('./enum.js')
const { MyUtil } = require('./my-util.js')
const { PingData, RequestError, Outage, TargetOutage, PingsLog } = require('./ping-formats.js')
const { Stats } = require('./stats.js')

const fsWriteFilePromise = util.promisify(fs.writeFile)
const fsReadFilePromise = util.promisify(fs.readFile)

class Pingu {
	constructor(options){
		this.appHumanName = 'Pingu' // must be filesystem-compatible
		this.appHumanSubtitle = 'ISP Uptime Logger'
		this.appHomepageUrl = 'https://twome.name/pingu'
		this.appSourceRepoUrl = 'https://gitlab.com/twome/pingu'

		this.connectionState = new Enum(['CONNECTED', 'DISCONNECTED', 'PENDING_RESPONSE'])

		/*
			NB: in 'net-ping's settings this is the size of the *data* I think?? From the docs: 
			> 8 bytes are required for the ICMP packet itself, then 4 bytes are required 
			> to encode a unique session ID in the request and response packets
		*/
		this.pingPacketSizeBytes = 56 // macOS inbuilt ping default 
		this.timeoutLimit = 2000 // Linux default is 2 x average RTT
		// NB: Currently using default timeout limit times
		this.pingIntervalMs = 3000
		this.badLatencyThresholdMs = 250
		// NB: ttl currently only used by 'net-ping'
		this.pingOutgoingTtlHops = 128 // Max number of hops a packet can go through before a router should delete it 
		
		this.exportSessionToTextSummaryIntervalMs = 10000
		this.updateOutagesIntervalMs = 2000
		this.connectionStatusIntervalMs = 3000
		this.writeToFileIntervalMs = 2000
		this.updateSessionEndTimeIntervalMs = 5000

		this.pingTargets = [
			{
				humanName: 'Google',
				IPV4: '8.8.8.8',
				connected: null,
				pingList: [],
				requestErrorList: []
			},
			{
				humanName: 'Level3',
				IPV4: '4.2.2.2',
				connected: null,
				pingList: [],
				requestErrorList: []
			}
		]
		this.logStandardFilename = 'pingu log'
		this.logsDir = './logs'
		this.summariesDir = './logs/human-readable' // Human-readable summary .txt files
		this.archiveDir = this.logsDir + '/compressed'
		this.pingLogIndent = 2 // Number/string: number of space chars to indent JSON log output by
		this.activeLogUri = null // URI string
		this.compressAnyJsonLogs = false // Option to allow users to compress non-standard-named JSON logs

		this.sessionStartTime = new Date()
		this.sessionEndTime = new Date()

		this.lastFailure = null // Date
		this.lastDateConnected = null // Date
		this.internetConnected = null // boolean
		this.firstPingSent = false
		this.outages = []

		// Use the inbuilt 'ping' command on Linux / Unix machines by default (more accurate latencies), 
		// and use the 'net-ping' package on Windows / unknown because it's more reliable to work at all
		// (We can't Windows' inbuilt ping because it doesn't support some features (like polling at <1sec 
		// intervals))
		this.pingEngineEnum = new Enum([{
			accessor: 'InbuiltSpawn',
			humanName: 'The OS\' native/default `ping` command-line program'
		}, {
			accessor: 'NodeNetPing',
			humanName: 'Node package `net-ping`'
		}])
		if (['darwin', 'linux', 'freebsd', 'sunos'].includes(os.platform())){
			this.pingEngine = this.pingEngineEnum.InbuiltSpawn
		} else {
			this.pingEngine = this.pingEngineEnum.NodeNetPing
		}
	}

	updateInternetConnectionStatus(){
		this.updateTargetsConnectionStatus()

		// If at least one target responds, we assume we have a working general internet connection
		for (let target of this.pingTargets){
			if (target.connected === this.connectionState.CONNECTED){
				this.lastDateConnected = new Date()
				return this.internetConnected = this.connectionState.CONNECTED
			}
		}

		return this.internetConnected = this.connectionState.DISCONNECTED
	}

	isBadResponse(ping){
	 	return ping.failure || (ping.errorType || ping.roundTripTimeMs > this.badLatencyThresholdMs)
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
		// TODO: safety-check inputs
		let pingLogTargets

		if (combinedPingList && combinedPingList.length && targetList && targetList.length ){
			// console.debug('updateOutages - Using provided ping / target lists')
			pingLogTargets = this.separatePingListIntoTargets(combinedPingList, targetList)
		} else {
			// No ping-list/target-list provided to updateOutages - using active session ping history by default.
			// console.debug('updateOutages - Using active-session ping / target lists')
			pingLogTargets = this.pingTargets
		}

		// Add TargetOutages (streaks of bad-response pings) to each target
		for (let target of pingLogTargets){

			target.targetOutages = []
			
			let currentStreak = []
			// Assumes list is chronological
			for (let ping of target.pingList){
				if (this.isBadResponse(ping)){
					if (config.nodeVerbose >= 2){ console.info(`[${ping.timeResponseReceived.toISOString()}] Bad response from ${target.IPV4}: ${ping.errorType.accessor}`) }

					currentStreak.push(ping)
					if (ping === _.last(target.pingList) ){
						target.targetOutages.push(new TargetOutage(currentStreak))
						currentStreak = []
					}
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
			fileData = MyUtil.parseJsonAndReconstitute(fileData, [PingData, RequestError, TargetOutage, Outage])

			// TEMP: Cast stringified dates to Date instances
			fileData.dateLogCreated = MyUtil.utcIsoStringToDateObj(fileData.dateLogCreated)
			fileData.dateLogLastUpdated = MyUtil.utcIsoStringToDateObj(fileData.dateLogLastUpdated)
			fileData.sessionStartTime = MyUtil.utcIsoStringToDateObj(fileData.sessionStartTime)
			fileData.sessionEndTime = MyUtil.utcIsoStringToDateObj(fileData.sessionEndTime)
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

			let receivedAnyResponse = latestPing && (typeof latestPing.roundTripTimeMs === 'number' )
			let responseWithinThreshold = latestPing && (latestPing.roundTripTimeMs <= this.badLatencyThresholdMs)

			if (receivedAnyResponse && responseWithinThreshold){
				this.lastDateConnected = new Date()
				return target.connected = this.connectionState.CONNECTED
			} else if ( latestPing && !latestPing.failure ){
				return target.connected = this.connectionState.PENDING_RESPONSE
			} else {
				this.lastFailure = new Date()
				return target.connected = this.connectionState.DISCONNECTED
			}
			
			// console.log(target.humanName + ' connected?: ' + target.connected.humanName)
		}
	}

	updateSessionEndTime(oldInstance){
		// For getting an estimate of the closest session time from sessions that ended prematurely
		if (oldInstance instanceof Pingu){
			let latest = oldInstance.latestPing()
			oldInstance.sessionEndTime = latest.timeResponseReceived || latest.timeRequestSent	
			return oldInstance
		} else if (oldInstance === undefined){
			this.sessionEndTime = new Date()
		} else {
			throw Error('updateSessionEndTime: oldInstance provided is not a Pingu instance')
		}
	}

	latestPing(target){
		if (target){
			return target.pingList[target.pingList.length - 1]	
		} else {
			console.debug('latestPing - No target specified so finding the latest ping from any target')

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
		const content = JSON.stringify(combinedTargets, null, this.pingLogIndent)
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
				console.info('Wrote log to ' + fileUri)
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
			
			toWrite = JSON.stringify(toWrite, null, this.pingLogIndent)
			
			return fsWriteFilePromise(this.activeLogUri, toWrite, 'utf8').then((file)=>{
				console.info('Updated log at ' + this.activeLogUri)
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
		let exporter = new PingsLog({
			sessionStartTime: this.sessionStartTime,
			sessionEndTime: this.sessionEndTime,
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

	exportSessionToTextSummary(indentSize/*, wrapAtCharLength*/){
		// Indent size in number of spaces
		let ind = typeof indentSize === 'number' ? Math.max(indentSize, 8) : 2
		let indString = ''
		for (let i = 0; i < ind; i = i + 1){
			indString = indString + ' '
		}
		ind = indString

		// This will overwrite any file with the same session start time
		let summaryUri = this.summariesDir + '/' + MyUtil.isoDateToFileSystemName(this.sessionStartTime) + ' pingu summary.txt'

		let template = `Pingu internet connectivity log` +
		`\nSession started: ${moment(this.sessionStartTime).format('MMMM Do YYYY hh:mm:ss ZZ')}` +
		`\nTime of last ping in session: ${moment(this.sessionEndTime).format('MMMM Do YYYY hh:mm:ss ZZ')}` +
		`\nPing interval time (in milliseconds): ${this.pingIntervalMs}` +
		`\nUnderlying ping engine used to get ping data: ${this.pingEngine.humanName}` +
		`\nMaximum round-trip time before considering a connection "down" (in milliseconds): ${this.badLatencyThresholdMs}` +
		`\nPing targets:`
		
		for (let target of this.pingTargets){
			template = template + `\n${ind}- ` + target.humanName + ' (IP: ' + target.IPV4 + ')'
		}

		template = template + '\n\nFull internet connection outages (when all target IP addresses took too long to respond):'

		if (this.outages.length >= 1){
			for (let outage of this.outages){
				let humanOutageDuration = (outage.durationSec >= this.pingIntervalMs / 1000) ? outage.durationSec : '<' + (this.pingIntervalMs / 1000)
				template = template + '\n    - ' + moment(outage.startDate).format('MMMM Do YYYY hh:mm:ss ZZ') + ', duration: ' + humanOutageDuration + ' seconds'
			}
		} else {
			template = template + `\n${ind}[No outages]`
		}

		template = template + '\n\nAll pings:'

		let combinedPingList = this.combineTargetsForExport().combinedPingList

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

		template = template + `\n\n${this.appHumanName} - ${this.appHumanSubtitle}` + `\n${this.appHomepageUrl}`
		
		template = template + `\nFree & open-source (gratis & libre)`

		// TODO: Allow option to wrap the final output to x characters for display in bad/old/CL apps
		// TODO: Potentially also allow tab character for indenting instead of just spaces
		/*if (wrapAtCharLength){
			TODOwrapToCharLength(template, wrapAtCharLength)
		}*/

		fs.mkdir(this.summariesDir, undefined, (err)=>{
			if (err) {
				// Ignore; just wanted to ensure folder exists here.
			}
			
			return fsWriteFilePromise(summaryUri, template, 'utf8').then((file)=>{
				console.info('Wrote human-readable text summary to ' + summaryUri)
				return summaryUri
			}, (error)=>{
				throw new Error(error)
			})
		})
	}

	updateSessionStats(){
		this.sessionStats = Stats.calcSessionStats(this)
		return this.sessionStats
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

	startPinging(pingTargets, pingEngine){
		let selectedPingEngine = pingEngine || this.pingEngine // Allows API user to override the default platform 'ping' engine

		for ( let pingTarget of pingTargets ){
			if (selectedPingEngine === this.pingEngineEnum.InbuiltSpawn){
				console.info('Starting pinging - Using inbuilt/native `ping`')
				this.regPingHandlersInbuilt(pingTarget)
			} else if (selectedPingEngine){
				console.info('Starting pinging - Using node package `net-ping`')
				this.regPingHandlersNetPing(pingTarget)
			} else {
				throw Error('startPinging - unknown \'ping\' engine selected: ' + selectedPingEngine)
			}
		}
	}

	// PRODUCTION TODO: Do this more thoroughly/securely (i.e. read up on it and use a tested 3rd-party lib)
	sanitizeSpawnInput(intervalNumber, ipString){
		let ret = {}

		let pin = intervalNumber
		let ips = ipString

		let intervalOk = (pin === Number(pin)) && (typeof pin === 'number')
		if (intervalOk){
			ret.intervalNumber = Math.abs(Math.floor(pin))
		} else {
			throw Error('DANGER: this.pingIntervalMs, which is used in node\'s command-line call \'spawn\', is not a number')
		}

		let nothingButDigitsAndDots = (ips.match(/[^\d\.]+/) === null)
		let ipOk = (typeof ips === 'string') && nothingButDigitsAndDots
		if (ipOk){
			ret.ipString = ips
		} else {
			throw Error('DANGER: this.pingIntervalMs, which is used in node\'s command-line call \'spawn\', is not a number')
		}

		return ret
	}

	regPingHandlersInbuilt(pingTarget){
		console.info(`Registering inbuilt ping handler for target: ${pingTarget.humanName} (${pingTarget.IPV4})`)

		// TODO: hold onto each ICMP as it gets sent out and pair it up with a new Date(); 
		// attach it to its response/timeout when that comes back.
		// - How to do this in a stream-like way? Have a stack of ICMPs (w max size) that gets popped from in onResponse?

		let sanitizedSpawnInput = this.sanitizeSpawnInput(this.pingIntervalMs, pingTarget.IPV4)

		const pingProcess = spawn('ping', [
			'-i', 
			sanitizedSpawnInput.intervalNumber / 1000, // Mac ping -i supports fractional intervals but <= 0.1s requires su privilege 
			sanitizedSpawnInput.ipString
		])

		this.firstPingSent = true

		pingProcess.on('error', (code, signal)=>{
			console.error('child process hit an error with ' + `code ${code} and signal ${signal}`)
			throw Error('Node child process hit an error')
		})

		pingProcess.stdout.on('data', (data)=>{
	  		let pingAsStructure = PingData.pingTextToStructure(data.toString(), new Date())
		  	pingTarget.pingList.push(new PingData(pingAsStructure))	
		})

		pingProcess.stderr.on('data', (data)=>{
			console.err('inbuilt ping returned error through stderr:')
			console.err(data)
			// TODO: sort stderr errors into error types before storing
		  	pingTarget.requestErrorList.push(new RequestError(RequestError.errorTypes.unknownError, new Date(), new Date(), data.toString()))
		})

		pingProcess.on('close', (code)=>{
		  	console.info(`Child process (ping) closed with code ${code}`)
		})

		pingProcess.on('exit', (code)=>{
		  	console.info(`Child process (ping) exited with code ${code}`)
		})

		return true
	}

	regPingHandlersNetPing(pingTarget){
		console.info(`Registering 'net-ping' handler for target: ${pingTarget.humanName} (${pingTarget.IPV4})`)

		let npOptions = {
			timeout: this.timeoutLimit,
			packetSize: this.pingPacketSizeBytes,
			ttl: this.pingOutgoingTtlHops
		}

		let npSession = netPing.createSession(npOptions)

		let currentIcmp = null
		let unpairedRequests = []

		let pingHost = (ipv4)=>{
			currentIcmp = currentIcmp === null ? 0 : currentIcmp + 1
			let contextIcmp = currentIcmp

			let req = {
				icmpSeq: contextIcmp,
				timeRequestSent: new Date()
			}
			unpairedRequests.push(req)

			let res = {
				failure: null,
				errorType: undefined
			}

			let instance = this // 'this' will refer to net-ping's internal context
			npSession.pingHost(ipv4, (err, target, sent, rcvd)=>{
				instance.processNetPingResponse(err, target, sent, rcvd, req, res, unpairedRequests, pingTarget)
			})
		}	

		npSession.on('error', (err)=>{
			console.error(err.toString())
			npSession.close()

			throw Error('net-ping\'s underlying raw socket emitted an error')
		})

		let npPingChosenTarget = ()=>{
			this.firstPingSent = true
			return pingHost(pingTarget.IPV4)
		}

		let targetPingingTick = setInterval(npPingChosenTarget, this.pingIntervalMs)

		return true
	}

	// Needs net-ping 
	processNetPingResponse(err, target, sent, rcvd, req, res, unpairedRequests, pingTarget){
		res.icmpSeq = req.icmpSeq // num
		res.timeRequestSent = sent // Date - can be undefined if error
		res.timeResponseReceived = rcvd // Date - can be undefined if error

		// TODO: this needs to account for errors that occur within/deeper than net-ping (try/catch?)
		if (err){
			res.failure = true
			for (let supportedErrorStr of [
				'RequestTimedOutError',
				'DestinationUnreachableError',
				'PacketTooBigError',
				'ParameterProblemError',
				'RedirectReceivedError',
				'SourceQuenchError',
				'TimeExceededError'
			]){
				if (err instanceof netPing[supportedErrorStr]){
					let netPingToInternalError = {
						RequestTimedOutError: 'requestTimedOutError',
						DestinationUnreachableError: 'destinationUnreachableError',
						PacketTooBigError: 'packetTooBigError',
						ParameterProblemError: 'parameterProblemError',
						RedirectReceivedError: 'redirectReceivedError',
						SourceQuenchError: 'sourceQuenchError',
						TimeExceededError: 'timeExceededError'
					}
					// Convert between net-ping's and our own errors
					res.errorType = PingData.errorTypes[netPingToInternalError[supportedErrorStr]]
				} else {
					let handled = false

					// NB: Errors emitted from raw-socket when network adapter turned off on macOS
					// Should have been handled by netPing 
					if (err.toString().match(/No route to host/)){
						res.errorType = PingData.errorTypes.destinationUnreachableError
						handled = true
					}
					if (err.toString().match(/Network is down/)){
						res.errorType = PingData.errorTypes.networkDownError
						handled = true
					}

					if (!handled){
						// Unknown misc error
						console.error('processNetPingResponse: Unknown net-ping response error:')
						console.error(err)

						res.errorType = PingData.errorTypes.unknownError
						// PRODUCTION TODO: take this throw out; more important to stay running than identify unhandled errors
						if (process.env.NODE_ENV === 'development'){
							console.error(err)
							throw Error('processNetPingResponse - Unhandled error:', err)	
						}	
					}
					
				}
			}
			pingTarget.pingList.push(new PingData(res))

		} else {
			// Successful response
			res.failure = false
			res.roundTripTimeMs = rcvd - sent // num - we only bother to calc if both vals are truthy
			// TODO: how to get response size in net-ping? seems impossible
			// TODO: how to get response ttl in net-ping (it's not the same as request ttl)? seems impossible
			
			pingTarget.pingList.push(new PingData(res))
		}

		for (let requestIndex in unpairedRequests){
			if (unpairedRequests[requestIndex].icmpSeq === res.icmpSeq){
				unpairedRequests.splice(requestIndex, 1)
			}
		}

		// TEMP
		if (unpairedRequests.length > 10){
			console.debug('=== Unpaired requests piling up...')
			console.debug(unpairedRequests)
		}

		return {
			req: req,
			res: res,
			unpairedRequests: unpairedRequests
		}
	}
}

exports.Pingu = Pingu