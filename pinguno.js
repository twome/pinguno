// Built-in modules
const fs = require('fs')
const path = require('path')
const os = require('os')

// 3rd-party dependencies
const { _ } = require('lodash') // cloneDeep, sortBy, last
const getFolderSize = require('get-folder-size')

// In-house modules
import { config } from './config.js'
import { fullOutagesAcrossTargets, isBadResponse } from './outages.js'
import { Enum } from './util-iso.js'
import { EngineNative, EngineNetPing } from './ping-engines.js'
import { Stats } from './stats.js'

// Extensions of this module's main class
import { attachExtensions } from './pinguno-ext-fs.js'

// Convenience / shorthands
let inDev = process.env.NODE_ENV === 'development'

// Option enums
let connectionState = new Enum(['CONNECTED', 'DISCONNECTED', 'PENDING_RESPONSE'])

class Pinguno {
	constructor(options){
		/*
			Hard-coded app meta-information
		*/
		this.appHumanName = 'Pinguno' // must be filesystem-compatible
		this.appHumanSubtitle = 'ISP Uptime Logger'
		this.appHomepageUrl = new URL('https://twome.name/pinguno')
		this.appSourceRepoUrl = new URL('https://gitlab.com/twome/pinguno')

		/*
			Options
		*/
		let opt = {}

		// Individual ping settings
		/*
			NB: in 'net-ping's settings this is the size of the *data* I think?? From the docs: 
			> 8 bytes are required for the ICMP packet itself, then 4 bytes are required 
			> to encode a unique session ID in the request and response packets
		*/
		opt.pingPacketSizeBytes = 56 // macOS inbuilt ping default 
		opt.timeoutLimit = 2000 // Linux default is 2 x average RTT
		// NB: Currently using default timeout limit times
		opt.pingIntervalMs = inDev ? 1000 : 3000
		opt.badLatencyThresholdMs = 250
		// NB: TTL currently only used by 'net-ping'
		opt.pingOutgoingTtlHops = 128 // Max number of hops a packet can go through before a router should delete it 
		
		opt.exportSessionToTextSummaryIntervalMs = inDev ? 4000 :10000
		opt.updateOutagesIntervalMs = inDev ? 500 : 2000
		opt.connectionStatusIntervalMs = inDev ? 2000 : 3000
		opt.writeToFileIntervalMs = 2000
		opt.updateSessionEndTimeIntervalMs = inDev ? 1000 : 5000
		opt.updateSessionStatsIntervalMs = inDev ? 10000 : 20000

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

		// Logging
		opt.logStandardFilename = 'pinguno log'
		opt.logsDir = 'logs'
		opt.summariesDir = 'human-readable' // Human-readable summary .txt files
		opt.archiveDir = 'compressed'
		opt.configDir = 'config'
		opt.configLastUsedPath = 'pinguno-last-settings.json'
		opt.luxonDateFormatShortPrecise = 'yyyy-LL-dd HH:mm:ss.SSS' // Custom date output format for Luxon (date library)
		opt.pingLogIndent = 2 // Number/string: number of space chars to indent JSON log output by
		opt.wrapHumanLogAtCharLength = false // Number/falsey: number of characters-per-line to hard-wrap log output to
		opt.activeLogUri = null // URI string
		opt.compressAnyJsonLogs = false // Option to allow users to compress non-standard-named JSON logs
		opt.maxUncompressedSizeMiB = 100 // Maximum size of JSON log directory to reach before running a compression on all uncompressed logs, in MiB

		// Maximum MiB size to temporarily allow the program to require when decompressing all archives (just prior to recompressing in a new archive)
		opt.maxDecompressionHeadroomMiB = 1000 

		// If the total uncompressed JSON + compressed archive size is greater than this, start refusing to create new files and kick up a stink
		opt.neverExceedSizeMiB = 2000 

		// Boolean: use the terminal user's current working directory as the relative base of Pinguno-related paths
		// (instead of the directory of the Pinguno app files)
		opt.pathsRelativeToUserCwd = false 

		// Replace default options with passed-in options
		if (options && typeof options === 'object'){
			Object.assign(opt, options)
		}
		this.opt = opt

		/*
			# App state properties
		*/
		// At build-time, pkg moves references to local files to a virtual folder /snapshot/
		// We're going to use this to check whether this program is running from inside a pkg'd executable
		let snapshotIsFirstFolder = String.prototype.split.call(process.cwd(), path.sep)[1] === 'snapshot'
		this.runningInPkgExecutable = !!(process.pkg && (process.pkg.entrypoint || snapshotIsFirstFolder))

		/*
			## Path resolution
		*/
		this.appPath = __filename

		this.appDir = opt.pathsRelativeToUserCwd ? process.cwd : __dirname
		if (this.runningInPkgExecutable){
			// process.execPath will point to the executable's location and *won't* be overriden by pkg to relate to 'snapshot'
			this.appDir = opt.pathsRelativeToUserCwd ? __dirname : path.dirname(process.execPath)
		}
		// Combine the directory names into proper path strings
		this.configDir = path.join(this.appDir, opt.configDir)
		this.configLastUsedPath = path.join(opt.configDir, opt.configLastUsedPath)
		this.logsDir = path.join(this.appDir, opt.logsDir)
		this.summariesDir = path.join(opt.logsDir, opt.summariesDir)
		this.archiveDir = path.join(opt.logsDir, opt.archiveDir)

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

		// Has this session's state changed since it was last saved?
		this.sessionDirty = false

		this.lastDateFailed = null // Date
		this.lastDateConnected = null // Date
		this.internetConnected = connectionState.PENDING_RESPONSE // connectionState
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

		// Keep track of child processes (such as ping) we spawn
		this.processRoster = []
	}

