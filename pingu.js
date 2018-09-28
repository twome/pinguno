console.info('RUNNING: pingu.js')

// Built-in modules
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const zlib = require('zlib')
const os = require('os')

// 3rd-party dependencies
const { _ } = require('lodash')
const getFolderSize = require('get-folder-size')
const moment = require('moment')
const netPing = require('net-ping')

// In-house modules
const { config } = require('./config.js')
const { fullOutagesAcrossTargets } = require('./outages.js')
const { Enum } = require('./enum.js')
const { MyUtil } = require('./my-util.js')
const { PingData, RequestError, Outage, TargetOutage, PingsLog } = require('./ping-formats.js')
const { EngineNative, EngineNetPing } = require('./ping-engines.js')
const { Stats } = require('./stats.js')

class Pingu {
	constructor(options){
		/*
			Hard-coded app meta-information
		*/
		this.appHumanName = 'Pingu' // must be filesystem-compatible
		this.appHumanSubtitle = 'ISP Uptime Logger'
		this.appHomepageUrl = new URL('https://twome.name/pingu')
		this.appSourceRepoUrl = new URL('https://gitlab.com/twome/pingu')

		/*
			Options
		*/
		let opt = {}
		/*
			NB: in 'net-ping's settings this is the size of the *data* I think?? From the docs: 
			> 8 bytes are required for the ICMP packet itself, then 4 bytes are required 
			> to encode a unique session ID in the request and response packets
		*/
		opt.pingPacketSizeBytes = 56 // macOS inbuilt ping default 
		opt.timeoutLimit = 2000 // Linux default is 2 x average RTT
		// NB: Currently using default timeout limit times
		opt.pingIntervalMs = 3000
		opt.badLatencyThresholdMs = 250
		// NB: ttl currently only used by 'net-ping'
		opt.pingOutgoingTtlHops = 128 // Max number of hops a packet can go through before a router should delete it 
		
		opt.exportSessionToTextSummaryIntervalMs = 10000
		opt.updateOutagesIntervalMs = 2000
		opt.connectionStatusIntervalMs = 3000
		opt.writeToFileIntervalMs = 2000
		opt.updateSessionEndTimeIntervalMs = 5000
		opt.updateSessionStatsIntervalMs = 5000

		opt.desiredPingTargets = [
			{
				humanName: 'Google',
				IPV4: '8.8.8.8'
			},{
				// IP belonging to company formerly named 'Level3' before merger; a popular pinging target host.
				humanName: 'CenturyLink', 
				IPV4: '4.2.2.2'
			}
		]

		opt.logStandardFilename = 'pingu log'
		opt.logsDir = path.normalize('logs')
		opt.summariesDir = path.join(opt.logsDir, '/human-readable') // Human-readable summary .txt files
		opt.archiveDir = path.join(opt.logsDir, '/compressed')
		opt.pingLogIndent = 2 // Number/string: number of space chars to indent JSON log output by
		opt.activeLogUri = null // URI string
		opt.compressAnyJsonLogs = false // Option to allow users to compress non-standard-named JSON logs
		opt.maxUncompressedSizeMiB = 100 // Maximum size of JSON log directory to reach before running a compression on all uncompressed logs, in MiB

		// Maximum MiB size to temporarily allow the program to require when decompressing all archives (just prior to recompressing in a new archive)
		opt.maxDecompressionHeadroomMiB = 1000 

		// If the total uncompressed JSON + compressed archive size is greater than this, start refusing to create new files and kick up a stink
		opt.neverExceedSizeMiB = 2000 

		// Boolean: use the terminal user's current working directory as the relative base of Pingu-related paths
		// (instead of the directory of the Pingu app files)
		opt.pathsRelativeToUserCwd = false 

		// Replace default options with passed-in options
		if (options && typeof options === 'object'){
			Object.assign(opt, options)
		}
		this.opt = opt

		/*
			App state properties
		*/
		this.appPath = __filename
		// At built-time, pkg moves references to local files to a virtual folder /snapshot/
		// We're going to use this to check whether this program is running from inside a pkg'd executable
		let snapshotIsFirstFolder = String.prototype.split.call(process.cwd(), path.sep)[1] === 'snapshot'
		this.runningInPkgExecutable = !!(process.pkg && (process.pkg.entrypoint || snapshotIsFirstFolder))
		if (this.runningInPkgExecutable && config.nodeVerbose >= 2){
			console.info('Pingu is running from within a pkg-built executable.')
		}
		this.appDir = opt.pathsRelativeToUserCwd ? process.cwd : __dirname
		if (this.runningInPkgExecutable){
			this.appDir = opt.pathsRelativeToUserCwd ? __dirname : process.execPath
		}
		console.info(
			`Pingu's main directory for this session: ${this.appDir}` + 
			`\nPingu will write logs to ${path.join(this.appDir, opt.logsDir)}` + 
			`\nPingu will write human-readable summaries to ${path.join(this.appDir, opt.summariesDir)}` + 
			`\nPingu will compress logs archives to ${path.join(this.appDir, opt.archiveDir)}\n`
		)

		this.connectionState = new Enum(['CONNECTED', 'DISCONNECTED', 'PENDING_RESPONSE'])

		this.pingTargets = _.cloneDeep(opt.desiredPingTargets)
		for (let target of this.pingTargets){
			target = Object.assign(target, {
				connected: null,
				pingList: [],
				requestErrorList: []
			})
		}

		this.sessionStartTime = new Date()
		this.sessionEndTime = new Date()
		this.sessionStats = {}

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

	updateOutages(combinedPingList, targetList){
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

		let outageData = fullOutagesAcrossTargets(pingLogTargets, this.opt.badLatencyThresholdMs)

		this.outages = outageData.fullOutages

		for (let origTarget of this.pingTargets){
			for (let processedTarget of outageData.targets){
				if (origTarget.IPV4 === processedTarget.IPV4){
					origTarget.targetOutages = processedTarget.targetOutages
				}
			}
		}

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
			let responseWithinThreshold = latestPing && (latestPing.roundTripTimeMs <= this.opt.badLatencyThresholdMs)

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

	// Interleave the ping-targets with their individual ping-lists into one shared ping list
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

		// Sort the aggregate ping list 1) chronologically 2) by target IP
		let pingListSorted = _.sortBy(exporter.combinedPingList, [(o)=>{return o.timeResponseReceived}, (o)=>{return o.targetIPV4}])
		exporter.combinedPingList = pingListSorted

		return exporter
	}

	getArchiveSize(callback){
		if (! fs.existsSync(this.opt.logsDir)){
			return false
		}
		getFolderSize(this.opt.logsDir, (err, size)=>{
			if (err) { throw err }
			let sizeInMiB = (size / 1024 / 1024).toFixed(2)
			callback(sizeInMiB)
		})
	}

	tellArchiveSize(){
		this.getArchiveSize((sizeInMiB)=>{
			if ( sizeInMiB ){
				console.info(`Archive size: ${sizeInMiB} MiB`)
			} else {
				console.info('No pre-existing archive folder.')
			}	
		})
	}

	updateSessionStats(){
		this.sessionStats = Stats.calcSessionStats(this)
		return this.sessionStats
	}

	startPinging(pingTargets, pingEngine){
		let selectedPingEngine = pingEngine || this.pingEngine // Allows API user to override the default platform 'ping' engine

		for ( let pingTarget of pingTargets ){
			if (selectedPingEngine === this.pingEngineEnum.InbuiltSpawn){
				console.info('Starting pinging - Using inbuilt/native `ping`')
				EngineNative.regPingHandlersInbuilt(this, pingTarget)
			} else if (selectedPingEngine){
				console.info('Starting pinging - Using node package `net-ping`')
				EngineNetPing.regPingHandlersNetPing(this, pingTarget)
			} else {
				throw Error('startPinging - unknown \'ping\' engine selected: ' + selectedPingEngine)
			}
		}
	}
}

exports.Pingu = Pingu