	tellStatus(){
		if (this.runningInPkgExecutable && config.NODE_VERBOSE >= 2){
			console.info('Pinguno is running from within a pkg-built executable.')
		}
		console.info(
			`Pinguno's main directory for this session: ${this.appDir}` + 
			`\nPinguno will write logs to ${path.join(this.appDir, this.logsDir)}` + 
			`\nPinguno will write human-readable summaries to ${path.join(this.appDir, this.summariesDir)}` + 
			`\nPinguno will compress logs archives to ${path.join(this.appDir, this.archiveDir)}\n`
		)
		this.tellArchiveSize()
	}

	getArchiveSizeMiB(callback){
		if (! fs.existsSync(this.logsDir)){
			return false
		}
		getFolderSize(this.logsDir, (err, size)=>{
			if (err) { throw err }
			let sizeInMiB = (size / 1024 / 1024).toFixed(2)
			callback(sizeInMiB)
		})
	}

	tellArchiveSize(){
		this.getArchiveSizeMiB((sizeInMiB)=>{
			if ( sizeInMiB ){
				console.info(`Archive size: ${sizeInMiB} MiB`)
			} else {
				console.info('No pre-existing archive folder.')
			}	
		})
	}

	updateTargetConnectionStatus(target){
		let targetLatestPing = this.latestPing(target)
		if (targetLatestPing === undefined){
			target.connected = connectionState.PENDING_RESPONSE
			target.lastDateConnected = null
			target.lastDateFailed = null
			return null
		} 

		let latestGoodPing = this.latestPing(target, true)
		let latestBadPing = this.latestPing(target, false)
		if ( isBadResponse(targetLatestPing, this.opt.badLatencyThresholdMs) ){
			target.connected = connectionState.DISCONNECTED
			target.lastDateConnected = latestGoodPing && latestGoodPing.timeResponseReceived
			target.lastDateFailed = latestBadPing && latestBadPing.timeResponseReceived
			return false
		}

		// Can assume we had a connection at some point by this stage in the function
		let targetLastConnectedTimeMs = targetLatestPing.timeResponseReceived.getTime()
		if ( targetLastConnectedTimeMs - new Date().getTime() <= this.opt.timeoutLimit ){
			target.connected = connectionState.CONNECTED
			target.lastDateConnected = targetLatestPing.timeResponseReceived
			target.lastDateFailed = latestBadPing && latestBadPing.timeResponseReceived
			return true
		}
	}

	updateGlobalConnectionStatus(){
		let isXLaterThanY = (x, y, dateProp)=>{
			if (!x[dateProp] || !y[dateProp]){ return null }
			return Math.sign(x[dateProp] - y[dateProp]) >= 0 
		}

		for (let target of this.pingTargets){	
			this.updateTargetConnectionStatus(target)
			
			if (isXLaterThanY(target, this, 'lastDateConnected')){
				this.lastDateConnected = target.lastDateConnected
			}
			if (isXLaterThanY(target, this, 'lastDateFailed')){
				this.lastDateFailed = target.lastDateFailed
			}

			// If at least one target responds, we assume we have a working general internet connection
			if (target.connected === connectionState.CONNECTED){
				return this.internetConnected = connectionState.CONNECTED
			}
		}

		return this.internetConnected = connectionState.DISCONNECTED
	}

	updateOutages(combinedPingList, targetList){
		let pingLogTargets

		if (combinedPingList && combinedPingList.length && targetList && targetList.length ){
			pingLogTargets = this.separatePingListIntoTargets(combinedPingList, targetList)
		} else {
			// No ping-list/target-list provided to updateOutages - using active session ping history by default.
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

	updateSessionEndTime(oldInstance){
		if (oldInstance instanceof Pinguno){ // For getting an estimate of the closest session time from sessions that ended prematurely
			let latest = oldInstance.latestPing()
			oldInstance.sessionEndTime = latest.timeResponseReceived || latest.timeRequestSent	
			return oldInstance
		} else if (oldInstance === undefined){
			this.sessionEndTime = new Date()
			this.sessionDirty = true
		} else {
			throw Error('updateSessionEndTime: oldInstance provided is not a Pinguno instance')
		}
	}

	// If we specify a target, this is the latest ping within that target. 
	// If we specify "iterateUntilGoodPing" as true or false, then find the latest *good* or *bad* ping, respectively.
	latestPing(target, iterateUntilGoodPing){
		let latestEachTarget = []
		let latestPingOfTarget = (target)=>{
			let sortedPings = _.sortBy(target.pingList, p => p.icmpSeq)
			var i = target.pingList.length - 1
			if (typeof iterateUntilGoodPing === 'boolean'){
				for (; i > 0; i = i - 1){
					if (isBadResponse(sortedPings[i]) === !iterateUntilGoodPing){
						return sortedPings[i]
					}
				}
				return undefined // No ping that fits our demand for "good" or "bad"
			}
			return sortedPings[i]
		}

		if (target){
			return latestPingOfTarget(target)	
		} else {
			for (let target in this.targets ){
				latestEachTarget.push(latestPingOfTarget(target)) 
			}
			return _.last(_.sortBy(latestEachTarget, p => p.icmpSeq))
		}
	}

	updateEntireState(){
		this.updateSessionEndTime()
		this.updateOutages()
		this.updateGlobalConnectionStatus()
		this.updateSessionStats()
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

	static getPingFromIcmpTarget (session, icmpSeq, targetIPV4){
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

	updateSessionStats(){
		this.sessionStats = new Stats(this)
		this.sessionDirty = true
		return this.sessionStats
	}

	startPinging(pingTargets, pingEngine){
		let selectedPingEngine = pingEngine || this.pingEngine // Allows API user to override the default platform 'ping' engine
		let registerEngineFn
		if (selectedPingEngine === this.pingEngineEnum.InbuiltSpawn){
			console.info('Starting pinging - Using inbuilt/native `ping`')
			registerEngineFn = EngineNative.regPingHandlersInbuilt
		} else if (selectedPingEngine === this.pingEngineEnum.NodeNetPing){
			console.info('Starting pinging - Using node package `net-ping`')
			registerEngineFn = EngineNetPing.regPingHandlersNetPing
		} else {
			throw Error('startPinging - unknown \'ping\' engine selected: ' + selectedPingEngine)
		}

		if (!inDev) console.info('Press Control+C to stop process.')
		
		// Before we start doing anything, save this session's active settings/config
		this.saveSessionConfigToJSON((promise)=>{
			promise.then((val)=>{
				console.info('Saved Pinguno settings to ' + val)
			}, (err)=>{throw Error(err)})	
		})

		for ( let pingTarget of pingTargets ){				
			let returnedEngine = registerEngineFn(this, pingTarget)
			if (returnedEngine.pid){
				// Engine is a node_spawn'd process
				this.processRoster.push({
					processName: 'ping' + pingTarget.humanName,
					actualProcess: returnedEngine
				})
			}
		}
	}

	shutDown(){
		this.processRoster.forEach((obj, i)=>{
			console.info(`[pinguno:shutDown] Exiting subprocess ${obj.processName}`)
			process.kill(obj.actualProcess.pid, 'SIGTERM')
		})
		return this.processRoster
	}
}
 
attachExtensions(Pinguno) // Attach class def extensions from pinguno-ext-fs.js to Pinguno 

export { Pinguno, connectionState }